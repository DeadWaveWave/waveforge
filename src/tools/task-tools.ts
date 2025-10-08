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
  convertResponseToSnakeCase,
  convertRequestToCamelCase as _convertRequestToCamelCase, // 预留用于请求参数转换
} from '../core/field-converter.js';
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
  LogHighlightSelector,
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
   * 创建成功响应（自动转换为 snake_case）
   */
  protected createSuccessResponse(data: any): any {
    // 转换字段名为 snake_case
    const snakeCaseData = convertResponseToSnakeCase({
      success: true,
      timestamp: new Date().toISOString(),
      ...data,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(snakeCaseData, null, 2),
        },
      ],
    };
  }

  /**
   * 创建错误响应（自动转换为 snake_case）
   */
  protected createErrorResponse(error: any, context?: any): any {
    const errorResponse = errorHandler.handleError(error, context);
    // 转换字段名为 snake_case
    const snakeCaseError = convertResponseToSnakeCase(errorResponse);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(snakeCaseError, null, 2),
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

      // 参数转换：plan_no → plan_id, step_no → step_id
      if (params.update_type === 'plan' && params.plan_no && !params.plan_id) {
        const task = await this.taskManager.getCurrentTask(params.project_id);
        if (!task) {
          throw new NotFoundError('当前没有活跃任务');
        }
        const planIndex = params.plan_no - 1;
        if (planIndex < 0 || planIndex >= task.overall_plan.length) {
          throw new ValidationError(`无效的 plan_no: ${params.plan_no}`);
        }
        params.plan_id = task.overall_plan[planIndex].id;
      }

      if (params.update_type === 'step' && params.step_no && !params.step_id) {
        const task = await this.taskManager.getCurrentTask(params.project_id);
        if (!task) {
          throw new NotFoundError('当前没有活跃任务');
        }
        // 找到对应的步骤
        let found = false;
        for (const plan of task.overall_plan) {
          if (plan.steps && plan.steps.length >= params.step_no) {
            params.step_id = plan.steps[params.step_no - 1].id;
            found = true;
            break;
          }
        }
        if (!found) {
          throw new ValidationError(`无效的 step_no: ${params.step_no}`);
        }
      }

      // 验证条件逻辑
      if (params.update_type === 'plan' && !params.plan_id) {
        throw new ValidationError('plan级别更新需要提供plan_id或plan_no');
      }
      if (params.update_type === 'step' && !params.step_id) {
        throw new ValidationError('step级别更新需要提供step_id或step_no');
      }
      if (params.update_type === 'evr' && !params.evr) {
        throw new ValidationError('EVR更新需要提供evr字段');
      }
      // 只有 blocked 状态必须提供 notes 说明阻塞原因
      // completed 状态的 notes 是可选的
      if (params.status === 'blocked' && !params.notes) {
        throw new ValidationError('阻塞状态需要提供notes说明阻塞原因');
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

      // 如果结果是失败（例如EVR门槛检查未通过），返回非success响应
      if (result.success === false) {
        return this.createSuccessResponse({
          success: false,
          current_plan_id: result.current_plan_id,
          evr_pending: result.evr_pending,
          evr_for_plan: result.evr_for_plan,
          message: 'EVR 验证未完成，无法完成计划',
        });
      }

      return this.createSuccessResponse({
        success: true,
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

      // read 为只读预览（dry-run），不应用变更
      // 只检测面板同步状态，不修改任务数据
      const syncResult = await this.checkPanelSync(task);

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

      // 添加同步预览信息（read 为 dry-run，只预览）
      if (syncResult && syncResult.hasPendingChanges && syncResult.preview) {
        responseData.panel_pending = true;
        responseData.sync_preview = syncResult.preview;
      } else {
        responseData.panel_pending = false;
      }

      // 添加日志高亮和计数
      const logInfo = this.generateLogInfo(task, params);
      responseData.logs_highlights = logInfo.highlights;
      responseData.logs_full_count = logInfo.fullCount;

      // 添加缓存信息
      responseData.md_version = this.generateMdVersion(task);

      // 添加 hints 信息（read 上下文会返回 task hints）
      responseData.hints = this.getActiveHints(task);

      this.logOperation(
        LogCategory.Task,
        LogAction.Handle,
        '任务状态读取完成',
        {
          taskId: task.id,
          evrReady: responseData.evr_ready,
          panelPending: responseData.panel_pending,
          logsHighlights: responseData.logs_highlights.length,
          taskHintsCount: responseData.hints?.task?.length || 0,
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
  private async checkPanelSync(task: any): Promise<{
    hasPendingChanges: boolean;
    preview?: SyncPreview;
  }> {
    try {
      // 尝试读取面板内容
      const panelPath = this.taskManager.getCurrentTaskPanelPath();
      if (!panelPath) {
        return { hasPendingChanges: false };
      }

      // 检查面板文件是否存在
      const fs = await import('fs-extra');
      if (!(await fs.pathExists(panelPath))) {
        return { hasPendingChanges: false };
      }

      // 读取面板内容
      const panelContent = await fs.readFile(panelPath, 'utf8');
      if (!panelContent || panelContent.trim() === '') {
        return { hasPendingChanges: false };
      }

      // 将 CurrentTask 转换为 LazySync 期望的 TaskData 结构（仅预览用）
      const taskData: any = {
        id: task.id,
        title: task.title,
        goal: task.goal,
        requirements: task.goal ? [task.goal] : [],
        issues: [],
        hints: task.task_hints || [],
        plans: task.overall_plan || [],
        expectedResults: task.expectedResults || [],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        projectId: task.project_id || '',
        // 不在预览中提供 panelModTime，确保 reason 保持 etag_mismatch
      };

      // 使用 LazySync 检测差异（干运行模式）
      const diff = this.lazySync.detectDifferences(panelContent, taskData);

      if (!diff.hasChanges) {
        return { hasPendingChanges: false };
      }

      // 创建同步预览（applied=false 表示仅预览）
      const changes: any[] = [];

      // 添加内容变更
      changes.push(
        ...diff.contentChanges.map((change: any) => ({
          type: 'content' as const,
          section: change.section,
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          source: change.source,
        }))
      );

      // 添加状态变更（标记为 status 类型）
      changes.push(
        ...diff.statusChanges.map((stateChange: any) => ({
          type: 'status' as const,
          section: stateChange.target === 'plan' ? stateChange.id : `${stateChange.target}:${stateChange.id}`,
          field: 'status',
          oldValue: stateChange.oldStatus,
          newValue: stateChange.newStatus,
          source: 'panel' as const,
        }))
      );

      // 为了在预览中提供冲突的解决建议，使用引擎计算一次冲突解法
      // 注意：这里不会持久化任何变更，仅用于生成 resolution 供展示
      const dryRun = await this.lazySync.applySyncChanges(diff, 'etag_first_then_ts');

      const preview: SyncPreview = {
        applied: false,
        changes,
        conflicts: (dryRun.conflicts as any) || diff.conflicts || [],
        affectedSections: [
          ...new Set([
            ...diff.contentChanges.map((c: any) => c.section),
            ...diff.statusChanges.map((s: any) => s.id),
          ]),
        ] as string[],
      };

      return {
        hasPendingChanges: true,
        preview,
      };
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
   * 选择高亮日志（使用新的 LogHighlightSelector）
   */
  private selectHighlightLogs(logs: any[]): LogEntry[] {
    const selector = new LogHighlightSelector({ maxHighlights: 20 });
    const highlights = selector.selectHighlights(logs);

    // 转换为 LogEntry 格式
    return highlights.map((h) => ({
      ts: h.ts,
      level: h.level,
      category: h.category,
      action: h.action,
      message: h.message,
    }));
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
   * 获取 current_task_read 的 hints
   * 只返回 task-level hints（符合隔离规则）
   */
  private getActiveHints(task: any): {
    task: string[];
    plan: string[];
    step: string[];
  } {
    return {
      task: task.task_hints || [],
      plan: [],  // read 上下文不返回 plan hints
      step: [],  // read 上下文不返回 step hints
    };
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

      // 处理 plan_no 参数（将序号转换为 plan_id）
      let planId = params.plan_id;
      if (params.plan_no !== undefined && !planId) {
        // 如果提供了 plan_no 但没有 plan_id，则需要先获取当前任务来查找对应的 plan_id
        const task = await this.taskManager.getCurrentTask(params.project_id);
        if (!task) {
          throw new ValidationError('当前没有活跃任务');
        }

        const planIndex = params.plan_no - 1; // plan_no 从 1 开始
        if (planIndex < 0 || planIndex >= task.overall_plan.length) {
          throw new ValidationError(`plan_no ${params.plan_no} 超出范围（1-${task.overall_plan.length}）`);
        }

        planId = task.overall_plan[planIndex].id;
      }

      // 验证条件逻辑
      if (params.field === 'steps' && !planId) {
        throw new ValidationError('修改步骤时需要提供plan_id或plan_no');
      }
      if (params.field === 'hints' && params.step_id && !planId) {
        throw new ValidationError('修改步骤级提示时需要提供plan_id或plan_no');
      }

      this.logOperation(
        LogCategory.Task,
        LogAction.Modify,
        `开始修改任务${params.field}`,
        {
          field: params.field,
          changeType: params.change_type,
          reason: params.reason,
          planNo: params.plan_no,
          planId: planId,
        }
      );

      // 调用 TaskManager 修改任务
      const result = await this.taskManager.modifyTask({
        field: params.field,
        content: params.content,
        reason: params.reason,
        plan_id: planId,  // 使用转换后的 plan_id
        plan_no: params.plan_no,  // 同时传递 plan_no（供 insert/remove/update 使用）
        step_id: params.step_id,
        step_no: params.step_no,  // 同时传递 step_no
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

      // 添加 EVR 摘要
      if (result.evr_summary) {
        responseData.evr_summary = result.evr_summary;
      }

      // 添加日志高亮
      if (result.evr_summary && result.evr_summary.total > 0) {
        responseData.logs_highlights = [
          {
            ts: new Date().toISOString(),
            level: 'INFO',
            category: 'TEST',
            message: `EVR 验证成功: ${result.evr_summary.passed.length} passed, ${result.evr_summary.skipped.length} skipped`,
          },
        ];
      }

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
    } catch (error: any) {
      // 检查是否是 EVR 验证失败
      if (error.code === 'EVR_NOT_READY' && error.evrValidation) {
        this.logOperation(
          LogCategory.Test,
          LogAction.Handle,
          'EVR 验证未就绪',
          {
            evrSummary: error.evrValidation.summary,
            requiredFinal: error.evrValidation.requiredFinal,
          }
        );

        // 直接构建错误响应，包含 EVR 相关字段
        const errorResponse = {
          success: false,
          error: 'EVR 验证未就绪，无法完成任务',
          error_code: 'EVR_NOT_READY',
          type: 'EVR_ERROR',
          timestamp: new Date().toISOString(),
          evr_required_final: error.evrValidation.requiredFinal,
          evr_summary: error.evrValidation.summary,
          logs_highlights: [
            {
              ts: new Date().toISOString(),
              level: 'ERROR',
              category: 'TEST',
              message: `EVR 验证失败: ${error.evrValidation.requiredFinal.length} 项未就绪`,
            },
          ],
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(errorResponse, null, 2),
            },
          ],
        };
      }

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
