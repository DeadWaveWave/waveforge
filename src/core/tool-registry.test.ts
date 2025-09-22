/**
 * 工具注册系统测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ToolRegistry,
  ToolHandler,
  ToolRegistration,
} from './tool-registry.js';
import { ValidationError } from './error-handler.js';
import { ToolDefinition } from '@modelcontextprotocol/sdk/types.js';

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockHandler: ToolHandler;
  let mockRegistration: ToolRegistration;

  beforeEach(() => {
    registry = new ToolRegistry();

    // 创建 mock 工具处理器
    mockHandler = {
      getDefinition: vi.fn().mockReturnValue({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      } as ToolDefinition),
      handle: vi.fn().mockResolvedValue({ result: 'success' }),
      validateArgs: vi.fn().mockReturnValue({}),
    };

    mockRegistration = {
      name: 'test_tool',
      handler: mockHandler,
      category: 'system',
      description: 'Test tool for unit testing',
      enabled: true,
    };
  });

  describe('工具注册', () => {
    it('应该成功注册有效工具', () => {
      registry.registerTool(mockRegistration);

      expect(registry.hasTool('test_tool')).toBe(true);
      expect(registry.isToolEnabled('test_tool')).toBe(true);
      expect(registry.getToolHandler('test_tool')).toBe(mockHandler);
    });

    it('应该拒绝空工具名称', () => {
      const invalidRegistration = { ...mockRegistration, name: '' };

      expect(() => registry.registerTool(invalidRegistration)).toThrow(
        ValidationError
      );
      expect(() => registry.registerTool(invalidRegistration)).toThrow(
        '工具名称不能为空'
      );
    });

    it('应该拒绝无效的工具处理器', () => {
      const invalidRegistration = {
        ...mockRegistration,
        handler: {} as ToolHandler,
      };

      expect(() => registry.registerTool(invalidRegistration)).toThrow(
        ValidationError
      );
      expect(() => registry.registerTool(invalidRegistration)).toThrow(
        '工具 test_tool 的处理器无效'
      );
    });

    it('应该拒绝无效的工具定义', () => {
      const invalidHandler = {
        ...mockHandler,
        getDefinition: vi.fn().mockReturnValue(null),
      };
      const invalidRegistration = {
        ...mockRegistration,
        handler: invalidHandler,
      };

      expect(() => registry.registerTool(invalidRegistration)).toThrow(
        ValidationError
      );
      expect(() => registry.registerTool(invalidRegistration)).toThrow(
        '工具 test_tool 的定义无效'
      );
    });

    it('应该处理工具定义获取异常', () => {
      const invalidHandler = {
        ...mockHandler,
        getDefinition: vi.fn().mockImplementation(() => {
          throw new Error('Definition error');
        }),
      };
      const invalidRegistration = {
        ...mockRegistration,
        handler: invalidHandler,
      };

      expect(() => registry.registerTool(invalidRegistration)).toThrow(
        ValidationError
      );
      expect(() => registry.registerTool(invalidRegistration)).toThrow(
        '工具 test_tool 的定义获取失败'
      );
    });

    it('应该允许覆盖已存在的工具', () => {
      // 注册第一个工具
      registry.registerTool(mockRegistration);
      expect(registry.hasTool('test_tool')).toBe(true);

      // 创建新的处理器
      const newHandler = {
        ...mockHandler,
        handle: vi.fn().mockResolvedValue({ result: 'updated' }),
      };
      const newRegistration = {
        ...mockRegistration,
        handler: newHandler,
        description: 'Updated test tool',
      };

      // 覆盖注册
      registry.registerTool(newRegistration);
      expect(registry.getToolHandler('test_tool')).toBe(newHandler);
    });
  });

  describe('工具注销', () => {
    beforeEach(() => {
      registry.registerTool(mockRegistration);
    });

    it('应该成功注销存在的工具', () => {
      expect(registry.hasTool('test_tool')).toBe(true);

      const result = registry.unregisterTool('test_tool');
      expect(result).toBe(true);
      expect(registry.hasTool('test_tool')).toBe(false);
    });

    it('应该处理注销不存在的工具', () => {
      const result = registry.unregisterTool('nonexistent_tool');
      expect(result).toBe(false);
    });
  });

  describe('工具查询', () => {
    beforeEach(() => {
      // 注册多个不同类别的工具
      registry.registerTool(mockRegistration);

      registry.registerTool({
        name: 'task_tool',
        handler: mockHandler,
        category: 'task',
        description: 'Task management tool',
        enabled: true,
      });

      registry.registerTool({
        name: 'disabled_tool',
        handler: mockHandler,
        category: 'system',
        description: 'Disabled tool',
        enabled: false,
      });
    });

    it('应该返回所有已启用工具的定义', () => {
      const definitions = registry.getToolDefinitions();
      expect(definitions).toHaveLength(2); // 只有启用的工具
      expect(definitions.every((def) => def.name && def.description)).toBe(
        true
      );
    });

    it('应该按类别过滤工具', () => {
      const systemTools = registry.getToolsByCategory('system');
      expect(systemTools).toHaveLength(1); // 只有启用的系统工具
      expect(systemTools[0].name).toBe('test_tool');

      const taskTools = registry.getToolsByCategory('task');
      expect(taskTools).toHaveLength(1);
      expect(taskTools[0].name).toBe('task_tool');
    });

    it('应该返回所有工具类别', () => {
      const categories = registry.getCategories();
      expect(categories).toEqual(['system', 'task']);
    });

    it('应该返回正确的统计信息', () => {
      const stats = registry.getStats();
      expect(stats).toEqual({
        total: 3,
        enabled: 2,
        disabled: 1,
        byCategory: {
          system: 2,
          task: 1,
        },
      });
    });

    it('应该正确处理禁用工具的查询', () => {
      expect(registry.hasTool('disabled_tool')).toBe(true);
      expect(registry.isToolEnabled('disabled_tool')).toBe(false);
      expect(registry.getToolHandler('disabled_tool')).toBeNull();
    });
  });

  describe('工具状态管理', () => {
    beforeEach(() => {
      registry.registerTool(mockRegistration);
    });

    it('应该能够启用工具', () => {
      registry.disableTool('test_tool');
      expect(registry.isToolEnabled('test_tool')).toBe(false);

      const result = registry.enableTool('test_tool');
      expect(result).toBe(true);
      expect(registry.isToolEnabled('test_tool')).toBe(true);
    });

    it('应该能够禁用工具', () => {
      expect(registry.isToolEnabled('test_tool')).toBe(true);

      const result = registry.disableTool('test_tool');
      expect(result).toBe(true);
      expect(registry.isToolEnabled('test_tool')).toBe(false);
    });

    it('应该处理不存在工具的状态操作', () => {
      expect(registry.enableTool('nonexistent')).toBe(false);
      expect(registry.disableTool('nonexistent')).toBe(false);
    });
  });

  describe('批量操作', () => {
    it('应该支持批量注册工具', () => {
      const registrations: ToolRegistration[] = [
        mockRegistration,
        {
          name: 'tool2',
          handler: mockHandler,
          category: 'task',
          description: 'Second tool',
          enabled: true,
        },
        {
          name: 'tool3',
          handler: mockHandler,
          category: 'project',
          description: 'Third tool',
          enabled: false,
        },
      ];

      registry.registerTools(registrations);

      expect(registry.getStats().total).toBe(3);
      expect(registry.hasTool('test_tool')).toBe(true);
      expect(registry.hasTool('tool2')).toBe(true);
      expect(registry.hasTool('tool3')).toBe(true);
    });

    it('应该处理批量注册中的错误', () => {
      const registrations: ToolRegistration[] = [
        mockRegistration,
        {
          name: '', // 无效名称
          handler: mockHandler,
          category: 'task',
          description: 'Invalid tool',
          enabled: true,
        },
        {
          name: 'valid_tool',
          handler: mockHandler,
          category: 'task',
          description: 'Valid tool',
          enabled: true,
        },
      ];

      // 不应该抛出异常，但应该记录错误
      registry.registerTools(registrations);

      // 有效工具应该被注册
      expect(registry.hasTool('test_tool')).toBe(true);
      expect(registry.hasTool('valid_tool')).toBe(true);
      // 无效工具不应该被注册
      expect(registry.hasTool('')).toBe(false);
    });

    it('应该能够清空所有工具', () => {
      registry.registerTool(mockRegistration);
      expect(registry.getStats().total).toBe(1);

      registry.clear();
      expect(registry.getStats().total).toBe(0);
      expect(registry.getCategories()).toHaveLength(0);
    });
  });

  describe('错误处理', () => {
    it('应该处理工具定义获取异常', () => {
      const faultyHandler = {
        ...mockHandler,
        getDefinition: vi.fn().mockImplementation(() => {
          throw new Error('Definition error');
        }),
      };

      // 注册有问题的工具应该抛出异常
      expect(() =>
        registry.registerTool({
          ...mockRegistration,
          handler: faultyHandler,
          name: 'faulty_tool',
        })
      ).toThrow(ValidationError);

      // 工具不应该被注册
      expect(registry.hasTool('faulty_tool')).toBe(false);
    });
  });
});
