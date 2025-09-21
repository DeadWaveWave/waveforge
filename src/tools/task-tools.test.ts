/**
 * 任务管理 MCP 工具集成测试
 * 采用 TDD 方式，先写测试再写实现
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CurrentTaskInitTool,
  CurrentTaskUpdateTool,
  CurrentTaskReadTool,
} from './task-tools.js';
import { TaskManager } from '../core/task-manager.js';
import { TaskStatus, LogCategory, LogAction } from '../types/index.js';
import {
  createTestEnvironment,
  TestEnvironmentManager,
} from '../test-utils/test-environment.js';

// 测试环境管理器
let testEnv: TestEnvironmentManager;

// 创建测试任务数据
function createMockTaskInitParams() {
  return {
    title: '实现用户认证系统',
    goal: '支持用户注册、登录、JWT鉴权和审计日志功能，确保安全性和可扩展性',
    story: 'https://github.com/project/issues/123',
    description: '为应用添加完整的用户认证和授权系统',
    knowledge_refs: ['JWT最佳实践', '密码安全指南'],
    overall_plan: [
      '数据库设计和用户模型',
      '认证API端点实现',
      '前端集成和用户界面',
      '安全测试和审计日志',
    ],
  };
}

describe('CurrentTaskInitTool', () => {
  let taskInitTool: CurrentTaskInitTool;
  let mockTaskManager: TaskManager;

  beforeEach(async () => {
    // 创建独立的测试环境
    testEnv = createTestEnvironment('task-init');
    await testEnv.setup();

    // 创建测试用的 TaskManager
    mockTaskManager = new TaskManager(testEnv.getTestDir());
    taskInitTool = new CurrentTaskInitTool(mockTaskManager);
  });

  afterEach(async () => {
    // 清理测试环境
    await testEnv.cleanup();
  });

  describe('参数验证', () => {
    it('应该验证必填参数 title 和 goal', async () => {
      const result = await taskInitTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('title');
      expect(response.type).toBe('VALIDATION_ERROR');
    });

    it('应该验证 title 长度限制', async () => {
      const longTitle = 'a'.repeat(201); // 超过200字符限制
      const result = await taskInitTool.handle({
        title: longTitle,
        goal: '测试目标',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('title');
      expect(response.error).toContain('200');
    });

    it('应该验证 goal 长度限制', async () => {
      const longGoal = 'a'.repeat(2001); // 超过2000字符限制
      const result = await taskInitTool.handle({
        title: '测试任务',
        goal: longGoal,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('goal');
      expect(response.error).toContain('2000');
    });

    it('应该验证 story URL 格式', async () => {
      const result = await taskInitTool.handle({
        title: '测试任务',
        goal: '这是一个测试目标，需要满足最小长度要求',
        story: 'invalid-url',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('story');
      expect(response.error).toContain('URL');
    });

    it('应该验证 knowledge_refs 数组长度限制', async () => {
      const tooManyRefs = Array(21).fill('ref'); // 超过20个限制
      const result = await taskInitTool.handle({
        title: '测试任务',
        goal: '测试目标',
        knowledge_refs: tooManyRefs,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('knowledge_refs');
      expect(response.error).toContain('20');
    });

    it('应该验证 overall_plan 数组长度限制', async () => {
      const tooManyPlans = Array(51).fill('plan'); // 超过50个限制
      const result = await taskInitTool.handle({
        title: '测试任务',
        goal: '测试目标',
        overall_plan: tooManyPlans,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('overall_plan');
      expect(response.error).toContain('50');
    });
  });

  describe('任务初始化功能', () => {
    it('应该成功创建带有完整参数的任务', async () => {
      const params = createMockTaskInitParams();
      const result = await taskInitTool.handle(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.task_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID 格式
      expect(response.slug).toBe('实现用户认证系统');
      expect(response.plan_required).toBe(false); // 因为提供了 overall_plan
      expect(response.plan_ids).toHaveLength(4);
      expect(response.current_plan_id).toBe(response.plan_ids[0]);
    });

    it('应该创建不带 overall_plan 的任务并返回 plan_required', async () => {
      const params = {
        title: '简单任务',
        goal: '完成基础功能开发，包含核心逻辑实现',
      };
      const result = await taskInitTool.handle(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.task_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(response.slug).toBe('简单任务');
      expect(response.plan_required).toBe(true);
      expect(response.plan_ids).toBeUndefined();
      expect(response.current_plan_id).toBeNull();
    });

    it('应该正确处理可选参数', async () => {
      const params = {
        title: '测试任务',
        goal: '这是一个测试目标，需要满足最小长度要求',
        description: '这是一个测试任务的描述',
        knowledge_refs: ['参考1', '参考2'],
      };
      const result = await taskInitTool.handle(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.task_id).toBeDefined();
      expect(response.slug).toBe('测试任务');
    });

    it('应该生成唯一的任务ID和slug', async () => {
      const params1 = { title: '任务1', goal: '这是第一个任务的目标描述' };
      const params2 = { title: '任务2', goal: '这是第二个任务的目标描述' };

      const result1 = await taskInitTool.handle(params1);
      const result2 = await taskInitTool.handle(params2);

      const response1 = JSON.parse(result1.content[0].text);
      const response2 = JSON.parse(result2.content[0].text);

      expect(response1.task_id).not.toBe(response2.task_id);
      expect(response1.slug).not.toBe(response2.slug);
    });

    it('应该创建初始化日志条目', async () => {
      const params = createMockTaskInitParams();
      const result = await taskInitTool.handle(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);

      // 验证任务已被创建并包含日志
      const task = await mockTaskManager.getCurrentTask();
      expect(task).toBeDefined();
      expect(task!.logs).toHaveLength(1);
      expect(task!.logs[0].category).toBe('TASK');
      expect(task!.logs[0].action).toBe('CREATE');
      expect(task!.logs[0].message).toContain('任务初始化');
    });
  });

  describe('计划管理', () => {
    it('应该为提供的 overall_plan 创建相应的 TaskPlan 对象', async () => {
      const params = createMockTaskInitParams();
      const result = await taskInitTool.handle(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);

      const task = await mockTaskManager.getCurrentTask();
      expect(task!.overall_plan).toHaveLength(4);

      task!.overall_plan.forEach((plan, index) => {
        expect(plan.id).toMatch(/^plan-[0-9A-HJKMNP-TV-Z]{26}$/); // ULID格式
        expect(plan.description).toBe(params.overall_plan![index]);
        expect(plan.status).toBe(TaskStatus.ToDo);
        expect(plan.steps).toHaveLength(0); // 初始时没有步骤
        expect(plan.hints).toHaveLength(0);
        expect(plan.created_at).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
      });
    });

    it('应该设置第一个计划为当前计划', async () => {
      const params = createMockTaskInitParams();
      const result = await taskInitTool.handle(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.current_plan_id).toBe(response.plan_ids[0]);

      const task = await mockTaskManager.getCurrentTask();
      expect(task!.current_plan_id).toBe(task!.overall_plan[0].id);
    });
  });

  describe('错误处理', () => {
    it('应该处理文件系统错误', async () => {
      // Mock 文件系统错误
      vi.spyOn(mockTaskManager, 'initTask').mockRejectedValue(
        new Error('磁盘空间不足')
      );

      const params = createMockTaskInitParams();
      const result = await taskInitTool.handle(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('磁盘空间不足');
      expect(response.type).toBe('SYSTEM_ERROR');
    });

    it('应该处理并发创建冲突', async () => {
      // 模拟并发创建同一任务的情况
      const params = createMockTaskInitParams();

      // 同时创建两个相同的任务
      const [result1, result2] = await Promise.all([
        taskInitTool.handle(params),
        taskInitTool.handle(params),
      ]);

      const response1 = JSON.parse(result1.content[0].text);
      const response2 = JSON.parse(result2.content[0].text);

      // 至少有一个应该成功
      const successCount = [response1, response2].filter(
        (r) => r.success
      ).length;
      expect(successCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('工具定义', () => {
    it('应该返回正确的工具定义', () => {
      const definition = CurrentTaskInitTool.getDefinition();

      expect(definition).toMatchObject({
        name: 'current_task_init',
        description:
          expect.stringContaining('初始化具有明确目标和计划的结构化任务'),
        inputSchema: {
          type: 'object',
          properties: {
            title: expect.objectContaining({
              type: 'string',
              minLength: 1,
              maxLength: 200,
            }),
            goal: expect.objectContaining({
              type: 'string',
              minLength: 1,
              maxLength: 2000,
            }),
          },
          required: ['title', 'goal'],
          additionalProperties: false,
        },
      });
    });
  });
});

describe('CurrentTaskUpdateTool', () => {
  let taskUpdateTool: CurrentTaskUpdateTool;
  let mockTaskManager: TaskManager;
  let testTask: any;

  beforeEach(async () => {
    // 创建独立的测试环境
    testEnv = createTestEnvironment('task-update');
    await testEnv.setup();

    // 创建测试用的 TaskManager 和工具
    mockTaskManager = new TaskManager(testEnv.getTestDir());
    taskUpdateTool = new CurrentTaskUpdateTool(mockTaskManager);

    // 创建测试任务
    const initParams = createMockTaskInitParams();
    try {
      await mockTaskManager.initTask(initParams);
      await testEnv.waitForStable(); // 等待文件系统稳定
      testTask = await mockTaskManager.getCurrentTask();

      // 确保任务被正确创建
      if (!testTask) {
        throw new Error('测试任务创建失败');
      }
    } catch (error) {
      console.error('测试任务初始化失败:', error);
      throw error;
    }
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('参数验证', () => {
    it('应该验证必填参数 update_type 和 status', async () => {
      const result = await taskUpdateTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('update_type');
      expect(response.type).toBe('VALIDATION_ERROR');
    });

    it('应该验证 update_type 枚举值', async () => {
      const result = await taskUpdateTool.handle({
        update_type: 'invalid_type',
        status: 'in_progress',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('update_type');
      expect(response.error).toContain('plan');
      expect(response.error).toContain('step');
    });

    it('应该验证 status 枚举值', async () => {
      const result = await taskUpdateTool.handle({
        update_type: 'plan',
        status: 'invalid_status',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('status');
      expect(response.error).toContain('to_do');
    });

    it('应该要求 plan_id 当 update_type 为 plan 时', async () => {
      const result = await taskUpdateTool.handle({
        update_type: 'plan',
        status: 'in_progress',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('plan_id');
    });

    it('应该要求 step_id 当 update_type 为 step 时', async () => {
      const result = await taskUpdateTool.handle({
        update_type: 'step',
        status: 'completed',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('step_id');
    });

    it('应该要求 notes 当状态为 completed 或 blocked 时', async () => {
      const result = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_id: testTask.overall_plan[0].id,
        status: 'completed',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('notes');
      expect(response.error).toContain('完成');
    });
  });

  describe('计划级别更新', () => {
    it('应该成功更新计划状态为进行中', async () => {
      const planId = testTask.overall_plan[0].id;
      const result = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'in_progress',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.current_plan_id).toBe(planId);
      expect(response.steps_required).toBe(true);

      const updatedTask = await mockTaskManager.getCurrentTask();
      const plan = updatedTask!.overall_plan.find((p) => p.id === planId);
      expect(plan!.status).toBe(TaskStatus.InProgress);
    });

    it('应该成功完成计划并自动推进到下一个计划', async () => {
      const firstPlanId = testTask.overall_plan[0].id;
      const secondPlanId = testTask.overall_plan[1].id;

      const result = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_id: firstPlanId,
        status: 'completed',
        notes: '第一个计划已完成',
        evidence: 'https://github.com/project/commit/abc123',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.auto_advanced).toBe(true);
      expect(response.current_plan_id).toBe(secondPlanId);
      expect(response.started_new_plan).toBe(true);

      const updatedTask = await mockTaskManager.getCurrentTask();
      const firstPlan = updatedTask!.overall_plan.find(
        (p) => p.id === firstPlanId
      );
      const secondPlan = updatedTask!.overall_plan.find(
        (p) => p.id === secondPlanId
      );

      expect(firstPlan!.status).toBe(TaskStatus.Completed);
      expect(firstPlan!.evidence).toBe(
        'https://github.com/project/commit/abc123'
      );
      expect(firstPlan!.completed_at).toBeDefined();
      expect(secondPlan!.status).toBe(TaskStatus.InProgress);
    });

    it('应该处理阻塞状态', async () => {
      const planId = testTask.overall_plan[0].id;
      const result = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'blocked',
        notes: '等待外部依赖完成',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.auto_advanced).toBe(false);

      const updatedTask = await mockTaskManager.getCurrentTask();
      const plan = updatedTask!.overall_plan.find((p) => p.id === planId);
      expect(plan!.status).toBe(TaskStatus.Blocked);
      expect(plan!.notes).toBe('等待外部依赖完成');
    });
  });

  describe('步骤级别更新', () => {
    beforeEach(async () => {
      // 为测试计划添加步骤
      const planId = testTask.overall_plan[0].id;
      await mockTaskManager.modifyTask({
        field: 'steps',
        plan_id: planId,
        content: ['创建用户表', '设计索引', '编写迁移脚本'],
        change_type: 'generate_steps',
        reason: '为测试添加步骤',
      });
      testTask = await mockTaskManager.getCurrentTask();
    });

    it('应该成功更新步骤状态', async () => {
      const stepId = testTask.overall_plan[0].steps[0].id;

      const result = await taskUpdateTool.handle({
        update_type: 'step',
        step_id: stepId,
        status: 'in_progress',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.next_step).toBeDefined();
      expect(response.next_step.id).toBe(stepId);

      const updatedTask = await mockTaskManager.getCurrentTask();
      const step = updatedTask!.overall_plan[0].steps.find(
        (s) => s.id === stepId
      );
      expect(step!.status).toBe(TaskStatus.InProgress);
    });

    it('应该完成步骤并自动推进到下一步', async () => {
      const stepId = testTask.overall_plan[0].steps[0].id;
      const nextStepId = testTask.overall_plan[0].steps[1].id;

      const result = await taskUpdateTool.handle({
        update_type: 'step',
        step_id: stepId,
        status: 'completed',
        notes: '用户表创建完成',
        evidence: 'src/migrations/001_create_users.sql',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.auto_advanced).toBe(true);
      expect(response.next_step.id).toBe(nextStepId);

      const updatedTask = await mockTaskManager.getCurrentTask();
      const completedStep = updatedTask!.overall_plan[0].steps.find(
        (s) => s.id === stepId
      );
      const nextStep = updatedTask!.overall_plan[0].steps.find(
        (s) => s.id === nextStepId
      );

      expect(completedStep!.status).toBe(TaskStatus.Completed);
      expect(completedStep!.evidence).toBe(
        'src/migrations/001_create_users.sql'
      );
      expect(nextStep!.status).toBe(TaskStatus.InProgress);
    });

    it('应该在完成最后一个步骤时自动完成计划', async () => {
      const planId = testTask.overall_plan[0].id;
      const steps = testTask.overall_plan[0].steps;

      // 完成前两个步骤
      for (let i = 0; i < steps.length - 1; i++) {
        await taskUpdateTool.handle({
          update_type: 'step',
          step_id: steps[i].id,
          status: 'completed',
          notes: `步骤 ${i + 1} 完成`,
        });
      }

      // 完成最后一个步骤
      const lastStepId = steps[steps.length - 1].id;
      const result = await taskUpdateTool.handle({
        update_type: 'step',
        step_id: lastStepId,
        status: 'completed',
        notes: '最后一个步骤完成',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.auto_advanced).toBe(true);
      expect(response.started_new_plan).toBe(true);

      const updatedTask = await mockTaskManager.getCurrentTask();
      const plan = updatedTask!.overall_plan.find((p) => p.id === planId);
      expect(plan!.status).toBe(TaskStatus.Completed);
    });
  });

  describe('提示系统', () => {
    it('应该返回相关的提示信息', async () => {
      // 添加任务级提示
      await mockTaskManager.modifyTask({
        field: 'hints',
        content: ['注意数据安全', '遵循编码规范'],
        change_type: 'user_request',
        reason: '添加开发提示',
      });

      const planId = testTask.overall_plan[0].id;
      const result = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'in_progress',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.hints).toBeDefined();
      expect(response.hints.task).toContain('注意数据安全');
      expect(response.hints.task).toContain('遵循编码规范');
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的计划ID', async () => {
      const result = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_id: 'invalid-plan-id',
        status: 'in_progress',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('计划');
      expect(response.error).toContain('不存在');
    });

    it('应该处理无效的步骤ID', async () => {
      const result = await taskUpdateTool.handle({
        update_type: 'step',
        step_id: 'invalid-step-id',
        status: 'completed',
        notes: '测试',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('步骤');
      expect(response.error).toContain('不存在');
    });

    it('应该处理状态转换冲突', async () => {
      const planId = testTask.overall_plan[0].id;

      // 先设置为阻塞状态
      await taskUpdateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'blocked',
        notes: '阻塞原因',
      });

      // 尝试直接设置为完成状态（应该失败）
      const result = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'completed',
        notes: '尝试完成',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('状态转换');
    });
  });

  describe('工具定义', () => {
    it('应该返回正确的工具定义', () => {
      const definition = CurrentTaskUpdateTool.getDefinition();

      expect(definition).toMatchObject({
        name: 'current_task_update',
        description:
          expect.stringContaining('在计划和步骤两个层级更新任务进度'),
        inputSchema: {
          type: 'object',
          properties: {
            update_type: expect.objectContaining({
              type: 'string',
              enum: ['plan', 'step'],
            }),
            status: expect.objectContaining({
              type: 'string',
              enum: ['to_do', 'in_progress', 'completed', 'blocked'],
            }),
          },
          required: ['update_type', 'status'],
          additionalProperties: false,
        },
      });
    });
  });
});

describe('CurrentTaskReadTool', () => {
  let taskReadTool: CurrentTaskReadTool;
  let mockTaskManager: TaskManager;
  let testTask: any;

  beforeEach(async () => {
    // 创建独立的测试环境
    testEnv = createTestEnvironment('task-read');
    await testEnv.setup();

    // 创建测试用的 TaskManager 和工具
    mockTaskManager = new TaskManager(testEnv.getTestDir());
    taskReadTool = new CurrentTaskReadTool(mockTaskManager);

    // 创建测试任务
    const initParams = createMockTaskInitParams();
    try {
      await mockTaskManager.initTask(initParams);
      await testEnv.waitForStable(); // 等待文件系统稳定
      testTask = await mockTaskManager.getCurrentTask();

      // 确保任务被正确创建
      if (!testTask) {
        throw new Error('测试任务创建失败');
      }

      // 添加一些日志和步骤
      await mockTaskManager.modifyTask({
        field: 'steps',
        plan_id: testTask.overall_plan[0].id,
        content: ['创建用户表', '设计索引'],
        change_type: 'generate_steps',
        reason: '添加测试步骤',
      });

      await testEnv.waitForStable(); // 等待修改操作稳定

      // 添加一些日志条目
      await mockTaskManager.logActivity({
        category: LogCategory.Discussion,
        action: LogAction.Create,
        message: '讨论数据库设计方案',
        ai_notes: '考虑了多种数据库设计方案',
      });

      await testEnv.waitForStable(); // 等待日志操作稳定
    } catch (error) {
      console.error('测试任务初始化失败:', error);
      throw error;
    }
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('基础读取功能', () => {
    it('应该返回完整的任务状态', async () => {
      const result = await taskReadTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.task).toBeDefined();
      expect(response.task.id).toBe(testTask.id);
      expect(response.task.title).toBe(testTask.title);
      expect(response.task.goal).toBe(testTask.goal);
      expect(response.task.overall_plan).toHaveLength(4);
      expect(response.task.logs).toBeDefined();
    });

    it('应该包含健康度信息', async () => {
      const result = await taskReadTool.handle({ include_health: true });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.health).toBeDefined();
      expect(response.health.status).toMatch(/^(healthy|warning|error)$/);
      expect(response.health.checks).toBeDefined();
      expect(response.health.checks.task_integrity).toBeDefined();
      expect(response.health.checks.file_system).toBeDefined();
      expect(response.health.checks.data_consistency).toBeDefined();
    });

    it('应该包含历史任务引用', async () => {
      // 创建另一个任务作为历史
      await mockTaskManager.completeTask('第一个任务完成');
      await mockTaskManager.initTask({
        title: '第二个任务',
        goal: '完成第二个功能的详细实现和测试',
      });

      const result = await taskReadTool.handle({ include_history_refs: true });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.history_refs).toBeDefined();
      expect(response.history_refs.recent_tasks).toBeDefined();
      expect(response.history_refs.total_count).toBeGreaterThan(0);
    });

    it('应该支持日志数量限制', async () => {
      // 添加更多日志
      for (let i = 0; i < 10; i++) {
        await mockTaskManager.logActivity({
          category: LogCategory.Test,
          action: LogAction.Create,
          message: `测试日志 ${i}`,
          ai_notes: `测试日志详情 ${i}`,
        });
      }

      const result = await taskReadTool.handle({
        include_logs: true,
        logs_limit: 5,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.task.logs).toHaveLength(5);
      expect(response.logs_truncated).toBe(true);
      expect(response.total_logs_count).toBeGreaterThan(5);
    });

    it('应该支持排除日志', async () => {
      const result = await taskReadTool.handle({ include_logs: false });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.task.logs).toHaveLength(0);
      expect(response.logs_excluded).toBe(true);
    });
  });

  describe('性能优化', () => {
    it('应该缓存读取结果以提高性能', async () => {
      // 第一次读取
      const result1 = await taskReadTool.handle({});
      const response1 = JSON.parse(result1.content[0].text);

      // 第二次读取
      const result2 = await taskReadTool.handle({});
      const response2 = JSON.parse(result2.content[0].text);

      // 两次读取应该返回相同的数据
      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      expect(response1.task.id).toBe(response2.task.id);
    });

    it('应该在任务更新后清除缓存', async () => {
      // 第一次读取建立缓存
      const result1 = await taskReadTool.handle({});
      const response1 = JSON.parse(result1.content[0].text);

      // 更新任务
      await mockTaskManager.modifyTask({
        field: 'goal',
        content: '更新后的目标',
        change_type: 'refine_goal',
        reason: '优化目标描述',
      });

      // 第二次读取应该返回更新后的数据
      const result2 = await taskReadTool.handle({});
      const response2 = JSON.parse(result2.content[0].text);

      expect(response1.task.goal).not.toBe(response2.task.goal);
      expect(response2.task.goal).toBe('更新后的目标');
    });

    it('应该支持增量读取大型任务', async () => {
      // 创建大型任务（大量计划和步骤）
      const largePlans = Array(20)
        .fill(0)
        .map((_, i) => `大型计划 ${i + 1}`);
      await mockTaskManager.modifyTask({
        field: 'plan',
        content: largePlans,
        change_type: 'plan_adjustment',
        reason: '创建大型任务测试',
      });

      const result = await taskReadTool.handle({
        include_logs: false, // 减少数据量
        logs_limit: 10,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.task.overall_plan).toHaveLength(20);
      expect(response.performance_info).toBeDefined();
      expect(response.performance_info.read_time_ms).toBeLessThan(1000);
    });
  });

  describe('数据完整性检查', () => {
    it('应该检测任务数据完整性问题', async () => {
      const result = await taskReadTool.handle({ include_health: true });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.health).toBeDefined();
      expect(response.health.status).toMatch(/^(healthy|warning|error)$/);
      expect(response.health.checks).toBeDefined();
    });

    it('应该检测文件系统问题', async () => {
      const result = await taskReadTool.handle({ include_health: true });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.health).toBeDefined();
      expect(response.health.checks.file_system).toBeDefined();
    });

    it('应该提供数据修复建议', async () => {
      const result = await taskReadTool.handle({ include_health: true });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.health).toBeDefined();
      expect(response.health.recommendations).toBeDefined();
      expect(Array.isArray(response.health.recommendations)).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该处理任务不存在的情况', async () => {
      vi.spyOn(mockTaskManager, 'getCurrentTask').mockResolvedValue(null);

      const result = await taskReadTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('当前没有活跃任务');
      expect(response.type).toBe('NOT_FOUND');
    });

    it('应该处理文件读取错误', async () => {
      vi.spyOn(mockTaskManager, 'getCurrentTask').mockRejectedValue(
        new Error('文件读取失败')
      );

      const result = await taskReadTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('文件读取失败');
      expect(response.type).toBe('SYSTEM_ERROR');
    });

    it('应该处理参数验证错误', async () => {
      const result = await taskReadTool.handle({ logs_limit: 0 });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('logs_limit');
      expect(response.error).toContain('1');
    });
  });

  describe('格式化输出', () => {
    it('应该返回格式化的 Markdown 文档', async () => {
      const result = await taskReadTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.formatted_document).toBeDefined();
      expect(response.formatted_document).toContain('# 实现用户认证系统');
      expect(response.formatted_document).toContain('## 验收标准');
      expect(response.formatted_document).toContain('## 整体计划');
      expect(response.formatted_document).toContain('## 执行日志');
    });

    it('应该包含当前状态摘要', async () => {
      const result = await taskReadTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.status_summary).toBeDefined();
      expect(response.status_summary.current_plan).toBeDefined();
      expect(response.status_summary.progress).toBeDefined();
      expect(response.status_summary.next_actions).toBeDefined();
    });
  });

  describe('工具定义', () => {
    it('应该返回正确的工具定义', () => {
      const definition = CurrentTaskReadTool.getDefinition();

      expect(definition).toMatchObject({
        name: 'current_task_read',
        description:
          expect.stringContaining('读取当前任务完整状态以恢复上下文'),
        inputSchema: {
          type: 'object',
          properties: {
            include_health: expect.objectContaining({
              type: 'boolean',
              default: true,
            }),
            logs_limit: expect.objectContaining({
              type: 'integer',
              minimum: 1,
              maximum: 1000,
              default: 50,
            }),
          },
          additionalProperties: false,
        },
      });
    });
  });
});
