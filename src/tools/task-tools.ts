/**
 * 任务管理 MCP 工具实现
 * 实现所有任务管理相关的工具类
 */

import { TaskManager } from '../core/task-manager.js';
import { logger } from '../core/logger.js';
import {
  errorHandler,
  ValidationError,
  NotFoundError,
} from '../core/error-handler.js';
import {
  CurrentTaskInitSchema,
  CurrentTaskUpdateSchema,
  CurrentTaskReadSchema,
  CurrentTaskModifySchema,
  CurrentTaskCompleteSchema,
  CurrentTaskLogSchema,
  validateParametersAgainstSchema,
} from './schemas.js';
import {
  EVRValidator,
  createEVRValidator,
  LazySync,
  createLazySync,
} from '../core/index.js';
import {
  TaskStatus,
  LogCategory,
  LogAction,
  type EVRSummary,
  type EVRDetail,
  type SyncPreview,
  type LogEntry,
} from '../types/index.js';

/**
 * 任务管理工具基础类
 * 提供通用的错误处理和日志记录功能
 */
abstract class BaseTaskTool {
  protected taskManager: TaskManager;

  constructor(taskManager: TaskManager) {
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
 * Current Task Init 工具实现
 * 初始化具有明确目标和计划的结构化任务
 */
export class CurrentTaskInitTool extends BaseTaskTool {
  constructor(taskManager: TaskManager) {
    super(taskManager);
  }
  /**
   * 处理任务初始化请求
   */
  async handle(params: any): Promise<any> {
    try {
      // 参数验证
      this.validateParams('current_task_init', params);

      this.logOperation(LogCategory.Task, LogAction.Create, '开始任务初始化', {
        title: params.title,
      });

      // 调用 TaskManager 初始化任务
      const result = await this.taskManager.initTask({
        title: params.title,
        goal: params.goal,
        story: params.story,
        description: params.description,
        knowledge_refs: params.knowledge_refs || [],
        overall_plan: params.overall_plan || [],
        project_id: params.project_id,
      });

      this.logOperation(LogCategory.Task, LogAction.Create, '任务初始化完成', {
        taskId: result.task_id,
        slug: result.slug,
        planCount: result.plan_ids?.length || 0,
      });

      return this.createSuccessResponse({
        task_id: result.task_id,
        slug: result.slug,
        current_plan_id: result.current_plan_id,
        plan_required: result.plan_required,
        plan_ids: result.plan_ids,
      });
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '任务初始化失败',
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        }
      );

      return this.createErrorResponse(error, {
        tool: 'current_task_init',
        params,
      });
    }
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: CurrentTaskInitSchema.name,
      description: CurrentTaskInitSchema.description,
      inputSchema: CurrentTaskInitSchema.inputSchema,
    };
  }
}

/**
 * Current Task Update 工具实现
 * 在计划和步骤两个层级更新任务进度
 */
export class CurrentTaskUpdateTool extends BaseTaskTool {
  constructor(taskManager: TaskManager) {
    super(taskManager);
  }
  /**
   * 处理任务更新请求
   */
  async handle(params: any): Promise<any> {
    try {
      // 参数验证
      this.validateParams('current_task_update', params);

      // 验证条件逻辑
      if (params.update_type === 'plan' && !params.plan_id) {
        throw new ValidationError('plan级别更新需要提供plan_id');
      }
      if (params.update_type === 'step' && !params.step_id) {
        throw new ValidationError('step级别更新需要提供step_id');
      }
      if (params.update_type === 'evr' && !params.evr) {
        throw new ValidationError('EVR更新需要提供evr字段');
      }
      if (['completed', 'blocked'].includes(params.status) && !params.notes) {
        throw new ValidationError('完成或阻塞状态需要提供notes说明');
      }

      this.logOperation(
        LogCategory.Task,
        LogAction.Update,
        `开始${params.update_type}级别状态更新`,
        {
          updateType: params.update_type,
          status: params.status,
          targetId: params.plan_id || params.step_id,
        }
      );

      // 调用 TaskManager 更新任务状态
      const result = await this.taskManager.updateTaskStatus({
        update_type: params.update_type,
        plan_id: params.plan_id,
        step_id: params.step_id,
        status: params.status as TaskStatus,
        evidence: params.evidence,
        notes: params.notes,
        project_id: params.project_id,
        evr: params.evr,
      });

      this.logOperation(
        LogCategory.Task,
        LogAction.Update,
        `${params.update_type}级别状态更新完成`,
        {
          autoAdvanced: result.auto_advanced,
          newPlanId: result.current_plan_id,
        }
      );

      return this.createSuccessResponse({
        current_plan_id: result.current_plan_id,
        next_step: result.next_step,
        auto_advanced: result.auto_advanced,
        steps_required: result.steps_required,
        started_new_plan: result.started_new_plan,
        hints: result.hints,
        logs_highlights: result.logs_highlights,
        // EVR 相关字段
        evr_for_node: result.evr_for_node,
        evr_pending: result.evr_pending,
        evr_for_plan: result.evr_for_plan,
        // Lazy 同步相关字段
        sync_preview: result.sync_preview,
      });
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '任务状态更新失败',
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        }
      );

