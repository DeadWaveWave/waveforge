/**
 * 任务修改和完成工具集成测试
 * 继续 task-tools.test.ts 的测试内容
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CurrentTaskModifyTool,
  CurrentTaskCompleteTool,
  CurrentTaskLogTool,
} from './task-tools.js';
import { TaskManager } from '../core/task-manager.js';
import { TaskStatus } from '../types/index.js';
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

describe('CurrentTaskModifyTool', () => {
  let taskModifyTool: CurrentTaskModifyTool;
  let mockTaskManager: TaskManager;
  let testTask: any;

  beforeEach(async () => {
    // 创建独立的测试环境
    testEnv = createTestEnvironment('task-modify');
    await testEnv.setup();

    // 创建测试用的 TaskManager 和工具
    mockTaskManager = new TaskManager(testEnv.getTestDir());
    taskModifyTool = new CurrentTaskModifyTool(mockTaskManager);

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
    it('应该验证必填参数', async () => {
      const result = await taskModifyTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('field');
      expect(response.type).toBe('VALIDATION_ERROR');
    });

    it('应该验证 field 枚举值', async () => {
      const result = await taskModifyTool.handle({
        field: 'invalid_field',
        content: 'test',
        reason: 'test',
        change_type: 'user_request',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('field');
      expect(response.error).toContain('goal');
    });

    it('应该验证 change_type 枚举值', async () => {
      const result = await taskModifyTool.handle({
        field: 'goal',
        content: 'new goal',
        reason: 'test',
        change_type: 'invalid_type',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('change_type');
      expect(response.error).toContain('generate_steps');
    });

    it('应该要求 plan_id 当修改 steps 时', async () => {
      const result = await taskModifyTool.handle({
        field: 'steps',
        content: ['step1', 'step2'],
        reason: 'add steps',
        change_type: 'generate_steps',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('plan_id');
    });

    it('应该验证 content 类型匹配', async () => {
      const result = await taskModifyTool.handle({
        field: 'goal',
        content: ['array', 'not', 'string'], // goal 应该是字符串
        reason: 'test',
        change_type: 'refine_goal',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('goal字段的内容必须是字符串');
    });
  });

  describe('目标修改', () => {
    it('应该成功修改任务目标', async () => {
      const newGoal = '更新后的验收标准：支持OAuth2.0和多因子认证';
      const result = await taskModifyTool.handle({
        field: 'goal',
        content: newGoal,
        reason: '根据安全要求更新目标',
        change_type: 'refine_goal',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.modified_field).toBe('goal');
      expect(response.change_summary).toContain('goal已更新');

      const updatedTask = await mockTaskManager.getCurrentTask();
      expect(updatedTask!.goal).toBe(newGoal);

      // 验证日志记录
      const logs = updatedTask!.logs.filter(
        (log) => log.category === 'TASK' && log.action === 'MODIFY'
      );
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('目标修改');
    });

    it('应该验证目标长度限制', async () => {
      const longGoal = 'a'.repeat(2001);
      const result = await taskModifyTool.handle({
        field: 'goal',
        content: longGoal,
        reason: 'test',
        change_type: 'refine_goal',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('2000');
    });
  });

  describe('计划修改', () => {
    it('应该成功替换整体计划', async () => {
      const newPlans = ['需求分析和架构设计', '核心功能开发', '测试和部署'];
      const result = await taskModifyTool.handle({
        field: 'plan',
        content: newPlans,
        reason: '简化开发流程',
        change_type: 'plan_adjustment',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.modified_field).toBe('plan');
      expect(response.plan_reset).toBe(true);
      expect(response.new_current_plan_id).toBeDefined();

      const updatedTask = await mockTaskManager.getCurrentTask();
      expect(updatedTask!.overall_plan).toHaveLength(3);
      expect(updatedTask!.overall_plan[0].description).toBe(newPlans[0]);
      expect(updatedTask!.current_plan_id).toBe(
        updatedTask!.overall_plan[0].id
      );
    });

    it('应该重置到第一个计划', async () => {
      // 先推进到第二个计划
      await mockTaskManager.updateTaskStatus({
        update_type: 'plan',
        plan_id: testTask.overall_plan[0].id,
        status: TaskStatus.Completed,
        notes: '第一个计划完成',
      });

      // 修改计划
      const result = await taskModifyTool.handle({
        field: 'plan',
        content: ['新计划1', '新计划2'],
        reason: '重新规划',
        change_type: 'plan_adjustment',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.plan_reset).toBe(true);

      const updatedTask = await mockTaskManager.getCurrentTask();
      expect(updatedTask!.current_plan_id).toBe(
        updatedTask!.overall_plan[0].id
      );
    });
  });

  describe('步骤修改', () => {
    it('应该成功为计划添加步骤', async () => {
      const planId = testTask.overall_plan[0].id;
      const steps = [
        '设计用户表结构',
        '创建数据库迁移',
        '编写用户模型',
        '添加索引和约束',
      ];

      const result = await taskModifyTool.handle({
        field: 'steps',
        plan_id: planId,
        content: steps,
        reason: '为数据库设计计划添加详细步骤',
        change_type: 'generate_steps',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.modified_field).toBe('steps');
      expect(response.steps_added).toBe(4);
      expect(response.first_step_started).toBe(true);

      const updatedTask = await mockTaskManager.getCurrentTask();
      const plan = updatedTask!.overall_plan.find((p) => p.id === planId);
      expect(plan!.steps).toHaveLength(4);
      expect(plan!.steps[0].description).toBe(steps[0]);
      expect(plan!.steps[0].status).toBe(TaskStatus.InProgress);
    });

    it('应该替换现有步骤', async () => {
      const planId = testTask.overall_plan[0].id;

      // 先添加一些步骤
      await taskModifyTool.handle({
        field: 'steps',
        plan_id: planId,
        content: ['旧步骤1', '旧步骤2'],
        reason: '添加初始步骤',
        change_type: 'generate_steps',
      });

      // 替换步骤
      const newSteps = ['新步骤1', '新步骤2', '新步骤3'];
      const result = await taskModifyTool.handle({
        field: 'steps',
        plan_id: planId,
        content: newSteps,
        reason: '重新设计步骤',
        change_type: 'steps_adjustment',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.steps_replaced).toBe(true);

      const updatedTask = await mockTaskManager.getCurrentTask();
      const plan = updatedTask!.overall_plan.find((p) => p.id === planId);
      expect(plan!.steps).toHaveLength(3);
      expect(plan!.steps[0].description).toBe(newSteps[0]);
    });

    it('应该处理无效的计划ID', async () => {
      const result = await taskModifyTool.handle({
        field: 'steps',
        plan_id: 'invalid-plan-id',
        content: ['step1'],
        reason: 'test',
        change_type: 'generate_steps',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('计划');
      expect(response.error).toContain('不存在');
    });
  });

  describe('提示管理', () => {
    it('应该添加任务级提示', async () => {
      const hints = ['注意数据安全', '遵循编码规范', '考虑性能优化'];
      const result = await taskModifyTool.handle({
        field: 'hints',
        content: hints,
        reason: '添加开发指导',
        change_type: 'user_request',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.modified_field).toBe('hints');
      expect(response.hints_added).toBe(3);
      expect(response.hint_level).toBe('task');

      const updatedTask = await mockTaskManager.getCurrentTask();
      expect(updatedTask!.task_hints).toEqual(hints);
    });

    it('应该添加计划级提示', async () => {
      const planId = testTask.overall_plan[0].id;
      const hints = ['使用PostgreSQL', '考虑数据迁移'];

      const result = await taskModifyTool.handle({
        field: 'hints',
        plan_id: planId,
        content: hints,
        reason: '为数据库设计添加提示',
        change_type: 'user_request',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.hint_level).toBe('plan');

      const updatedTask = await mockTaskManager.getCurrentTask();
      const plan = updatedTask!.overall_plan.find((p) => p.id === planId);
      expect(plan!.hints).toEqual(hints);
    });

    it('应该添加步骤级提示', async () => {
      const planId = testTask.overall_plan[0].id;

      // 先添加步骤
      await taskModifyTool.handle({
        field: 'steps',
        plan_id: planId,
        content: ['创建用户表'],
        reason: '添加步骤',
        change_type: 'generate_steps',
      });

      const updatedTask = await mockTaskManager.getCurrentTask();
      const stepId = updatedTask!.overall_plan[0].steps[0].id;
      const hints = ['使用UUID作为主键', '添加时间戳字段'];

      const result = await taskModifyTool.handle({
        field: 'hints',
        plan_id: planId,
        step_id: stepId,
        content: hints,
        reason: '为用户表创建添加提示',
        change_type: 'user_request',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.hint_level).toBe('step');

      const finalTask = await mockTaskManager.getCurrentTask();
      const step = finalTask!.overall_plan[0].steps.find(
        (s) => s.id === stepId
      );
      expect(step!.hints).toEqual(hints);
    });
  });

  describe('批量修改', () => {
    it('应该支持批量修改操作', async () => {
      const modifications = [
        {
          field: 'goal',
          content: '更新的目标',
          reason: '优化目标',
          change_type: 'refine_goal',
        },
        {
          field: 'hints',
          content: ['新提示1', '新提示2'],
          reason: '添加提示',
          change_type: 'user_request',
        },
      ];

      // 模拟批量修改（实际实现中可能需要专门的批量接口）
      const results: any[] = [];
      for (const mod of modifications) {
        const result = await taskModifyTool.handle(mod);
        results.push(JSON.parse(result.content[0].text));
      }

      expect(results.every((r: any) => r.success)).toBe(true);

      const updatedTask = await mockTaskManager.getCurrentTask();
      expect(updatedTask!.goal).toBe('更新的目标');
      expect(updatedTask!.task_hints).toEqual(['新提示1', '新提示2']);
    });
  });

  describe('错误处理', () => {
    it('应该处理并发修改冲突', async () => {
      // 模拟两个Agent同时修改同一任务
      const modification1 = taskModifyTool.handle({
        field: 'goal',
        content: '目标1',
        reason: 'Agent1修改',
        change_type: 'refine_goal',
      });

      const modification2 = taskModifyTool.handle({
        field: 'goal',
        content: '目标2',
        reason: 'Agent2修改',
        change_type: 'refine_goal',
      });

      const [result1, result2] = await Promise.allSettled([
        modification1,
        modification2,
      ]);

      // 至少有一个应该成功
      const responses = [result1, result2]
        .map((r) =>
          r.status === 'fulfilled' ? JSON.parse(r.value.content[0].text) : null
        )
        .filter(Boolean);

      expect(responses.some((r) => r.success)).toBe(true);
    });

    it('应该处理数据验证错误', async () => {
      const result = await taskModifyTool.handle({
        field: 'plan',
        content: [], // 空数组应该被拒绝
        reason: 'test',
        change_type: 'plan_adjustment',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('计划');
      expect(response.error).toContain('不能为空');
    });
  });

  describe('工具定义', () => {
    it('应该返回正确的工具定义', () => {
      const definition = CurrentTaskModifyTool.getDefinition();

      expect(definition).toMatchObject({
        name: 'current_task_modify',
        description: expect.stringContaining('动态修改任务结构'),
        inputSchema: {
          type: 'object',
          properties: {
            field: expect.objectContaining({
              type: 'string',
              enum: ['goal', 'plan', 'steps', 'hints'],
            }),
            change_type: expect.objectContaining({
              type: 'string',
              enum: expect.arrayContaining([
                'generate_steps',
                'plan_adjustment',
                'refine_goal',
              ]),
            }),
          },
          required: ['field', 'content', 'reason', 'change_type'],
          additionalProperties: false,
        },
      });
    });
  });
});

describe('CurrentTaskCompleteTool', () => {
  let taskCompleteTool: CurrentTaskCompleteTool;
  let mockTaskManager: TaskManager;
  let testTask: any;

  beforeEach(async () => {
    // 创建独立的测试环境
    testEnv = createTestEnvironment('task-complete');
    await testEnv.setup();

    mockTaskManager = new TaskManager(testEnv.getTestDir());
    taskCompleteTool = new CurrentTaskCompleteTool(mockTaskManager);

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

  describe('任务完成', () => {
    it('应该成功完成任务并返回devlog建议', async () => {
      const summary = '用户认证系统开发完成，包含注册、登录、JWT鉴权等功能';
      const result = await taskCompleteTool.handle({
        summary,
        generate_docs: true,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.completed).toBe(true);
      expect(response.archived_task_id).toBe(testTask.id);
      expect(response.devlog_recommendation).toBeDefined();
      expect(response.devlog_recommendation.prompt).toBe(true);
      expect(response.devlog_recommendation.suggested_mode).toMatch(
        /^(timeline|narrative|both)$/
      );
    });

    it('应该支持不生成文档', async () => {
      const result = await taskCompleteTool.handle({
        summary: '任务完成',
        generate_docs: false,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.docs_generated).toBe(false);
      expect(response.devlog_recommendation).toBeUndefined();
    });

    it('应该验证必填的summary参数', async () => {
      const result = await taskCompleteTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('summary');
      expect(response.type).toBe('VALIDATION_ERROR');
    });

    it('应该验证summary长度限制', async () => {
      const longSummary = 'a'.repeat(2001);
      const result = await taskCompleteTool.handle({
        summary: longSummary,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('2000');
    });
  });

  describe('归档处理', () => {
    it('应该正确归档任务到历史目录', async () => {
      const result = await taskCompleteTool.handle({
        summary: '任务完成',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.archived_task_id).toBe(testTask.id);

      // 验证任务已被归档
      const currentTask = await mockTaskManager.getCurrentTask();
      expect(currentTask).toBeNull();
    });

    it('应该更新任务索引', async () => {
      const result = await taskCompleteTool.handle({
        summary: '任务完成',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.index_updated).toBe(true);
    });
  });

  describe('工具定义', () => {
    it('应该返回正确的工具定义', () => {
      const definition = CurrentTaskCompleteTool.getDefinition();

      expect(definition).toMatchObject({
        name: 'current_task_complete',
        description: expect.stringContaining('完成当前任务并生成文档'),
        inputSchema: {
          type: 'object',
          properties: {
            summary: expect.objectContaining({
              type: 'string',
              minLength: 1,
              maxLength: 2000,
            }),
            generate_docs: expect.objectContaining({
              type: 'boolean',
              default: true,
            }),
          },
          required: ['summary'],
          additionalProperties: false,
        },
      });
    });
  });
});

describe('CurrentTaskLogTool', () => {
  let taskLogTool: CurrentTaskLogTool;
  let mockTaskManager: TaskManager;

  beforeEach(async () => {
    // 创建独立的测试环境
    testEnv = createTestEnvironment('task-log');
    await testEnv.setup();

    mockTaskManager = new TaskManager(testEnv.getTestDir());
    taskLogTool = new CurrentTaskLogTool(mockTaskManager);

    const initParams = createMockTaskInitParams();
    try {
      await mockTaskManager.initTask(initParams);
      await testEnv.waitForStable(); // 等待文件系统稳定

      // 确保任务被正确创建
      const testTask = await mockTaskManager.getCurrentTask();
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

  describe('日志记录', () => {
    it('应该成功记录讨论日志', async () => {
      const result = await taskLogTool.handle({
        category: 'discussion',
        action: 'create',
        message: '讨论数据库设计方案',
        notes: '考虑了PostgreSQL和MySQL两种方案，最终选择PostgreSQL',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.log_recorded).toBe(true);
      expect(response.log_id).toBeDefined();

      const task = await mockTaskManager.getCurrentTask();
      const discussionLogs = task!.logs.filter(
        (log) => log.category === 'DISCUSSION'
      );
      expect(discussionLogs).toHaveLength(1);
      expect(discussionLogs[0].message).toBe('讨论数据库设计方案');
    });

    it('应该记录异常日志', async () => {
      const result = await taskLogTool.handle({
        category: 'exception',
        action: 'handle',
        message: '数据库连接失败',
        notes: '连接超时，已切换到备用数据库',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);

      const task = await mockTaskManager.getCurrentTask();
      const exceptionLogs = task!.logs.filter(
        (log) => log.category === 'EXCEPTION'
      );
      expect(exceptionLogs).toHaveLength(1);
      expect(exceptionLogs[0].action).toBe('HANDLE');
    });

    it('应该记录测试日志', async () => {
      const result = await taskLogTool.handle({
        category: 'test',
        action: 'create',
        message: '创建用户认证测试用例',
        notes: '包含单元测试和集成测试，覆盖率达到95%',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);

      const task = await mockTaskManager.getCurrentTask();
      const testLogs = task!.logs.filter((log) => log.category === 'TEST');
      expect(testLogs).toHaveLength(1);
    });
  });

  describe('参数验证', () => {
    it('应该验证必填参数', async () => {
      const result = await taskLogTool.handle({});
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('category');
      expect(response.type).toBe('VALIDATION_ERROR');
    });

    it('应该验证category枚举值', async () => {
      const result = await taskLogTool.handle({
        category: 'invalid_category',
        action: 'create',
        message: 'test',
        notes: 'test',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('category');
    });

    it('应该验证消息长度限制', async () => {
      const longMessage = 'a'.repeat(1001);
      const result = await taskLogTool.handle({
        category: 'discussion',
        action: 'create',
        message: longMessage,
        notes: 'test',
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('1000');
    });
  });

  describe('工具定义', () => {
    it('应该返回正确的工具定义', () => {
      const definition = CurrentTaskLogTool.getDefinition();

      expect(definition).toMatchObject({
        name: 'current_task_log',
        description: expect.stringContaining('记录非任务状态变更的重要事件'),
        inputSchema: {
          type: 'object',
          properties: {
            category: expect.objectContaining({
              type: 'string',
              enum: ['discussion', 'exception', 'test', 'health', 'knowledge'],
            }),
            action: expect.objectContaining({
              type: 'string',
              enum: ['update', 'create', 'modify', 'switch', 'handle'],
            }),
          },
          required: ['category', 'action', 'message', 'notes'],
          additionalProperties: false,
        },
      });
    });
  });
});
