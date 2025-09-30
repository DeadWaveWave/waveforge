/**
 * 错误处理模块
 * 提供统一的错误处理和日志记录功能
 */

import { LogLevel, LogCategory, LogAction, ErrorCode } from '../types/index.js';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  ValidationError = 'VALIDATION_ERROR',
  FileSystemError = 'FILESYSTEM_ERROR',
  ConcurrencyError = 'CONCURRENCY_ERROR',
  NetworkError = 'NETWORK_ERROR',
  SystemError = 'SYSTEM_ERROR',
  NotFound = 'NOT_FOUND',
  UnknownError = 'UNKNOWN_ERROR',

  // 面向结果的任务管理系统错误类型
  ProjectError = 'PROJECT_ERROR',
  TaskError = 'TASK_ERROR',
  EVRError = 'EVR_ERROR',
  SyncError = 'SYNC_ERROR',
  ParseError = 'PARSE_ERROR',
  RenderError = 'RENDER_ERROR',
  StateError = 'STATE_ERROR',
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
 * 资源未找到错误
 */
export class NotFoundError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.NotFound, context);
    this.name = 'NotFoundError';
  }
}

/**
 * 系统错误
 */
export class SystemError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.SystemError, context);
    this.name = 'SystemError';
  }
}

/**
 * 项目错误
 */
export class ProjectError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.ProjectError, context);
    this.name = 'ProjectError';
  }
}

/**
 * 任务错误
 */
export class TaskError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.TaskError, context);
    this.name = 'TaskError';
  }
}

/**
 * EVR 错误
 */
export class EVRError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.EVRError, context);
    this.name = 'EVRError';
  }
}

/**
 * 同步错误
 */
export class SyncError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.SyncError, context);
    this.name = 'SyncError';
  }
}

/**
 * 解析错误
 */
export class ParseError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.ParseError, context);
    this.name = 'ParseError';
  }
}

/**
 * 渲染错误
 */
export class RenderError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.RenderError, context);
    this.name = 'RenderError';
  }
}

/**
 * 状态错误
 */
export class StateError extends WaveForgeError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.StateError, context);
    this.name = 'StateError';
  }
}

/**
 * 错误码到错误类型的映射
 */
export const ERROR_CODE_TO_TYPE: Record<ErrorCode, ErrorType> = {
  [ErrorCode.NO_PROJECT_BOUND]: ErrorType.ProjectError,
  [ErrorCode.NO_ACTIVE_TASK]: ErrorType.TaskError,
  [ErrorCode.INVALID_ROOT]: ErrorType.ProjectError,
  [ErrorCode.NOT_FOUND]: ErrorType.NotFound,
  [ErrorCode.MULTIPLE_CANDIDATES]: ErrorType.ProjectError,
  [ErrorCode.MISSING_PERMISSIONS]: ErrorType.FileSystemError,
  [ErrorCode.EVR_NOT_READY]: ErrorType.EVRError,
  [ErrorCode.EVR_VALIDATION_FAILED]: ErrorType.EVRError,
  [ErrorCode.SYNC_CONFLICT]: ErrorType.SyncError,
  [ErrorCode.PARSE_ERROR]: ErrorType.ParseError,
  [ErrorCode.RENDER_ERROR]: ErrorType.RenderError,
  [ErrorCode.INVALID_STATE_TRANSITION]: ErrorType.StateError,
  [ErrorCode.PLAN_GATE_BLOCKED]: ErrorType.EVRError,
};

/**
 * 错误码到错误类的映射
 */
export const ERROR_CODE_TO_CLASS: Record<
  ErrorCode,
  new (message: string, context?: Record<string, any>) => WaveForgeError
> = {
  [ErrorCode.NO_PROJECT_BOUND]: ProjectError,
  [ErrorCode.NO_ACTIVE_TASK]: TaskError,
  [ErrorCode.INVALID_ROOT]: ProjectError,
  [ErrorCode.NOT_FOUND]: NotFoundError,
  [ErrorCode.MULTIPLE_CANDIDATES]: ProjectError,
  [ErrorCode.MISSING_PERMISSIONS]: FileSystemError,
  [ErrorCode.EVR_NOT_READY]: EVRError,
  [ErrorCode.EVR_VALIDATION_FAILED]: EVRError,
  [ErrorCode.SYNC_CONFLICT]: SyncError,
  [ErrorCode.PARSE_ERROR]: ParseError,
  [ErrorCode.RENDER_ERROR]: RenderError,
  [ErrorCode.INVALID_STATE_TRANSITION]: StateError,
  [ErrorCode.PLAN_GATE_BLOCKED]: EVRError,
};

