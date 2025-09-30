/**
 * 握手工具实现
 * 实现 project_info 和 connect_project 工具，确保强制握手流程
 */

import { ProjectManager } from '../core/project-manager.js';
import { TaskManager } from '../core/task-manager.js';
import { logger } from '../core/logger.js';
import { errorHandler, ValidationError } from '../core/error-handler.js';
import {
  LogCategory,
  LogAction,
  ErrorCode,
  type ConnectParams,
  type ConnectionResult,
  type TaskSummary,
} from '../types/index.js';

/**
 * 握手工具基础类
 */
abstract class BaseHandshakeTool {
  protected projectManager: ProjectManager;
  protected taskManager: TaskManager;

  constructor(projectManager: ProjectManager, taskManager: TaskManager) {
    this.projectManager = projectManager;
    this.taskManager = taskManager;
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
              data,
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
  protected createErrorResponse(
    errorCode: ErrorCode,
    message: string,
    recovery?: any,
    context?: any
  ): any {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error_code: errorCode,
              message,
              recovery,
              timestamp: new Date().toISOString(),
              context,
            },
            null,
            2
          ),
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
 * project_info 工具实现
 * 返回连接状态和项目信息，强制握手流程的入口点
 */
export class ProjectInfoTool extends BaseHandshakeTool {
  /**
   * 处理 project_info 请求
   */
  async handle(): Promise<any> {
    try {
      this.logOperation(
        LogCategory.Task,
        LogAction.Handle,
        '开始获取项目连接信息'
      );

      // 检查项目连接状态
      const hasActiveProject = this.projectManager.hasActiveProject();

      if (!hasActiveProject) {
        // 未连接状态
        this.logOperation(
          LogCategory.Task,
          LogAction.Handle,
          '项目未连接，返回未连接状态'
        );

        return this.createSuccessResponse({
          connected: false,
          project: null,
          active_task: null,
          recent_tasks: [],
          message: '当前会话未连接项目，请先调用 connect_project',
          next_action: {
            tool: 'connect_project',
            required_params: ['project_path'],
            example: {
              project_path: '/path/to/your/project',
            },
          },
        });
      }

      // 已连接状态，获取项目信息
      const projectInfo = await this.projectManager.getProjectInfo();

      // 获取活动任务信息
      let activeTask: TaskSummary | null = null;
      try {
        const currentTask = await this.taskManager.getCurrentTask();
        if (currentTask) {
          activeTask = {
            id: currentTask.id,
            title: currentTask.title,
            slug: currentTask.slug,
            status: 'active' as const,
            created_at: currentTask.created_at,
            updated_at: currentTask.updated_at,
            goal: currentTask.goal,
            taskDir: '', // 由 TaskManager 填充
            progress: {
              totalPlans: currentTask.overall_plan.length,
              completedPlans: currentTask.overall_plan.filter(
                (p) => p.status === 'completed'
              ).length,
              currentPlanId: currentTask.current_plan_id,
            },
          };
        }
      } catch (error) {
        // 获取任务信息失败不影响项目信息返回
        this.logOperation(
          LogCategory.Task,
          LogAction.Handle,
          '获取活动任务信息失败',
          { error: error instanceof Error ? error.message : String(error) }
        );
      }

      // 获取最近任务列表
      let recentTasks: TaskSummary[] = [];
      try {
        const taskHistory = await this.taskManager.getTaskHistory();
        recentTasks = taskHistory.slice(0, 5); // 最近5个任务
      } catch (error) {
        // 获取历史任务失败不影响主要功能
        this.logOperation(
          LogCategory.Task,
          LogAction.Handle,
          '获取最近任务列表失败',
          { error: error instanceof Error ? error.message : String(error) }
        );
      }

      this.logOperation(
        LogCategory.Task,
        LogAction.Handle,
        '项目连接信息获取成功',
        {
          projectId: projectInfo.project.id,
          hasActiveTask: activeTask !== null,
          recentTasksCount: recentTasks.length,
        }
      );

      return this.createSuccessResponse({
        connected: true,
        project: {
          id: projectInfo.project.id,
          root: projectInfo.project.root,
          slug: projectInfo.project.slug,
          origin: projectInfo.project.origin,
        },
        active_task: activeTask,
        recent_tasks: recentTasks,
        session_info: {
          connected_at: new Date().toISOString(), // 实际应该从 ProjectManager 获取
          session_id: 'session-' + Date.now(), // 临时实现
        },
      });
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '获取项目连接信息失败',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );

      // 如果是 NO_ACTIVE_PROJECT 错误，转换为未连接状态
      if (
        error instanceof Error &&
        error.message.includes('NO_ACTIVE_PROJECT')
      ) {
        return this.createSuccessResponse({
          connected: false,
          project: null,
          active_task: null,
          recent_tasks: [],
          message: '项目连接已失效，请重新连接',
          next_action: {
            tool: 'connect_project',
            required_params: ['project_path'],
          },
        });
      }

      const errorResponse = errorHandler.handleError(error, {
        tool: 'project_info',
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
      };
    }
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: 'project_info',
      description:
        '获取当前连接状态和项目信息，握手流程的入口点。必须首先调用此工具检查连接状态。',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        additionalProperties: false,
      },
    };
  }
}

