// MCP 工具定义

import { HealthCheckResponse, ProjectRootInfo } from '../types/index.js';
import { logger } from '../core/logger.js';
import { errorHandler, ValidationError } from '../core/error-handler.js';
import { HealthToolSchema, PingToolSchema } from './schemas.js';

/**
 * Health 工具处理器
 */
export class HealthTool {
  private startTime: number;
  private projectRoot: ProjectRootInfo | null;

  constructor(startTime: number, projectRoot: ProjectRootInfo | null) {
    this.startTime = startTime;
    this.projectRoot = projectRoot;
  }

  /**
   * 处理健康检查请求
   */
  async handle(): Promise<any> {
    try {
      const uptime = Date.now() - this.startTime;
      const response: HealthCheckResponse = {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        uptime: Math.floor(uptime / 1000), // 秒
        data: {
          server: 'waveforge-mcp-task-management',
          capabilities: ['tools', 'roots'],
          projectRoot: this.projectRoot,
          environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
          },
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
          },
        },
      };

      // 记录健康检查
      logger.health('健康检查执行', { 
        uptime: response.uptime, 
        status: response.status,
        memoryUsed: response.data.memory.used 
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorResponse = errorHandler.handleError(error, { tool: 'health' });
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
      name: HealthToolSchema.name,
      description: HealthToolSchema.description,
      inputSchema: HealthToolSchema.inputSchema,
    };
  }
}

/**
 * Ping 工具处理器
 */
export class PingTool {
  /**
   * 处理 ping 请求
   */
  async handle(args: { message?: string }): Promise<any> {
    try {
      // 参数验证
      if (args.message !== undefined) {
        errorHandler.validateTypes({ message: args.message }, { message: 'string' });
        
        // 验证消息长度
        if (args.message.length > 1000) {
          throw new ValidationError('消息长度不能超过 1000 个字符', {
            provided: args.message.length,
            maximum: 1000
          });
        }
        
        // 验证消息内容（不允许包含控制字符）
        if (/[\x00-\x1F\x7F]/.test(args.message)) {
          throw new ValidationError('消息不能包含控制字符');
        }
      }

      const response = {
        success: true,
        message: 'pong',
        echo: args.message || null,
        timestamp: new Date().toISOString(),
        server: 'waveforge-mcp-task-management',
        version: '0.1.0',
        data: {
          requestId: this.generateRequestId(),
          latency: 0, // 在实际实现中可以计算延迟
        },
      };

      // 记录 ping 请求
      logger.info(
        'TASK' as any,
        'HANDLE' as any,
        'Ping 请求处理完成',
        { echo: response.echo, requestId: response.data.requestId }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorResponse = errorHandler.handleError(error, { tool: 'ping', args });
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
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `ping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: PingToolSchema.name,
      description: PingToolSchema.description,
      inputSchema: PingToolSchema.inputSchema,
    };
  }
}