      return this.createErrorResponse(error, {
        tool: 'current_task_update',
        params,
      });
    }
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: CurrentTaskUpdateSchema.name,
      description: CurrentTaskUpdateSchema.description,
      inputSchema: CurrentTaskUpdateSchema.inputSchema,
    };
  }
}

/**
 * Current Task Read 工具实现
 * 读取当前任务完整状态以恢复上下文，支持 EVR 相关参数和同步预览
 */
export class CurrentTaskReadTool extends BaseTaskTool {
  private evrValidator: EVRValidator;
  private lazySync: LazySync;

  constructor(taskManager: TaskManager) {
    super(taskManager);
    this.evrValidator = createEVRValidator();
    this.lazySync = createLazySync();
  }

  /**
   * 处理任务读取请求
   */
  async handle(params: any = {}): Promise<any> {
    try {
      // 参数验证
      this.validateParams('current_task_read', params);

      this.logOperation(
        LogCategory.Task,
        LogAction.Handle,
        '开始读取当前任务状态',
        {
          includeEVR: params.evr?.include !== false,
          requireSkipReason: params.evr?.require_skip_reason !== false,
        }
      );

      // 获取当前任务
      const task = await this.taskManager.getCurrentTask(params.project_id);
      if (!task) {
        throw new NotFoundError('当前没有活跃任务');
      }

      // 构建响应数据
      const responseData: any = {
        task: this.processTaskData(task, params),
      };

      // 添加 EVR 相关信息
      if (params.evr?.include !== false) {
        const evrInfo = await this.generateEVRInfo(task, params.evr);
        responseData.evr_ready = evrInfo.ready;
        responseData.evr_summary = evrInfo.summary;
        responseData.evr_details = evrInfo.details;
      } else {
        // 即使不包含 EVR 详情，也要提供基本的就绪状态
        const validation = this.evrValidator.validateEVRReadiness(
          task.expectedResults || []
        );
        responseData.evr_ready = validation.ready;
        responseData.evr_summary = validation.summary;
        responseData.evr_details = [];
      }

      // 检测面板同步状态（仅干运行预览）
      const syncInfo = await this.checkPanelSync(task);
      if (syncInfo.hasPendingChanges) {
        responseData.panel_pending = true;
        responseData.sync_preview = syncInfo.preview;
      } else {
        responseData.panel_pending = false;
        // 不返回 sync_preview 字段以避免噪声
      }

      // 添加日志高亮和计数
      const logInfo = this.generateLogInfo(task, params);
      responseData.logs_highlights = logInfo.highlights;
      responseData.logs_full_count = logInfo.fullCount;

      // 添加缓存信息
      responseData.md_version = this.generateMdVersion(task);

      this.logOperation(
        LogCategory.Task,
        LogAction.Handle,
        '任务状态读取完成',
        {
          taskId: task.id,
          evrReady: responseData.evr_ready,
          panelPending: responseData.panel_pending,
          logsHighlights: responseData.logs_highlights.length,
        }
      );

      return this.createSuccessResponse(responseData);
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '任务状态读取失败',
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        }
      );

