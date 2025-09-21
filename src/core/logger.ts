/**
 * 日志记录模块
 * 提供结构化日志记录功能
 */

import { LogLevel, LogCategory, LogAction } from '../types/index.js';

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  action: LogAction;
  message: string;
  details?: Record<string, any>;
  context?: Record<string, any>;
}

/**
 * 日志记录器类
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    // 从环境变量读取日志级别，默认为 INFO
    const envLogLevel = process.env.WF_LOG_LEVEL?.toUpperCase();
    this.logLevel = this.parseLogLevel(envLogLevel) || LogLevel.Info;
  }

  /**
   * 获取单例实例
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 解析日志级别
   */
  private parseLogLevel(level?: string): LogLevel | null {
    switch (level) {
      case 'INFO':
        return LogLevel.Info;
      case 'WARNING':
        return LogLevel.Warning;
      case 'ERROR':
        return LogLevel.Error;
      case 'TEACH':
        return LogLevel.Teach;
      default:
        return null;
    }
  }

  /**
   * 检查是否应该记录指定级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.Info,
      LogLevel.Warning,
      LogLevel.Error,
      LogLevel.Teach,
    ];
    const currentIndex = levels.indexOf(this.logLevel);
    const targetIndex = levels.indexOf(level);
    return targetIndex >= currentIndex;
  }

  /**
   * 记录日志
   */
  log(
    level: LogLevel,
    category: LogCategory,
    action: LogAction,
    message: string,
    details?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      action,
      message,
      details,
      context,
    };

    // 输出到 stderr（MCP 服务器的标准做法）
    const prefix = this.getLogPrefix(level);
    console.error(`${prefix}`, JSON.stringify(logEntry, null, 2));
  }

  /**
   * 获取日志前缀
   */
  private getLogPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.Info:
        return '[WaveForge Info]';
      case LogLevel.Warning:
        return '[WaveForge Warning]';
      case LogLevel.Error:
        return '[WaveForge Error]';
      case LogLevel.Teach:
        return '[WaveForge Teach]';
      default:
        return '[WaveForge]';
    }
  }

  /**
   * 记录信息日志
   */
  info(
    category: LogCategory,
    action: LogAction,
    message: string,
    details?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.log(LogLevel.Info, category, action, message, details, context);
  }

  /**
   * 记录警告日志
   */
  warning(
    category: LogCategory,
    action: LogAction,
    message: string,
    details?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.log(LogLevel.Warning, category, action, message, details, context);
  }

  /**
   * 记录错误日志
   */
  error(
    category: LogCategory,
    action: LogAction,
    message: string,
    details?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.log(LogLevel.Error, category, action, message, details, context);
  }

  /**
   * 记录教学日志
   */
  teach(
    category: LogCategory,
    action: LogAction,
    message: string,
    details?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.log(LogLevel.Teach, category, action, message, details, context);
  }

  /**
   * 记录健康检查日志
   */
  health(message: string, details?: Record<string, any>): void {
    this.info(LogCategory.Health, LogAction.Handle, message, details);
  }

  /**
   * 记录服务器启动日志
   */
  startup(message: string, details?: Record<string, any>): void {
    this.info(LogCategory.Task, LogAction.Create, message, details);
  }

  /**
   * 记录工具调用日志
   */
  toolCall(toolName: string, args?: Record<string, any>): void {
    this.info(LogCategory.Task, LogAction.Handle, `工具调用: ${toolName}`, {
      tool: toolName,
      arguments: args,
    });
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(
      LogCategory.Task,
      LogAction.Modify,
      `日志级别已更改为: ${level}`,
      { newLevel: level }
    );
  }
}

/**
 * 获取全局日志记录器实例
 */
export const logger = Logger.getInstance();
