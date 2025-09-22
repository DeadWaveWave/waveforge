#!/usr/bin/env node

/**
 * WaveForge MCP 任务管理系统服务器入口
 * 最小可运行版本 - 使用官方 MCP SDK
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListRootsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { errorHandler, ValidationError } from './core/error-handler.js';
import { logger } from './core/logger.js';
import { LogCategory, LogAction } from './types/index.js';
import { HealthTool, PingTool } from './tools/index.js';
import {
  CurrentTaskInitTool,
  CurrentTaskUpdateTool,
  CurrentTaskReadTool,
  CurrentTaskModifyTool,
  CurrentTaskCompleteTool,
  CurrentTaskLogTool,
} from './tools/task-tools.js';
import { ProjectRootManager } from './core/project-root-manager.js';
import { toolRegistry } from './core/tool-registry.js';
import { TaskManager } from './core/task-manager.js';
import { ulid } from 'ulid';
import * as path from 'path';

/**
 * WaveForge MCP 服务器类
 * 严格 TypeScript 模式实现
 */
class WaveForgeServer {
  private readonly server: Server;
  private readonly projectRootManager: ProjectRootManager;
  private taskManager: TaskManager;
  private readonly startTime: number;
  private readonly serverId: string;
  private readonly middleware: ReturnType<typeof errorHandler.createMiddleware>;
  private isShuttingDown: boolean = false;

  constructor() {
    this.startTime = Date.now();
    this.serverId = ulid();
    this.projectRootManager = new ProjectRootManager();
    // TaskManager 将在 initializeProjectRoot 之后初始化
    this.taskManager = null as any; // 临时设置，稍后初始化
    this.middleware = errorHandler.createMiddleware();

    this.server = new Server(
      {
        name: 'waveforge-mcp-task-management',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          roots: {
            listChanged: true,
          },
        },
      }
    );

    // 设置日志上下文
    logger.setSessionId(this.serverId);
    logger.setCorrelationId(`server-${this.serverId}`);

