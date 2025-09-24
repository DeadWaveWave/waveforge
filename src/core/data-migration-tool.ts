/**
 * DataMigrationTool - 数据迁移工具
 * 负责从现有单任务结构迁移到多任务目录结构
 * 支持从 .wave/current-task.json 和 .wave/history/ 迁移到新的目录结构
 */

import fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger.js';
import { MultiTaskDirectoryManager } from './multi-task-directory-manager.js';
import {
  LogCategory,
  LogAction,
  type CurrentTask,
  type MigrationStatus,
  type MigrationResult,
} from '../types/index.js';

/**
 * 数据迁移工具
 */
export class DataMigrationTool {
  private docsPath: string;
  private multiTaskDirectoryManager: MultiTaskDirectoryManager;

  constructor(docsPath: string) {
    if (!docsPath || docsPath.trim() === '') {
      throw new Error('docsPath 不能为空');
    }
    this.docsPath = docsPath.trim();
    this.multiTaskDirectoryManager = new MultiTaskDirectoryManager(docsPath);
  }

  /**
   * 检查是否需要迁移
   */
  async checkMigrationStatus(): Promise<MigrationStatus> {
    try {
      logger.info(LogCategory.Task, LogAction.Handle, '开始检查迁移状态');

      const status: MigrationStatus = {
        needsMigration: false,
        migrationType: 'none',
        legacyData: {
          otherFiles: [],
        },
        migrationPlan: {
          directoriesToCreate: [],
          filesToMove: [],
          dataToTransform: [],
        },
      };

      // 检查旧的 current-task.json 文件
      const currentTaskJsonPath = path.join(this.docsPath, 'current-task.json');
      if (await fs.pathExists(currentTaskJsonPath)) {
        status.needsMigration = true;
        status.migrationType = 'single_to_multi';
        status.legacyData.currentTaskJson = currentTaskJsonPath;

        logger.info(
          LogCategory.Task,
          LogAction.Handle,
          '发现旧的current-task.json文件'
        );
      }

      // 检查旧的 history 目录
      const historyDirPath = path.join(this.docsPath, 'history');
      if (await fs.pathExists(historyDirPath)) {
        const historyFiles = await fs.readdir(historyDirPath);
        const jsonFiles = historyFiles.filter((file) => file.endsWith('.json'));

        if (jsonFiles.length > 0) {
          status.needsMigration = true;
          if (status.migrationType === 'none') {
            status.migrationType = 'single_to_multi';
          }
          status.legacyData.historyDir = historyDirPath;
          status.legacyData.otherFiles.push(
            ...jsonFiles.map((file) => path.join(historyDirPath, file))
          );

          logger.info(
            LogCategory.Task,
            LogAction.Handle,
            '发现旧的history目录',
            {
              historyFiles: jsonFiles.length,
            }
          );
        }
      }

      // 检查其他可能需要迁移的文件
      const otherLegacyFiles = [
        'task-index.json',
        'latest-task.json',
        'tasks.json',
      ];

      for (const fileName of otherLegacyFiles) {
        const filePath = path.join(this.docsPath, fileName);
        if (await fs.pathExists(filePath)) {
          status.legacyData.otherFiles.push(filePath);
          if (!status.needsMigration) {
            status.needsMigration = true;
            status.migrationType = 'structure_upgrade';
          }
        }
      }

      // 生成迁移计划
      if (status.needsMigration) {
        await this.generateMigrationPlan(status);
      }

      logger.info(LogCategory.Task, LogAction.Handle, '迁移状态检查完成', {
        needsMigration: status.needsMigration,
        migrationType: status.migrationType,
        legacyFiles: status.legacyData.otherFiles.length,
      });

      return status;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '检查迁移状态失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行数据迁移
   */
  async performMigration(): Promise<MigrationResult> {
    const startTime = Date.now();

    const result: MigrationResult = {
      success: false,
      migratedTasks: 0,
      createdFiles: [],
      movedFiles: [],
      errors: [],
      warnings: [],
      duration: 0,
    };

    try {
      logger.info(LogCategory.Task, LogAction.Create, '开始执行数据迁移');

      // 检查迁移状态
      const migrationStatus = await this.checkMigrationStatus();

      if (!migrationStatus.needsMigration) {
        result.success = true;
        result.warnings.push('无需迁移，数据结构已是最新');
        return result;
      }

      // 创建备份
      await this.createBackup();

      // 确保新的目录结构存在
      await this.ensureNewDirectoryStructure();

      // 迁移当前任务
      if (migrationStatus.legacyData.currentTaskJson) {
        await this.migrateCurrentTask(
          migrationStatus.legacyData.currentTaskJson,
          result
        );
      }

      // 迁移历史任务
      if (migrationStatus.legacyData.historyDir) {
        await this.migrateHistoryTasks(
          migrationStatus.legacyData.historyDir,
          result
        );
      }

      // 迁移其他文件
      for (const filePath of migrationStatus.legacyData.otherFiles) {
        if (!filePath.includes('history/')) {
          await this.migrateOtherFile(filePath, result);
        }
      }

      // 清理旧文件（可选，默认保留作为备份）
      await this.cleanupLegacyFiles(migrationStatus, result);

      result.success = true;
      result.duration = Date.now() - startTime;

      logger.info(LogCategory.Task, LogAction.Create, '数据迁移完成', {
        migratedTasks: result.migratedTasks,
        createdFiles: result.createdFiles.length,
        duration: result.duration,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);

      logger.error(LogCategory.Task, LogAction.Create, '数据迁移失败', {
        error: errorMessage,
        duration: result.duration,
      });
    }

    return result;
  }

  /**
   * 生成迁移计划
   */
  private async generateMigrationPlan(status: MigrationStatus): Promise<void> {
    // 需要创建的目录
    status.migrationPlan.directoriesToCreate = [
      path.join(this.docsPath, 'tasks'),
      path.join(this.docsPath, 'tasks', 'views'),
      path.join(this.docsPath, 'tasks', 'views', 'by-slug'),
    ];

    // 如果有当前任务，计划迁移
    if (status.legacyData.currentTaskJson) {
      try {
        const taskData = await fs.readFile(
          status.legacyData.currentTaskJson,
          'utf8'
        );
        const task = JSON.parse(taskData) as CurrentTask;

        const dirInfo =
          this.multiTaskDirectoryManager.generateTaskDirectoryInfo(task);
        status.migrationPlan.directoriesToCreate.push(dirInfo.fullPath);

        status.migrationPlan.dataToTransform.push({
          source: status.legacyData.currentTaskJson,
          target: path.join(dirInfo.fullPath, 'task.json'),
          type: 'task_json',
        });
      } catch (error) {
        logger.warning(
          LogCategory.Task,
          LogAction.Handle,
          '无法解析当前任务文件',
          {
            file: status.legacyData.currentTaskJson,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    }

    // 如果有历史任务，计划迁移
    if (status.legacyData.historyDir) {
      try {
        const historyFiles = await fs.readdir(status.legacyData.historyDir);
        const jsonFiles = historyFiles.filter((file) => file.endsWith('.json'));

        for (const fileName of jsonFiles) {
          const filePath = path.join(status.legacyData.historyDir, fileName);
          try {
            const taskData = await fs.readFile(filePath, 'utf8');
            const task = JSON.parse(taskData) as CurrentTask;

            const dirInfo =
              this.multiTaskDirectoryManager.generateTaskDirectoryInfo(task);
            status.migrationPlan.directoriesToCreate.push(dirInfo.fullPath);

            status.migrationPlan.dataToTransform.push({
              source: filePath,
              target: path.join(dirInfo.fullPath, 'task.json'),
              type: 'task_json',
            });
          } catch (error) {
            logger.warning(
              LogCategory.Task,
              LogAction.Handle,
              '无法解析历史任务文件',
              {
                file: filePath,
                error: error instanceof Error ? error.message : String(error),
              }
            );
          }
        }
      } catch (error) {
        logger.warning(LogCategory.Task, LogAction.Handle, '无法读取历史目录', {
          dir: status.legacyData.historyDir,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * 创建备份
   */
  private async createBackup(): Promise<void> {
    try {
      const backupDir = path.join(
        this.docsPath,
        'backup',
        new Date().toISOString().split('T')[0]
      );
      await fs.ensureDir(backupDir);

      // 备份 current-task.json
      const currentTaskPath = path.join(this.docsPath, 'current-task.json');
      if (await fs.pathExists(currentTaskPath)) {
        await fs.copy(
          currentTaskPath,
          path.join(backupDir, 'current-task.json')
        );
      }

      // 备份 history 目录
      const historyDir = path.join(this.docsPath, 'history');
      if (await fs.pathExists(historyDir)) {
        await fs.copy(historyDir, path.join(backupDir, 'history'));
      }

      logger.info(LogCategory.Task, LogAction.Create, '备份创建成功', {
        backupDir,
      });
    } catch (error) {
      logger.warning(LogCategory.Task, LogAction.Create, '备份创建失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 确保新的目录结构存在
   */
  private async ensureNewDirectoryStructure(): Promise<void> {
    const requiredDirs = [
      path.join(this.docsPath, 'tasks'),
      path.join(this.docsPath, 'tasks', 'views'),
      path.join(this.docsPath, 'tasks', 'views', 'by-slug'),
    ];

    for (const dir of requiredDirs) {
      await fs.ensureDir(dir);
    }
  }

  /**
   * 迁移当前任务
   */
  private async migrateCurrentTask(
    currentTaskPath: string,
    result: MigrationResult
  ): Promise<void> {
    try {
      const taskData = await fs.readFile(currentTaskPath, 'utf8');
      const task = JSON.parse(taskData) as CurrentTask;

      // 验证任务数据
      this.validateTaskData(task);

      // 保存到新的目录结构
      const archive =
        await this.multiTaskDirectoryManager.saveTaskToDirectory(task);

      result.migratedTasks++;
      result.createdFiles.push(
        archive.files.taskJson,
        archive.files.currentMd,
        archive.files.logsJsonl
      );

      logger.info(LogCategory.Task, LogAction.Create, '当前任务迁移成功', {
        taskId: task.id,
        taskDir: archive.taskDir,
      });
    } catch (error) {
      const errorMessage = `迁移当前任务失败: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
      logger.error(LogCategory.Task, LogAction.Create, errorMessage, {
        currentTaskPath,
      });
    }
  }

  /**
   * 迁移历史任务
   */
  private async migrateHistoryTasks(
    historyDir: string,
    result: MigrationResult
  ): Promise<void> {
    try {
      const historyFiles = await fs.readdir(historyDir);
      const jsonFiles = historyFiles.filter((file) => file.endsWith('.json'));

      for (const fileName of jsonFiles) {
        const filePath = path.join(historyDir, fileName);

        try {
          const taskData = await fs.readFile(filePath, 'utf8');
          const task = JSON.parse(taskData) as CurrentTask;

          // 验证任务数据
          this.validateTaskData(task);

          // 保存到新的目录结构
          const archive =
            await this.multiTaskDirectoryManager.saveTaskToDirectory(task);

          result.migratedTasks++;
          result.createdFiles.push(
            archive.files.taskJson,
            archive.files.currentMd,
            archive.files.logsJsonl
          );

          logger.info(LogCategory.Task, LogAction.Create, '历史任务迁移成功', {
            taskId: task.id,
            taskDir: archive.taskDir,
            sourceFile: fileName,
          });
        } catch (error) {
          const errorMessage = `迁移历史任务失败 (${fileName}): ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
          logger.error(LogCategory.Task, LogAction.Create, errorMessage, {
            filePath,
          });
        }
      }
    } catch (error) {
      const errorMessage = `读取历史目录失败: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
      logger.error(LogCategory.Task, LogAction.Create, errorMessage, {
        historyDir,
      });
    }
  }

  /**
   * 迁移其他文件
   */
  private async migrateOtherFile(
    filePath: string,
    result: MigrationResult
  ): Promise<void> {
    try {
      const fileName = path.basename(filePath);
      const targetPath = path.join(this.docsPath, 'legacy', fileName);

      await fs.ensureDir(path.dirname(targetPath));
      await fs.move(filePath, targetPath);

      result.movedFiles.push(`${filePath} -> ${targetPath}`);

      logger.info(LogCategory.Task, LogAction.Create, '其他文件迁移成功', {
        from: filePath,
        to: targetPath,
      });
    } catch (error) {
      const errorMessage = `迁移其他文件失败 (${filePath}): ${error instanceof Error ? error.message : String(error)}`;
      result.warnings.push(errorMessage);
      logger.warning(LogCategory.Task, LogAction.Create, errorMessage);
    }
  }

  /**
   * 清理旧文件
   */
  private async cleanupLegacyFiles(
    migrationStatus: MigrationStatus,
    result: MigrationResult
  ): Promise<void> {
    try {
      // 默认不删除旧文件，而是移动到 legacy 目录
      const legacyDir = path.join(this.docsPath, 'legacy');
      await fs.ensureDir(legacyDir);

      // 移动 current-task.json
      if (migrationStatus.legacyData.currentTaskJson) {
        const targetPath = path.join(legacyDir, 'current-task.json');
        if (await fs.pathExists(migrationStatus.legacyData.currentTaskJson)) {
          await fs.move(migrationStatus.legacyData.currentTaskJson, targetPath);
          result.movedFiles.push(
            `${migrationStatus.legacyData.currentTaskJson} -> ${targetPath}`
          );
        }
      }

      // 移动 history 目录
      if (migrationStatus.legacyData.historyDir) {
        const targetPath = path.join(legacyDir, 'history');
        if (await fs.pathExists(migrationStatus.legacyData.historyDir)) {
          await fs.move(migrationStatus.legacyData.historyDir, targetPath);
          result.movedFiles.push(
            `${migrationStatus.legacyData.historyDir} -> ${targetPath}`
          );
        }
      }

      logger.info(LogCategory.Task, LogAction.Create, '旧文件清理完成', {
        legacyDir,
        movedFiles: result.movedFiles.length,
      });
    } catch (error) {
      const errorMessage = `清理旧文件失败: ${error instanceof Error ? error.message : String(error)}`;
      result.warnings.push(errorMessage);
      logger.warning(LogCategory.Task, LogAction.Create, errorMessage);
    }
  }

  /**
   * 验证任务数据
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

    if (!task.created_at || typeof task.created_at !== 'string') {
      throw new Error('任务创建时间无效');
    }

    // 修复缺失的字段
    if (!task.slug) {
      task.slug = this.generateSlugFromTitle(task.title);
    }

    if (!task.knowledge_refs) {
      task.knowledge_refs = [];
    }

    if (!task.task_hints) {
      task.task_hints = [];
    }

    if (!task.updated_at) {
      task.updated_at = task.created_at;
    }
  }

  /**
   * 从标题生成slug
   */
  private generateSlugFromTitle(title: string): string {
    let slug = title.trim();

    slug = slug
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    if (/^[\u4e00-\u9fa5-]+$/.test(slug)) {
      return slug.replace(/-/g, '');
    }

    if (slug.length > 100) {
      slug = slug.substring(0, 100).replace(/-[^-]*$/, '');
    }

    return slug || 'untitled-task';
  }

  /**
   * 检查是否有待迁移的数据
   */
  async hasLegacyData(): Promise<boolean> {
    const status = await this.checkMigrationStatus();
    return status.needsMigration;
  }

  /**
   * 获取迁移摘要信息
   */
  async getMigrationSummary(): Promise<{
    needsMigration: boolean;
    legacyFiles: number;
    estimatedTasks: number;
  }> {
    const status = await this.checkMigrationStatus();

    let estimatedTasks = 0;

    // 估算当前任务数量
    if (status.legacyData.currentTaskJson) {
      estimatedTasks += 1;
    }

    // 估算历史任务数量
    if (status.legacyData.historyDir) {
      try {
        const historyFiles = await fs.readdir(status.legacyData.historyDir);
        estimatedTasks += historyFiles.filter((file) =>
          file.endsWith('.json')
        ).length;
      } catch (error) {
        // 忽略错误
      }
    }

    return {
      needsMigration: status.needsMigration,
      legacyFiles: status.legacyData.otherFiles.length,
      estimatedTasks,
    };
  }
}
