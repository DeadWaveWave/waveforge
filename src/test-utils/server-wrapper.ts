/**
 * 服务器测试包装器
 * 用于在测试环境中安全地实例化和测试服务器
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListRootsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { errorHandler, ValidationError } from '../core/error-handler.js';
import { logger } from '../core/logger.js';
import { LogCategory, LogAction } from '../types/index.js';
import { HealthTool, PingTool } from '../tools/index.js';
import { ProjectRootManager } from '../core/project-root-manager.js';
import { toolRegistry } from '../core/tool-registry.js';

/**
 * WaveForge MCP 服务器测试包装器
 * 与主服务器类相同，但可以在测试环境中安全使用
 * 严格 TypeScript 模式实现
 */
export class WaveForgeServer {
  private readonly server: Server;
  private readonly projectRootManager: ProjectRootManager;
  private readonly startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.projectRootManager = new ProjectRootManager();

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

    this.setupHandlers();
    this.setupNotificationHandlers();
    this.setupSignalHandlers();
    this.registerSystemTools();
  }

  /**
   * 设置 MCP 处理器
   */
  private setupHandlers(): void {
    // 工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolRegistry.getToolDefinitions(),
      };
    });

    // 根目录列表处理器
    this.server.setRequestHandler(ListRootsRequestSchema, async () => {
      const projectRoot = this.projectRootManager.getProjectRoot();

      if (projectRoot && projectRoot.available) {
        logger.info(LogCategory.Task, LogAction.Handle, 'MCP 根目录列表请求', {
          root: projectRoot.root,
          source: projectRoot.source,
        });

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
    });

    // 工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // 严格类型检查
      if (typeof name !== 'string') {
        throw new ValidationError('工具名称必须是字符串类型');
      }

      // 记录工具调用
      logger.toolCall(name, args);

      try {
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
        return await toolHandler.handle(validatedArgs);
      } catch (error) {
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
   * 初始化项目根目录
   */
  private async initializeProjectRoot(): Promise<void> {
    await this.projectRootManager.initializeProjectRoot();
  }

  /**
   * 设置通知处理器
   */
  private setupNotificationHandlers(): void {
    logger.info(LogCategory.Task, LogAction.Create, '通知处理器已设置', {
      handlers: ['roots/list_changed'],
    });
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    logger.startup('MCP 任务管理服务器启动中...', { version: '0.1.0' });

    // 初始化项目根目录
    await this.initializeProjectRoot();

    // 创建 stdio 传输
    const transport = new StdioServerTransport();

    // 连接服务器和传输
    await this.server.connect(transport);

    const projectRoot = this.projectRootManager.getProjectRoot();
    logger.startup('服务器已启动，等待客户端连接...', {
      projectRoot: projectRoot?.root,
      projectRootSource: projectRoot?.source,
      capabilities: ['tools', 'roots'],
    });
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
    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      logger.info(
        LogCategory.Task,
        LogAction.Handle,
        `开始优雅关闭服务器 (${signal})`,
        { uptime, signal }
      );

      // 设置关闭超时，防止无限等待
      const shutdownTimeout = setTimeout(() => {
        logger.error(
          LogCategory.Exception,
          LogAction.Handle,
          '优雅关闭超时，强制退出',
          { timeout: 5000 }
        );
        // 在测试环境中不调用 process.exit，避免未处理的错误
        if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
          process.exit(1);
        }
      }, 5000);

      // 执行清理操作
      await this.performCleanup();

      // 清除超时定时器
      clearTimeout(shutdownTimeout);

      logger.info(LogCategory.Task, LogAction.Handle, '服务器已优雅关闭', {
        uptime,
        totalRuntime: uptime,
      });

      // 在测试环境中不调用 process.exit，避免未处理的错误
      if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
        process.exit(0);
      }
    } catch (error) {
      logger.error(
        LogCategory.Exception,
        LogAction.Handle,
        '优雅关闭过程中发生错误',
        {
          error: error instanceof Error ? error.message : String(error),
          signal,
        }
      );
      // 在测试环境中不调用 process.exit，避免未处理的错误
      if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
        process.exit(1);
      }
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
          '清理项目根目录管理器状态'
        );
      })
    );

    // 等待所有清理任务完成
    try {
      await Promise.all(cleanupTasks);
      logger.info(LogCategory.Task, LogAction.Handle, '所有清理任务已完成');
    } catch (error) {
      logger.warning(
        LogCategory.Exception,
        LogAction.Handle,
        '部分清理任务失败',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * 重新加载配置
   */
  private async reloadConfiguration(): Promise<void> {
    try {
      logger.info(LogCategory.Task, LogAction.Update, '重新加载配置中...');

      // 刷新项目根目录
      await this.projectRootManager.refreshProjectRoot();

      logger.info(LogCategory.Task, LogAction.Update, '配置重新加载完成');
    } catch (error) {
      logger.error(
        LogCategory.Exception,
        LogAction.Handle,
        '重新加载配置失败',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * 获取服务器实例（用于测试）
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * 获取项目根目录管理器（用于测试）
   */
  getProjectRootManager(): ProjectRootManager {
    return this.projectRootManager;
  }

  /**
   * 获取启动时间（用于测试）
   */
  getStartTime(): number {
    return this.startTime;
  }
}
