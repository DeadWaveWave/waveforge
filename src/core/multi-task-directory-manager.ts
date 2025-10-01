/**
 * MultiTaskDirectoryManager - 多任务目录管理器
 * 负责管理基于日期和slug的多任务目录结构
 * 目录格式：.wave/tasks/YYYY/MM/DD/<slug>--<id8>/
 */

import fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger.js';
import { PanelRenderer, createPanelRenderer } from './panel-renderer.js';
import {
  LogCategory,
  LogAction,
  type CurrentTask,
  type TaskDirectoryInfo,
  type TaskArchive,
} from '../types/index.js';

/**
 * 多任务目录管理器
 */
export class MultiTaskDirectoryManager {
  private docsPath: string;
  private tasksBasePath: string;
  private panelRenderer: PanelRenderer;

  constructor(docsPath: string) {
    if (!docsPath || docsPath.trim() === '') {
      throw new Error('docsPath 不能为空');
    }
    this.docsPath = docsPath.trim();
    this.tasksBasePath = path.join(this.docsPath, 'tasks');
    this.panelRenderer = createPanelRenderer();
  }

  /**
   * 获取任务基础路径
   */
  getTasksBasePath(): string {
    return this.tasksBasePath;
  }

  /**
   * 生成任务目录信息
   */
  generateTaskDirectoryInfo(task: CurrentTask): TaskDirectoryInfo {
    const date = new Date(task.created_at);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    // 生成短ID（ULID前8位）
    const shortId = task.id.substring(0, 8);

    // 限制slug长度以避免文件名过长
    // 考虑到路径长度限制，slug最多保留100个字符
    let safeSlug = task.slug;
    if (safeSlug.length > 100) {
      safeSlug = safeSlug.substring(0, 100);
    }

    // 生成目录名称：<slug>--<id8>
    const dirName = `${safeSlug}--${shortId}`;

    // 生成相对路径：YYYY/MM/DD/<slug>--<id8>
    const relativePath = path.join(year, month, day, dirName);

    // 生成完整路径
    const fullPath = path.join(this.tasksBasePath, relativePath);

    return {
      taskId: task.id,
      slug: task.slug, // 保留原始slug
      date,
      fullPath,
      relativePath,
      dirName,
      shortId,
    };
  }

