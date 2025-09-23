/**
 * 提示功能综合测试
 * 测试任务级、计划级、步骤级提示的管理和上下文传递
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from './task-manager.js';
import { TaskStatus } from '../types/index.js';
import fs from 'fs-extra';
import * as path from 'path';

// Mock fs-extra 模块
vi.mock('fs-extra');
const mockFs = vi.mocked(fs);

// Mock path 模块
vi.mock('path');
const mockPath = vi.mocked(path);

describe('提示功能综合测试', () => {
  let taskManager: TaskManager;
  let mockDocsPath: string;
  let testTask: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDocsPath = '/tmp/test-wave';
    taskManager = new TaskManager(mockDocsPath);

    mockPath.join.mockImplementation((...paths) => paths.join('/'));

    // Mock fs-extra operations
    mockFs.ensureDir.mockResolvedValue();
    mockFs.writeFile.mockResolvedValue();
    (mockFs.pathExists as any).mockResolvedValue(true);

    // 初始化测试任务
    const initResult = await taskManager.initTask({
      title: '测试提示功能',
      goal: '验证三层级提示系统的完整功能',
      overall_plan: ['设计阶段', '开发阶段', '测试阶段'],
    });

    // Mock 读取任务数据
    testTask = {
      id: initResult.task_id,
      title: '测试提示功能',
      slug: '测试提示功能',
      goal: '验证三层级提示系统的完整功能',
      task_hints: [],
      overall_plan: [
        {
          id: 'plan-001',
          description: '设计阶段',
          status: TaskStatus.ToDo,
          hints: [],
          steps: [
            {
              id: 'step-001',
              description: '需求分析',
              status: TaskStatus.ToDo,
              hints: [],
              created_at: new Date().toISOString(),
            },
            {
              id: 'step-002',
              description: '架构设计',
              status: TaskStatus.ToDo,
              hints: [],
              created_at: new Date().toISOString(),
            },
          ],
          created_at: new Date().toISOString(),
        },
        {
          id: 'plan-002',
          description: '开发阶段',
          status: TaskStatus.ToDo,
          hints: [],
          steps: [],
          created_at: new Date().toISOString(),
        },
      ],
      current_plan_id: 'plan-001',
      knowledge_refs: [],
      logs: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Mock 动态返回更新后的任务数据
    (mockFs.readFile as any).mockImplementation(() => {
      return Promise.resolve(JSON.stringify(testTask));
    });
  });

  describe('任务级提示管理', () => {
    it('应该能够添加任务级提示', async () => {
      const hints = ['注意代码质量', '遵循安全规范', '及时更新文档'];

      const result = await taskManager.modifyTask({
        field: 'hints',
        content: hints,
        reason: '添加任务级开发指导',
        change_type: 'user_request',
      });

      expect(result.success).toBe(true);
      expect(result.field).toBe('hints');
      expect(result.hint_level).toBe('task');
      expect(result.hints_added).toBe(3);
    });

    it('应该能够更新任务级提示', async () => {
      // 先添加提示
      await taskManager.modifyTask({
        field: 'hints',
        content: ['初始提示'],
        reason: '添加初始提示',
        change_type: 'user_request',
      });

      // 更新提示
      const newHints = ['更新后的提示1', '更新后的提示2'];
      const result = await taskManager.modifyTask({
        field: 'hints',
        content: newHints,
        reason: '更新任务提示',
        change_type: 'user_request',
      });

      expect(result.success).toBe(true);
      expect(result.hints_added).toBe(2);
    });

    it('应该能够清空任务级提示', async () => {
      // 先添加提示
      await taskManager.modifyTask({
        field: 'hints',
        content: ['待清空的提示'],
        reason: '添加测试提示',
        change_type: 'user_request',
      });

      // 清空提示
      const result = await taskManager.modifyTask({
        field: 'hints',
        content: [],
        reason: '清空任务提示',
        change_type: 'user_request',
      });

      expect(result.success).toBe(true);
      expect(result.hints_added).toBe(0);
    });
  });

  describe('计划级提示管理', () => {
    it('应该能够添加计划级提示', async () => {
      const planId = testTask.overall_plan[0].id;
      const hints = ['注意设计模式', '考虑扩展性'];

      const result = await taskManager.modifyTask({
        field: 'hints',
        content: hints,
        reason: '添加设计阶段提示',
        change_type: 'user_request',
        plan_id: planId,
      });

      expect(result.success).toBe(true);
      expect(result.field).toBe('hints');
      expect(result.hint_level).toBe('plan');
      expect(result.hints_added).toBe(2);
      expect(result.affected_ids).toContain(planId);
    });

    it('应该验证计划ID的有效性', async () => {
      const invalidPlanId = 'invalid-plan-id';

      await expect(
        taskManager.modifyTask({
          field: 'hints',
          content: ['测试提示'],
          reason: '测试无效计划ID',
          change_type: 'user_request',
          plan_id: invalidPlanId,
        })
      ).rejects.toThrow('指定的计划不存在');
    });

    it('应该能够为不同计划添加不同提示', async () => {
      const plan1Id = testTask.overall_plan[0].id;
      const plan2Id = testTask.overall_plan[1].id;

      // 为第一个计划添加提示
      const result1 = await taskManager.modifyTask({
        field: 'hints',
        content: ['设计阶段提示'],
        reason: '添加设计提示',
        change_type: 'user_request',
        plan_id: plan1Id,
      });

      // 为第二个计划添加提示
      const result2 = await taskManager.modifyTask({
        field: 'hints',
        content: ['开发阶段提示'],
        reason: '添加开发提示',
        change_type: 'user_request',
        plan_id: plan2Id,
      });

      expect(result1.success).toBe(true);
      expect(result1.affected_ids).toContain(plan1Id);
      expect(result2.success).toBe(true);
      expect(result2.affected_ids).toContain(plan2Id);
    });
  });

  describe('步骤级提示管理', () => {
    it('应该能够添加步骤级提示', async () => {
      const planId = testTask.overall_plan[0].id;
      const stepId = testTask.overall_plan[0].steps[0].id;
      const hints = ['仔细分析需求', '与用户确认细节'];

      const result = await taskManager.modifyTask({
        field: 'hints',
        content: hints,
        reason: '添加需求分析提示',
        change_type: 'user_request',
        plan_id: planId,
        step_id: stepId,
      });

      expect(result.success).toBe(true);
      expect(result.field).toBe('hints');
      expect(result.hint_level).toBe('step');
      expect(result.hints_added).toBe(2);
      expect(result.affected_ids).toContain(stepId);
    });

    it('应该验证步骤ID的有效性', async () => {
      const planId = testTask.overall_plan[0].id;
      const invalidStepId = 'invalid-step-id';

      await expect(
        taskManager.modifyTask({
          field: 'hints',
          content: ['测试提示'],
          reason: '测试无效步骤ID',
          change_type: 'user_request',
          plan_id: planId,
          step_id: invalidStepId,
        })
      ).rejects.toThrow('指定的步骤不存在');
    });

    it('应该要求同时提供计划ID和步骤ID', async () => {
      const stepId = testTask.overall_plan[0].steps[0].id;

      await expect(
        taskManager.modifyTask({
          field: 'hints',
          content: ['测试提示'],
          reason: '测试缺少计划ID',
          change_type: 'user_request',
          step_id: stepId,
        })
      ).rejects.toThrow('修改步骤级提示时必须同时提供plan_id和step_id');
    });

    it('应该能够为不同步骤添加不同提示', async () => {
      const planId = testTask.overall_plan[0].id;
      const step1Id = testTask.overall_plan[0].steps[0].id;
      const step2Id = testTask.overall_plan[0].steps[1].id;

      // 为第一个步骤添加提示
      const result1 = await taskManager.modifyTask({
        field: 'hints',
        content: ['需求分析提示'],
        reason: '添加需求分析提示',
        change_type: 'user_request',
        plan_id: planId,
        step_id: step1Id,
      });

      // 为第二个步骤添加提示
      const result2 = await taskManager.modifyTask({
        field: 'hints',
        content: ['架构设计提示'],
        reason: '添加架构设计提示',
        change_type: 'user_request',
        plan_id: planId,
        step_id: step2Id,
      });

      expect(result1.success).toBe(true);
      expect(result1.affected_ids).toContain(step1Id);
      expect(result2.success).toBe(true);
      expect(result2.affected_ids).toContain(step2Id);
    });
  });

  // 辅助函数：更新测试任务数据
  const _updateTestTaskData = (updates: any) => {
    Object.assign(testTask, updates);
    if (updates.task_hints) {
      testTask.task_hints = updates.task_hints;
    }
    if (updates.overall_plan) {
      testTask.overall_plan = updates.overall_plan;
    }
  };

  describe('提示上下文传递', () => {
    beforeEach(async () => {
      // 设置多层级提示
      testTask.task_hints = ['任务级提示1', '任务级提示2'];
      testTask.overall_plan[0].hints = ['计划级提示1', '计划级提示2'];
      testTask.overall_plan[0].steps[0].hints = ['步骤级提示1', '步骤级提示2'];
    });

    it('应该在计划级更新时返回任务级和计划级提示', async () => {
      const planId = testTask.overall_plan[0].id;

      const result = await taskManager.updateTaskStatus({
        update_type: 'plan',
        plan_id: planId,
        status: TaskStatus.InProgress,
        notes: '开始执行计划',
      });

      expect(result.success).toBe(true);
      expect(result.hints).toBeDefined();
      expect(result.hints!.task).toContain('任务级提示1');
      expect(result.hints!.task).toContain('任务级提示2');
      expect(result.hints!.plan).toContain('计划级提示1');
      expect(result.hints!.plan).toContain('计划级提示2');
      expect(result.hints!.step).toHaveLength(0);
    });

    it('应该在步骤级更新时返回所有层级的提示', async () => {
      const stepId = testTask.overall_plan[0].steps[0].id;

      const result = await taskManager.updateTaskStatus({
        update_type: 'step',
        step_id: stepId,
        status: TaskStatus.InProgress,
        notes: '开始执行步骤',
      });

      expect(result.success).toBe(true);
      expect(result.hints).toBeDefined();
      expect(result.hints!.task).toContain('任务级提示1');
      expect(result.hints!.task).toContain('任务级提示2');
      expect(result.hints!.plan).toContain('计划级提示1');
      expect(result.hints!.plan).toContain('计划级提示2');
      expect(result.hints!.step).toContain('步骤级提示1');
      expect(result.hints!.step).toContain('步骤级提示2');
    });

    it('应该在没有相关提示时返回空数组', async () => {
      // 使用没有提示的计划
      const planId = testTask.overall_plan[1].id;

      const result = await taskManager.updateTaskStatus({
        update_type: 'plan',
        plan_id: planId,
        status: TaskStatus.InProgress,
        notes: '开始执行无提示计划',
      });

      expect(result.success).toBe(true);
      expect(result.hints).toBeDefined();
      expect(result.hints!.task).toContain('任务级提示1');
      expect(result.hints!.task).toContain('任务级提示2');
      expect(result.hints!.plan).toHaveLength(0);
      expect(result.hints!.step).toHaveLength(0);
    });
  });

  describe('提示持久化和读取', () => {
    it('应该正确保存和读取任务级提示', async () => {
      const hints = ['持久化测试提示1', '持久化测试提示2'];

      // 模拟保存操作会更新测试数据
      (mockFs.writeFile as any).mockImplementation(
        (filePath: string, data: string) => {
          if (filePath.includes('current-task.json')) {
            const parsedData = JSON.parse(data);
            // 直接替换整个 testTask 对象
            Object.keys(testTask).forEach((key) => delete testTask[key]);
            Object.assign(testTask, parsedData);
          }
          return Promise.resolve();
        }
      );

      await taskManager.modifyTask({
        field: 'hints',
        content: hints,
        reason: '测试持久化',
        change_type: 'user_request',
      });

      // 验证保存调用
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(testTask.task_hints).toEqual(hints);
    });

    it('应该正确保存和读取计划级提示', async () => {
      const planId = testTask.overall_plan[0].id;
      const hints = ['计划持久化提示1', '计划持久化提示2'];

      const result = await taskManager.modifyTask({
        field: 'hints',
        content: hints,
        reason: '测试计划级持久化',
        change_type: 'user_request',
        plan_id: planId,
      });

      // 验证修改结果
      expect(result.success).toBe(true);
      expect(result.hint_level).toBe('plan');
      expect(result.hints_added).toBe(2);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('应该正确保存和读取步骤级提示', async () => {
      const planId = testTask.overall_plan[0].id;
      const stepId = testTask.overall_plan[0].steps[0].id;
      const hints = ['步骤持久化提示1', '步骤持久化提示2'];

      const result = await taskManager.modifyTask({
        field: 'hints',
        content: hints,
        reason: '测试步骤级持久化',
        change_type: 'user_request',
        plan_id: planId,
        step_id: stepId,
      });

      // 验证修改结果
      expect(result.success).toBe(true);
      expect(result.hint_level).toBe('step');
      expect(result.hints_added).toBe(2);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该验证提示内容为字符串数组', async () => {
      await expect(
        taskManager.modifyTask({
          field: 'hints',
          content: 'invalid string content' as any,
          reason: '测试错误处理',
          change_type: 'user_request',
        })
      ).rejects.toThrow('hints字段的内容必须是字符串数组');
    });

    it('应该验证提示数组中的元素为字符串', async () => {
      await expect(
        taskManager.modifyTask({
          field: 'hints',
          content: ['valid hint', 123, 'another valid hint'] as any,
          reason: '测试错误处理',
          change_type: 'user_request',
        })
      ).rejects.toThrow('hints字段的内容必须是字符串数组');
    });

    it('应该要求提供修改原因', async () => {
      await expect(
        taskManager.modifyTask({
          field: 'hints',
          content: ['test hint'],
          reason: '',
          change_type: 'user_request',
        })
      ).rejects.toThrow('修改原因不能为空');
    });

    it('应该要求提供有效的变更类型', async () => {
      await expect(
        taskManager.modifyTask({
          field: 'hints',
          content: ['test hint'],
          reason: '测试',
          change_type: 'invalid_type' as any,
        })
      ).rejects.toThrow('无效的变更类型');
    });
  });

  describe('多Agent协同场景', () => {
    it('应该支持多个Agent同时添加不同层级的提示', async () => {
      const planId = testTask.overall_plan[0].id;
      const stepId = testTask.overall_plan[0].steps[0].id;

      // 模拟Agent1添加任务级提示
      const result1 = await taskManager.modifyTask({
        field: 'hints',
        content: ['Agent1的任务提示'],
        reason: 'Agent1添加指导',
        change_type: 'user_request',
      });

      // 模拟Agent2添加计划级提示
      const result2 = await taskManager.modifyTask({
        field: 'hints',
        content: ['Agent2的计划提示'],
        reason: 'Agent2添加指导',
        change_type: 'user_request',
        plan_id: planId,
      });

      // 模拟Agent3添加步骤级提示
      const result3 = await taskManager.modifyTask({
        field: 'hints',
        content: ['Agent3的步骤提示'],
        reason: 'Agent3添加指导',
        change_type: 'user_request',
        plan_id: planId,
        step_id: stepId,
      });

      expect(result1.success).toBe(true);
      expect(result1.hint_level).toBe('task');
      expect(result2.success).toBe(true);
      expect(result2.hint_level).toBe('plan');
      expect(result3.success).toBe(true);
      expect(result3.hint_level).toBe('step');
    });

    it('应该在任务更新时返回所有相关提示给执行Agent', async () => {
      // 设置多层级提示（模拟不同Agent添加）
      const stepId = testTask.overall_plan[0].steps[0].id;

      // 直接设置测试数据
      testTask.task_hints = ['项目经理提示：注意进度'];
      testTask.overall_plan[0].hints = ['架构师提示：考虑性能'];
      testTask.overall_plan[0].steps[0].hints = ['开发者提示：注意边界条件'];

      // 执行Agent更新步骤状态
      const result = await taskManager.updateTaskStatus({
        update_type: 'step',
        step_id: stepId,
        status: TaskStatus.InProgress,
        notes: '开始执行',
      });

      expect(result.hints!.task).toContain('项目经理提示：注意进度');
      expect(result.hints!.plan).toContain('架构师提示：考虑性能');
      expect(result.hints!.step).toContain('开发者提示：注意边界条件');
    });
  });
});
