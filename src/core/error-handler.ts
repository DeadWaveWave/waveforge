/**
 * 错误处理模块
 * 提供统一的错误处理和日志记录功能
 */

import { LogLevel, LogCategory, LogAction } from '../types/index.js';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  ValidationError = 'VALIDATION_ERROR',
  FileSystemError = 'FILESYSTEM_ERROR',
  ConcurrencyError = 'CONCURRENCY_ERROR',
  NetworkError = 'NETWORK_ERROR',
  UnknownError = 'UNKNOWN_ERROR',
}

/**
 * WaveForge 错误基类
 */
export class WaveForgeError extends Error {
  public readonly type: ErrorType;
  public readonly timestamp: string;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UnknownError,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'WaveForgeError';
    this.type = type;
    this.timestamp = new Date().toISOString();
    this.context = context;
  }

  /**
   * 转换为 JSON 格式
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * 验证错误
 */
export class ValidationError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.ValidationError, context);
    this.name = 'ValidationError';
  }
}

/**
 * 文件系统错误
 */
export class FileSystemError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.FileSystemError, context);
    this.name = 'FileSystemError';
  }
}

/**
 * 并发控制错误
 */
export class ConcurrencyError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.ConcurrencyError, context);
    this.name = 'ConcurrencyError';
  }
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 处理错误并返回标准化响应
   */
  handleError(error: unknown, context?: Record<string, any>): {
    success: false;
    error: string;
    type: string;
    timestamp: string;
    context?: Record<string, any>;
  } {
    let waveForgeError: WaveForgeError;

    if (error instanceof WaveForgeError) {
      waveForgeError = error;
    } else if (error instanceof Error) {
      waveForgeError = new WaveForgeError(
        error.message,
        ErrorType.UnknownError,
        { originalError: error.name, ...context }
      );
    } else {
      waveForgeError = new WaveForgeError(
        '未知错误',
        ErrorType.UnknownError,
        { originalError: String(error), ...context }
      );
    }

    // 记录错误日志
    this.logError(waveForgeError);

    return {
      success: false,
      error: waveForgeError.message,
      type: waveForgeError.type,
      timestamp: waveForgeError.timestamp,
      context: waveForgeError.context,
    };
  }

  /**
   * 记录错误日志
   */
  private logError(error: WaveForgeError): void {
    const logEntry = {
      timestamp: error.timestamp,
      level: LogLevel.Error,
      category: LogCategory.Exception,
      action: LogAction.Handle,
      message: error.message,
      details: {
        type: error.type,
        context: error.context,
        stack: error.stack,
      },
    };

    // 输出到 stderr（MCP 服务器的标准做法）
    console.error('[WaveForge Error]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * 包装异步函数，自动处理错误
   */
  wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: Record<string, any>
  ): (...args: T) => Promise<R | { success: false; error: string }> {
    return async (...args: T) => {
      try {
        return await fn(...args);
      } catch (error) {
        return this.handleError(error, context);
      }
    };
  }

  /**
   * 验证参数
   */
  validateRequired(
    params: Record<string, any>,
    requiredFields: string[]
  ): void {
    const missing = requiredFields.filter(field => 
      params[field] === undefined || params[field] === null
    );

    if (missing.length > 0) {
      throw new ValidationError(
        `缺少必需参数: ${missing.join(', ')}`,
        { missing, provided: Object.keys(params) }
      );
    }
  }

  /**
   * 验证参数类型
   */
  validateTypes(
    params: Record<string, any>,
    typeMap: Record<string, string>
  ): void {
    const errors: string[] = [];

    for (const [field, expectedType] of Object.entries(typeMap)) {
      if (params[field] !== undefined) {
        const actualType = typeof params[field];
        if (actualType !== expectedType) {
          errors.push(`${field} 应为 ${expectedType}，实际为 ${actualType}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        `参数类型错误: ${errors.join('; ')}`,
        { errors, params }
      );
    }
  }
}

/**
 * 获取全局错误处理器实例
 */
export const errorHandler = ErrorHandler.getInstance();