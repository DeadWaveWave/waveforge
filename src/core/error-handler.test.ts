/**
 * 错误处理器测试用例
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ErrorHandler, 
  WaveForgeError, 
  ValidationError, 
  FileSystemError, 
  ConcurrencyError,
  ErrorType 
} from './error-handler.js';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    vi.clearAllMocks();
  });

  describe('单例模式', () => {
    it('应该返回同一个实例', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('错误处理', () => {
    it('应该处理 WaveForgeError', () => {
      const error = new ValidationError('测试验证错误', { field: 'test' });
      const result = errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.error).toBe('测试验证错误');
      expect(result.type).toBe(ErrorType.ValidationError);
      expect(result.context).toEqual({ field: 'test' });
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('应该处理普通 Error', () => {
      const error = new Error('普通错误');
      const result = errorHandler.handleError(error, { source: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('普通错误');
      expect(result.type).toBe(ErrorType.UnknownError);
      expect(result.context).toEqual({ originalError: 'Error', source: 'test' });
    });

    it('应该处理非 Error 对象', () => {
      const error = '字符串错误';
      const result = errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.error).toBe('未知错误');
      expect(result.type).toBe(ErrorType.UnknownError);
      expect(result.context).toEqual({ originalError: '字符串错误' });
    });

    it('应该处理 null 和 undefined', () => {
      const result1 = errorHandler.handleError(null);
      const result2 = errorHandler.handleError(undefined);

      expect(result1.success).toBe(false);
      expect(result1.error).toBe('未知错误');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('未知错误');
    });
  });

  describe('参数验证', () => {
    it('应该验证必需参数', () => {
      const params = { name: 'test', age: 25 };
      const requiredFields = ['name', 'age'];

      expect(() => {
        errorHandler.validateRequired(params, requiredFields);
      }).not.toThrow();
    });

    it('应该在缺少必需参数时抛出错误', () => {
      const params = { name: 'test' };
      const requiredFields = ['name', 'age', 'email'];

      expect(() => {
        errorHandler.validateRequired(params, requiredFields);
      }).toThrow(ValidationError);

      try {
        errorHandler.validateRequired(params, requiredFields);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('缺少必需参数: age, email');
        expect((error as ValidationError).context).toEqual({
          missing: ['age', 'email'],
          provided: ['name']
        });
      }
    });

    it('应该验证参数类型', () => {
      const params = { name: 'test', age: 25, active: true };
      const typeMap = { name: 'string', age: 'number', active: 'boolean' };

      expect(() => {
        errorHandler.validateTypes(params, typeMap);
      }).not.toThrow();
    });

    it('应该在参数类型错误时抛出错误', () => {
      const params = { name: 123, age: '25', active: 'true' };
      const typeMap = { name: 'string', age: 'number', active: 'boolean' };

      expect(() => {
        errorHandler.validateTypes(params, typeMap);
      }).toThrow(ValidationError);

      try {
        errorHandler.validateTypes(params, typeMap);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('参数类型错误');
        expect((error as ValidationError).context?.errors).toHaveLength(3);
      }
    });

    it('应该忽略未定义的参数', () => {
      const params = { name: 'test' };
      const typeMap = { name: 'string', age: 'number' };

      expect(() => {
        errorHandler.validateTypes(params, typeMap);
      }).not.toThrow();
    });
  });

  describe('异步函数包装', () => {
    it('应该包装成功的异步函数', async () => {
      const asyncFn = async (x: number, y: number) => x + y;
      const wrappedFn = errorHandler.wrapAsync(asyncFn);

      const result = await wrappedFn(2, 3);
      expect(result).toBe(5);
    });

    it('应该捕获异步函数中的错误', async () => {
      const asyncFn = async () => {
        throw new ValidationError('异步验证错误', { field: 'test' });
      };
      const wrappedFn = errorHandler.wrapAsync(asyncFn, { source: 'test' });

      const result = await wrappedFn();
      expect(result).toEqual({
        success: false,
        error: '异步验证错误',
        type: ErrorType.ValidationError,
        timestamp: expect.any(String),
        context: { field: 'test' }
      });
    });
  });
});

describe('WaveForgeError', () => {
  it('应该创建基础错误', () => {
    const error = new WaveForgeError('测试错误');
    
    expect(error.name).toBe('WaveForgeError');
    expect(error.message).toBe('测试错误');
    expect(error.type).toBe(ErrorType.UnknownError);
    expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('应该创建带上下文的错误', () => {
    const context = { field: 'test', value: 123 };
    const error = new WaveForgeError('测试错误', ErrorType.ValidationError, context);
    
    expect(error.type).toBe(ErrorType.ValidationError);
    expect(error.context).toEqual(context);
  });

  it('应该正确序列化为 JSON', () => {
    const error = new WaveForgeError('测试错误', ErrorType.ValidationError, { test: true });
    const json = error.toJSON();
    
    expect(json).toEqual({
      name: 'WaveForgeError',
      message: '测试错误',
      type: ErrorType.ValidationError,
      timestamp: error.timestamp,
      context: { test: true },
      stack: error.stack
    });
  });
});

describe('ValidationError', () => {
  it('应该创建验证错误', () => {
    const error = new ValidationError('验证失败', { field: 'email' });
    
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('验证失败');
    expect(error.type).toBe(ErrorType.ValidationError);
    expect(error.context).toEqual({ field: 'email' });
  });
});

describe('FileSystemError', () => {
  it('应该创建文件系统错误', () => {
    const error = new FileSystemError('文件不存在', { path: '/test/file.txt' });
    
    expect(error.name).toBe('FileSystemError');
    expect(error.message).toBe('文件不存在');
    expect(error.type).toBe(ErrorType.FileSystemError);
    expect(error.context).toEqual({ path: '/test/file.txt' });
  });
});

describe('ConcurrencyError', () => {
  it('应该创建并发错误', () => {
    const error = new ConcurrencyError('锁获取失败', { lockId: 'task-123' });
    
    expect(error.name).toBe('ConcurrencyError');
    expect(error.message).toBe('锁获取失败');
    expect(error.type).toBe(ErrorType.ConcurrencyError);
    expect(error.context).toEqual({ lockId: 'task-123' });
  });
});

describe('错误类型枚举', () => {
  it('应该包含所有错误类型', () => {
    expect(ErrorType.ValidationError).toBe('VALIDATION_ERROR');
    expect(ErrorType.FileSystemError).toBe('FILESYSTEM_ERROR');
    expect(ErrorType.ConcurrencyError).toBe('CONCURRENCY_ERROR');
    expect(ErrorType.NetworkError).toBe('NETWORK_ERROR');
    expect(ErrorType.UnknownError).toBe('UNKNOWN_ERROR');
  });
});