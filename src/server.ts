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
  SetLevelRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ProjectRootInfo } from './types/index.js';
import { errorHandler, ValidationError } from './core/error-handler.js';
import { logger } from './core/logger.js';
import { LogCategory, LogAction } from './types/index.js';
import { HealthTool, PingTool } from './tools/index.js';
import { ProjectRootManager } from './core/project-root-manager.js';

/**
 * WaveForge MCP 服务器类
 */
class WaveForgeServer {
  private server: Server;
  private projectRootManager: ProjectRootManager;
  private startTime: number;

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
  }

  /**
   * 设置 MCP 处理器
   */
  private setupHandlers(): void {
    // 工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          HealthTool.getDefinition(),
          PingTool.getDefinition(),
        ],
      };
    });

    // 根目录列表处理器
    this.server.setRequestHandler(ListRootsRequestSchema, async () => {
      const projectRoot = this.projectRootManager.getProjectRoot();
      
      if (projectRoot && projectRoot.available) {
        logger.info(
          LogCategory.Task,
          LogAction.Handle,
          'MCP 根目录列表请求',
          { root: projectRoot.root, source: projectRoot.source }
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
    });

    // 工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // 记录工具调用
      logger.toolCall(name, args);

      try {
        // 验证工具名称
        if (!name) {
          throw new ValidationError('工具名称不能为空');
        }

        switch (name) {
          case 'health': {
            const healthTool = new HealthTool(this.startTime, this.projectRootManager.getProjectRoot());
            return await healthTool.handle();
          }
          case 'ping': {
            const pingTool = new PingTool();
            return await pingTool.handle(args as { message?: string });
          }
          default:
            throw new ValidationError(`未知工具: ${name}`, { availableTools: ['health', 'ping'] });
        }
      } catch (error) {
        const errorResponse = errorHandler.handleError(error, { 
          tool: name, 
          args: args 
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
    logger.info(
      LogCategory.Task,
      LogAction.Create,
      '通知处理器已设置',
      { handlers: ['roots/list_changed'] }
    );
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    logger.startup('MCP 任务管理服务器启动中...', { version: '0.1.0' });
    
    // 设置进程信号处理
    this.setupSignalHandlers();
    
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
      capabilities: ['tools', 'roots']
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
        process.exit(1);
      }, 5000);

      // 执行清理操作
      await this.performCleanup();

      // 清除超时定时器
      clearTimeout(shutdownTimeout);

      logger.info(
        LogCategory.Task,
        LogAction.Handle,
        '服务器已优雅关闭',
        { uptime, totalRuntime: uptime }
      );

      process.exit(0);
    } catch (error) {
      logger.error(
        LogCategory.Exception,
        LogAction.Handle,
        '优雅关闭过程中发生错误',
        { 
          error: error instanceof Error ? error.message : String(error),
          signal
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
          '清理项目根目录管理器状态'
        );
        // 这里可以添加项目根目录相关的清理逻辑
      })
    );

    // 等待所有清理任务完成
    try {
      await Promise.all(cleanupTasks);
      logger.info(
        LogCategory.Task,
        LogAction.Handle,
        '所有清理任务已完成'
      );
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
      logger.info(
        LogCategory.Task,
        LogAction.Update,
        '重新加载配置中...'
      );

      // 刷新项目根目录
      await this.projectRootManager.refreshProjectRoot();

      logger.info(
        LogCategory.Task,
        LogAction.Update,
        '配置重新加载完成'
      );
    } catch (error) {
      logger.error(
        LogCategory.Exception,
        LogAction.Handle,
        '重新加载配置失败',
        { error: error instanceof Error ? error.message : String(error) }
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
  logger.error(
    LogCategory.Exception,
    LogAction.Handle,
    '未捕获的异常',
    { 
      error: error.message,
      stack: error.stack,
      name: error.name
    }
  );
  
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
      promise: promise.toString()
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