    this.setupHandlers();
    this.setupNotificationHandlers();
    this.registerSystemTools();
    this.registerTaskManagementTools();
  }

  /**
   * 设置 MCP 处理器
   * 严格类型检查和错误处理
   */
  private setupHandlers(): void {
    // 工具列表处理器
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      this.middleware.wrapAsync(
        async () => {
          const tools = toolRegistry.getToolDefinitions();
          logger.info(LogCategory.Task, LogAction.Handle, '工具列表请求', {
            toolCount: tools.length,
            tools: tools.map((t) => t.name),
          });
          return { tools };
        },
        { operation: 'list_tools' }
      )
    );

    // 根目录列表处理器
    this.server.setRequestHandler(
      ListRootsRequestSchema,
      this.middleware.wrapAsync(
        async () => {
          const projectRoot = this.projectRootManager.getProjectRoot();

          if (projectRoot && projectRoot.available) {
            logger.info(
              LogCategory.Task,
              LogAction.Handle,
              'MCP 根目录列表请求',
              {
                root: projectRoot.root,
                source: projectRoot.source,
              }
            );

            return {
              roots: [
                {
                  uri: `file://${projectRoot.root}`,
                  name: `Project Root (${projectRoot.source})`,
                },
              ],
            };
          }

          logger.warning(
            LogCategory.Task,
            LogAction.Handle,
            'MCP 根目录列表请求 - 无可用根目录'
          );

          return { roots: [] };
        },
        { operation: 'list_roots' }
      )
    );

    // 工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const timer = logger.createTimer(`tool-${name}`);

      try {
        // 严格类型检查
        if (typeof name !== 'string') {
          throw new ValidationError('工具名称必须是字符串类型');
        }

        // 记录工具调用
        logger.toolCall(name, args);

        // 验证工具名称
        if (!name || name.trim().length === 0) {
          throw new ValidationError('工具名称不能为空');
        }

        // 从工具注册表获取处理器
        const toolHandler = toolRegistry.getToolHandler(name);
        if (!toolHandler) {
          const availableTools = toolRegistry
            .getToolDefinitions()
            .map((def) => def.name);
          throw new ValidationError(`未知工具: ${name}`, {
            availableTools,
          });
        }

        // 验证参数（如果工具提供了验证方法）
        const validatedArgs = toolHandler.validateArgs
          ? toolHandler.validateArgs(args)
          : args;

        // 调用工具处理器
        const result = await toolHandler.handle(validatedArgs);

        // 记录成功完成
        timer.end(LogCategory.Task, LogAction.Handle, `工具 ${name} 执行完成`, {
          tool: name,
          success: true,
        });

        return result;
      } catch (error) {
        // 记录错误完成
        timer.end(
          LogCategory.Exception,
          LogAction.Handle,
          `工具 ${name} 执行失败`,
          {
            tool: name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        );

        const errorResponse = errorHandler.handleError(error, {
          tool: name,
          args: args,
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
    });
  }

  /**
   * 注册系统工具
   */
  private registerSystemTools(): void {
    // 注册 health 工具
    toolRegistry.registerTool({
      name: 'health',
      handler: {
        getDefinition: () => HealthTool.getDefinition(),
        handle: async () => {
          const healthTool = new HealthTool(
            this.startTime,
            this.projectRootManager.getProjectRoot()
          );
          return await healthTool.handle();
        },
      },
      category: 'system',
      description: '检查服务器健康状态',
      enabled: true,
    });

    // 注册 ping 工具
    toolRegistry.registerTool({
      name: 'ping',
      handler: {
        getDefinition: () => PingTool.getDefinition(),
        handle: async (args) => {
          const pingTool = new PingTool();
          return await pingTool.handle(args as { message?: string });
        },
        validateArgs: (args: unknown): { message?: string } => {
          if (args === null || args === undefined) {
            return {};
          }

          if (typeof args !== 'object') {
            throw new ValidationError('ping 工具参数必须是对象类型');
          }

          const argsObj = args as Record<string, unknown>;
          const result: { message?: string } = {};

          if ('message' in argsObj) {
            if (typeof argsObj.message === 'string') {
              result.message = argsObj.message;
            } else if (
              argsObj.message !== undefined &&
              argsObj.message !== null
            ) {
              throw new ValidationError(
                'ping 工具的 message 参数必须是字符串类型'
              );
            }
          }

          return result;
        },
      },
      category: 'system',
      description: '测试服务器连接',
      enabled: true,
    });

    logger.info(LogCategory.Task, LogAction.Create, '系统工具注册完成', {
      tools: toolRegistry.getStats(),
    });
  }

  /**
   * 注册任务管理工具
   */
  private registerTaskManagementTools(): void {
    // 注册 current_task_init 工具
    toolRegistry.registerTool({
      name: 'current_task_init',
      handler: {
        getDefinition: () => CurrentTaskInitTool.getDefinition(),
        handle: async (args) => {
          const tool = new CurrentTaskInitTool(this.taskManager);
          return await tool.handle(args);
        },
      },
      category: 'task',
      description: '初始化新的开发任务',
      enabled: true,
    });

    // 注册 current_task_update 工具
    toolRegistry.registerTool({
      name: 'current_task_update',
      handler: {
        getDefinition: () => CurrentTaskUpdateTool.getDefinition(),
        handle: async (args) => {
          const tool = new CurrentTaskUpdateTool(this.taskManager);
          return await tool.handle(args);
        },
      },
      category: 'task',
      description: '更新任务状态和进度',
      enabled: true,
    });

    // 注册 current_task_read 工具
    toolRegistry.registerTool({
      name: 'current_task_read',
      handler: {
        getDefinition: () => CurrentTaskReadTool.getDefinition(),
        handle: async (args) => {
          const tool = new CurrentTaskReadTool(this.taskManager);
          return await tool.handle(args);
        },
      },
      category: 'task',
      description: '读取当前任务完整状态以恢复上下文',
      enabled: true,
    });

    // 注册 current_task_modify 工具
    toolRegistry.registerTool({
      name: 'current_task_modify',
      handler: {
        getDefinition: () => CurrentTaskModifyTool.getDefinition(),
        handle: async (args) => {
          const tool = new CurrentTaskModifyTool(this.taskManager);
          return await tool.handle(args);
        },
      },
      category: 'task',
      description: '修改任务目标、计划或步骤',
      enabled: true,
    });

    // 注册 current_task_complete 工具
    toolRegistry.registerTool({
      name: 'current_task_complete',
      handler: {
        getDefinition: () => CurrentTaskCompleteTool.getDefinition(),
        handle: async (args) => {
          const tool = new CurrentTaskCompleteTool(this.taskManager);
          return await tool.handle(args);
        },
      },
      category: 'task',
      description: '完成当前任务并生成文档',
      enabled: true,
    });

    // 注册 current_task_log 工具
    toolRegistry.registerTool({
      name: 'current_task_log',
      handler: {
        getDefinition: () => CurrentTaskLogTool.getDefinition(),
        handle: async (args) => {
          const tool = new CurrentTaskLogTool(this.taskManager);
          return await tool.handle(args);
        },
      },
      category: 'task',
      description: '记录非任务状态变更的重要事件',
      enabled: true,
    });

    logger.info(LogCategory.Task, LogAction.Create, '任务管理工具注册完成', {
      tools: toolRegistry.getStats(),
    });
  }

  /**
   * 记录系统健康状态
   */
  private logSystemHealth(): void {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const projectRoot = this.projectRootManager.getProjectRoot();
    const toolStats = toolRegistry.getStats();
    const logStats = logger.getStats();
    const errorStats = errorHandler.getMetrics();

    logger.health('系统健康状态检查', {
      serverId: this.serverId,
      uptime: Math.floor(uptime),
      memory: {
        rss: Math.floor(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.floor(memoryUsage.external / 1024 / 1024), // MB
      },
      projectRoot: {
        available: projectRoot?.available || false,
        source: projectRoot?.source,
        path: projectRoot?.root,
      },
      tools: {
        total: toolStats.total,
        enabled: toolStats.enabled,
        byCategory: toolStats.byCategory,
      },
      logs: {
        total: logStats.total,
        errors: logStats.errors.length,
        recent: logStats.recent.length,
      },
      errors: {
        total: errorStats.total,
        byType: errorStats.byType,
        recent: errorStats.recent.length,
      },
    });
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(): {
    serverId: string;
    startTime: number;
    uptime: number;
    isShuttingDown: boolean;
    projectRoot: any;
    tools: any;
    logs: any;
    errors: any;
  } {
    const projectRoot = this.projectRootManager.getProjectRoot();
    const toolStats = toolRegistry.getStats();
    const logStats = logger.getStats();
    const errorStats = errorHandler.getMetrics();

    return {
      serverId: this.serverId,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
      isShuttingDown: this.isShuttingDown,
      projectRoot: {
        available: projectRoot?.available || false,
        source: projectRoot?.source,
        path: projectRoot?.root,
      },
      tools: toolStats,
      logs: {
        total: logStats.total,
        byLevel: logStats.byLevel,
        errors: logStats.errors.length,
      },
      errors: {
        total: errorStats.total,
        byType: errorStats.byType,
        recent: errorStats.recent.length,
      },
    };
  }

  /**
   * 初始化项目根目录
   */
  private async initializeProjectRoot(): Promise<void> {
    await this.projectRootManager.initializeProjectRoot();
  }

  /**
   * 设置通知处理器
   */
  private setupNotificationHandlers(): void {
    // 注意：在实际的 MCP 实现中，客户端根目录通常通过初始化参数传递
    // 这里我们提供一个占位符实现，实际的根目录检测在 initializeProjectRoot 中进行
    logger.info(LogCategory.Task, LogAction.Create, '通知处理器已设置', {
      handlers: ['roots/list_changed'],
    });
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    const startupTimer = logger.createTimer('server-startup');

    try {
      logger.startup('MCP 任务管理服务器启动中...', {
        version: '0.1.0',
        serverId: this.serverId,
        nodeVersion: process.version,
        platform: process.platform,
      });

      // 设置进程信号处理
      this.setupSignalHandlers();

      // 初始化项目根目录
      await this.initializeProjectRoot();

      // 初始化 TaskManager（强制使用正确的项目路径）
      const projectRoot = this.projectRootManager.getProjectRoot();

      logger.info(
        LogCategory.Task,
        LogAction.Create,
        'TaskManager初始化调试信息',
        {
          projectRoot: projectRoot?.root,
          projectRootSource: projectRoot?.source,
          currentDir: process.cwd(),
          argv1: process.argv[1],
        }
      );

      // 临时解决方案：如果项目根目录是 / 或检测失败，使用脚本所在目录的上上级目录
      let waveDir: string;
      if (projectRoot?.root && projectRoot.root !== '/') {
        waveDir = `${projectRoot.root}/.wave`;
      } else {
        // 使用脚本文件所在目录的上上级目录作为项目根目录
        // 因为脚本在 dist/ 目录中，我们需要回到项目根目录
        const scriptDir = path.dirname(process.argv[1] || __filename);
        const possibleProjectRoot = path.resolve(scriptDir, '..', '..');
        waveDir = `${possibleProjectRoot}/.wave`;
      }

      logger.info(LogCategory.Task, LogAction.Create, 'TaskManager路径信息', {
        waveDir,
        resolved: path.resolve(waveDir),
        scriptDir: path.dirname(process.argv[1] || __filename),
      });

      this.taskManager = new TaskManager(waveDir);

      // 创建 stdio 传输
      const transport = new StdioServerTransport();

      // 连接服务器和传输
      await this.server.connect(transport);
      const toolStats = toolRegistry.getStats();

      startupTimer.end(LogCategory.Task, LogAction.Create, '服务器启动完成');

      logger.startup('服务器已启动，等待客户端连接...', {
        serverId: this.serverId,
        projectRoot: projectRoot?.root,
        projectRootSource: projectRoot?.source,
        capabilities: ['tools', 'roots'],
        registeredTools: toolStats.total,
        enabledTools: toolStats.enabled,
      });

      // 记录系统健康状态
      this.logSystemHealth();
    } catch (error) {
      startupTimer.end(
        LogCategory.Exception,
        LogAction.Handle,
        '服务器启动失败'
      );
      logger.error(LogCategory.Exception, LogAction.Create, '服务器启动失败', {
        error: error instanceof Error ? error.message : String(error),
        serverId: this.serverId,
      });
      throw error;
    }
  }

  /**
   * 设置进程信号处理器
   */
  private setupSignalHandlers(): void {
    // 处理 SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info(
        LogCategory.Task,
        LogAction.Handle,
        '收到 SIGINT 信号，开始优雅关闭...'
      );
      this.gracefulShutdown('SIGINT');
    });

    // 处理 SIGTERM (终止信号)
    process.on('SIGTERM', () => {
      logger.info(
        LogCategory.Task,
        LogAction.Handle,
        '收到 SIGTERM 信号，开始优雅关闭...'
      );
      this.gracefulShutdown('SIGTERM');
    });

    // 处理 SIGHUP (挂起信号)
    process.on('SIGHUP', () => {
      logger.info(
        LogCategory.Task,
        LogAction.Handle,
        '收到 SIGHUP 信号，重新加载配置...'
      );
      this.reloadConfiguration();
    });
  }

  /**
   * 优雅关闭服务器
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warning(
        LogCategory.Task,
        LogAction.Handle,
        '服务器已在关闭过程中',
        { signal }
      );
      return;
    }

    this.isShuttingDown = true;
    const shutdownTimer = logger.createTimer('server-shutdown');

    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      logger.info(
        LogCategory.Task,
        LogAction.Handle,
        `开始优雅关闭服务器 (${signal})`,
        {
          uptime,
          signal,
          serverId: this.serverId,
        }
      );

      // 记录关闭前的系统状态
      this.logSystemHealth();

      // 设置关闭超时，防止无限等待
      const shutdownTimeout = setTimeout(() => {
        logger.error(
          LogCategory.Exception,
          LogAction.Handle,
          '优雅关闭超时，强制退出',
          {
            timeout: 5000,
            serverId: this.serverId,
          }
        );
        process.exit(1);
      }, 5000);

      // 执行清理操作
      await this.performCleanup();

      // 清除超时定时器
      clearTimeout(shutdownTimeout);

      shutdownTimer.end(LogCategory.Task, LogAction.Handle, '服务器关闭完成');

      logger.info(LogCategory.Task, LogAction.Handle, '服务器已优雅关闭', {
        uptime,
        totalRuntime: uptime,
        serverId: this.serverId,
        finalStats: this.getServerStatus(),
      });

      process.exit(0);
    } catch (error) {
      shutdownTimer.end(
        LogCategory.Exception,
        LogAction.Handle,
        '服务器关闭失败'
      );

      logger.error(
        LogCategory.Exception,
        LogAction.Handle,
        '优雅关闭过程中发生错误',
        {
          error: error instanceof Error ? error.message : String(error),
          signal,
          serverId: this.serverId,
        }
      );
      process.exit(1);
    }
  }

  /**
   * 执行清理操作
   */
  private async performCleanup(): Promise<void> {
    const cleanupTasks: Promise<void>[] = [];

    // 清理项目根目录管理器状态
    cleanupTasks.push(
      Promise.resolve().then(() => {
        logger.info(
          LogCategory.Task,
          LogAction.Handle,
          '清理项目根目录管理器状态',
          { serverId: this.serverId }
        );
        // 这里可以添加项目根目录相关的清理逻辑
      })
    );

    // 清理工具注册表
    cleanupTasks.push(
      Promise.resolve().then(() => {
        const toolStats = toolRegistry.getStats();
        logger.info(LogCategory.Task, LogAction.Handle, '清理工具注册表', {
          serverId: this.serverId,
          toolsToCleanup: toolStats.total,
        });
        // 工具注册表不需要特殊清理，但记录状态
      })
    );

    // 生成最终报告
    cleanupTasks.push(
      Promise.resolve().then(() => {
        const finalReport = {
          serverId: this.serverId,
          totalUptime: Date.now() - this.startTime,
          finalMemoryUsage: process.memoryUsage(),
          logStats: logger.getStats(),
          errorStats: errorHandler.getMetrics(),
          toolStats: toolRegistry.getStats(),
        };

        logger.audit(
          LogAction.Handle,
          '服务器关闭最终报告',
          finalReport,
          this.serverId
        );
      })
    );

    // 等待所有清理任务完成
    try {
      await Promise.all(cleanupTasks);
      logger.info(LogCategory.Task, LogAction.Handle, '所有清理任务已完成', {
        serverId: this.serverId,
        cleanupTasks: cleanupTasks.length,
      });
    } catch (error) {
      logger.warning(
        LogCategory.Exception,
        LogAction.Handle,
        '部分清理任务失败',
        {
          error: error instanceof Error ? error.message : String(error),
          serverId: this.serverId,
        }
      );
    }
  }

  /**
   * 重新加载配置
   */
  private async reloadConfiguration(): Promise<void> {
    const reloadTimer = logger.createTimer('config-reload');

    try {
      logger.info(LogCategory.Task, LogAction.Update, '重新加载配置中...', {
        serverId: this.serverId,
      });

      // 刷新项目根目录
      await this.projectRootManager.refreshProjectRoot();

      // 记录重新加载后的状态
      this.logSystemHealth();

      reloadTimer.end(LogCategory.Task, LogAction.Update, '配置重新加载完成');

      logger.info(LogCategory.Task, LogAction.Update, '配置重新加载完成', {
        serverId: this.serverId,
        newProjectRoot: this.projectRootManager.getProjectRoot(),
      });
    } catch (error) {
      reloadTimer.end(
        LogCategory.Exception,
        LogAction.Handle,
        '配置重新加载失败'
      );

      logger.error(
        LogCategory.Exception,
        LogAction.Handle,
        '重新加载配置失败',
        {
          error: error instanceof Error ? error.message : String(error),
          serverId: this.serverId,
        }
      );
    }
  }
}

// 启动服务器
async function main() {
  try {
    const server = new WaveForgeServer();
    await server.start();
  } catch (error) {
    console.error('[WaveForge] 服务器启动失败:', error);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error(LogCategory.Exception, LogAction.Handle, '未捕获的异常', {
    error: error.message,
    stack: error.stack,
    name: error.name,
  });

  // 给服务器一些时间来记录错误
  setTimeout(() => {
    process.exit(1);
  }, 100);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(
    LogCategory.Exception,
    LogAction.Handle,
    '未处理的 Promise 拒绝',
    {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
    }
  );

  // 给服务器一些时间来记录错误
  setTimeout(() => {
    process.exit(1);
  }, 100);
});

// 启动主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('[WaveForge] 主函数执行失败:', error);
    process.exit(1);
  });
}