      return this.createErrorResponse(error, {
        tool: 'current_task_read',
        params,
      });
    }
  }

  /**
   * 处理任务数据
   */
  private processTaskData(task: any, params: any): any {
    const processedTask = { ...task };

    // 处理日志限制
    if (params.include_logs === false) {
      processedTask.logs = [];
    } else if (params.logs_limit && task.logs.length > params.logs_limit) {
      processedTask.logs = task.logs.slice(-params.logs_limit);
    }

    return processedTask;
  }

  /**
   * 生成 EVR 相关信息
   */
  private async generateEVRInfo(
    task: any,
    evrParams: any = {}
  ): Promise<{
    ready: boolean;
    summary: EVRSummary;
    details: EVRDetail[];
  }> {
    const expectedResults = task.expectedResults || [];

    // 使用 EVRValidator 验证就绪性
    const validation = this.evrValidator.validateEVRReadiness(expectedResults, {
      requireSkipReason: evrParams.require_skip_reason !== false,
    });

    // 生成 EVR 详情
    const details: EVRDetail[] = expectedResults.map((evr: any) => ({
      evr_id: evr.id,
      title: evr.title,
      status: evr.status,
      last_run: evr.lastRun,
      referenced_by: evr.referencedBy || [],
      runs: evr.runs || [],
    }));

    return {
      ready: validation.ready,
      summary: validation.summary,
      details,
    };
  }

  /**
   * 检查面板同步状态（仅干运行预览）
   */
  private async checkPanelSync(_task: any): Promise<{
    hasPendingChanges: boolean;
    preview?: SyncPreview;
  }> {
    try {
      // 尝试读取面板内容
      const panelPath = this.taskManager.getCurrentTaskPanelPath();
      if (!panelPath) {
        return { hasPendingChanges: false };
      }

      // 这里应该读取面板内容，但由于我们还没有实现面板文件系统
      // 暂时返回无变更状态
      // TODO: 实现面板内容读取和差异检测

      return { hasPendingChanges: false };
    } catch (error) {
      // 如果检测失败，记录错误但不影响主流程
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '面板同步检测失败',
        { error: error instanceof Error ? error.message : String(error) }
      );

      return { hasPendingChanges: false };
    }
  }

  /**
   * 生成日志高亮和计数信息
   */
  private generateLogInfo(
    task: any,
    _params: any
  ): {
    highlights: LogEntry[];
    fullCount: number;
  } {
    const allLogs = task.logs || [];
    const fullCount = allLogs.length;

    // 生成高亮日志（重点日志筛选）
    const highlights = this.selectHighlightLogs(allLogs);

    return {
      highlights,
      fullCount,
    };
  }

  /**
   * 选择高亮日志
   */
  private selectHighlightLogs(logs: any[]): LogEntry[] {
    const highlights: LogEntry[] = [];
    const maxHighlights = 20; // 最多20条高亮

    // 优先级：EXCEPTION > TEST > TASK/MODIFY > DISCUSSION
    const priorityOrder = ['EXCEPTION', 'TEST', 'TASK', 'MODIFY', 'DISCUSSION'];

    // 按优先级和时间排序
    const sortedLogs = logs
      .filter((log) => log.category && priorityOrder.includes(log.category))
      .sort((a, b) => {
        const aPriority = priorityOrder.indexOf(a.category);
        const bPriority = priorityOrder.indexOf(b.category);
        if (aPriority !== bPriority) {
          return aPriority - bPriority; // 优先级高的在前
        }
        return (
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ); // 时间新的在前
      });

    // 选择前 N 条作为高亮
    for (let i = 0; i < Math.min(sortedLogs.length, maxHighlights); i++) {
      const log = sortedLogs[i];
      highlights.push({
        ts: log.timestamp,
        level: log.level || 'INFO',
        category: log.category,
        action: log.action,
        message: log.message,
      });
    }

    return highlights;
  }

  /**
   * 生成 MD 版本号（ETag）
   */
  private generateMdVersion(task: any): string {
    // 基于任务的关键字段生成版本号，包含更多细节以确保唯一性
    const versionData = {
      id: task.id,
      updated_at: task.updatedAt,
      plans_count: task.plans?.length || 0,
      evrs_count: task.expectedResults?.length || 0,
      logs_count: task.logs?.length || 0,
      // 添加更多细节以确保版本号的唯一性
      plans_hash:
        task.plans?.map((p: any) => `${p.id}:${p.status}`).join(',') || '',
      evrs_hash:
        task.expectedResults
          ?.map((e: any) => `${e.id}:${e.status}`)
          .join(',') || '',
      logs_hash:
        task.logs
          ?.slice(-3)
          .map((l: any) => l.timestamp)
          .join(',') || '',
    };

    return Buffer.from(JSON.stringify(versionData))
      .toString('base64')
      .slice(0, 16);
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: CurrentTaskReadSchema.name,
      description: CurrentTaskReadSchema.description,
      inputSchema: CurrentTaskReadSchema.inputSchema,
    };
  }
}

/**
 * Current Task Modify 工具实现
 * 动态修改任务结构，包括计划、步骤和目标
 */