  /**
   * 解析任务目录路径
   */
  parseTaskDirectoryPath(taskDir: string): TaskDirectoryInfo | null {
    try {
      // 移除基础路径前缀
      const relativePath = path.relative(this.tasksBasePath, taskDir);
      const parts = relativePath.split(path.sep);

      if (parts.length !== 4) {
        return null;
      }

      const [year, month, day, dirName] = parts;

      // 验证年月日格式
      if (
        !/^\d{4}$/.test(year) ||
        !/^\d{2}$/.test(month) ||
        !/^\d{2}$/.test(day)
      ) {
        return null;
      }

      // 解析目录名称：<slug>--<id8>
      const dirNameMatch = dirName.match(/^(.+)--([A-Z0-9]{8})$/);
      if (!dirNameMatch) {
        return null;
      }

      const [, slug, shortId] = dirNameMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      return {
        taskId: '', // 需要从任务文件中读取完整ID
        slug,
        date,
        fullPath: taskDir,
        relativePath,
        dirName,
        shortId,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '解析任务目录路径失败', {
        taskDir,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 创建任务目录
   */
  async createTaskDirectory(task: CurrentTask): Promise<TaskDirectoryInfo> {
    try {
      const dirInfo = this.generateTaskDirectoryInfo(task);

      // 确保目录存在
      await fs.ensureDir(dirInfo.fullPath);

      logger.info(LogCategory.Task, LogAction.Create, '任务目录创建成功', {
        taskId: task.id,
        taskDir: dirInfo.fullPath,
        relativePath: dirInfo.relativePath,
      });

      return dirInfo;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '任务目录创建失败', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取任务文件路径
   */
  getTaskFilePaths(dirInfo: TaskDirectoryInfo): TaskArchive['files'] {
    return {
      taskJson: path.join(dirInfo.fullPath, 'task.json'),
      currentMd: path.join(dirInfo.fullPath, 'current.md'),
      logsJsonl: path.join(dirInfo.fullPath, 'logs.jsonl'),
    };
  }

  /**
   * 保存任务到目录
   */
  async saveTaskToDirectory(task: CurrentTask): Promise<TaskArchive> {
    try {
      const dirInfo = await this.createTaskDirectory(task);
      const filePaths = this.getTaskFilePaths(dirInfo);

      // 保存任务数据到 task.json
      await fs.writeFile(
        filePaths.taskJson,
        JSON.stringify(task, null, 2),
        'utf8'
      );

      // 生成当前任务文档到 current.md
      const currentMd = this.generateCurrentTaskMarkdown(task);
      await fs.writeFile(filePaths.currentMd, currentMd, 'utf8');

      // 保存结构化日志到 logs.jsonl
      await this.saveLogsToJsonl(task.logs, filePaths.logsJsonl);

      const archive: TaskArchive = {
        task,
        archivePath: dirInfo.relativePath,
        archivedAt: new Date().toISOString(),
        taskDir: dirInfo.fullPath,
        files: filePaths,
      };

      logger.info(LogCategory.Task, LogAction.Create, '任务保存到目录成功', {
        taskId: task.id,
        taskDir: dirInfo.fullPath,
        filesCreated: Object.keys(filePaths).length,
      });

      return archive;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '任务保存到目录失败', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 从目录加载任务
   */
  async loadTaskFromDirectory(taskDir: string): Promise<CurrentTask | null> {
    try {
      const taskJsonPath = path.join(taskDir, 'task.json');

      if (!(await fs.pathExists(taskJsonPath))) {
        return null;
      }

      const taskData = await fs.readFile(taskJsonPath, 'utf8');
      const task = JSON.parse(taskData) as CurrentTask;

      // 验证任务数据结构
      this.validateTaskData(task);

      logger.info(LogCategory.Task, LogAction.Handle, '从目录加载任务成功', {
        taskId: task.id,
        taskDir,
      });

      return task;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '从目录加载任务失败', {
        taskDir,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 更新任务目录中的文件
   */
  async updateTaskInDirectory(
    task: CurrentTask,
    taskDir: string
  ): Promise<void> {
    try {
      const filePaths = {
        taskJson: path.join(taskDir, 'task.json'),
        currentMd: path.join(taskDir, 'current.md'),
        logsJsonl: path.join(taskDir, 'logs.jsonl'),
      };

      // 更新任务数据
      await fs.writeFile(
        filePaths.taskJson,
        JSON.stringify(task, null, 2),
        'utf8'
      );

      // 更新当前任务文档
      const currentMd = this.generateCurrentTaskMarkdown(task);
      await fs.writeFile(filePaths.currentMd, currentMd, 'utf8');

      // 更新结构化日志
      await this.saveLogsToJsonl(task.logs, filePaths.logsJsonl);

      logger.info(LogCategory.Task, LogAction.Update, '任务目录更新成功', {
        taskId: task.id,
        taskDir,
      });
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Update, '任务目录更新失败', {
        taskId: task.id,
        taskDir,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找任务目录
   */
  async findTaskDirectory(taskId: string): Promise<string | null> {
    try {
      // 获取短ID用于匹配
      const shortId = taskId.substring(0, 8);

      // 遍历年份目录
      const tasksDir = this.tasksBasePath;
      if (!(await fs.pathExists(tasksDir))) {
        return null;
      }

      const years = await fs.readdir(tasksDir);

      for (const year of years) {
        const yearPath = path.join(tasksDir, year);
        if (!(await fs.stat(yearPath)).isDirectory()) continue;

        const months = await fs.readdir(yearPath);

        for (const month of months) {
          const monthPath = path.join(yearPath, month);
          if (!(await fs.stat(monthPath)).isDirectory()) continue;

          const days = await fs.readdir(monthPath);

          for (const day of days) {
            const dayPath = path.join(monthPath, day);
            if (!(await fs.stat(dayPath)).isDirectory()) continue;

            const taskDirs = await fs.readdir(dayPath);

            for (const taskDirName of taskDirs) {
              if (taskDirName.endsWith(`--${shortId}`)) {
                const taskDir = path.join(dayPath, taskDirName);

                // 验证是否确实是目标任务
                const task = await this.loadTaskFromDirectory(taskDir);
                if (task && task.id === taskId) {
                  return taskDir;
                }
              }
            }
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '查找任务目录失败', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 列出所有任务目录
   */
  async listAllTaskDirectories(): Promise<TaskDirectoryInfo[]> {
    try {
      const taskDirs: TaskDirectoryInfo[] = [];
      const tasksDir = this.tasksBasePath;

      if (!(await fs.pathExists(tasksDir))) {
        return taskDirs;
      }

      const years = await fs.readdir(tasksDir);

      for (const year of years) {
        const yearPath = path.join(tasksDir, year);
        if (!(await fs.stat(yearPath)).isDirectory()) continue;

        const months = await fs.readdir(yearPath);

        for (const month of months) {
          const monthPath = path.join(yearPath, month);
          if (!(await fs.stat(monthPath)).isDirectory()) continue;

          const days = await fs.readdir(monthPath);

          for (const day of days) {
            const dayPath = path.join(monthPath, day);
            if (!(await fs.stat(dayPath)).isDirectory()) continue;

            const taskDirNames = await fs.readdir(dayPath);

            for (const taskDirName of taskDirNames) {
              const taskDir = path.join(dayPath, taskDirName);
              if (!(await fs.stat(taskDir)).isDirectory()) continue;

              const dirInfo = this.parseTaskDirectoryPath(taskDir);
              if (dirInfo) {
                // 尝试从任务文件中获取完整的任务ID
                const task = await this.loadTaskFromDirectory(taskDir);
                if (task) {
                  dirInfo.taskId = task.id;
                  taskDirs.push(dirInfo);
                }
              }
            }
          }
        }
      }

      // 按创建时间排序
      taskDirs.sort((a, b) => b.date.getTime() - a.date.getTime());

      return taskDirs;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '列出任务目录失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 删除任务目录
   */
  async deleteTaskDirectory(taskDir: string): Promise<void> {
    try {
      if (await fs.pathExists(taskDir)) {
        await fs.remove(taskDir);

        logger.info(LogCategory.Task, LogAction.Handle, '任务目录删除成功', {
          taskDir,
        });
      }
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '任务目录删除失败', {
        taskDir,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // 私有辅助方法

  /**
   * 生成当前任务的Markdown文档（使用 PanelRenderer）
   */
  private generateCurrentTaskMarkdown(task: CurrentTask): string {
    // 将 CurrentTask 转换为 ParsedPanel 格式
    const panelData = this.convertTaskToPanelData(task);

    // 使用 PanelRenderer 渲染
    return this.panelRenderer.renderToMarkdown(panelData);
  }

  /**
   * 将 CurrentTask 转换为 ParsedPanel 格式
   */
  private convertTaskToPanelData(task: CurrentTask): any {
    return {
      title: task.title,
      taskId: task.id,
      references: task.knowledge_refs || [],
      requirements: [task.goal],
      issues: [],
      hints: task.task_hints || [],
      plans: (task.overall_plan || []).map(plan => ({
        id: plan.id,
        text: plan.description,
        status: plan.status,
        hints: plan.hints || [],
        contextTags: plan.contextTags || [],
        evrBindings: plan.evrBindings || [],
        steps: (plan.steps || []).map(step => ({
          id: step.id,
          text: step.description,
          status: step.status,
          hints: step.hints || [],
          contextTags: step.contextTags || [],
          usesEVR: [],
        })),
      })),
      evrs: (task.expectedResults || []).map(evr => ({
        id: evr.id,
        title: evr.title,
        verify: evr.verify,
        expect: evr.expect,
        status: evr.status,
        class: evr.class,
        lastRun: evr.lastRun,
        notes: evr.notes,
        proof: evr.proof,
        referencedBy: evr.referencedBy || [],
      })),
      logs: (task.logs || []).map(log => ({
        timestamp: log.timestamp,
        level: log.level,
        category: log.category,
        action: log.action,
        message: log.message,
        aiNotes: log.ai_notes,
      })),
      metadata: {
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        completedAt: task.completed_at,
        currentPlanId: task.current_plan_id,
      },
    };
  }

  /**
   * 保存日志到JSONL格式
   */
  private async saveLogsToJsonl(logs: any[], filePath: string): Promise<void> {
    try {
      const jsonlContent = logs.map((log) => JSON.stringify(log)).join('\n');
      await fs.writeFile(filePath, jsonlContent, 'utf8');
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '保存JSONL日志失败', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 验证任务数据结构
   */
  private validateTaskData(task: any): void {
    if (!task || typeof task !== 'object') {
      throw new Error('任务数据格式无效');
    }

    if (!task.id || typeof task.id !== 'string') {
      throw new Error('任务ID无效');
    }

    if (!task.title || typeof task.title !== 'string') {
      throw new Error('任务标题无效');
    }

    if (!task.goal || typeof task.goal !== 'string') {
      throw new Error('任务目标无效');
    }

    if (!Array.isArray(task.overall_plan)) {
      throw new Error('任务计划格式无效');
    }

    if (!Array.isArray(task.logs)) {
      throw new Error('任务日志格式无效');
    }
  }
}
