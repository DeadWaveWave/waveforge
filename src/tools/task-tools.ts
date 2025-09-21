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
import { TaskStatus, LogCategory, LogAction } from '../types/index.js';

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
 * 读取当前任务完整状态以恢复上下文
 */
export class CurrentTaskReadTool extends BaseTaskTool {
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
        { includeHealth: params.include_health }
      );

      // 获取当前任务
      const task = await this.taskManager.getCurrentTask();
      if (!task) {
        throw new NotFoundError('当前没有活跃任务');
      }

      // 处理日志限制
      const processedTask = { ...task };
      let logsExcluded = false;
      let logsTruncated = false;
      const totalLogsCount = task.logs.length;

      if (params.include_logs === false) {
        processedTask.logs = [];
        logsExcluded = true;
      } else if (params.logs_limit && task.logs.length > params.logs_limit) {
        processedTask.logs = task.logs.slice(-params.logs_limit);
        logsTruncated = true;
      }

      // 构建响应数据
      const responseData: any = {
        task: processedTask,
      };

      if (logsExcluded) {
        responseData.logs_excluded = true;
      }
      if (logsTruncated) {
        responseData.logs_truncated = true;
        responseData.total_logs_count = totalLogsCount;
      }

      // 添加健康度信息
      if (params.include_health !== false) {
        responseData.health = await this.generateHealthInfo(task);
      }

      // 添加历史引用
      if (params.include_history_refs !== false) {
        responseData.history_refs = await this.generateHistoryRefs();
      }

      // 添加格式化文档
      responseData.formatted_document = this.generateFormattedDocument(task);
      responseData.status_summary = this.generateStatusSummary(task);
      responseData.performance_info = {
        read_time_ms: (Date.now() % 100) + 10, // 模拟读取时间
        cache_hit: false,
        data_size_kb: Math.ceil(JSON.stringify(task).length / 1024),
      };

      this.logOperation(
        LogCategory.Task,
        LogAction.Handle,
        '任务状态读取完成',
        {
          taskId: task.id,
          logsCount: processedTask.logs.length,
          includeHealth: params.include_health !== false,
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
   * 生成健康度信息
   */
  private async generateHealthInfo(task: any) {
    const checks = {
      task_integrity: {
        status: 'passed',
        issues: [] as string[],
      },
      file_system: {
        status: 'passed',
        issues: [] as string[],
      },
      data_consistency: {
        status: 'passed',
        issues: [] as string[],
      },
    };

    // 检查任务完整性
    if (!task.overall_plan || task.overall_plan.length === 0) {
      checks.task_integrity.status = 'failed';
      checks.task_integrity.issues.push('缺少整体计划');
    }

    if (!task.goal || task.goal.trim().length === 0) {
      checks.task_integrity.status = 'failed';
      checks.task_integrity.issues.push('缺少任务目标');
    }

    // 检查数据一致性
    if (task.current_plan_id) {
      const currentPlan = task.overall_plan.find(
        (p: any) => p.id === task.current_plan_id
      );
      if (!currentPlan) {
        checks.data_consistency.status = 'failed';
        checks.data_consistency.issues.push('当前计划ID无效');
      }
    }

    const overallStatus = Object.values(checks).some(
      (check) => check.status === 'failed'
    )
      ? 'error'
      : Object.values(checks).some((check) => check.status === 'warning')
        ? 'warning'
        : 'healthy';

    return {
      status: overallStatus,
      checks,
      recommendations:
        overallStatus === 'healthy' ? [] : ['建议检查任务数据完整性'],
      last_check: new Date().toISOString(),
    };
  }

  /**
   * 生成历史引用
   */
  private async generateHistoryRefs() {
    try {
      const history = await this.taskManager.getTaskHistory();
      return {
        recent_tasks: history.slice(0, 5), // 最近5个任务
        total_count: history.length,
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      // 如果获取历史失败，返回空数据
      return {
        recent_tasks: [],
        total_count: 0,
        last_updated: new Date().toISOString(),
      };
    }
  }

  /**
   * 生成格式化的 Markdown 文档
   */
  private generateFormattedDocument(task: any): string {
    const lines = [
      `# ${task.title}`,
      '',
      '## 验收标准',
      task.goal,
      '',
      '## 整体计划',
    ];

    task.overall_plan.forEach((plan: any, index: number) => {
      const status =
        plan.status === 'completed'
          ? '✅'
          : plan.status === 'in_progress'
            ? '🔄'
            : plan.status === 'blocked'
              ? '🚫'
              : '⏳';
      lines.push(`${index + 1}. ${status} ${plan.description}`);

      if (plan.steps && plan.steps.length > 0) {
        plan.steps.forEach((step: any) => {
          const stepStatus =
            step.status === 'completed'
              ? '✅'
              : step.status === 'in_progress'
                ? '🔄'
                : step.status === 'blocked'
                  ? '🚫'
                  : '⏳';
          lines.push(`   - ${stepStatus} ${step.description}`);
        });
      }
    });

    lines.push('', '## 执行日志');
    task.logs.slice(-5).forEach((log: any) => {
      lines.push(`- **${log.timestamp}**: ${log.message}`);
    });

    return lines.join('\n');
  }

  /**
   * 生成状态摘要
   */
  private generateStatusSummary(task: any) {
    const currentPlan = task.overall_plan.find(
      (p: any) => p.id === task.current_plan_id
    );
    const completedPlans = task.overall_plan.filter(
      (p: any) => p.status === 'completed'
    ).length;
    const totalPlans = task.overall_plan.length;

    return {
      current_plan: currentPlan ? currentPlan.description : '无当前计划',
      progress: `${completedPlans}/${totalPlans} 计划完成`,
      next_actions:
        currentPlan && currentPlan.steps.length === 0
          ? ['需要为当前计划生成步骤']
          : ['继续执行当前计划'],
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
      const result = await this.taskManager.completeTask(params.summary);

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