export class CurrentTaskModifyTool extends BaseTaskTool {
  constructor(taskManager: TaskManager) {
    super(taskManager);
  }
  /**
   * 处理任务修改请求
   */
  async handle(params: any): Promise<any> {
    try {
      // 参数验证
      this.validateParams('current_task_modify', params);

      // 验证条件逻辑
      if (params.field === 'steps' && !params.plan_id) {
        throw new ValidationError('修改步骤时需要提供plan_id');
      }
      if (params.field === 'hints' && params.step_id && !params.plan_id) {
        throw new ValidationError('修改步骤级提示时需要提供plan_id');
      }

      this.logOperation(
        LogCategory.Task,
        LogAction.Modify,
        `开始修改任务${params.field}`,
        {
          field: params.field,
          changeType: params.change_type,
          reason: params.reason,
        }
      );

      // 调用 TaskManager 修改任务
      const result = await this.taskManager.modifyTask({
        field: params.field,
        content: params.content,
        reason: params.reason,
        plan_id: params.plan_id,
        step_id: params.step_id,
        change_type: params.change_type,
        project_id: params.project_id,
        evr: params.evr,
        op: params.op,
        hints: params.hints,
        tags: params.tags,
      });

      this.logOperation(
        LogCategory.Task,
        LogAction.Modify,
        `任务${params.field}修改完成`,
        { result }
      );

      return this.createSuccessResponse({
        modified_field: params.field,
        change_summary: `${params.field}已更新`,
        ...result,
      });
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '任务修改失败',
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        }
      );

      return this.createErrorResponse(error, {
        tool: 'current_task_modify',
        params,
      });
    }
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: CurrentTaskModifySchema.name,
      description: CurrentTaskModifySchema.description,
      inputSchema: CurrentTaskModifySchema.inputSchema,
    };
  }
}

/**
 * Current Task Complete 工具实现
 * 完成当前任务并生成文档
 */
export class CurrentTaskCompleteTool extends BaseTaskTool {
  constructor(taskManager: TaskManager) {
    super(taskManager);
  }
  /**
   * 处理任务完成请求
   */
  async handle(params: any): Promise<any> {
    try {
      // 参数验证
      this.validateParams('current_task_complete', params);

      this.logOperation(LogCategory.Task, LogAction.Update, '开始完成任务', {
        summary: params.summary,
      });

      // 调用 TaskManager 完成任务
      const result = await this.taskManager.completeTask(
        params.summary,
        params.project_id
      );

      this.logOperation(LogCategory.Task, LogAction.Update, '任务完成', {
        archivedTaskId: result.archived_task_id,
      });

      const responseData: any = {
        completed: true,
        archived_task_id: result.archived_task_id,
        index_updated: true,
      };

      // 根据 generate_docs 参数决定是否返回 devlog 建议
      if (params.generate_docs !== false) {
        responseData.devlog_recommendation = {
          prompt: true,
          suggested_mode: 'both',
          reason: '任务已完成，建议生成开发日志记录工作过程',
        };
      } else {
        responseData.docs_generated = false;
      }

      return this.createSuccessResponse(responseData);
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '任务完成失败',
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        }
      );

      return this.createErrorResponse(error, {
        tool: 'current_task_complete',
        params,
      });
    }
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: CurrentTaskCompleteSchema.name,
      description: CurrentTaskCompleteSchema.description,
      inputSchema: CurrentTaskCompleteSchema.inputSchema,
    };
  }
}

/**
 * Current Task Log 工具实现
 * 记录非任务状态变更的重要事件
 */
export class CurrentTaskLogTool extends BaseTaskTool {
  constructor(taskManager: TaskManager) {
    super(taskManager);
  }
  /**
   * 处理日志记录请求
   */
  async handle(params: any): Promise<any> {
    try {
      // 参数验证
      this.validateParams('current_task_log', params);

      this.logOperation(
        LogCategory.Task,
        LogAction.Create,
        '开始记录任务日志',
        { category: params.category, action: params.action }
      );

      // 调用 TaskManager 记录日志
      const result = await this.taskManager.logActivity({
        category: params.category.toUpperCase() as LogCategory,
        action: params.action.toUpperCase() as LogAction,
        message: params.message,
        ai_notes: params.notes,
        project_id: params.project_id,
      });

      this.logOperation(
        LogCategory.Task,
        LogAction.Create,
        '任务日志记录完成',
        { logId: result.log_id }
      );

      return this.createSuccessResponse({
        log_recorded: true,
        log_id: result.log_id,
        timestamp: result.timestamp,
      });
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '任务日志记录失败',
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        }
      );

      return this.createErrorResponse(error, {
        tool: 'current_task_log',
        params,
      });
    }
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: CurrentTaskLogSchema.name,
      description: CurrentTaskLogSchema.description,
      inputSchema: CurrentTaskLogSchema.inputSchema,
    };
  }
}
