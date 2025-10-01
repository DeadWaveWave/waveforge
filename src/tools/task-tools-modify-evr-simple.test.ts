/**
 * EVR 修改功能简化测试
 * 测试 current_task_modify 工具对 EVR 内容字段的修改功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskManager } from '../core/task-manager.js';
import { CurrentTaskModifyTool } from './task-tools.js';
import { createTestEnvironment, TestEnvironmentManager } from '../test-utils/test-environment.js';
import { EVRStatus, EVRClass } from '../types/index.js';

describe('CurrentTaskModifyTool - EVR 修改功能 (简化版)', () => {
  let testEnv: TestEnvironmentManager;
  let taskManager: TaskManager;
  let modifyTool: CurrentTaskModifyTool;

  beforeEach(async () => {
    testEnv = createTestEnvironment('evr-modify-simple');
    await testEnv.setup();
    
    taskManager = new TaskManager(testEnv.getTestDir());
    modifyTool = new CurrentTaskModifyTool(taskManager);

    // 创建测试任务
    await taskManager.initTask({
      title: 'EVR修改测试任务',
      goal: '测试EVR内容字段修改功能',
      overall_plan: ['实现EVR修改', '验证数组结构保持'],
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('应该能够创建新的 EVR', async () => {
    const params = {
      field: 'evr',
      reason: '添加新的验证目标',
      change_type: 'user_request',
      evr: {
        items: [
          {
            title: '测试通过验证',
            verify: 'pnpm test',
            expect: '所有测试通过',
            class: 'runtime',
          },
        ],
      },
    };

    const result = await modifyTool.handle(params);
    const response = JSON.parse(result.content[0].text);

    expect(response.success).toBe(true);
    expect(response.field).toBe('evr');
    expect(response.evr_modified).toBe(1);
    expect(response.operation_type).toBe('create');

    // 验证任务中确实添加了 EVR
    const task = await taskManager.getCurrentTask();
    expect(task?.expectedResults).toHaveLength(1);
    expect(task?.expectedResults?.[0].title).toBe('测试通过验证');
    expect(task?.expectedResults?.[0].verify).toBe('pnpm test');
    expect(task?.expectedResults?.[0].expect).toBe('所有测试通过');
    expect(task?.expectedResults?.[0].class).toBe(EVRClass.Runtime);
    expect(task?.expectedResults?.[0].status).toBe(EVRStatus.Unknown);
  });

  it('应该能够创建带有数组 verify/expect 的 EVR', async () => {
    const params = {
      field: 'evr',
      reason: '添加复杂验证目标',
      change_type: 'user_request',
      evr: {
        items: [
          {
            title: '多步骤验证',
            verify: ['pnpm test', 'pnpm build', 'pnpm lint'],
            expect: ['测试通过', '构建成功', '代码规范检查通过'],
            class: 'static',
          },
        ],
      },
    };

    const result = await modifyTool.handle(params);
    const response = JSON.parse(result.content[0].text);

    expect(response.success).toBe(true);

    const task = await taskManager.getCurrentTask();
    const evr = task?.expectedResults?.[0];
    expect(evr?.verify).toEqual(['pnpm test', 'pnpm build', 'pnpm lint']);
    expect(evr?.expect).toEqual(['测试通过', '构建成功', '代码规范检查通过']);
    expect(Array.isArray(evr?.verify)).toBe(true);
    expect(Array.isArray(evr?.expect)).toBe(true);
  });

  it('应该能够更新现有 EVR 的内容', async () => {
    // 先创建一个 EVR
    await modifyTool.handle({
      field: 'evr',
      reason: '创建测试EVR',
      change_type: 'user_request',
      evr: {
        items: [
          {
            title: '原始标题',
            verify: '原始验证',
            expect: '原始期望',
            class: 'runtime',
          },
        ],
      },
    });

    const task = await taskManager.getCurrentTask();
    const existingEVRId = task?.expectedResults?.[0]?.id || '';

    // 更新 EVR 标题
    const updateParams = {
      field: 'evr',
      reason: '更新EVR标题',
      change_type: 'user_request',
      evr: {
        items: [
          {
            evrId: existingEVRId,
            title: '更新后的标题',
          },
        ],
      },
    };

    const result = await modifyTool.handle(updateParams);
    const response = JSON.parse(result.content[0].text);

    expect(response.success).toBe(true);
    expect(response.operation_type).toBe('update');

    const updatedTask = await taskManager.getCurrentTask();
    const evr = updatedTask?.expectedResults?.find(e => e.id === existingEVRId);
    expect(evr?.title).toBe('更新后的标题');
    expect(evr?.verify).toBe('原始验证'); // 其他字段保持不变
    expect(evr?.expect).toBe('原始期望');
  });

  it('应该保持数组结构在更新中不变', async () => {
    // 先创建一个 EVR
    await modifyTool.handle({
      field: 'evr',
      reason: '创建测试EVR',
      change_type: 'user_request',
      evr: {
        items: [
          {
            title: '原始标题',
            verify: ['命令1', '命令2'],
            expect: ['结果1', '结果2'],
          },
        ],
      },
    });

    const task = await taskManager.getCurrentTask();
    const existingEVRId = task?.expectedResults?.[0]?.id || '';

    // 更新数组内容
    await modifyTool.handle({
      field: 'evr',
      reason: '更新数组内容',
      change_type: 'user_request',
      evr: {
        items: [
          {
            evrId: existingEVRId,
            verify: ['新命令1', '新命令2', '新命令3'],
            expect: ['新结果1', '新结果2', '新结果3'],
          },
        ],
      },
    });

    const updatedTask = await taskManager.getCurrentTask();
    const evr = updatedTask?.expectedResults?.find(e => e.id === existingEVRId);
    expect(Array.isArray(evr?.verify)).toBe(true);
    expect(Array.isArray(evr?.expect)).toBe(true);
    expect(evr?.verify).toEqual(['新命令1', '新命令2', '新命令3']);
    expect(evr?.expect).toEqual(['新结果1', '新结果2', '新结果3']);
  });

  it('应该能够删除 EVR', async () => {
    // 先创建两个 EVR
    await modifyTool.handle({
      field: 'evr',
      reason: '创建测试EVR',
      change_type: 'user_request',
      evr: {
        items: [
          {
            title: 'EVR 1',
            verify: '验证1',
            expect: '期望1',
          },
          {
            title: 'EVR 2',
            verify: '验证2',
            expect: '期望2',
          },
        ],
      },
    });

    const task = await taskManager.getCurrentTask();
    const evrId1 = task?.expectedResults?.[0]?.id || '';

    // 删除第一个 EVR
    const deleteParams = {
      field: 'evr',
      reason: '删除不需要的EVR',
      change_type: 'user_request',
      evr: {
        evrIds: [evrId1],
      },
    };

    const result = await modifyTool.handle(deleteParams);
    const response = JSON.parse(result.content[0].text);

    expect(response.success).toBe(true);
    expect(response.operation_type).toBe('remove');
    expect(response.evr_modified).toBe(1);

    const updatedTask = await taskManager.getCurrentTask();
    expect(updatedTask?.expectedResults).toHaveLength(1);
    expect(updatedTask?.expectedResults?.[0]?.title).toBe('EVR 2');
  });

  it('应该在 EVR 参数为空时抛出错误', async () => {
    const params = {
      field: 'evr',
      reason: '测试错误处理',
      change_type: 'user_request',
    };

    const result = await modifyTool.handle(params);
    const response = JSON.parse(result.content[0].text);

    expect(response.success).toBe(false);
    expect(response.error).toContain('EVR修改时必须提供evr.items或evr.evrIds');
  });

  it('应该记录 EVR 修改的审计日志', async () => {
    const params = {
      field: 'evr',
      reason: '测试审计日志',
      change_type: 'user_request',
      evr: {
        items: [
          {
            title: '测试EVR',
            verify: '测试验证',
            expect: '测试期望',
          },
        ],
      },
    };

    await modifyTool.handle(params);

    const task = await taskManager.getCurrentTask();
    const logs = task?.logs || [];
    const evrLog = logs.find(log => 
      log.message.includes('EVR内容修改') && 
      log.ai_notes === '测试审计日志'
    );

    expect(evrLog).toBeDefined();
    expect(evrLog?.details?.field).toBe('evr');
    expect(evrLog?.details?.change_type).toBe('user_request');
    expect(evrLog?.details?.operation_type).toBe('create');
    expect(evrLog?.details?.operation_count).toBe(1);
  });
});