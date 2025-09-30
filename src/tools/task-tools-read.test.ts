/**
 * CurrentTaskReadTool 单元测试
 * 测试升级后的任务读取工具的各项功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CurrentTaskReadTool } from './task-tools.js';
import { TaskManager } from '../core/task-manager.js';
import { TaskStatus, EVRStatus, type CurrentTask } from '../types/index.js';

describe('CurrentTaskReadTool - 升级版本', () => {
  let taskManager: TaskManager;
  let readTool: CurrentTaskReadTool;
  let mockTask: CurrentTask;

  beforeEach(() => {
    // 创建模拟的 TaskManager
    taskManager = {
      getCurrentTask: vi.fn(),
      getCurrentTaskPanelPath: vi.fn(),
    } as any;

    readTool = new CurrentTaskReadTool(taskManager);

    // 创建模拟任务数据
    mockTask = {
      id: '01K6DM5Y3SC1GHYZJQKQMQR2ZH',
      title: '升级 MCP 工具接口 - 任务读取工具',
      slug: '升级-mcp-工具接口-任务读取工具',
      goal: '增强 current_task_read() 工具，支持 EVR 相关参数',
      requirements: ['需求1', '需求2'],
      issues: [],
      plans: [
        {
          id: 'plan-1',
          text: '调研当前实现情况',
          status: TaskStatus.Completed,
          steps: [],
          hints: [],
          contextTags: [],
          evrBindings: ['evr-001'],
          createdAt: '2025-09-30T15:00:00.000Z',
          completedAt: '2025-09-30T15:30:00.000Z',
        },
        {
          id: 'plan-2',
          text: '实现 EVR 相关参数支持',
          status: TaskStatus.InProgress,
          steps: [],
          hints: [],
          contextTags: [],
          evrBindings: ['evr-002'],
          createdAt: '2025-09-30T15:30:00.000Z',
          completedAt: null,
        },
      ],
      currentPlanId: 'plan-2',
      expectedResults: [
        {
          id: 'evr-001',
          title: '基础功能验证',
          verify: '调用 current_task_read 工具',
          expect: '返回完整的任务状态',
          status: EVRStatus.Pass,
          class: 'runtime',
          lastRun: '2025-09-30T15:30:00.000Z',
          notes: '验证通过',
          proof: 'test-result.json',
          referencedBy: ['plan-1'],
          runs: [
            {
              at: '2025-09-30T15:30:00.000Z',
              by: 'ai',
              status: EVRStatus.Pass,
              notes: '验证通过',
              proof: 'test-result.json',
            },
          ],
        },
        {
          id: 'evr-002',
          title: 'EVR 参数支持验证',
          verify: '调用带 EVR 参数的 current_task_read',
          expect: '返回 EVR 摘要和详情',
          status: EVRStatus.Unknown,
          class: 'runtime',
          lastRun: null,
          notes: null,
          proof: null,
          referencedBy: ['plan-2'],
          runs: [],
        },
      ],
      hints: ['提示1', '提示2'],
      contextTags: [],
      status: 'active',
      createdAt: '2025-09-30T15:00:00.000Z',
      updatedAt: '2025-09-30T15:35:00.000Z',
      projectId: '01K5XNPG6BCJ71GMD9816XCPSF',
      mdVersion: 'v1.0.0',
      sectionFingerprints: {
        title: 'hash1',
        requirements: 'hash2',
        issues: 'hash3',
        hints: 'hash4',
        plans: { 'plan-1': 'hash5', 'plan-2': 'hash6' },
        evrs: { 'evr-001': 'hash7', 'evr-002': 'hash8' },
        logs: 'hash9',
      },
      logs: [
        {
          id: 'log-1',
          timestamp: '2025-09-30T15:00:00.000Z',
          level: 'INFO',
          category: 'TASK',
          action: 'CREATE',
          message: '任务已创建',
          aiNotes: null,
        },
        {
          id: 'log-2',
          timestamp: '2025-09-30T15:30:00.000Z',
          level: 'INFO',
          category: 'TEST',
          action: 'HANDLE',
          message: 'EVR 验证通过',
          aiNotes: 'evr-001 验证成功',
        },
        {
          id: 'log-3',
          timestamp: '2025-09-30T15:35:00.000Z',
          level: 'ERROR',
          category: 'EXCEPTION',
          action: 'HANDLE',
          message: '发生异常',
          aiNotes: '测试异常',
        },
      ],
    };
  });

  describe('基础功能测试', () => {
    it('应该成功读取任务状态', async () => {
      // Given: 存在活跃任务
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(mockTask);

      // When: 调用 current_task_read
      const result = await readTool.handle({});

      // Then: 返回成功响应
      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.task).toBeDefined();
      expect(response.task.id).toBe(mockTask.id);
      expect(response.task.title).toBe(mockTask.title);
    });

    it('应该在没有活跃任务时返回错误', async () => {
      // Given: 没有活跃任务
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(null);

      // When: 调用 current_task_read
      const result = await readTool.handle({});

      // Then: 返回错误响应
      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.type).toBe('NOT_FOUND');
    });
  });

  describe('EVR 相关功能测试', () => {
    beforeEach(() => {
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(mockTask);
    });

    it('应该返回 EVR 就绪性信息', async () => {
      // When: 调用 current_task_read 包含 EVR 信息
      const result = await readTool.handle({
        evr: { include: true },
      });

      // Then: 返回 EVR 相关信息
      const response = JSON.parse(result.content[0].text);

      expect(response.evr_ready).toBe(false); // 因为 evr-002 状态为 unknown
      expect(response.evr_summary).toBeDefined();
      expect(response.evr_summary.total).toBe(2);
      expect(response.evr_summary.passed).toContain('evr-001');
      expect(response.evr_summary.unknown).toContain('evr-002');
      expect(response.evr_details).toHaveLength(2);
    });

    it('应该支持 require_skip_reason 参数', async () => {
      // Given: 添加一个 skip 状态的 EVR 但没有理由
      const taskWithSkipEVR = {
        ...mockTask,
        expectedResults: [
          ...mockTask.expectedResults,
          {
            id: 'evr-003',
            title: 'Skip EVR 测试',
            verify: '测试 skip 状态',
            expect: '应该被跳过',
            status: EVRStatus.Skip,
            class: 'runtime',
            lastRun: '2025-09-30T15:40:00.000Z',
            notes: '', // 空的理由
            proof: null,
            referencedBy: ['plan-2'],
            runs: [],
          },
        ],
      };
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(taskWithSkipEVR);

      // When: 调用 current_task_read 要求 skip 必须有理由
      const result = await readTool.handle({
        evr: {
          include: true,
          require_skip_reason: true,
        },
      });

      // Then: EVR 不就绪，因为 skip 没有理由
      const response = JSON.parse(result.content[0].text);

      expect(response.evr_ready).toBe(false);
      expect(response.evr_summary.skipped).toContain('evr-003');
    });

    it('应该在不包含 EVR 时提供基本就绪状态', async () => {
      // When: 调用 current_task_read 不包含 EVR 详情
      const result = await readTool.handle({
        evr: { include: false },
      });

      // Then: 仍然返回基本的 EVR 就绪状态
      const response = JSON.parse(result.content[0].text);

      expect(response.evr_ready).toBe(false);
      expect(response.evr_summary).toBeDefined();
      expect(response.evr_details).toHaveLength(0);
    });
  });

  describe('面板同步检测测试', () => {
    beforeEach(() => {
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(mockTask);
    });

    it('应该在没有面板文件时不返回 panel_pending', async () => {
      // Given: 没有面板文件
      vi.mocked(taskManager.getCurrentTaskPanelPath).mockReturnValue(null);

      // When: 调用 current_task_read
      const result = await readTool.handle({});

      // Then: panel_pending 为 false，不返回 sync_preview
      const response = JSON.parse(result.content[0].text);

      expect(response.panel_pending).toBe(false);
      expect(response.sync_preview).toBeUndefined();
    });

    it('应该在面板同步检测失败时不影响主流程', async () => {
      // Given: 面板路径检测抛出异常
      vi.mocked(taskManager.getCurrentTaskPanelPath).mockImplementation(() => {
        throw new Error('文件系统错误');
      });

      // When: 调用 current_task_read
      const result = await readTool.handle({});

      // Then: 仍然返回成功响应，panel_pending 为 false
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.panel_pending).toBe(false);
    });
  });

  describe('日志高亮功能测试', () => {
    beforeEach(() => {
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(mockTask);
    });

    it('应该返回高亮日志和全量计数', async () => {
      // When: 调用 current_task_read
      const result = await readTool.handle({});

      // Then: 返回日志高亮和计数
      const response = JSON.parse(result.content[0].text);

      expect(response.logs_highlights).toBeDefined();
      expect(response.logs_full_count).toBe(3);
      expect(response.logs_highlights.length).toBeGreaterThan(0);
    });

    it('应该按优先级排序高亮日志', async () => {
      // When: 调用 current_task_read
      const result = await readTool.handle({});

      // Then: 高亮日志按优先级排序（EXCEPTION > TEST > TASK）
      const response = JSON.parse(result.content[0].text);
      const highlights = response.logs_highlights;

      expect(highlights[0].category).toBe('EXCEPTION'); // 最高优先级
      expect(highlights[1].category).toBe('TEST');
      expect(highlights[2].category).toBe('TASK');
    });

    it('应该限制高亮日志数量', async () => {
      // Given: 创建大量日志的任务
      const taskWithManyLogs = {
        ...mockTask,
        logs: Array.from({ length: 50 }, (_, i) => ({
          id: `log-${i}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          level: 'INFO',
          category: 'TASK',
          action: 'UPDATE',
          message: `日志 ${i}`,
          aiNotes: null,
        })),
      };
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(taskWithManyLogs);

      // When: 调用 current_task_read
      const result = await readTool.handle({});

      // Then: 高亮日志数量不超过限制
      const response = JSON.parse(result.content[0].text);

      expect(response.logs_highlights.length).toBeLessThanOrEqual(20);
      expect(response.logs_full_count).toBe(50);
    });
  });

  describe('缓存和版本信息测试', () => {
    beforeEach(() => {
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(mockTask);
    });

    it('应该返回 md_version 用于缓存', async () => {
      // When: 调用 current_task_read
      const result = await readTool.handle({});

      // Then: 返回 md_version
      const response = JSON.parse(result.content[0].text);

      expect(response.md_version).toBeDefined();
      expect(typeof response.md_version).toBe('string');
      expect(response.md_version.length).toBeGreaterThan(0);
    });

    it('应该为不同的任务状态生成不同的 md_version', async () => {
      // Given: 第一次调用
      const result1 = await readTool.handle({});
      const response1 = JSON.parse(result1.content[0].text);
      const version1 = response1.md_version;

      // Given: 创建一个完全不同的任务
      const differentTask = {
        id: 'DIFFERENT_TASK_ID',
        title: '完全不同的任务',
        slug: '完全不同的任务',
        goal: '不同的目标',
        requirements: ['不同需求'],
        issues: [],
        plans: [
          {
            id: 'plan-different',
            text: '不同的计划',
            status: TaskStatus.ToDo,
            steps: [],
            hints: [],
            contextTags: [],
            evrBindings: [],
            createdAt: '2025-09-30T16:00:00.000Z',
            completedAt: null,
          },
        ],
        currentPlanId: 'plan-different',
        expectedResults: [],
        hints: [],
        contextTags: [],
        status: 'active',
        createdAt: '2025-09-30T16:00:00.000Z',
        updatedAt: '2025-09-30T16:00:00.000Z',
        projectId: 'DIFFERENT_PROJECT',
        mdVersion: 'v2.0.0',
        sectionFingerprints: {
          title: 'different-hash',
          requirements: 'different-hash',
          issues: 'different-hash',
          hints: 'different-hash',
          plans: { 'plan-different': 'different-hash' },
          evrs: {},
          logs: 'different-hash',
        },
        logs: [],
      };
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(differentTask);

      // When: 第二次调用
      const result2 = await readTool.handle({});
      const response2 = JSON.parse(result2.content[0].text);
      const version2 = response2.md_version;

      // Then: 版本号应该不同
      expect(version1).not.toBe(version2);
    });
  });

  describe('参数验证测试', () => {
    beforeEach(() => {
      vi.mocked(taskManager.getCurrentTask).mockResolvedValue(mockTask);
    });

    it('应该接受有效的参数', async () => {
      // When: 使用有效参数调用
      const result = await readTool.handle({
        evr: {
          include: true,
          require_skip_reason: false,
        },
        include_history_refs: true,
        include_logs: true,
        logs_limit: 10,
        project_id: '01K5XNPG6BCJ71GMD9816XCPSF',
      });

      // Then: 成功处理
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it('应该使用默认参数值', async () => {
      // When: 不提供参数调用
      const result = await readTool.handle({});

      // Then: 使用默认值成功处理
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.evr_ready).toBeDefined(); // 默认包含 EVR
    });
  });

  describe('错误处理测试', () => {
    it('应该处理 TaskManager 异常', async () => {
      // Given: TaskManager 抛出异常
      vi.mocked(taskManager.getCurrentTask).mockRejectedValue(
        new Error('数据库连接失败')
      );

      // When: 调用 current_task_read
      const result = await readTool.handle({});

      // Then: 返回错误响应
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.type).toBeDefined();
      expect(response.error).toContain('数据库连接失败');
    });

    it('应该处理无效参数', async () => {
      // When: 使用无效参数调用
      const result = await readTool.handle({
        logs_limit: -1, // 无效值
      });

      // Then: 返回参数验证错误
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.type).toBe('VALIDATION_ERROR');
    });
  });
});
