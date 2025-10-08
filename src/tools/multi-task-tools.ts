/**
 * 多任务管理 MCP 工具实现
 * 实现 task_list 和 task_switch 工具
 */

import { logger } from '../core/logger.js';
import { MultiTaskDirectoryManager } from '../core/multi-task-directory-manager.js';
import * as path from 'path';
import {
  errorHandler,
  ValidationError,
  NotFoundError,
} from '../core/error-handler.js';
import {
  TaskListSchema,
  TaskSwitchSchema,
  validateParametersAgainstSchema,
} from './schemas.js';
import { LogCategory, LogAction } from '../types/index.js';
import type {
  TaskListParams,
  TaskListResponse,
  TaskSwitchParams,
  TaskSwitchResponse,
} from '../types/index.js';

/**
 * 多任务工具基础类
 */
abstract class BaseMultiTaskTool {
  protected taskIndexManager: any; // 将在实现TaskIndexManager后更新类型
  protected multiTaskDirectoryManager: any; // 将在实现后更新类型
  protected taskManager: any; // 现有的TaskManager

  constructor(
    taskIndexManager: any,
    multiTaskDirectoryManager: any,
    taskManager: any
  ) {
    this.taskIndexManager = taskIndexManager;
    this.multiTaskDirectoryManager = multiTaskDirectoryManager;
    this.taskManager = taskManager;
  }

  /**
   * 验证工具参数
   */
  protected validateParams(toolName: string, params: any): void {
    const validation = validateParametersAgainstSchema(toolName, params);
    if (!validation.valid) {
      throw new ValidationError(
        `参数验证失败: ${validation.errors.join(', ')}`,
        { errors: validation.errors, params }
      );
    }
  }

  /**
   * 创建成功响应
   */
  protected createSuccessResponse(data: any): any {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              timestamp: new Date().toISOString(),
              ...data,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 创建错误响应
   */
  protected createErrorResponse(error: any, context?: any): any {
    const errorResponse = errorHandler.handleError(error, context);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
    };
  }

  /**
   * 记录工具操作日志
   */
  protected logOperation(
    category: LogCategory,
    action: LogAction,
    message: string,
    details?: any
  ): void {
    logger.info(category, action, message, details);
  }
}

/**
 * Task List 工具实现
 * 列出任务，支持状态过滤、搜索和分页
 */
export class TaskListTool extends BaseMultiTaskTool {
  /**
   * 处理任务列表请求
   */
  async handle(params: any = {}): Promise<any> {
    try {
      // 参数验证
      this.validateParams('task_list', params);

      // 设置默认值
      const listParams: TaskListParams = {
        status: params.status || 'all',
        limit: params.limit || 20,
        offset: params.offset || 0,
        sort: params.sort || 'updated_at',
        order: params.order || 'desc',
        search: params.search,
        project_id: params.project_id,
      };

      this.logOperation(
        LogCategory.Task,
        LogAction.Handle,
        '开始获取任务列表',
        {
          status: listParams.status,
          limit: listParams.limit,
          offset: listParams.offset,
          sort: listParams.sort,
          order: listParams.order,
          search: listParams.search,
        }
      );

      // 获取任务列表
      const taskList = await this.getTaskList(listParams);

      this.logOperation(
        LogCategory.Task,
        LogAction.Handle,
        '任务列表获取完成',
        {
          totalTasks: taskList.total,
          returnedTasks: taskList.tasks.length,
        }
      );

      return this.createSuccessResponse(taskList);
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '任务列表获取失败',
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        }
      );