/**
 * connect_project 工具实现
 * 连接项目到当前会话，支持多种连接方式
 */
export class ConnectProjectTool extends BaseHandshakeTool {
  /**
   * 处理 connect_project 请求
   */
  async handle(params: any): Promise<any> {
    try {
      // 参数验证
      this.validateParams(params);

      this.logOperation(LogCategory.Task, LogAction.Create, '开始连接项目', {
        params,
      });

      // 构建连接参数
      const connectParams: ConnectParams = {};

      if (params.root) {
        connectParams.root = params.root;
      }
      if (params.project_path) {
        connectParams.root = params.project_path; // project_path 映射到 root
      }
      if (params.slug) {
        connectParams.slug = params.slug;
      }
      if (params.repo) {
        connectParams.repo = params.repo;
      }

      // 执行项目连接
      const result = await this.connectProject(connectParams);

      if (!result.connected) {
        // 连接失败
        this.logOperation(LogCategory.Task, LogAction.Create, '项目连接失败', {
          error: result.error,
          message: result.message,
        });

        return this.createErrorResponse(
          result.error || ErrorCode.NOT_FOUND,
          result.message || '项目连接失败',
          this.getRecoveryGuidance(result.error),
          {
            candidates: result.candidates,
            attempted_params: connectParams,
          }
        );
      }

      // 连接成功
      this.logOperation(LogCategory.Task, LogAction.Create, '项目连接成功', {
        projectId: result.project!.id,
        root: result.project!.root,
        slug: result.project!.slug,
      });

      return this.createSuccessResponse({
        connected: true,
        project: {
          id: result.project!.id,
          root: result.project!.root,
          slug: result.project!.slug,
          origin: result.project!.origin,
        },
        message: '项目连接成功',
        next_steps: [
          '可以调用 project_info 查看连接状态',
          '可以调用 current_task_init 创建新任务',
          '可以调用 current_task_read 查看现有任务（如果有）',
        ],
      });
    } catch (error) {
      this.logOperation(
        LogCategory.Exception,
        LogAction.Handle,
        '项目连接过程中发生错误',
        {
          error: error instanceof Error ? error.message : String(error),
          params,
        }
      );

      if (error instanceof ValidationError) {
        return this.createErrorResponse(ErrorCode.INVALID_ROOT, error.message, {
          next_action: 'connect_project',
          required_params: ['project_path'],
          example: {
            project_path: '/absolute/path/to/project',
          },
        });
      }

      const errorResponse = errorHandler.handleError(error, {
        tool: 'connect_project',
        params,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
      };
    }
  }

  /**
   * 验证连接参数
   */
  private validateParams(params: any): void {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('参数必须是对象类型');
    }

    // 至少需要提供一个连接参数
    if (!params.root && !params.project_path && !params.slug && !params.repo) {
      throw new ValidationError(
        '必须提供至少一个连接参数：root、project_path、slug 或 repo'
      );
    }

    // 验证路径参数
    if (params.root && typeof params.root !== 'string') {
      throw new ValidationError('root 参数必须是字符串类型');
    }
    if (params.project_path && typeof params.project_path !== 'string') {
      throw new ValidationError('project_path 参数必须是字符串类型');
    }
    if (params.slug && typeof params.slug !== 'string') {
      throw new ValidationError('slug 参数必须是字符串类型');
    }
    if (params.repo && typeof params.repo !== 'string') {
      throw new ValidationError('repo 参数必须是字符串类型');
    }

    // 验证路径不为空
    const pathParam = params.root || params.project_path;
    if (pathParam && pathParam.trim() === '') {
      throw new ValidationError('路径参数不能为空字符串');
    }
  }

