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
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  duration?: number;
  tags?: string[];
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableStructured: boolean;
  enableColors: boolean;
  enableTimestamp: boolean;
  enableCorrelation: boolean;
  sensitiveFields: string[];
}

/**
 * 日志统计接口
 */
export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<LogCategory, number>;
  byAction: Record<LogAction, number>;
  recent: LogEntry[];
  errors: LogEntry[];
}

/**
 * 日志过滤器接口
 */
export interface LogFilter {
  level?: LogLevel;
  category?: LogCategory;
  action?: LogAction;
  message?: string;
  startTime?: string;
  endTime?: string;
  correlationId?: string;
  tags?: string[];
}

/**
 * 日志记录器类
 */
export class Logger {
  private static instance: Logger;
  private readonly config: LoggerConfig;
  private readonly stats: LogStats;
  private correlationId: string | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;

  private constructor(config?: Partial<LoggerConfig>) {
    // 从环境变量读取日志级别，默认为 INFO
    const envLogLevel = process.env.WF_LOG_LEVEL?.toUpperCase();

    this.config = {
      level: this.parseLogLevel(envLogLevel) || LogLevel.Info,
      enableConsole: true,
      enableFile: false,
      enableStructured: true,
      enableColors: false,
      enableTimestamp: true,
      enableCorrelation: true,
      sensitiveFields: ['password', 'token', 'secret', 'key', 'auth'],
      ...config,
    };

    this.stats = {
      total: 0,
      byLevel: {} as Record<LogLevel, number>,
      byCategory: {} as Record<LogCategory, number>,
      byAction: {} as Record<LogAction, number>,
      recent: [],
      errors: [],
    };
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * 重置实例（主要用于测试）
   */
  static resetInstance(): void {
    Logger.instance = undefined as any;
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
    const currentIndex = levels.indexOf(this.config.level);
    const targetIndex = levels.indexOf(level);
    return targetIndex >= currentIndex;
  }

  /**
   * 清理敏感信息
   */
  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        this.config.sensitiveFields.some((field) => lowerKey.includes(field))
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitizeData(value);
      }
    }
    return sanitized;
  }

  /**
   * 更新统计信息
   */
  private updateStats(entry: LogEntry): void {
    this.stats.total++;
    this.stats.byLevel[entry.level] =
      (this.stats.byLevel[entry.level] || 0) + 1;
    this.stats.byCategory[entry.category] =
      (this.stats.byCategory[entry.category] || 0) + 1;
    this.stats.byAction[entry.action] =
      (this.stats.byAction[entry.action] || 0) + 1;

    // 保留最近的日志（最多100条）
    this.stats.recent.unshift(entry);
    if (this.stats.recent.length > 100) {
      this.stats.recent = this.stats.recent.slice(0, 100);
    }

    // 保留错误日志（最多50条）
    if (entry.level === LogLevel.Error) {
      this.stats.errors.unshift(entry);
      if (this.stats.errors.length > 50) {
        this.stats.errors = this.stats.errors.slice(0, 50);
      }
    }
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
    context?: Record<string, any>,
    options?: {
      correlationId?: string;
      tags?: string[];
      duration?: number;
    }
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
      details: details ? this.sanitizeData(details) : undefined,
      context: context ? this.sanitizeData(context) : undefined,
      correlationId: options?.correlationId || this.correlationId || undefined,
      sessionId: this.sessionId || undefined,
      userId: this.userId || undefined,
      duration: options?.duration,
      tags: options?.tags,
    };

    // 更新统计信息
    this.updateStats(logEntry);

    // 输出日志
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    if (this.config.enableFile && this.config.filePath) {
      this.outputToFile(logEntry);
    }
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    const prefix = this.getLogPrefix(entry.level);

    if (this.config.enableStructured) {
      console.error(`${prefix}`, JSON.stringify(entry, null, 2));
    } else {
      const timestamp = this.config.enableTimestamp
        ? `[${entry.timestamp}] `
        : '';
      const correlation = entry.correlationId
        ? `[${entry.correlationId}] `
        : '';
      const simple = `${timestamp}${correlation}${entry.category}/${entry.action}: ${entry.message}`;
      console.error(`${prefix} ${simple}`);
    }
  }

  /**
   * 输出到文件（占位符实现）
   */
  private outputToFile(_entry: LogEntry): void {
    // 这里可以实现文件日志功能
    // 为了保持简单，暂时不实现
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
    context?: Record<string, any>,
    options?: {
      correlationId?: string;
      tags?: string[];
      duration?: number;
    }
  ): void {
    this.log(
      LogLevel.Info,
      category,
      action,
      message,
      details,
      context,
      options
    );
  }

  /**
   * 记录警告日志
   */
  warning(
    category: LogCategory,
    action: LogAction,
    message: string,
    details?: Record<string, any>,
    context?: Record<string, any>,
    options?: {
      correlationId?: string;
      tags?: string[];
      duration?: number;
    }
  ): void {
    this.log(
      LogLevel.Warning,
      category,
      action,
      message,
      details,
      context,
      options
    );
  }

  /**
   * 记录错误日志
   */
  error(
    category: LogCategory,
    action: LogAction,
    message: string,
    details?: Record<string, any>,
    context?: Record<string, any>,
    options?: {
      correlationId?: string;
      tags?: string[];
      duration?: number;
    }
  ): void {
    this.log(
      LogLevel.Error,
      category,
      action,
      message,
      details,
      context,
      options
    );
  }

  /**
   * 记录教学日志
   */
  teach(
    category: LogCategory,
    action: LogAction,
    message: string,
    details?: Record<string, any>,
    context?: Record<string, any>,
    options?: {
      correlationId?: string;
      tags?: string[];
      duration?: number;
    }
  ): void {
    this.log(
      LogLevel.Teach,
      category,
      action,
      message,
      details,
      context,
      options
    );
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
    (this.config as any).level = level;
    this.info(
      LogCategory.Task,
      LogAction.Modify,
      `日志级别已更改为: ${level}`,
      { newLevel: level }
    );
  }

  /**
   * 设置关联ID
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * 清除关联ID
   */
  clearCorrelationId(): void {
    this.correlationId = null;
  }

  /**
   * 设置会话ID
   */
  setSessionId(id: string): void {
    this.sessionId = id;
  }

  /**
   * 设置用户ID
   */
  setUserId(id: string): void {
    this.userId = id;
  }

  /**
   * 创建带关联ID的日志记录器
   */
  withCorrelation(correlationId: string): {
    info: (
      category: LogCategory,
      action: LogAction,
      message: string,
      details?: Record<string, any>
    ) => void;
    warning: (
      category: LogCategory,
      action: LogAction,
      message: string,
      details?: Record<string, any>
    ) => void;
    error: (
      category: LogCategory,
      action: LogAction,
      message: string,
      details?: Record<string, any>
    ) => void;
    teach: (
      category: LogCategory,
      action: LogAction,
      message: string,
      details?: Record<string, any>
    ) => void;
  } {
    return {
      info: (category, action, message, details) =>
        this.log(LogLevel.Info, category, action, message, details, undefined, {
          correlationId,
        }),
      warning: (category, action, message, details) =>
        this.log(
          LogLevel.Warning,
          category,
          action,
          message,
          details,
          undefined,
          { correlationId }
        ),
      error: (category, action, message, details) =>
        this.log(
          LogLevel.Error,
          category,
          action,
          message,
          details,
          undefined,
          { correlationId }
        ),
      teach: (category, action, message, details) =>
        this.log(
          LogLevel.Teach,
          category,
          action,
          message,
          details,
          undefined,
          { correlationId }
        ),
    };
  }

  /**
   * 记录性能日志
   */
  performance(
    category: LogCategory,
    action: LogAction,
    message: string,
    duration: number,
    details?: Record<string, any>
  ): void {
    this.info(category, action, message, details, undefined, {
      duration,
      tags: ['performance'],
    });
  }

  /**
   * 记录审计日志
   */
  audit(
    action: LogAction,
    message: string,
    details?: Record<string, any>,
    userId?: string
  ): void {
    this.info(LogCategory.Task, action, message, details, undefined, {
      tags: ['audit'],
      correlationId: userId || this.userId || undefined,
    });
  }

  /**
   * 记录安全日志
   */
  security(
    action: LogAction,
    message: string,
    details?: Record<string, any>
  ): void {
    this.warning(LogCategory.Exception, action, message, details, undefined, {
      tags: ['security'],
    });
  }

  /**
   * 获取日志统计
   */
  getStats(): LogStats {
    return {
      ...this.stats,
      byLevel: { ...this.stats.byLevel },
      byCategory: { ...this.stats.byCategory },
      byAction: { ...this.stats.byAction },
      recent: [...this.stats.recent],
      errors: [...this.stats.errors],
    };
  }

  /**
   * 清空统计信息
   */
  clearStats(): void {
    this.stats.total = 0;
    this.stats.byLevel = {} as Record<LogLevel, number>;
    this.stats.byCategory = {} as Record<LogCategory, number>;
    this.stats.byAction = {} as Record<LogAction, number>;
    this.stats.recent = [];
    this.stats.errors = [];
  }

  /**
   * 获取配置信息
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * 查询日志
   */
  queryLogs(filter: LogFilter): LogEntry[] {
    let logs = [...this.stats.recent];

    if (filter.level) {
      logs = logs.filter((log) => log.level === filter.level);
    }

    if (filter.category) {
      logs = logs.filter((log) => log.category === filter.category);
    }

    if (filter.action) {
      logs = logs.filter((log) => log.action === filter.action);
    }

    if (filter.message) {
      logs = logs.filter((log) => log.message.includes(filter.message!));
    }

    if (filter.correlationId) {
      logs = logs.filter((log) => log.correlationId === filter.correlationId);
    }

    if (filter.tags && filter.tags.length > 0) {
      logs = logs.filter(
        (log) => log.tags && filter.tags!.some((tag) => log.tags!.includes(tag))
      );
    }

    if (filter.startTime) {
      logs = logs.filter((log) => log.timestamp >= filter.startTime!);
    }

    if (filter.endTime) {
      logs = logs.filter((log) => log.timestamp <= filter.endTime!);
    }

    return logs;
  }

  /**
   * 创建计时器
   */
  createTimer(name: string): {
    end: (
      category: LogCategory,
      action: LogAction,
      message?: string,
      details?: Record<string, any>
    ) => void;
  } {
    const startTime = Date.now();

    return {
      end: (category, action, message, details) => {
        const duration = Date.now() - startTime;
        this.performance(
          category,
          action,
          message || `${name} 完成`,
          duration,
          { ...details, timerName: name }
        );
      },
    };
  }

  /**
   * 批量记录日志
   */
  batch(
    entries: Array<{
      level: LogLevel;
      category: LogCategory;
      action: LogAction;
      message: string;
      details?: Record<string, any>;
      context?: Record<string, any>;
    }>
  ): void {
    for (const entry of entries) {
      this.log(
        entry.level,
        entry.category,
        entry.action,
        entry.message,
        entry.details,
        entry.context
      );
    }
  }
}

/**
 * 获取全局日志记录器实例
 */
export const logger = Logger.getInstance();
