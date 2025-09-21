/**
 * TaskManager 单元测试
 * 简化版本，专注于核心功能验证
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from './task-manager.js';
import fs from 'fs-extra';
import * as path from 'path';

// Mock fs-extra 模块
vi.mock('fs-extra');
const mockFs = vi.mocked(fs);

// Mock path 模块
vi.mock('path');
const mockPath = vi.mocked(path);

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockDocsPath: string;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDocsPath = '/tmp/test-wave';
    taskManager = new TaskManager(mockDocsPath);

    mockPath.join.mockImplementation((...paths) => paths.join('/'));

    // Mock fs-extra operations to avoid real file system access
    mockFs.ensureDir.mockResolvedValue();
    mockFs.writeFile.mockResolvedValue();
    (mockFs.readFile as any).mockResolvedValue('{}');
    (mockFs.pathExists as any).mockResolvedValue(false);
  });

  describe('构造函数', () => {
    it('应该正确初始化 TaskManager 实例', () => {
      expect(taskManager).toBeInstanceOf(TaskManager);
      expect(taskManager.getDocsPath()).toBe(mockDocsPath);
    });

    it('应该抛出错误当 docsPath 为空时', () => {
      expect(() => new TaskManager('')).toThrow('docsPath 不能为空');
    });
  });

  describe('initTask - 任务初始化', () => {
    const validTaskParams = {
      title: '实现用户认证系统',
      goal: '支持用户注册、登录和JWT鉴权功能，包含完整的安全验证',
      description: '实现完整的用户认证流程',
      knowledge_refs: ['auth-spec.md', 'security-guidelines.md'],
      overall_plan: ['设计数据库', '实现后端API', '编写测试'],
    };

    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('应该成功初始化新任务', async () => {
      const result = await taskManager.initTask(validTaskParams);

      expect(result.success).toBe(true);
      expect(result.task_id).toBeDefined();
      expect(result.slug).toBe('实现用户认证系统');
      expect(result.current_plan_id).toBeDefined();
      expect(result.plan_required).toBe(false);
      expect(result.plan_ids).toHaveLength(3);
    });

    it('应该验证必填参数', async () => {
      await expect(
        taskManager.initTask({
          title: '',
          goal: validTaskParams.goal,
        })
      ).rejects.toThrow('任务标题不能为空');

      await expect(
        taskManager.initTask({
          title: validTaskParams.title,
          goal: '',
        })
      ).rejects.toThrow('任务目标不能为空');
    });

    it('应该正确处理可选参数', async () => {
      const minimalParams = {
        title: '最小任务',
        goal: '完成基本功能，包含必要的验证和测试',
      };

      const result = await taskManager.initTask(minimalParams);

      expect(result.success).toBe(true);
      expect(result.plan_required).toBe(true);
      expect(result.plan_ids).toBeUndefined();
    });

    it('应该验证参数长度限制', async () => {
      await expect(
        taskManager.initTask({
          title: validTaskParams.title,
          goal: 'A'.repeat(2001), // 超过2000字符
        })
      ).rejects.toThrow('任务目标不能超过2000个字符');

      await expect(
        taskManager.initTask({
          title: 'A'.repeat(201), // 超过200字符
          goal: validTaskParams.goal,
        })
      ).rejects.toThrow('任务标题不能超过200个字符');
    });
  });

  describe('getCurrentTask - 获取当前任务', () => {
    it('应该返回 null 当没有当前任务时', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const task = await taskManager.getCurrentTask();
      expect(task).toBeNull();
    });

    it('应该处理损坏的JSON文件', async () => {
      (mockFs.pathExists as any).mockResolvedValue(true);
      (mockFs.readFile as any).mockResolvedValue('invalid json');

      await expect(taskManager.getCurrentTask()).rejects.toThrow(
        '任务数据格式错误'
      );
    });

    it('应该处理空文件', async () => {
      (mockFs.pathExists as any).mockResolvedValue(true);
      (mockFs.readFile as any).mockResolvedValue('');

      const task = await taskManager.getCurrentTask();
      expect(task).toBeNull();
    });
  });

  describe('参数验证', () => {
    it('应该验证知识引用格式', async () => {
      await expect(
        taskManager.initTask({
          title: '测试任务',
          goal: '测试目标，包含完整的功能验证',
          knowledge_refs: ['valid-ref', 123 as any], // 包含非字符串
        })
      ).rejects.toThrow('知识引用必须是字符串数组');
    });

    it('应该验证计划数量限制', async () => {
      const tooManyPlans = Array.from({ length: 21 }, (_, i) => `计划${i + 1}`);

      await expect(
        taskManager.initTask({
          title: '测试任务',
          goal: '测试目标，包含完整的功能验证',
          overall_plan: tooManyPlans,
        })
      ).rejects.toThrow('计划数量不能超过20个');
    });

    it('应该验证计划描述长度', async () => {
      await expect(
        taskManager.initTask({
          title: '测试任务',
          goal: '测试目标，包含完整的功能验证',
          overall_plan: ['A'.repeat(501)], // 超过500字符
        })
      ).rejects.toThrow('单个计划描述不能超过500个字符');
    });
  });

  describe('slug生成', () => {
    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('应该正确生成中文slug', async () => {
      const result = await taskManager.initTask({
        title: '实现用户认证系统',
        goal: '测试目标，包含完整的功能验证',
      });

      expect(result.slug).toBe('实现用户认证系统');
    });

    it('应该正确生成英文slug', async () => {
      const result = await taskManager.initTask({
        title: 'User Authentication System',
        goal: '测试目标，包含完整的功能验证',
      });

      expect(result.slug).toBe('user-authentication-system');
    });

    it('应该处理特殊字符', async () => {
      const result = await taskManager.initTask({
        title: '修复Bug #123',
        goal: '测试目标，包含完整的功能验证',
      });

      expect(result.slug).toBe('修复bug-123');
    });

    it('应该处理空格', async () => {
      const result = await taskManager.initTask({
        title: '  多余空格  ',
        goal: '测试目标，包含完整的功能验证',
      });

      expect(result.slug).toBe('多余空格');
    });
  });

  describe('错误处理', () => {
    it('应该处理文件系统错误', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(
        taskManager.initTask({
          title: '测试任务',
          goal: '测试目标，包含完整的功能验证',
        })
      ).rejects.toThrow('Permission denied');
    });

    it('应该处理系统时钟异常', async () => {
      // Mock Date 构造函数返回无效日期
      const originalDate = global.Date;
      global.Date = class extends Date {
        constructor() {
          super();
          return new originalDate('invalid date');
        }
      } as any;

      try {
        await expect(
          taskManager.initTask({
            title: '时钟测试',
            goal: '测试时钟异常处理，包含完整的功能验证',
          })
        ).rejects.toThrow(/系统时钟异常|Invalid time value/);
      } finally {
        global.Date = originalDate;
      }
    });
  });
});