/**
 * 错误码到用户友好消息的映射
 */
export const ERROR_CODE_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NO_PROJECT_BOUND]:
    '当前连接没有绑定活跃项目，请先调用 project_bind',
  [ErrorCode.NO_ACTIVE_TASK]: '当前没有活跃任务',
  [ErrorCode.INVALID_ROOT]: '无效的项目根目录路径',
  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.MULTIPLE_CANDIDATES]: '找到多个候选项目，请指定具体项目',
  [ErrorCode.MISSING_PERMISSIONS]: '缺少必要的文件访问权限',
  [ErrorCode.EVR_NOT_READY]: 'EVR 验证未就绪，无法完成操作',
  [ErrorCode.EVR_VALIDATION_FAILED]: 'EVR 验证失败',
  [ErrorCode.SYNC_CONFLICT]: '同步冲突，需要手动解决',
  [ErrorCode.PARSE_ERROR]: '面板解析失败',
  [ErrorCode.RENDER_ERROR]: '面板渲染失败',
  [ErrorCode.INVALID_STATE_TRANSITION]: '无效的状态转换',
  [ErrorCode.PLAN_GATE_BLOCKED]: '计划门槛检查未通过，存在未就绪的 EVR',
};

/**
 * 根据错误码创建错误实例
 */
export function createErrorFromCode(
  errorCode: ErrorCode,
  customMessage?: string,
  context?: Record<string, any>
): WaveForgeError {
  const ErrorClass = ERROR_CODE_TO_CLASS[errorCode];
  const message = customMessage || ERROR_CODE_MESSAGES[errorCode];

  return new ErrorClass(message, {
    errorCode,
    ...context,
  });
}

/**
 * 检查错误是否为特定错误码
 */
export function isErrorCode(error: unknown, errorCode: ErrorCode): boolean {
  return (
    error instanceof WaveForgeError && error.context?.errorCode === errorCode
  );
}

/**
 * 从错误中提取错误码
 */
export function getErrorCode(error: unknown): ErrorCode | null {
  if (error instanceof WaveForgeError && error.context?.errorCode) {
    return error.context.errorCode as ErrorCode;
  }
  return null;
}

/**
 * 错误处理器配置
 */
export interface ErrorHandlerConfig {
  logLevel: LogLevel;
  includeStackTrace: boolean;
  maxContextSize: number;
  enableMetrics: boolean;
}

/**
 * 错误统计信息
 */
export interface ErrorMetrics {
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  recent: Array<{
    timestamp: string;
    type: string;
    message: string;
  }>;
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private readonly config: ErrorHandlerConfig;
  private readonly metrics: ErrorMetrics;