  /**
   * 执行项目连接逻辑
   * 使用 ProjectManager.connectProject 而不是旧的 bindProject
   */
  private async connectProject(
    params: ConnectParams
  ): Promise<ConnectionResult> {
    try {
      // 直接使用 ProjectManager 的新 connectProject 方法
      // 这会调用 EnhancedProjectRegistry.connectProject
      const result = await this.projectManager.connectProject(params);
      return result;
    } catch (error) {
      return {
        connected: false,
        error: ErrorCode.NOT_FOUND,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // 注意：以下方法已被移除，因为我们现在直接使用 ProjectManager.connectProject
  // 这些方法使用了旧的 bindProject 逻辑，导致与 project_bind 共享问题
  // connectByRoot, connectBySlug, connectByRepo 现在由 EnhancedProjectRegistry 处理

  /**
   * 获取错误恢复指引
   */
  private getRecoveryGuidance(errorCode?: ErrorCode): any {
    switch (errorCode) {
      case ErrorCode.INVALID_ROOT:
        return {
          next_action: 'connect_project',
          required_params: ['project_path'],
          suggestions: [
            '确保提供的路径是绝对路径',
            '确保路径指向一个存在的目录',
            '确保对该目录有读写权限',
          ],
          example: {
            project_path: '/Users/username/projects/my-project',
          },
        };

      case ErrorCode.MULTIPLE_CANDIDATES:
        return {
          next_action: 'connect_project',
          required_params: ['project_path'],
          suggestions: [
            '使用具体的项目路径而不是 slug',
            '从候选列表中选择正确的项目路径',
          ],
        };

      case ErrorCode.MISSING_PERMISSIONS:
        return {
          suggestions: [
            '检查目录权限设置',
            '确保当前用户有读写权限',
            '尝试使用 chmod 修改权限',
          ],
        };

      default:
        return {
          next_action: 'project_info',
          suggestions: ['先调用 project_info 检查当前状态'],
        };
    }
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: 'connect_project',
      description:
        '连接项目到当前会话。支持通过绝对路径、项目 slug 或仓库地址连接。连接成功后才能使用其他任务管理工具。参数 root/project_path/slug/repo 至少提供一个。',
      inputSchema: {
        type: 'object' as const,
        properties: {
          root: {
            type: 'string' as const,
            description: '项目根目录的绝对路径（优先级最高）',
          },
          project_path: {
            type: 'string' as const,
            description: '项目路径（与 root 相同，为兼容性保留）',
          },
          slug: {
            type: 'string' as const,
            description: '项目 slug 标识符',
          },
          repo: {
            type: 'string' as const,
            description: '项目仓库地址',
          },
        },
        // 移除 anyOf，改为更简单的定义
        // 某些 MCP 客户端（Cursor/Kiro）不支持 anyOf 语法
        additionalProperties: false,
      },
    };
  }
}

/**
 * 握手检查中间件
 * 用于在其他工具中检查项目连接状态
 */
export class HandshakeChecker {
  private projectManager: ProjectManager;
  private taskManager: TaskManager;

  constructor(projectManager: ProjectManager, taskManager: TaskManager) {
    this.projectManager = projectManager;
    this.taskManager = taskManager;
  }

  /**
   * 检查项目连接状态
   * 返回错误响应或 null（表示检查通过）
   */
  async checkProjectConnection(): Promise<any | null> {
    if (!this.projectManager.hasActiveProject()) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error_code: ErrorCode.NO_PROJECT_BOUND,
                message: '未连接项目，请先调用 connect_project',
                recovery: {
                  next_action: 'connect_project',
                  required_params: ['project_path'],
                  example: {
                    project_path: '/path/to/your/project',
                  },
                },
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return null; // 检查通过
  }

  /**
   * 检查活动任务状态
   * 返回错误响应或 null（表示检查通过）
   */
  async checkActiveTask(): Promise<any | null> {
    // 先检查项目连接
    const projectCheck = await this.checkProjectConnection();
    if (projectCheck) {
      return projectCheck;
    }

    // 检查活动任务
    try {
      // 获取当前连接的项目 ID
      const activeProject = this.projectManager.getActiveProject();
      const projectId = activeProject?.project_id;

      // 尝试获取当前任务，先尝试带项目 ID 的路径
      let currentTask = await this.taskManager.getCurrentTask(projectId);

      // 如果带项目 ID 的路径没找到任务，且项目 ID 存在，则尝试默认路径
      if (!currentTask && projectId) {
        currentTask = await this.taskManager.getCurrentTask();
      }
      if (!currentTask) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error_code: ErrorCode.NO_ACTIVE_TASK,
                  message: '当前没有活动任务，请先创建任务',
                  recovery: {
                    next_action: 'current_task_init',
                    required_params: ['title', 'goal'],
                    example: {
                      title: '任务标题',
                      goal: '验收标准和成功指标',
                    },
                  },
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }
    } catch (error) {
      // 获取任务失败，可能是数据问题
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error_code: ErrorCode.NO_ACTIVE_TASK,
                message: '无法获取当前任务，请检查任务数据或创建新任务',
                recovery: {
                  next_action: 'current_task_init',
                  required_params: ['title', 'goal'],
                },
                error_details:
                  error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return null; // 检查通过
  }
}
