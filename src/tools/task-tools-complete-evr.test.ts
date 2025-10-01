/**
 * CurrentTaskCompleteTool EVR 验证测试
 * 测试任务完成前的 EVR 检查逻辑
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CurrentTaskCompleteTool } from './task-tools.js';
import { TaskManager } from '../core/task-manager.js';
import {
    createTestEnvironment,
    type TestEnvironmentManager,
} from '../test-utils/test-environment.js';
import { EVRStatus, EVRClass } from '../types/index.js';

let testEnv: TestEnvironmentManager;

describe('CurrentTaskCompleteTool - EVR 验证', () => {
    let taskCompleteTool: CurrentTaskCompleteTool;
    let mockTaskManager: TaskManager;
    let testTask: any;

    beforeEach(async () => {
        testEnv = createTestEnvironment('task-complete-evr');
        await testEnv.setup();

        mockTaskManager = new TaskManager(testEnv.getTestDir());
        taskCompleteTool = new CurrentTaskCompleteTool(mockTaskManager);

        // 创建测试任务
        const initParams = {
            title: 'EVR 测试任务',
            goal: '测试 EVR 验证功能',
            overall_plan: ['计划1'],
        };

        await mockTaskManager.initTask(initParams);
        await testEnv.waitForStable();
        testTask = await mockTaskManager.getCurrentTask();

        if (!testTask) {
            throw new Error('测试任务创建失败');
        }
    });

    afterEach(async () => {
        await testEnv.cleanup();
    });

    describe('EVR 未就绪阻断', () => {
        it('应该在存在 unknown 状态的 EVR 时阻止完成', async () => {
            // 添加一个 unknown 状态的 EVR
            testTask.expectedResults = [
                {
                    id: 'evr-001',
                    title: '测试 EVR 1',
                    verify: 'npm test',
                    expect: '所有测试通过',
                    status: EVRStatus.Unknown,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(false);
            expect(response.error_code).toBe('EVR_NOT_READY');
            expect(response.evr_required_final).toBeDefined();
            expect(response.evr_required_final).toHaveLength(1);
            expect(response.evr_required_final[0]).toEqual({
                evr_id: 'evr-001',
                reason: 'status_unknown',
            });
        });

        it('应该在存在 failed 状态的 EVR 时阻止完成', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-002',
                    title: '测试 EVR 2',
                    verify: 'npm test',
                    expect: '所有测试通过',
                    status: EVRStatus.Fail,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [
                        {
                            at: new Date().toISOString(),
                            by: 'ai',
                            status: EVRStatus.Fail,
                            notes: '测试失败',
                        },
                    ],
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(false);
            expect(response.error_code).toBe('EVR_NOT_READY');
            expect(response.evr_required_final).toHaveLength(1);
            expect(response.evr_required_final[0]).toEqual({
                evr_id: 'evr-002',
                reason: 'failed',
            });
        });

        it('应该在 skip 状态的 EVR 缺少理由时阻止完成', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-003',
                    title: '测试 EVR 3',
                    verify: 'npm test',
                    expect: '所有测试通过',
                    status: EVRStatus.Skip,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [
                        {
                            at: new Date().toISOString(),
                            by: 'ai',
                            status: EVRStatus.Skip,
                            // notes 为空，缺少理由
                        },
                    ],
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(false);
            expect(response.error_code).toBe('EVR_NOT_READY');
            expect(response.evr_required_final).toHaveLength(1);
            expect(response.evr_required_final[0]).toEqual({
                evr_id: 'evr-003',
                reason: 'need_reason_for_skip',
            });
        });

        it('应该在存在多个未就绪 EVR 时返回所有问题', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-001',
                    title: '测试 EVR 1',
                    verify: 'test 1',
                    expect: 'pass',
                    status: EVRStatus.Unknown,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                },
                {
                    id: 'evr-002',
                    title: '测试 EVR 2',
                    verify: 'test 2',
                    expect: 'pass',
                    status: EVRStatus.Fail,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                },
                {
                    id: 'evr-003',
                    title: '测试 EVR 3',
                    verify: 'test 3',
                    expect: 'pass',
                    status: EVRStatus.Skip,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                    // 缺少 notes
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(false);
            expect(response.error_code).toBe('EVR_NOT_READY');
            expect(response.evr_required_final).toHaveLength(3);
            expect(response.evr_required_final).toEqual(
                expect.arrayContaining([
                    { evr_id: 'evr-001', reason: 'status_unknown' },
                    { evr_id: 'evr-002', reason: 'failed' },
                    { evr_id: 'evr-003', reason: 'need_reason_for_skip' },
                ])
            );
        });
    });

    describe('EVR 就绪成功路径', () => {
        it('应该在所有 EVR 为 pass 时成功完成', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-001',
                    title: '测试 EVR 1',
                    verify: 'npm test',
                    expect: '所有测试通过',
                    status: EVRStatus.Pass,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [
                        {
                            at: new Date().toISOString(),
                            by: 'ai',
                            status: EVRStatus.Pass,
                            notes: '测试通过',
                            proof: 'test-result.txt',
                        },
                    ],
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(true);
            expect(response.completed).toBe(true);
            expect(response.evr_summary).toBeDefined();
            expect(response.evr_summary.total).toBe(1);
            expect(response.evr_summary.passed).toEqual(['evr-001']);
            expect(response.evr_summary.unknown).toEqual([]);
            expect(response.evr_summary.failed).toEqual([]);
        });

        it('应该在 skip 状态有理由时成功完成', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-001',
                    title: '测试 EVR 1',
                    verify: 'npm test',
                    expect: '所有测试通过',
                    status: EVRStatus.Skip,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [
                        {
                            at: new Date().toISOString(),
                            by: 'ai',
                            status: EVRStatus.Skip,
                            notes: '因为依赖环境不可用，跳过此测试',
                        },
                    ],
                    notes: '因为依赖环境不可用，跳过此测试',
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(true);
            expect(response.completed).toBe(true);
            expect(response.evr_summary).toBeDefined();
            expect(response.evr_summary.skipped).toEqual(['evr-001']);
        });

        it('应该在混合 pass 和有理由的 skip 时成功完成', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-001',
                    title: '测试 EVR 1',
                    verify: 'test 1',
                    expect: 'pass',
                    status: EVRStatus.Pass,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [
                        {
                            at: new Date().toISOString(),
                            by: 'ai',
                            status: EVRStatus.Pass,
                        },
                    ],
                },
                {
                    id: 'evr-002',
                    title: '测试 EVR 2',
                    verify: 'test 2',
                    expect: 'pass',
                    status: EVRStatus.Skip,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                    notes: '环境限制，跳过',
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(true);
            expect(response.completed).toBe(true);
            expect(response.evr_summary.passed).toEqual(['evr-001']);
            expect(response.evr_summary.skipped).toEqual(['evr-002']);
        });
    });

    describe('EVR Summary 返回', () => {
        it('应该返回完整的 EVR 摘要', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-001',
                    title: 'EVR 1',
                    verify: 'test 1',
                    expect: 'pass',
                    status: EVRStatus.Pass,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                },
                {
                    id: 'evr-002',
                    title: 'EVR 2',
                    verify: 'test 2',
                    expect: 'pass',
                    status: EVRStatus.Skip,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                    notes: '跳过理由',
                },
                {
                    id: 'evr-003',
                    title: 'EVR 3',
                    verify: 'test 3',
                    expect: 'pass',
                    status: EVRStatus.Pass,
                    class: EVRClass.Static,
                    referencedBy: [],
                    runs: [],
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(true);
            expect(response.evr_summary).toEqual({
                total: 3,
                passed: expect.arrayContaining(['evr-001', 'evr-003']),
                skipped: ['evr-002'],
                failed: [],
                unknown: [],
                unreferenced: ['evr-003'],
            });
        });

        it('应该在 EVR 未就绪时也返回 EVR 摘要', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-001',
                    title: 'EVR 1',
                    verify: 'test 1',
                    expect: 'pass',
                    status: EVRStatus.Unknown,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(false);
            expect(response.evr_summary).toBeDefined();
            expect(response.evr_summary.unknown).toEqual(['evr-001']);
        });
    });

    describe('无 EVR 情况', () => {
        it('应该在没有 EVR 时成功完成', async () => {
            // 确保没有 EVR
            testTask.expectedResults = [];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(true);
            expect(response.completed).toBe(true);
            expect(response.evr_summary).toEqual({
                total: 0,
                passed: [],
                skipped: [],
                failed: [],
                unknown: [],
                unreferenced: [],
            });
        });
    });

    describe('日志高亮', () => {
        it('应该在 EVR 检查失败时记录高亮日志', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-001',
                    title: 'EVR 1',
                    verify: 'test',
                    expect: 'pass',
                    status: EVRStatus.Unknown,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(false);
            // 应该包含日志高亮信息
            expect(response.logs_highlights).toBeDefined();
        });

        it('应该在成功完成时记录 EVR 验证成功的高亮', async () => {
            testTask.expectedResults = [
                {
                    id: 'evr-001',
                    title: 'EVR 1',
                    verify: 'test',
                    expect: 'pass',
                    status: EVRStatus.Pass,
                    class: EVRClass.Runtime,
                    referencedBy: ['plan-1'],
                    runs: [],
                },
            ];
            await mockTaskManager.saveTask(testTask);

            const result = await taskCompleteTool.handle({
                summary: '任务完成',
            });
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(true);
            // 应该包含成功的日志高亮
            expect(response.logs_highlights).toBeDefined();
        });
    });
});