      return this.createErrorResponse(error, {
        tool: 'task_list',
        params,
      });
    }
  }

  /**
   * 获取任务列表的核心逻辑
   */
  private async getTaskList(params: TaskListParams): Promise<TaskListResponse> {
    try {
      // 基于当前活动项目动态解析 .wave 路径，避免使用服务器启动目录
      const panelPath = this.taskManager.getCurrentTaskPanelPath();
      const docsPath = panelPath ? path.dirname(panelPath) : this.taskManager.getDocsPath();
      const mgr = new MultiTaskDirectoryManager(docsPath);

      // 获取所有任务目录
      const taskDirs = await mgr.listAllTaskDirectories();

      // 加载任务摘要信息
      const allTasks = [];
      for (const dirInfo of taskDirs) {
        try {
          const task = await mgr.loadTaskFromDirectory(dirInfo.fullPath);
          if (task) {
            // 确定任务状态
            const status = this.determineTaskStatus(task);

            // 计算进度
            const progress = this.calculateProgress(task);

            const taskSummary = {
              id: task.id,
              title: task.title,
              slug: task.slug,
              status,
              created_at: task.created_at,
              completed_at: task.completed_at,
              updated_at: task.updated_at,
              goal:
                task.goal.length > 200
                  ? task.goal.substring(0, 200) + '...'
                  : task.goal,
              taskDir: dirInfo.fullPath,
              progress,
            };

            allTasks.push(taskSummary);
          }
        } catch (error) {
          // 跳过损坏的任务文件
          logger.warning(
            LogCategory.Task,
            LogAction.Handle,
            '跳过损坏的任务文件',
            {
              taskDir: dirInfo.fullPath,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }

      // 应用状态过滤
      let filteredTasks = allTasks;
      if (params.status && params.status !== 'all') {
        filteredTasks = allTasks.filter(
          (task) => task.status === params.status
        );
      }

      // 应用搜索过滤
      if (params.search) {
        const searchLower = params.search.toLowerCase();
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.title.toLowerCase().includes(searchLower) ||
            task.goal.toLowerCase().includes(searchLower) ||
            task.slug.toLowerCase().includes(searchLower)
        );
      }

      // 排序
      filteredTasks.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (params.sort) {
          case 'created_at':
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          case 'updated_at':
            aValue = new Date(a.updated_at).getTime();
            bValue = new Date(b.updated_at).getTime();
            break;
          case 'title':
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          default:
            aValue = new Date(a.updated_at).getTime();
            bValue = new Date(b.updated_at).getTime();
        }

        if (params.order === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });

      // 分页
      const total = filteredTasks.length;
      const offset = params.offset || 0;
      const limit = params.limit || 20;
      const paginatedTasks = filteredTasks.slice(offset, offset + limit);

      // 计算统计信息
      const stats = {
        total: allTasks.length,
        active: allTasks.filter((t) => t.status === 'active').length,
        completed: allTasks.filter((t) => t.status === 'completed').length,
        archived: allTasks.filter((t) => t.status === 'archived').length,
      };

      return {
        tasks: paginatedTasks,
        total,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        stats,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '获取任务列表失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 确定任务状态
   */
  private determineTaskStatus(task: any): 'active' | 'completed' | 'archived' {
    if (task.completed_at) {
      return 'completed';
    }

    // 检查是否有活跃的计划或步骤
    const hasActiveWork = task.overall_plan.some(
      (plan: any) =>
        plan.status === 'in_progress' ||
        plan.steps.some((step: any) => step.status === 'in_progress')
    );

    if (hasActiveWork) {
      return 'active';
    }

    // 检查是否所有计划都已完成
    const allPlansCompleted =
      task.overall_plan.length > 0 &&
      task.overall_plan.every((plan: any) => plan.status === 'completed');

    if (allPlansCompleted) {
      return 'completed';
    }

    return 'active';
  }

  /**
   * 计算任务进度
   */
  private calculateProgress(task: any) {
    const totalPlans = task.overall_plan.length;
    const completedPlans = task.overall_plan.filter(
      (plan: any) => plan.status === 'completed'
    ).length;

    return {
      totalPlans,
      completedPlans,
      currentPlanId: task.current_plan_id,
    };
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: TaskListSchema.name,
      description: TaskListSchema.description,
      inputSchema: TaskListSchema.inputSchema,
    };
  }
}

/**
 * Task Switch 工具实现
 * 切换到指定任务，将其设为当前活跃任务
 */
export class TaskSwitchTool extends BaseMultiTaskTool {
  /**
   * 处理任务切换请求
   */
  async handle(params: any): Promise<any> {
    try {
      // 参数验证
      this.validateParams('task_switch', params);

      const switchParams: TaskSwitchParams = {
        task_id: params.task_id,
        project_id: params.project_id,
      };

      this.logOperation(LogCategory.Task, LogAction.Switch, '开始切换任务', {
        targetTaskId: switchParams.task_id,
        projectId: switchParams.project_id,
      });

      // 执行任务切换
      const result = await this.switchToTask(switchParams);

      this.logOperation(LogCategory.Task, LogAction.Switch, '任务切换完成', {
        currentTaskId: result.current_task_id,
        taskTitle: result.task.title,
      });

      return this.createSuccessResponse(result);
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '任务切换失败',
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        }
      );

      return this.createErrorResponse(error, {
        tool: 'task_switch',
        params,
      });
    }
  }

  /**
   * 切换任务的核心逻辑
   */
  private async switchToTask(
    params: TaskSwitchParams
  ): Promise<TaskSwitchResponse> {
    try {
      // 基于当前活动项目动态解析 .wave 路径，避免使用服务器启动目录
      const panelPath = this.taskManager.getCurrentTaskPanelPath();
      const docsPath = panelPath ? path.dirname(panelPath) : this.taskManager.getDocsPath();
      const mgr = new MultiTaskDirectoryManager(docsPath);

      // 查找目标任务目录
      const taskDir = await mgr.findTaskDirectory(params.task_id);

      if (!taskDir) {
        throw new NotFoundError(`任务不存在: ${params.task_id}`);
      }

      // 加载目标任务
      const targetTask = await mgr.loadTaskFromDirectory(taskDir);

      if (!targetTask) {
        throw new NotFoundError(`无法加载任务: ${params.task_id}`);
      }

      // 保存当前任务（如果存在）
      const currentTask = await this.taskManager.getCurrentTask(
        params.project_id
      );
      if (currentTask) {
        // 将当前任务保存到其对应的目录中
        const currentTaskDir = await mgr.findTaskDirectory(currentTask.id);
        if (currentTaskDir) {
          await mgr.updateTaskInDirectory(currentTask, currentTaskDir);
        } else {
          // 如果找不到目录，创建新的目录保存
          await mgr.saveTaskToDirectory(currentTask);
        }
      }

      // 将目标任务设为当前任务
      await this.taskManager.saveTask(targetTask, params.project_id);

      // 更新任务的最后访问时间
      targetTask.updated_at = new Date().toISOString();
      await mgr.updateTaskInDirectory(targetTask, taskDir);

      // 更新索引（如果有索引管理器的话）
      if (this.taskIndexManager) {
        await this.taskIndexManager.updateLatestTaskPointer(targetTask);
      }

      const switchedAt = new Date().toISOString();

      return {
        switched: true,
        current_task_id: targetTask.id,
        task: targetTask,
        switched_at: switchedAt,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Switch, '任务切换失败', {
        taskId: params.task_id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: TaskSwitchSchema.name,
      description: TaskSwitchSchema.description,
      inputSchema: TaskSwitchSchema.inputSchema,
    };
  }
}
