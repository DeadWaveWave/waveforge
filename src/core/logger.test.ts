/**
 * 日志系统测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Logger } from './logger.js';
import { LogLevel, LogCategory, LogAction } from '../types/index.js';

describe('Logger', () => {
  let logger: Logger;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // 重置单例实例
    Logger.resetInstance();
    logger = Logger.getInstance();

    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('基础日志记录', () => {
    it('应该记录信息日志', () => {
      logger.info(LogCategory.Task, LogAction.Create, '测试消息', {
        key: 'value',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WaveForge Info]',
        expect.stringContaining('测试消息')
      );
    });

    it('应该记录警告日志', () => {
      logger.warning(LogCategory.Task, LogAction.Handle, '警告消息');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WaveForge Warning]',
        expect.stringContaining('警告消息')
      );
    });

    it('应该记录错误日志', () => {
      logger.error(LogCategory.Exception, LogAction.Handle, '错误消息');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WaveForge Error]',
        expect.stringContaining('错误消息')
      );
    });

    it('应该记录教学日志', () => {
      logger.teach(LogCategory.Knowledge, LogAction.Create, '教学消息');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WaveForge Teach]',
        expect.stringContaining('教学消息')
      );
    });
  });

  describe('日志级别过滤', () => {
    it('应该根据日志级别过滤日志', () => {
      Logger.resetInstance();
      const errorLogger = Logger.getInstance({ level: LogLevel.Error });

      errorLogger.info(LogCategory.Task, LogAction.Create, '信息消息');
      errorLogger.warning(LogCategory.Task, LogAction.Handle, '警告消息');
      errorLogger.error(LogCategory.Exception, LogAction.Handle, '错误消息');

      // 只有错误日志应该被记录
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WaveForge Error]',
        expect.stringContaining('错误消息')
      );
    });

    it('应该能够动态设置日志级别', () => {
      logger.setLogLevel(LogLevel.Warning);

      // 清空之前的调用记录
      consoleErrorSpy.mockClear();

      logger.info(LogCategory.Task, LogAction.Create, '信息消息');
      logger.warning(LogCategory.Task, LogAction.Handle, '警告消息');

      // 信息日志不应该被记录，但警告日志应该被记录
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WaveForge Warning]',
        expect.stringContaining('警告消息')
      );
    });
  });

  describe('敏感信息清理', () => {
    it('应该清理敏感字段', () => {
      logger.info(LogCategory.Task, LogAction.Create, '测试消息', {
        username: 'user123',
        password: 'secret123',
        token: 'abc123',
        normalField: 'normal value',
      });

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.details).toEqual({
        username: 'user123',
        password: '[REDACTED]',
        token: '[REDACTED]',
        normalField: 'normal value',
      });
    });

    it('应该清理嵌套对象中的敏感信息', () => {
      logger.info(LogCategory.Task, LogAction.Create, '测试消息', {
        user: {
          name: 'John',
          password: 'secret',
        },
        config: {
          apiKey: 'key123',
          url: 'https://api.example.com',
        },
      });

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.details).toEqual({
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
  });

  describe('关联ID和上下文', () => {
    it('应该支持关联ID', () => {
      logger.setCorrelationId('test-correlation-123');
      logger.info(LogCategory.Task, LogAction.Create, '测试消息');

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.correlationId).toBe('test-correlation-123');
    });

    it('应该支持会话ID和用户ID', () => {
      logger.setSessionId('session-456');
      logger.setUserId('user-789');
      logger.info(LogCategory.Task, LogAction.Create, '测试消息');

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.sessionId).toBe('session-456');
      expect(logData.userId).toBe('user-789');
    });

    it('应该支持带关联ID的日志记录器', () => {
      const correlatedLogger = logger.withCorrelation('corr-123');
      correlatedLogger.info(LogCategory.Task, LogAction.Create, '测试消息');

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.correlationId).toBe('corr-123');
    });
  });

  describe('统计信息', () => {
    it('应该正确统计日志', () => {
      logger.info(LogCategory.Task, LogAction.Create, '信息1');
      logger.info(LogCategory.Task, LogAction.Update, '信息2');
      logger.warning(LogCategory.Task, LogAction.Handle, '警告1');
      logger.error(LogCategory.Exception, LogAction.Handle, '错误1');

      const stats = logger.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byLevel[LogLevel.Info]).toBe(2);
      expect(stats.byLevel[LogLevel.Warning]).toBe(1);
      expect(stats.byLevel[LogLevel.Error]).toBe(1);
      expect(stats.byCategory[LogCategory.Task]).toBe(3);
      expect(stats.byCategory[LogCategory.Exception]).toBe(1);
      expect(stats.byAction[LogAction.Create]).toBe(1);
      expect(stats.byAction[LogAction.Update]).toBe(1);
      expect(stats.byAction[LogAction.Handle]).toBe(2);
      expect(stats.recent).toHaveLength(4);
      expect(stats.errors).toHaveLength(1);
    });

    it('应该能够清空统计', () => {
      logger.info(LogCategory.Task, LogAction.Create, '测试消息');
      expect(logger.getStats().total).toBe(1);

      logger.clearStats();
      const stats = logger.getStats();

      expect(stats.total).toBe(0);
      expect(stats.byLevel).toEqual({});
      expect(stats.recent).toHaveLength(0);
      expect(stats.errors).toHaveLength(0);
    });

    it('应该限制最近日志和错误日志数量', () => {
      // 生成超过100条日志
      for (let i = 0; i < 150; i++) {
        logger.info(LogCategory.Task, LogAction.Create, `消息${i}`);
      }

      // 生成超过50条错误日志
      for (let i = 0; i < 60; i++) {
        logger.error(LogCategory.Exception, LogAction.Handle, `错误${i}`);
      }

      const stats = logger.getStats();
      expect(stats.recent).toHaveLength(100);
      expect(stats.errors).toHaveLength(50);
      expect(stats.total).toBe(210);
    });
  });

  describe('专用日志方法', () => {
    it('应该记录健康检查日志', () => {
      logger.health('服务器健康', { uptime: 3600 });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WaveForge Info]',
        expect.stringContaining('服务器健康')
      );
    });

    it('应该记录启动日志', () => {
      logger.startup('服务器启动', { version: '1.0.0' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WaveForge Info]',
        expect.stringContaining('服务器启动')
      );
    });

    it('应该记录工具调用日志', () => {
      logger.toolCall('test_tool', { arg1: 'value1' });

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.message).toContain('工具调用: test_tool');
      expect(logData.details.tool).toBe('test_tool');
      expect(logData.details.arguments).toEqual({ arg1: 'value1' });
    });

    it('应该记录性能日志', () => {
      logger.performance(LogCategory.Task, LogAction.Handle, '操作完成', 1500, {
        operation: 'test',
      });

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.duration).toBe(1500);
      expect(logData.tags).toContain('performance');
    });

    it('应该记录审计日志', () => {
      logger.audit(
        LogAction.Create,
        '用户创建',
        { userId: 'user123' },
        'admin'
      );

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.tags).toContain('audit');
      expect(logData.correlationId).toBe('admin');
    });

    it('应该记录安全日志', () => {
      logger.security(LogAction.Handle, '登录失败', { ip: '192.168.1.1' });

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.level).toBe(LogLevel.Warning);
      expect(logData.tags).toContain('security');
    });
  });

  describe('日志查询', () => {
    beforeEach(() => {
      logger.clearStats();
      consoleErrorSpy.mockClear();
      logger.info(
        LogCategory.Task,
        LogAction.Create,
        '任务创建',
        undefined,
        undefined,
        { tags: ['task'] }
      );
      logger.warning(LogCategory.Task, LogAction.Update, '任务更新');
      logger.error(LogCategory.Exception, LogAction.Handle, '错误处理');
      logger.setCorrelationId('test-123');
      logger.info(LogCategory.Knowledge, LogAction.Create, '知识创建');
    });

    it('应该按级别查询日志', () => {
      const errorLogs = logger.queryLogs({ level: LogLevel.Error });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('错误处理');
    });

    it('应该按类别查询日志', () => {
      const taskLogs = logger.queryLogs({ category: LogCategory.Task });
      expect(taskLogs).toHaveLength(2);
    });

    it('应该按操作查询日志', () => {
      const createLogs = logger.queryLogs({ action: LogAction.Create });
      expect(createLogs).toHaveLength(2);
    });

    it('应该按消息内容查询日志', () => {
      const taskLogs = logger.queryLogs({ message: '任务' });
      expect(taskLogs).toHaveLength(2);
    });

    it('应该按关联ID查询日志', () => {
      const correlatedLogs = logger.queryLogs({ correlationId: 'test-123' });
      expect(correlatedLogs).toHaveLength(1);
      expect(correlatedLogs[0].message).toBe('知识创建');
    });

    it('应该按标签查询日志', () => {
      const taggedLogs = logger.queryLogs({ tags: ['task'] });
      expect(taggedLogs.length).toBeGreaterThanOrEqual(1);
      const taskLog = taggedLogs.find((log) => log.message === '任务创建');
      expect(taskLog).toBeDefined();
    });
  });

  describe('计时器', () => {
    it('应该创建和使用计时器', () => {
      vi.useFakeTimers();

      const timer = logger.createTimer('test-operation');

      // 模拟时间流逝
      vi.advanceTimersByTime(1000);

      timer.end(LogCategory.Task, LogAction.Handle, '操作完成', {
        result: 'success',
      });

      const logCall = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);

      expect(logData.duration).toBe(1000);
      expect(logData.tags).toContain('performance');
      expect(logData.details.timerName).toBe('test-operation');

      vi.useRealTimers();
    });
  });

  describe('批量日志', () => {
    it('应该支持批量记录日志', () => {
      const entries = [
        {
          level: LogLevel.Info,
          category: LogCategory.Task,
          action: LogAction.Create,
          message: '消息1',
        },
        {
          level: LogLevel.Warning,
          category: LogCategory.Task,
          action: LogAction.Update,
          message: '消息2',
        },
      ];

      logger.batch(entries);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(logger.getStats().total).toBe(2);
    });
  });

  describe('配置', () => {
    it('应该返回正确的配置', () => {
      const config = logger.getConfig();

      expect(config.level).toBe(LogLevel.Info);
      expect(config.enableConsole).toBe(true);
      expect(config.enableStructured).toBe(true);
    });

    it('应该支持自定义配置', () => {
      Logger.resetInstance();
      const customLogger = Logger.getInstance({
        level: LogLevel.Warning,
        enableConsole: false,
        enableStructured: false,
      });

      const config = customLogger.getConfig();

      expect(config.level).toBe(LogLevel.Warning);
      expect(config.enableConsole).toBe(false);
      expect(config.enableStructured).toBe(false);
    });

    it('应该支持非结构化日志输出', () => {
      Logger.resetInstance();
      const simpleLogger = Logger.getInstance({
        enableStructured: false,
        enableTimestamp: true,
      });

      simpleLogger.setCorrelationId('test-123');
      simpleLogger.info(LogCategory.Task, LogAction.Create, '简单消息');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[WaveForge Info\] \[.*\] \[test-123\] TASK\/CREATE: 简单消息/
        )
      );
    });
  });
});
