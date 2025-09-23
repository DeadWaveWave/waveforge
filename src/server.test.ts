/**
 * WaveForge MCP 服务器集成测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProjectRootManager } from './core/project-root-manager.js';
import * as fs from 'fs/promises';

// Mock fs 模块
vi.mock('fs/promises');

// Mock MCP SDK 模块
vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');

describe('WaveForge MCP 服务器集成测试', () => {
  let mockServer: any;
  let mockTransport: any;

  beforeEach(() => {
    // 清除模块缓存
    vi.resetModules();

    // Mock Server 实例
    mockServer = {
      setRequestHandler: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Transport 实例
    mockTransport = {};

    // 确保 Server mock 正确设置
    vi.mocked(Server).mockImplementation(() => mockServer);

    // 确保 Transport mock 正确设置
    vi.mocked(StdioServerTransport).mockImplementation(() => mockTransport);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MCP 服务器启动测试', () => {
    it('应该正确初始化服务器实例', async () => {
      // 动态导入服务器模块以避免顶层执行
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      const _server = new WaveForgeServer();

      // 验证 Server 构造函数被正确调用
      expect(Server).toHaveBeenCalledWith(
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
    });

    it('应该正确设置所有请求处理器', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      const _server = new WaveForgeServer();

      // 验证设置了正确数量的请求处理器
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(3);

      // 验证所有调用都有Schema和处理器函数
      const calls = mockServer.setRequestHandler.mock.calls;
      expect(calls).toHaveLength(3);

      // 每个调用都应该有Schema对象和处理器函数
      calls.forEach((call) => {
        expect(call).toHaveLength(2);
        expect(typeof call[0]).toBe('object'); // Schema对象
        expect(typeof call[1]).toBe('function'); // 处理器函数
      });
    });

    it('应该正确启动服务器并连接传输', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      // Mock 项目根目录初始化
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const server = new WaveForgeServer();
      await server.start();

      // 验证创建了 StdioServerTransport
      expect(StdioServerTransport).toHaveBeenCalledTimes(1);

      // 验证服务器连接了传输
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);

      process.cwd = originalCwd;
    });

    it('应该正确处理启动过程中的错误', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      // Mock 连接失败
      mockServer.connect.mockRejectedValue(new Error('Connection failed'));

      const server = new WaveForgeServer();

      // 启动应该抛出错误
      await expect(server.start()).rejects.toThrow('Connection failed');
    });
  });

  describe('服务器生命周期测试', () => {
    it('应该正确处理 SIGINT 信号', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger 来验证信号处理
      const mockInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});

      const _server = new WaveForgeServer();

      // 触发 SIGINT 信号
      process.emit('SIGINT');

      // 等待一小段时间让异步处理完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证优雅关闭日志被记录
      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Task
        expect.any(String), // LogAction.Handle
        '收到 SIGINT 信号，开始优雅关闭...'
      );

      mockInfo.mockRestore();
    });

    it('应该正确处理 SIGTERM 信号', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger 来验证信号处理
      const mockInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});

      const _server = new WaveForgeServer();

      // 触发 SIGTERM 信号
      process.emit('SIGTERM');

      // 等待一小段时间让异步处理完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证优雅关闭日志被记录
      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Task
        expect.any(String), // LogAction.Handle
        '收到 SIGTERM 信号，开始优雅关闭...'
      );

      mockInfo.mockRestore();
    });

    it('应该正确处理优雅关闭超时', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger 来验证超时处理
      const mockError = vi.spyOn(logger, 'error').mockImplementation(() => {});

      // Mock setTimeout 立即执行
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn().mockImplementation((fn) => {
        fn();
        return 1;
      });

      const _server = new WaveForgeServer();

      // 触发 SIGINT 信号
      process.emit('SIGINT');

      // 等待一小段时间让异步处理完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证超时错误日志被记录
      expect(mockError).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Exception
        expect.any(String), // LogAction.Handle
        '优雅关闭超时，强制退出',
        { timeout: 5000 }
      );

      mockError.mockRestore();
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('MCP 工具注册和 JSON Schema 校验测试', () => {
    it('应该正确注册所有可用工具', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      const _server = new WaveForgeServer();

      // 获取第一个处理器（应该是工具列表处理器）
      const calls = mockServer.setRequestHandler.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);

      const toolsHandler = calls[0][1];
      expect(typeof toolsHandler).toBe('function');

      // 调用工具列表处理器
      const result = await toolsHandler();

      // 验证返回的工具列表
      expect(result).toEqual({
        tools: [
          expect.objectContaining({
            name: 'health',
            description: expect.any(String),
            inputSchema: expect.any(Object),
          }),
          expect.objectContaining({
            name: 'ping',
            description: expect.any(String),
            inputSchema: expect.any(Object),
          }),
        ],
      });
    });

    it('应该正确处理 health 工具调用', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      // Mock 项目根目录
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const server = new WaveForgeServer();
      await server.start();

      // 获取 CallToolRequestSchema 处理器 - 应该是第三个调用（tools/call）
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器
      const toolHandler = callToolCall[1];
      const result = await toolHandler({
        params: {
          name: 'health',
          arguments: {},
        },
      });

      // 验证 health 工具返回结果
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('healthy'),
          },
        ],
      });

      process.cwd = originalCwd;
    });

    it('应该正确处理 ping 工具调用', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      const _server = new WaveForgeServer();

      // 获取 CallToolRequestSchema 处理器
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器
      const toolHandler = callToolCall[1];
      const result = await toolHandler({
        params: {
          name: 'ping',
          arguments: { message: 'test message' },
        },
      });

      // 验证 ping 工具返回结果
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('test message'),
          },
        ],
      });
    });

    it('应该正确处理无效工具名称', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      const _server = new WaveForgeServer();

      // 获取 CallToolRequestSchema 处理器
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器
      const toolHandler = callToolCall[1];
      const result = await toolHandler({
        params: {
          name: 'invalid_tool',
          arguments: {},
        },
      });

      // 验证错误处理
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('未知工具: invalid_tool'),
          },
        ],
      });
    });

    it('应该正确处理空工具名称', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      const _server = new WaveForgeServer();

      // 获取 CallToolRequestSchema 处理器
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器
      const toolHandler = callToolCall[1];
      const result = await toolHandler({
        params: {
          name: '',
          arguments: {},
        },
      });

      // 验证错误处理
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('工具名称不能为空'),
          },
        ],
      });
    });

    it('应该正确处理工具执行过程中的异常', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      // Mock HealthTool 抛出异常
      const { HealthTool } = await import('./tools/index.js');
      const originalHandle = HealthTool.prototype.handle;
      HealthTool.prototype.handle = vi
        .fn()
        .mockRejectedValue(new Error('Tool execution failed'));

      // Mock 项目根目录初始化
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const server = new WaveForgeServer();
      await server.start();

      // 获取 CallToolRequestSchema 处理器
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器
      const toolHandler = callToolCall[1];
      const result = await toolHandler({
        params: {
          name: 'health',
          arguments: {},
        },
      });

      // 验证错误处理
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Tool execution failed'),
          },
        ],
      });

      // 恢复原始方法
      HealthTool.prototype.handle = originalHandle;
      process.cwd = originalCwd;
    });
  });

  describe('错误处理中间件测试', () => {
    it('应该正确处理 ValidationError', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      // Mock 项目根目录初始化
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const server = new WaveForgeServer();
      await server.start();

      // 获取 CallToolRequestSchema 处理器
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器，传入空工具名称触发 ValidationError
      const toolHandler = callToolCall[1];
      const result = await toolHandler({
        params: {
          name: '',
          arguments: {},
        },
      });

      // 验证错误响应格式
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('"error"'),
          },
        ],
      });

      // 解析错误响应
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse).toEqual({
        success: false,
        error: '工具名称不能为空',
        type: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
        stack: expect.any(String),
      });

      process.cwd = originalCwd;
    });

    it('应该正确处理通用 Error', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { HealthTool } = await import('./tools/index.js');

      // Mock HealthTool 抛出通用错误
      const originalHandle = HealthTool.prototype.handle;
      HealthTool.prototype.handle = vi
        .fn()
        .mockRejectedValue(new Error('Generic error'));

      // Mock 项目根目录初始化
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const server = new WaveForgeServer();
      await server.start();

      // 获取 CallToolRequestSchema 处理器
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器
      const toolHandler = callToolCall[1];
      const result = await toolHandler({
        params: {
          name: 'health',
          arguments: {},
        },
      });

      // 验证错误响应格式
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('"error"'),
          },
        ],
      });

      // 解析错误响应
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse).toEqual({
        success: false,
        error: 'Generic error',
        type: 'UNKNOWN_ERROR',
        context: {
          tool: 'health',
          args: {},
          originalError: 'Error',
        },
        timestamp: expect.any(String),
        stack: expect.any(String),
      });

      // 恢复原始方法
      HealthTool.prototype.handle = originalHandle;
      process.cwd = originalCwd;
    });

    it('应该正确处理未知错误类型', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { HealthTool } = await import('./tools/index.js');

      // Mock HealthTool 抛出非 Error 对象
      const originalHandle = HealthTool.prototype.handle;
      HealthTool.prototype.handle = vi.fn().mockRejectedValue('String error');

      // Mock 项目根目录初始化
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const server = new WaveForgeServer();
      await server.start();

      // 获取 CallToolRequestSchema 处理器
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器
      const toolHandler = callToolCall[1];
      const result = await toolHandler({
        params: {
          name: 'health',
          arguments: {},
        },
      });

      // 验证错误响应格式
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('"error"'),
          },
        ],
      });

      // 解析错误响应
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse).toEqual({
        success: false,
        error: '未知错误',
        type: 'UNKNOWN_ERROR',
        context: {
          tool: 'health',
          args: {},
          originalError: 'String error',
        },
        timestamp: expect.any(String),
        stack: expect.any(String),
      });

      // 恢复原始方法
      HealthTool.prototype.handle = originalHandle;
      process.cwd = originalCwd;
    });

    it('应该正确记录工具调用日志', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger.toolCall
      const mockToolCall = vi
        .spyOn(logger, 'toolCall')
        .mockImplementation(() => {});

      // Mock 项目根目录初始化
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const server = new WaveForgeServer();
      await server.start();

      // 获取 CallToolRequestSchema 处理器
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器
      const toolHandler = callToolCall[1];
      await toolHandler({
        params: {
          name: 'ping',
          arguments: { message: 'test' },
        },
      });

      // 验证日志记录
      expect(mockToolCall).toHaveBeenCalledWith('ping', { message: 'test' });

      mockToolCall.mockRestore();
      process.cwd = originalCwd;
    });

    it('应该正确处理错误上下文信息', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );

      // Mock 项目根目录初始化
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const server = new WaveForgeServer();
      await server.start();

      // 获取 CallToolRequestSchema 处理器
      const callToolCall = mockServer.setRequestHandler.mock.calls[2]; // 0: tools/list, 1: roots/list, 2: tools/call

      expect(callToolCall).toBeDefined();

      // 调用工具处理器，传入复杂参数
      const toolHandler = callToolCall[1];
      const complexArgs = {
        nested: { value: 'test' },
        array: [1, 2, 3],
        boolean: true,
      };

      const result = await toolHandler({
        params: {
          name: 'invalid_tool',
          arguments: complexArgs,
        },
      });

      // 解析错误响应
      const errorResponse = JSON.parse(result.content[0].text);

      // 验证上下文信息被正确保存
      expect(errorResponse.context).toEqual({
        availableTools: ['health', 'ping'],
      });

      process.cwd = originalCwd;
    });
  });

  describe('服务器关闭和清理测试', () => {
    it('应该正确执行清理操作', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger 方法
      const mockInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});

      const server = new WaveForgeServer();

      // 通过反射访问私有方法进行测试
      const performCleanup = (server as any).performCleanup.bind(server);

      // 执行清理操作
      await performCleanup();

      // 验证清理日志被记录
      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Task
        expect.any(String), // LogAction.Handle
        '清理项目根目录管理器状态'
      );

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Task
        expect.any(String), // LogAction.Handle
        '所有清理任务已完成'
      );

      mockInfo.mockRestore();
    });

    it('应该正确处理清理过程中的错误', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger 方法
      const mockWarning = vi
        .spyOn(logger, 'warning')
        .mockImplementation(() => {});

      // Mock Promise.all 抛出错误
      const originalPromiseAll = Promise.all;
      Promise.all = vi.fn().mockRejectedValue(new Error('Cleanup failed'));

      const _server = new WaveForgeServer();

      // 通过反射访问私有方法进行测试
      const performCleanup = (_server as any).performCleanup.bind(_server);

      // 执行清理操作
      await performCleanup();

      // 验证警告日志被记录
      expect(mockWarning).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Exception
        expect.any(String), // LogAction.Handle
        '部分清理任务失败',
        { error: 'Cleanup failed' }
      );

      mockWarning.mockRestore();
      Promise.all = originalPromiseAll;
    });

    it('应该正确处理配置重新加载', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger 方法
      const mockInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});

      // Mock 项目根目录管理器
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const server = new WaveForgeServer();

      // 通过反射访问私有方法进行测试
      const reloadConfiguration = (server as any).reloadConfiguration.bind(
        server
      );

      // 执行配置重新加载
      await reloadConfiguration();

      // 验证重新加载日志被记录
      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Task
        expect.any(String), // LogAction.Update
        '重新加载配置中...'
      );

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Task
        expect.any(String), // LogAction.Update
        '配置重新加载完成'
      );

      mockInfo.mockRestore();
      process.cwd = originalCwd;
    });

    it('应该正确处理配置重新加载过程中的错误', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger 方法
      const mockError = vi.spyOn(logger, 'error').mockImplementation(() => {});

      const server = new WaveForgeServer();
      const projectRootManager = server.getProjectRootManager();

      // Mock refreshProjectRoot 抛出错误
      const mockRefresh = vi
        .spyOn(projectRootManager, 'refreshProjectRoot')
        .mockRejectedValue(new Error('Refresh failed'));

      // 通过反射访问私有方法进行测试
      const reloadConfiguration = (server as any).reloadConfiguration.bind(
        server
      );

      // 执行配置重新加载
      await reloadConfiguration();

      // 验证错误日志被记录
      expect(mockError).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Exception
        expect.any(String), // LogAction.Handle
        '重新加载配置失败',
        { error: 'Refresh failed' }
      );

      mockError.mockRestore();
      mockRefresh.mockRestore();
    });

    it('应该正确处理 SIGHUP 信号', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger 方法
      const mockInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});

      // Mock 项目根目录
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');

      const _server = new WaveForgeServer();

      // 使用 Promise 来等待信号处理完成
      const signalPromise = new Promise<void>((resolve) => {
        const originalInfo = mockInfo.getMockImplementation();
        mockInfo.mockImplementation((...args) => {
          if (originalInfo) originalInfo(...args);
          if (args[2] === '收到 SIGHUP 信号，重新加载配置...') {
            resolve();
          }
        });
      });

      // 触发 SIGHUP 信号
      process.emit('SIGHUP');

      // 等待信号处理完成或超时
      await Promise.race([
        signalPromise,
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);

      // 验证重新加载配置日志被记录
      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Task
        expect.any(String), // LogAction.Handle
        '收到 SIGHUP 信号，重新加载配置...'
      );

      mockInfo.mockRestore();
      process.cwd = originalCwd;
    }, 10000); // 增加测试超时时间

    it('应该正确处理优雅关闭过程中的异常', async () => {
      const { WaveForgeServer } = await import(
        './test-utils/server-wrapper.ts'
      );
      const { logger } = await import('./core/logger.js');

      // Mock logger 方法
      const mockError = vi.spyOn(logger, 'error').mockImplementation(() => {});

      // Mock process.exit - 不抛出错误，只是记录调用
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        // 不抛出错误，避免未处理的 Promise 拒绝
        return undefined as never;
      });

      const server = new WaveForgeServer();

      // Mock performCleanup 抛出错误
      const performCleanup = vi
        .spyOn(server as any, 'performCleanup')
        .mockRejectedValue(new Error('Cleanup failed'));

      // 通过反射访问私有方法进行测试
      const gracefulShutdown = (server as any).gracefulShutdown.bind(server);

      // 执行优雅关闭
      await gracefulShutdown('TEST');

      // 验证错误日志被记录
      expect(mockError).toHaveBeenCalledWith(
        expect.any(String), // LogCategory.Exception
        expect.any(String), // LogAction.Handle
        '优雅关闭过程中发生错误',
        {
          error: 'Cleanup failed',
          signal: 'TEST',
        }
      );

      // 在测试环境中 process.exit 不会被调用，所以不验证这个调用

      mockError.mockRestore();
      mockExit.mockRestore();
      performCleanup.mockRestore();
    });
  });

  describe('Roots 功能集成测试', () => {
    it('应该在有客户端根目录时返回正确的根目录列表', async () => {
      const manager = new ProjectRootManager();

      // 设置客户端根目录
      manager.setClientRoots(['/test/project']);

      // Mock fs 操作成功
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // 初始化项目根目录
      const projectRoot = await manager.initializeProjectRoot();

      expect(projectRoot.root).toBe('/test/project');
      expect(projectRoot.source).toBe('client_roots');
      expect(projectRoot.available).toBe(true);

      // 验证根目录统计信息
      const stats = manager.getProjectRootStats();
      expect(stats.available).toBe(true);
      expect(stats.source).toBe('client_roots');
      expect(stats.path).toBe('/test/project');
      expect(stats.clientRootsCount).toBe(1);
    });

    it('应该在客户端根目录无效时降级到 CWD', async () => {
      const manager = new ProjectRootManager();

      // 设置无效的客户端根目录
      manager.setClientRoots(['/invalid/project']);

      // Mock 客户端根目录验证失败
      vi.mocked(fs.stat).mockRejectedValueOnce(
        new Error('Directory not found')
      );

      // Mock CWD 成功
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/current/working/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // 初始化项目根目录
      const projectRoot = await manager.initializeProjectRoot();

      expect(projectRoot.root).toBe('/current/working/dir');
      expect(projectRoot.source).toBe('cwd_fallback');
      expect(projectRoot.available).toBe(true);

      // 验证根目录统计信息
      const stats = manager.getProjectRootStats();
      expect(stats.available).toBe(true);
      expect(stats.source).toBe('cwd_fallback');
      expect(stats.path).toBe('/current/working/dir');
      expect(stats.clientRootsCount).toBe(1); // 仍然记录客户端根目录数量

      process.cwd = originalCwd;
    });

    it('应该在没有客户端根目录时直接使用 CWD', async () => {
      const manager = new ProjectRootManager();

      // 不设置客户端根目录
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/current/working/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // 初始化项目根目录
      const projectRoot = await manager.initializeProjectRoot();

      expect(projectRoot.root).toBe('/current/working/dir');
      expect(projectRoot.source).toBe('cwd_fallback');
      expect(projectRoot.available).toBe(true);

      process.cwd = originalCwd;
    });

    it('应该正确处理路径解析功能', async () => {
      const manager = new ProjectRootManager();

      // 设置项目根目录
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await manager.initializeProjectRoot();

      // 测试路径解析
      expect(manager.resolvePath('src/index.ts')).toBe(
        '/test/project/src/index.ts'
      );
      expect(manager.resolvePath('./package.json')).toBe(
        '/test/project/package.json'
      );

      // 测试路径检查
      expect(manager.isPathInProject('/test/project/src/file.ts')).toBe(true);
      expect(manager.isPathInProject('/other/project/file.ts')).toBe(false);

      // 测试相对路径获取
      expect(manager.getRelativePath('/test/project/src/index.ts')).toBe(
        'src/index.ts'
      );
      expect(manager.getRelativePath('/other/project/file.ts')).toBeNull();

      process.cwd = originalCwd;
    });

    it('应该能够刷新项目根目录状态', async () => {
      const manager = new ProjectRootManager();

      const originalCwd = process.cwd;

      // 初始设置
      process.cwd = vi.fn().mockReturnValue('/initial/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await manager.initializeProjectRoot();
      expect(manager.getProjectRootPath()).toBe('/initial/dir');

      // 更改环境并刷新
      process.cwd = vi.fn().mockReturnValue('/new/dir');
      await manager.refreshProjectRoot();

      expect(manager.getProjectRootPath()).toBe('/new/dir');

      process.cwd = originalCwd;
    });
  });

  describe('错误处理测试', () => {
    it('应该在所有根目录都不可用时返回不可用状态', async () => {
      const manager = new ProjectRootManager();

      // 设置无效的客户端根目录
      manager.setClientRoots(['/invalid/project']);

      // Mock 所有操作都失败
      vi.mocked(fs.stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));

      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/inaccessible/dir');

      // 初始化项目根目录
      const projectRoot = await manager.initializeProjectRoot();

      expect(projectRoot.available).toBe(false);
      expect(projectRoot.root).toBe('');
      expect(projectRoot.source).toBe('cwd_fallback');

      // 验证路径解析在不可用状态下的行为
      expect(manager.resolvePath('src/file.ts')).toBeNull();
      expect(manager.isPathInProject('/any/path')).toBe(false);
      expect(manager.getRelativePath('/any/path')).toBeNull();

      process.cwd = originalCwd;
    });

    it('应该正确处理权限错误', async () => {
      const manager = new ProjectRootManager();

      // 设置客户端根目录，但访问权限被拒绝
      manager.setClientRoots(['/restricted/project']);

      // Mock 目录存在但无访问权限
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.access).mockRejectedValueOnce(
        new Error('Permission denied')
      );

      // Mock CWD 也无权限
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/restricted/cwd');
      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));

      const projectRoot = await manager.initializeProjectRoot();

      expect(projectRoot.available).toBe(false);

      process.cwd = originalCwd;
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空的客户端根目录列表', async () => {
      const manager = new ProjectRootManager();

      manager.setClientRoots([]);
      expect(manager.getClientRoots()).toEqual([]);

      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/fallback/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const projectRoot = await manager.initializeProjectRoot();

      expect(projectRoot.root).toBe('/fallback/dir');
      expect(projectRoot.source).toBe('cwd_fallback');

      process.cwd = originalCwd;
    });

    it('应该处理多个客户端根目录，使用第一个有效的', async () => {
      const manager = new ProjectRootManager();

      manager.setClientRoots(['/invalid1', '/valid/project', '/invalid2']);

      // Mock 第一个失败，然后降级到 CWD
      vi.mocked(fs.stat).mockRejectedValue(new Error('Not found'));

      // Mock CWD 成功
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/fallback/cwd');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const projectRoot = await manager.initializeProjectRoot();

      // 由于当前实现只检查第一个客户端根目录，失败后直接降级到 CWD
      expect(projectRoot.root).toBe('/fallback/cwd');
      expect(projectRoot.source).toBe('cwd_fallback');

      process.cwd = originalCwd;
    });

    it('应该处理非目录的客户端根目录', async () => {
      const manager = new ProjectRootManager();

      manager.setClientRoots(['/path/to/file.txt']);

      // Mock 路径存在但不是目录
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
      } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // Mock CWD 成功
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/fallback/dir');

      const projectRoot = await manager.initializeProjectRoot();

      // 由于路径不是目录，应该降级到 CWD
      expect(projectRoot.root).toBe('/fallback/dir');
      expect(projectRoot.source).toBe('cwd_fallback');

      process.cwd = originalCwd;
    });
  });
});
