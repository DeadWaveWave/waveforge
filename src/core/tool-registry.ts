/**
 * MCP 工具注册系统
 * 支持动态工具注册和管理
 */

// 临时定义 ToolDefinition 类型，直到 SDK 更新
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}
import { logger } from './logger.js';
import { LogCategory, LogAction } from '../types/index.js';
import { ValidationError } from './error-handler.js';

/**
 * 工具处理器接口
 */
export interface ToolHandler {
  /**
   * 获取工具定义
   */
  getDefinition(): ToolDefinition;

  /**
   * 处理工具调用
   */
  handle(args?: unknown): Promise<any>;

  /**
   * 验证工具参数
   */
  validateArgs?(args: unknown): unknown;
}

/**
 * 工具注册信息
 */
export interface ToolRegistration {
  name: string;
  handler: ToolHandler;
  category: 'system' | 'task' | 'project' | 'devlog' | 'handshake';
  description: string;
  enabled: boolean;
}

/**
 * 工具注册系统
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolRegistration>();
  private readonly categories = new Set<string>();

  /**
   * 注册工具
   */
  registerTool(registration: ToolRegistration): void {
    const { name, handler, category, description, enabled } = registration;

    // 验证工具名称
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('工具名称不能为空');
    }

    // 验证工具处理器
    if (!handler || typeof handler.handle !== 'function') {
      throw new ValidationError(`工具 ${name} 的处理器无效`);
    }

    // 验证工具定义
    try {
      const definition = handler.getDefinition();
      if (!definition || !definition.name || !definition.description) {
        throw new ValidationError(`工具 ${name} 的定义无效`);
      }
    } catch (error) {
      throw new ValidationError(`工具 ${name} 的定义获取失败: ${error}`);
    }

    // 检查重复注册
    if (this.tools.has(name)) {
      logger.warning(
        LogCategory.Task,
        LogAction.Update,
        `工具 ${name} 已存在，将被覆盖`,
        { category, description }
      );
    }

    // 注册工具
    this.tools.set(name, registration);
    this.categories.add(category);

    logger.info(LogCategory.Task, LogAction.Create, `工具 ${name} 注册成功`, {
      category,
      description,
      enabled,
    });
  }

  /**
   * 注销工具
   */
  unregisterTool(name: string): boolean {
    if (!this.tools.has(name)) {
      logger.warning(
        LogCategory.Task,
        LogAction.Handle,
        `尝试注销不存在的工具: ${name}`
      );
      return false;
    }

    this.tools.delete(name);
    logger.info(LogCategory.Task, LogAction.Handle, `工具 ${name} 注销成功`);
    return true;
  }

  /**
   * 获取工具处理器
   */
  getToolHandler(name: string): ToolHandler | null {
    const registration = this.tools.get(name);
    if (!registration || !registration.enabled) {
      return null;
    }
    return registration.handler;
  }

  /**
   * 获取所有已启用工具的定义
   */
  getToolDefinitions(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];

    for (const [name, registration] of this.tools) {
      if (registration.enabled) {
        try {
          const definition = registration.handler.getDefinition();
          definitions.push(definition);
        } catch (error) {
          logger.error(
            LogCategory.Exception,
            LogAction.Handle,
            `获取工具 ${name} 定义失败`,
            { error: error instanceof Error ? error.message : String(error) }
          );
        }
      }
    }

    return definitions;
  }

  /**
   * 按类别获取工具
   */
  getToolsByCategory(category: string): ToolRegistration[] {
    const tools: ToolRegistration[] = [];

    for (const registration of this.tools.values()) {
      if (registration.category === category && registration.enabled) {
        tools.push(registration);
      }
    }

    return tools;
  }

  /**
   * 获取所有工具类别
   */
  getCategories(): string[] {
    return Array.from(this.categories).sort();
  }

  /**
   * 获取工具统计信息
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    byCategory: Record<string, number>;
  } {
    let enabled = 0;
    let disabled = 0;
    const byCategory: Record<string, number> = {};

    for (const registration of this.tools.values()) {
      if (registration.enabled) {
        enabled++;
      } else {
        disabled++;
      }

      byCategory[registration.category] =
        (byCategory[registration.category] || 0) + 1;
    }

    return {
      total: this.tools.size,
      enabled,
      disabled,
      byCategory,
    };
  }

  /**
   * 启用工具
   */
  enableTool(name: string): boolean {
    const registration = this.tools.get(name);
    if (!registration) {
      return false;
    }

    registration.enabled = true;
    logger.info(LogCategory.Task, LogAction.Update, `工具 ${name} 已启用`);
    return true;
  }

  /**
   * 禁用工具
   */
  disableTool(name: string): boolean {
    const registration = this.tools.get(name);
    if (!registration) {
      return false;
    }

    registration.enabled = false;
    logger.info(LogCategory.Task, LogAction.Update, `工具 ${name} 已禁用`);
    return true;
  }

  /**
   * 检查工具是否存在
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 检查工具是否已启用
   */
  isToolEnabled(name: string): boolean {
    const registration = this.tools.get(name);
    return registration ? registration.enabled : false;
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    const count = this.tools.size;
    this.tools.clear();
    this.categories.clear();

    logger.info(LogCategory.Task, LogAction.Handle, `已清空所有工具`, {
      count,
    });
  }

  /**
   * 批量注册工具
   */
  registerTools(registrations: ToolRegistration[]): void {
    for (const registration of registrations) {
      try {
        this.registerTool(registration);
      } catch (error) {
        logger.error(
          LogCategory.Exception,
          LogAction.Create,
          `批量注册工具 ${registration.name} 失败`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }
  }
}

/**
 * 全局工具注册表实例
 */
export const toolRegistry = new ToolRegistry();