  private constructor(config?: Partial<ErrorHandlerConfig>) {
    this.config = {
      logLevel: LogLevel.Error,
      includeStackTrace: true,
      maxContextSize: 1000,
      enableMetrics: true,
      ...config,
    };

    this.metrics = {
      total: 0,
      byType: {},
      byCategory: {},
      recent: [],
    };
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config);
    }
    return ErrorHandler.instance;
  }

  /**
   * 重置实例（主要用于测试）
   */
  static resetInstance(): void {
    ErrorHandler.instance = undefined as any;
  }

  /**
   * 处理错误并返回标准化响应
   */
  handleError(
    error: unknown,
    context?: Record<string, any>
  ): {
    success: false;
    error: string;
    type: string;
    timestamp: string;
    context?: Record<string, any>;
    stack?: string;
  } {
    let waveForgeError: WaveForgeError;

    if (error instanceof WaveForgeError) {
      waveForgeError = error;
    } else if (error instanceof Error) {
      // 根据错误消息内容判断错误类型
      let errorType = ErrorType.UnknownError;
      if (
        error.message.includes('磁盘空间不足') ||
        error.message.includes('权限') ||
        error.message.includes('文件') ||
        error.message.includes('ENOENT') ||
        error.message.includes('EINVAL')
      ) {
        errorType = ErrorType.SystemError;
      } else if (
        error.message.includes('不存在') ||
        error.message.includes('没有')
      ) {
        errorType = ErrorType.NotFound;
      } else if (
        error.message.includes('项目') ||
        error.message.includes('绑定')
      ) {
        errorType = ErrorType.ProjectError;
      } else if (error.message.includes('任务')) {
        errorType = ErrorType.TaskError;
      } else if (
        error.message.includes('EVR') ||
        error.message.includes('验证')
      ) {
        errorType = ErrorType.EVRError;
      } else if (
        error.message.includes('同步') ||
        error.message.includes('冲突')
      ) {
        errorType = ErrorType.SyncError;
      } else if (error.message.includes('解析')) {
        errorType = ErrorType.ParseError;
      } else if (error.message.includes('渲染')) {
        errorType = ErrorType.RenderError;
      } else if (error.message.includes('状态')) {
        errorType = ErrorType.StateError;
      }

      waveForgeError = new WaveForgeError(error.message, errorType, {
        originalError: error.name,
        ...context,
      });
    } else {
      waveForgeError = new WaveForgeError('未知错误', ErrorType.UnknownError, {
        originalError: String(error),
        ...context,
      });
    }

    // 记录错误日志和统计
    this.logError(waveForgeError);
    this.updateMetrics(waveForgeError);

    const response: {
      success: false;
      error: string;
      error_code?: string;
      type: string;
      timestamp: string;
      context?: Record<string, any>;
      stack?: string;
    } = {
      success: false,
      error: waveForgeError.message,
      type: waveForgeError.type,
      timestamp: waveForgeError.timestamp,
      context: this.sanitizeContext(waveForgeError.context),
    };

    // 添加错误码（基于错误类型）
    if (waveForgeError.type === ErrorType.SyncError) {
      response.error_code = 'SYNC_CONFLICT';
    } else if (waveForgeError.type === ErrorType.ValidationError) {
      response.error_code = 'VALIDATION_ERROR';
    } else if (waveForgeError.type === ErrorType.NotFound) {
      response.error_code = 'NOT_FOUND';
    } else if (waveForgeError.type === ErrorType.EVRError) {
      response.error_code = 'EVR_ERROR';
    }

    // 根据配置决定是否包含堆栈跟踪
    if (this.config.includeStackTrace && waveForgeError.stack) {
      response.stack = waveForgeError.stack;
    }

    return response;
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
        context: this.sanitizeContext(error.context),
        ...(this.config.includeStackTrace && { stack: error.stack }),
      },
    };

    // 输出到 stderr（MCP 服务器的标准做法）
    console.error('[WaveForge Error]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * 更新错误统计
   */
  private updateMetrics(error: WaveForgeError): void {
    if (!this.config.enableMetrics) {
      return;
    }

    this.metrics.total++;
    this.metrics.byType[error.type] =
      (this.metrics.byType[error.type] || 0) + 1;
    this.metrics.byCategory[LogCategory.Exception] =
      (this.metrics.byCategory[LogCategory.Exception] || 0) + 1;

    // 保留最近的错误记录（最多100条）
    this.metrics.recent.unshift({
      timestamp: error.timestamp,
      type: error.type,
      message: error.message,
    });

    if (this.metrics.recent.length > 100) {
      this.metrics.recent = this.metrics.recent.slice(0, 100);
    }
  }

  /**
   * 清理上下文数据，防止敏感信息泄露
   */
  private sanitizeContext(
    context?: Record<string, any>
  ): Record<string, any> | undefined {
    if (!context) {
      return undefined;
    }

    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];

    // 递归清理敏感信息
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitizeObject(value);
        }
      }
      return result;
    };

    const sanitizedContext = sanitizeObject(sanitized);

    // 限制上下文大小
    const contextStr = JSON.stringify(sanitizedContext);
    if (contextStr.length > this.config.maxContextSize) {
      return {
        ...sanitizedContext,
        _truncated: true,
        _originalSize: contextStr.length,
      };
    }

    return sanitizedContext;
  }

  /**
   * 获取错误统计信息
   */
  getMetrics(): ErrorMetrics {
    return {
      ...this.metrics,
      byType: { ...this.metrics.byType },
      byCategory: { ...this.metrics.byCategory },
      recent: [...this.metrics.recent],
    };
  }

  /**
   * 清空错误统计
   */
  clearMetrics(): void {
    this.metrics.total = 0;
    this.metrics.byType = {};
    this.metrics.byCategory = {};
    this.metrics.recent = [];
  }

  /**
   * 获取配置信息
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
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
    const missing = requiredFields.filter(
      (field) => params[field] === undefined || params[field] === null
    );

    if (missing.length > 0) {
      throw new ValidationError(`缺少必需参数: ${missing.join(', ')}`, {
        missing,
        provided: Object.keys(params),
      });
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
      throw new ValidationError(`参数类型错误: ${errors.join('; ')}`, {
        errors,
        params: this.sanitizeContext(params),
      });
    }
  }

  /**
   * 验证字符串长度
   */
  validateStringLength(
    value: string,
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): void {
    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(
        `${fieldName} 长度不能少于 ${minLength} 个字符`,
        { fieldName, actualLength: value.length, minLength }
      );
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw new ValidationError(
        `${fieldName} 长度不能超过 ${maxLength} 个字符`,
        { fieldName, actualLength: value.length, maxLength }
      );
    }
  }

  /**
   * 验证数组长度
   */
  validateArrayLength(
    value: any[],
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): void {
    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(`${fieldName} 至少需要 ${minLength} 个元素`, {
        fieldName,
        actualLength: value.length,
        minLength,
      });
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw new ValidationError(`${fieldName} 最多只能有 ${maxLength} 个元素`, {
        fieldName,
        actualLength: value.length,
        maxLength,
      });
    }
  }

  /**
   * 验证枚举值
   */
  validateEnum<T>(value: T, fieldName: string, allowedValues: T[]): void {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(
        `${fieldName} 必须是以下值之一: ${allowedValues.join(', ')}`,
        { fieldName, value, allowedValues }
      );
    }
  }

  /**
   * 创建错误处理中间件
   */
  createMiddleware() {
    return {
      /**
       * 包装 MCP 工具处理器
       */
      wrapToolHandler: <T extends any[], R>(
        handler: (...args: T) => Promise<R>,
        toolName: string
      ) => {
        return async (...args: T): Promise<R> => {
          try {
            return await handler(...args);
          } catch (error) {
            const errorResponse = this.handleError(error, {
              tool: toolName,
              args: this.sanitizeContext({ args }),
            });

            // 返回 MCP 标准错误响应格式
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(errorResponse, null, 2),
                },
              ],
            } as R;
          }
        };
      },

      /**
       * 包装异步操作
       */
      wrapAsync: <T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        context?: Record<string, any>
      ) => {
        return this.wrapAsync(fn, context);
      },
    };
  }

  /**
   * 检查错误是否为特定类型
   */
  isErrorType(error: unknown, type: ErrorType): boolean {
    return error instanceof WaveForgeError && error.type === type;
  }

  /**
   * 检查错误是否为可恢复错误
   */
  isRecoverableError(error: unknown): boolean {
    if (error instanceof WaveForgeError) {
      return [ErrorType.NetworkError, ErrorType.ConcurrencyError].includes(
        error.type
      );
    }
    return false;
  }

  /**
   * 格式化错误消息用于用户显示
   */
  formatUserMessage(error: unknown): string {
    if (error instanceof ValidationError) {
      return error.message;
    }

    if (error instanceof NotFoundError) {
      return error.message;
    }

    if (error instanceof WaveForgeError) {
      // 优先使用错误码对应的消息
      const errorCode = getErrorCode(error);
      if (errorCode && ERROR_CODE_MESSAGES[errorCode]) {
        return ERROR_CODE_MESSAGES[errorCode];
      }

      // 对于系统错误，返回更友好的消息
      switch (error.type) {
        case ErrorType.FileSystemError:
          return '文件操作失败，请检查文件权限和磁盘空间';
        case ErrorType.ConcurrencyError:
          return '操作冲突，请稍后重试';
        case ErrorType.NetworkError:
          return '网络连接失败，请检查网络设置';
        case ErrorType.SystemError:
          return '系统错误，请联系管理员';
        case ErrorType.ProjectError:
          return '项目操作失败，请检查项目状态';
        case ErrorType.TaskError:
          return '任务操作失败，请检查任务状态';
        case ErrorType.EVRError:
          return 'EVR 验证失败，请检查验证条件';
        case ErrorType.SyncError:
          return '同步失败，请检查数据一致性';
        case ErrorType.ParseError:
          return '解析失败，请检查数据格式';
        case ErrorType.RenderError:
          return '渲染失败，请检查模板格式';
        case ErrorType.StateError:
          return '状态错误，请检查操作顺序';
        default:
          return '操作失败，请重试';
      }
    }

    return '未知错误，请重试';
  }
}

/**
 * 获取全局错误处理器实例
 */
export const errorHandler = ErrorHandler.getInstance();
