/**
 * 错误处理中间件测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorHandler,
  ValidationError,
  FileSystemError,
  ConcurrencyError,
  NotFoundError,
  SystemError,
  ProjectError,
  TaskError,
  EVRError,
  SyncError,
  ParseError,
  RenderError,
  StateError,
  ErrorType,
  createErrorFromCode,
  isErrorCode,
  getErrorCode,
  ERROR_CODE_TO_TYPE,
  ERROR_CODE_TO_CLASS,
  ERROR_CODE_MESSAGES,
} from './error-handler.js';
import { LogLevel, ErrorCode } from '../types/index.js';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    // 重置单例实例
    ErrorHandler.resetInstance();
    errorHandler = ErrorHandler.getInstance();
  });

  describe('面向结果的任务管理系统错误', () => {
    it('应该正确创建项目错误', () => {
      const error = new ProjectError('项目不存在', { projectId: 'test' });
      expect(error.name).toBe('ProjectError');
      expect(error.type).toBe(ErrorType.ProjectError);
      expect(error.message).toBe('项目不存在');
      expect(error.context?.projectId).toBe('test');
    });

    it('应该正确创建任务错误', () => {
      const error = new TaskError('任务未找到', { taskId: 'task-1' });
      expect(error.name).toBe('TaskError');
      expect(error.type).toBe(ErrorType.TaskError);
      expect(error.message).toBe('任务未找到');
    });

    it('应该正确创建 EVR 错误', () => {
      const error = new EVRError('EVR 验证失败', { evrId: 'evr-001' });
      expect(error.name).toBe('EVRError');
      expect(error.type).toBe(ErrorType.EVRError);
      expect(error.message).toBe('EVR 验证失败');
    });

    it('应该正确创建同步错误', () => {
      const error = new SyncError('同步冲突', {
        conflictType: 'etag_mismatch',
      });
      expect(error.name).toBe('SyncError');
      expect(error.type).toBe(ErrorType.SyncError);
      expect(error.message).toBe('同步冲突');
    });

    it('应该正确创建解析错误', () => {
      const error = new ParseError('Markdown 解析失败', { line: 10 });
      expect(error.name).toBe('ParseError');
      expect(error.type).toBe(ErrorType.ParseError);
      expect(error.message).toBe('Markdown 解析失败');
    });

    it('应该正确创建渲染错误', () => {
      const error = new RenderError('模板渲染失败', { template: 'task.md' });
      expect(error.name).toBe('RenderError');
      expect(error.type).toBe(ErrorType.RenderError);
      expect(error.message).toBe('模板渲染失败');
    });

    it('应该正确创建状态错误', () => {
      const error = new StateError('无效状态转换', {
        from: 'to_do',
        to: 'completed',
      });
      expect(error.name).toBe('StateError');
      expect(error.type).toBe(ErrorType.StateError);
      expect(error.message).toBe('无效状态转换');
    });
  });

  describe('错误码处理', () => {
    it('应该根据错误码创建正确的错误实例', () => {
      const error = createErrorFromCode(ErrorCode.NO_PROJECT_BOUND);
      expect(error).toBeInstanceOf(ProjectError);
      expect(error.message).toBe(
        '当前连接没有绑定活跃项目，请先调用 project_bind'
      );
      expect(error.context?.errorCode).toBe(ErrorCode.NO_PROJECT_BOUND);
    });

    it('应该支持自定义错误消息', () => {
      const customMessage = '自定义项目错误消息';
      const error = createErrorFromCode(ErrorCode.INVALID_ROOT, customMessage);
      expect(error.message).toBe(customMessage);
      expect(error.context?.errorCode).toBe(ErrorCode.INVALID_ROOT);
    });

    it('应该正确检查错误码', () => {
      const error = createErrorFromCode(ErrorCode.EVR_NOT_READY);
      expect(isErrorCode(error, ErrorCode.EVR_NOT_READY)).toBe(true);
      expect(isErrorCode(error, ErrorCode.NO_ACTIVE_TASK)).toBe(false);
    });

    it('应该正确提取错误码', () => {
      const error = createErrorFromCode(ErrorCode.SYNC_CONFLICT);
      expect(getErrorCode(error)).toBe(ErrorCode.SYNC_CONFLICT);

      const regularError = new Error('普通错误');
      expect(getErrorCode(regularError)).toBe(null);
    });

    it('应该为所有错误码提供映射', () => {
      const errorCodes = Object.values(ErrorCode);

      errorCodes.forEach((code) => {
        expect(ERROR_CODE_TO_TYPE).toHaveProperty(code);
        expect(ERROR_CODE_TO_CLASS).toHaveProperty(code);
        expect(ERROR_CODE_MESSAGES).toHaveProperty(code);
      });
    });

    it('应该正确处理错误码对应的用户消息', () => {
      const error = createErrorFromCode(ErrorCode.NO_PROJECT_BOUND);
      const userMessage = errorHandler.formatUserMessage(error);
      expect(userMessage).toBe(
        '当前连接没有绑定活跃项目，请先调用 project_bind'
      );
    });
  });

  describe('错误处理', () => {
    it('应该正确处理 ValidationError', () => {
      const error = new ValidationError('参数无效', { field: 'name' });
      const result = errorHandler.handleError(error);

      expect(result).toEqual({
        success: false,
        error: '参数无效',
        type: ErrorType.ValidationError,
        timestamp: expect.any(String),
        context: { field: 'name' },
        stack: expect.any(String),
      });
    });

    it('应该正确处理通用 Error', () => {
      const error = new Error('通用错误');
      const result = errorHandler.handleError(error, { operation: 'test' });

      expect(result).toEqual({
        success: false,
        error: '通用错误',
        type: ErrorType.UnknownError,
        timestamp: expect.any(String),
        context: {
          originalError: 'Error',
          operation: 'test',
        },
        stack: expect.any(String),
      });
    });

    it('应该正确处理未知错误类型', () => {
      const error = 'string error';
      const result = errorHandler.handleError(error);

      expect(result).toEqual({
        success: false,
        error: '未知错误',
        type: ErrorType.UnknownError,
        timestamp: expect.any(String),
        context: {
          originalError: 'string error',
        },
        stack: expect.any(String),
      });
    });

    it('应该根据错误消息自动判断错误类型', () => {
      const fileError = new Error('文件不存在 ENOENT');
      const result = errorHandler.handleError(fileError);

      expect(result.type).toBe(ErrorType.SystemError);
    });

    it('应该正确处理包含堆栈跟踪的配置', () => {
      const handlerWithStack = ErrorHandler.getInstance({
        includeStackTrace: true,
      });

      const error = new Error('测试错误');
      const result = handlerWithStack.handleError(error);

      expect(result.stack).toBeDefined();
    });

    it('应该正确处理不包含堆栈跟踪的配置', () => {
      ErrorHandler.resetInstance();
      const handlerWithoutStack = ErrorHandler.getInstance({
        includeStackTrace: false,
      });

      const error = new Error('测试错误');
      const result = handlerWithoutStack.handleError(error);

      expect(result.stack).toBeUndefined();
    });
  });

  describe('上下文清理', () => {
    it('应该清理敏感信息', () => {
      const error = new ValidationError('测试错误', {
        username: 'user123',
        password: 'secret123',
        token: 'abc123',
        normalField: 'normal value',
      });

      const result = errorHandler.handleError(error);

      expect(result.context).toEqual({
        username: 'user123',
        password: '[REDACTED]',
        token: '[REDACTED]',
        normalField: 'normal value',
      });
    });

    it('应该处理嵌套对象中的敏感信息', () => {
      const error = new ValidationError('测试错误', {
        user: {
          name: 'John',
          password: 'secret',
        },
        config: {
          apiKey: 'key123',
          url: 'https://api.example.com',
        },
      });

      const result = errorHandler.handleError(error);

      expect(result.context).toEqual({
        user: {
          name: 'John',
          password: '[REDACTED]',
        },
        config: {
          apiKey: '[REDACTED]',
          url: 'https://api.example.com',
        },
      });
    });

    it('应该限制上下文大小', () => {
      ErrorHandler.resetInstance();
      const handlerWithSmallContext = ErrorHandler.getInstance({
        maxContextSize: 50,
      });

      const largeContext = {
        data: 'a'.repeat(100),
      };

      const error = new ValidationError('测试错误', largeContext);
      const result = handlerWithSmallContext.handleError(error);

      expect(result.context?._truncated).toBe(true);
      expect(result.context?._originalSize).toBeGreaterThan(50);
    });
  });

  describe('错误统计', () => {
    it('应该正确统计错误', () => {
      errorHandler.handleError(new ValidationError('错误1'));
      errorHandler.handleError(new ValidationError('错误2'));
      errorHandler.handleError(new FileSystemError('错误3'));

      const metrics = errorHandler.getMetrics();

      expect(metrics.total).toBe(3);
      expect(metrics.byType[ErrorType.ValidationError]).toBe(2);
      expect(metrics.byType[ErrorType.FileSystemError]).toBe(1);
      expect(metrics.recent).toHaveLength(3);
    });

    it('应该能够清空统计', () => {
      errorHandler.handleError(new ValidationError('错误'));
      expect(errorHandler.getMetrics().total).toBe(1);

      errorHandler.clearMetrics();
      const metrics = errorHandler.getMetrics();

      expect(metrics.total).toBe(0);
      expect(metrics.byType).toEqual({});
      expect(metrics.recent).toHaveLength(0);
    });

    it('应该限制最近错误记录数量', () => {
      // 生成超过100个错误
      for (let i = 0; i < 150; i++) {
        errorHandler.handleError(new ValidationError(`错误${i}`));
      }

      const metrics = errorHandler.getMetrics();
      expect(metrics.recent).toHaveLength(100);
      expect(metrics.total).toBe(150);
    });
  });

  describe('参数验证', () => {
    it('应该验证必需参数', () => {
      const params = { name: 'test' };
      const requiredFields = ['name', 'email'];

      expect(() => {
        errorHandler.validateRequired(params, requiredFields);
      }).toThrow(ValidationError);
    });

    it('应该验证参数类型', () => {
      const params = { name: 'test', age: '25' };
      const typeMap = { name: 'string', age: 'number' };

      expect(() => {
        errorHandler.validateTypes(params, typeMap);
      }).toThrow(ValidationError);
    });

    it('应该验证字符串长度', () => {
      expect(() => {
        errorHandler.validateStringLength('ab', 'name', 3, 10);
      }).toThrow(ValidationError);

      expect(() => {
        errorHandler.validateStringLength('a'.repeat(15), 'name', 3, 10);
      }).toThrow(ValidationError);

      // 正常情况不应该抛出错误
      expect(() => {
        errorHandler.validateStringLength('test', 'name', 3, 10);
      }).not.toThrow();
    });

    it('应该验证数组长度', () => {
      expect(() => {
        errorHandler.validateArrayLength([1], 'items', 2, 5);
      }).toThrow(ValidationError);

      expect(() => {
        errorHandler.validateArrayLength([1, 2, 3, 4, 5, 6], 'items', 2, 5);
      }).toThrow(ValidationError);

      // 正常情况不应该抛出错误
      expect(() => {
        errorHandler.validateArrayLength([1, 2, 3], 'items', 2, 5);
      }).not.toThrow();
    });

    it('应该验证枚举值', () => {
      const allowedValues = ['red', 'green', 'blue'];

      expect(() => {
        errorHandler.validateEnum('yellow', 'color', allowedValues);
      }).toThrow(ValidationError);

      // 正常情况不应该抛出错误
      expect(() => {
        errorHandler.validateEnum('red', 'color', allowedValues);
      }).not.toThrow();
    });
  });

  describe('错误类型检查', () => {
    it('应该正确识别错误类型', () => {
      const validationError = new ValidationError('测试');
      const fileSystemError = new FileSystemError('测试');
      const genericError = new Error('测试');

      expect(
        errorHandler.isErrorType(validationError, ErrorType.ValidationError)
      ).toBe(true);
      expect(
        errorHandler.isErrorType(validationError, ErrorType.FileSystemError)
      ).toBe(false);
      expect(
        errorHandler.isErrorType(fileSystemError, ErrorType.FileSystemError)
      ).toBe(true);
      expect(
        errorHandler.isErrorType(genericError, ErrorType.ValidationError)
      ).toBe(false);
    });

    it('应该正确识别可恢复错误', () => {
      const concurrencyError = new ConcurrencyError('测试');
      const validationError = new ValidationError('测试');
      const genericError = new Error('测试');

      expect(errorHandler.isRecoverableError(concurrencyError)).toBe(true);
      expect(errorHandler.isRecoverableError(validationError)).toBe(false);
      expect(errorHandler.isRecoverableError(genericError)).toBe(false);
    });
  });

  describe('用户消息格式化', () => {
    it('应该为不同错误类型返回友好消息', () => {
      const validationError = new ValidationError('参数无效');
      const fileSystemError = new FileSystemError('文件操作失败');
      const notFoundError = new NotFoundError('资源不存在');
      const systemError = new SystemError('系统错误');
      const genericError = new Error('通用错误');

      expect(errorHandler.formatUserMessage(validationError)).toBe('参数无效');
      expect(errorHandler.formatUserMessage(fileSystemError)).toBe(
        '文件操作失败，请检查文件权限和磁盘空间'
      );
      expect(errorHandler.formatUserMessage(notFoundError)).toBe('资源不存在');
      expect(errorHandler.formatUserMessage(systemError)).toBe(
        '系统错误，请联系管理员'
      );
      expect(errorHandler.formatUserMessage(genericError)).toBe(
        '未知错误，请重试'
      );
    });
  });

  describe('中间件', () => {
    it('应该创建工具处理器包装器', async () => {
      const middleware = errorHandler.createMiddleware();

      const mockHandler = vi
        .fn()
        .mockRejectedValue(new ValidationError('测试错误'));
      const wrappedHandler = middleware.wrapToolHandler(
        mockHandler,
        'test_tool'
      );

      const result = await wrappedHandler('arg1', 'arg2');

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('测试错误'),
          },
        ],
      });
    });

    it('应该创建异步操作包装器', async () => {
      const middleware = errorHandler.createMiddleware();

      const mockFn = vi.fn().mockRejectedValue(new Error('异步错误'));
      const wrappedFn = middleware.wrapAsync(mockFn, { context: 'test' });

      const result = await wrappedFn('arg1');

      expect(result).toEqual({
        success: false,
        error: '异步错误',
        type: ErrorType.UnknownError,
        timestamp: expect.any(String),
        context: {
          originalError: 'Error',
          context: 'test',
        },
        stack: expect.any(String),
      });
    });
  });

  describe('配置', () => {
    it('应该返回正确的配置', () => {
      const config = errorHandler.getConfig();

      expect(config).toEqual({
        logLevel: LogLevel.Error,
        includeStackTrace: true,
        maxContextSize: 1000,
        enableMetrics: true,
      });
    });

    it('应该支持自定义配置', () => {
      ErrorHandler.resetInstance();
      const customHandler = ErrorHandler.getInstance({
        logLevel: LogLevel.Warning,
        includeStackTrace: false,
        maxContextSize: 500,
        enableMetrics: false,
      });

      const config = customHandler.getConfig();

      expect(config).toEqual({
        logLevel: LogLevel.Warning,
        includeStackTrace: false,
        maxContextSize: 500,
        enableMetrics: false,
      });
    });
  });
});
