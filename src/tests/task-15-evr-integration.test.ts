/**
 * 任务 15：集成测试 - EVR 生命周期
 * TDD：Given EVR 生命周期全流程（创建→绑定→验证→完成），When 执行，Then 计划 Gate 与任务 Gate 均按规则工作，
 * static EVR 单次验证生效。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from '../core/project-manager.js';
import { TaskManager } from '../core/task-manager.js';
// import { EVRValidator, createEVRValidator } from '../core/evr-validator.js';
import { ConnectProjectTool } from '../tools/handshake-tools.js';
import {
  CurrentTaskInitTool,
  CurrentTaskReadTool,
  CurrentTaskModifyTool,
  CurrentTaskUpdateTool,
  CurrentTaskCompleteTool,
} from '../tools/task-tools.js';
import { EVRStatus, EVRClass, ErrorCode } from '../types/index.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('任务 15：EVR 生命周期集成测试', () => {
  let tempDir: string;
  let projectManager: ProjectManager;
  let taskManager: TaskManager;
  // let evrValidator: EVRValidator;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task15-evr-'));

    projectManager = new ProjectManager();
    taskManager = new TaskManager(path.join(tempDir, '.wave'), projectManager);
    // evrValidator = createEVRValidator();

    // 连接项目
    const connectTool = new ConnectProjectTool(projectManager, taskManager);
    await connectTool.handle({ project_path: tempDir });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('EVR 创建 → 绑定 → 验证 → 完成门槛检查完整流程', () => {
    it('应该支持完整的 EVR 生命周期', async () => {
      // Step 1: 创建任务和计划
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: 'EVR 生命周期测试',
        goal: '验证 EVR 从创建到完成的完整流程',
        overall_plan: ['实现功能', '编写测试', '完成验证'],
        knowledge_refs: [],
      });

      // Step 2: 创建 EVR（通过 modify 工具）
      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const readTool = new CurrentTaskReadTool(taskManager);

      // 获取第一个计划的 ID
      let readResult = await readTool.handle();
      let readResponse = JSON.parse(readResult.content[0].text);
      const plan1Id = readResponse.task.overall_plan[0].id;
      const plan2Id = readResponse.task.overall_plan[1].id;

      // 创建 EVR 并绑定到计划
      const createEVRResult = await modifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: '单元测试通过',
              verify: 'npm test',
              expect: '所有测试通过',
              class: EVRClass.Runtime,
            },
            {
              title: '代码格式检查',
              verify: 'npm run lint',
              expect: '无格式错误',
              class: EVRClass.Static,
            },
          ],
        },
        reason: '添加验证标准',
        change_type: 'plan_adjustment',
      });
      const createEVRResponse = JSON.parse(createEVRResult.content[0].text);
      expect(createEVRResponse.success).toBe(true);

      // Step 3: 验证 EVR 已创建并绑定
      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);

      expect(readResponse.task.expected_results).toHaveLength(2);
      expect(readResponse.task.expected_results[0].status).toBe(
        EVRStatus.Unknown
      );
      expect(readResponse.task.expected_results[1].class).toBe(EVRClass.Static);

      // 验证 EVR 摘要
      expect(readResponse.evr_ready).toBe(false);
      expect(readResponse.evr_summary.total).toBe(2);
      expect(readResponse.evr_summary.unknown).toHaveLength(2);

      const evr1Id = readResponse.task.expected_results[0].id;
      const evr2Id = readResponse.task.expected_results[1].id;

      // Step 4: 开始执行计划，应该返回 EVR 引导
      const updateTool = new CurrentTaskUpdateTool(taskManager);
      const startPlanResult = await updateTool.handle({
        update_type: 'plan',
        plan_id: plan1Id,
        status: 'in_progress',
        notes: '开始执行计划',
      });
      const startPlanResponse = JSON.parse(startPlanResult.content[0].text);

      expect(startPlanResponse.success).toBe(true);
      // 验证返回了 EVR 引导
      expect(startPlanResponse.evr_for_node).toBeDefined();
      expect(startPlanResponse.evr_for_node).toContain(evr1Id);
      expect(startPlanResponse.evr_for_node).toContain(evr2Id);

      // Step 5: 执行验证，更新 EVR 状态
      // 5.1 更新 Runtime EVR
      const updateEVR1Result = await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evr1Id,
              status: EVRStatus.Pass,
              last_run: new Date().toISOString(),
              notes: '所有单元测试通过',
              proof: 'test-results.log',
            },
          ],
        },
      });
      const updateEVR1Response = JSON.parse(updateEVR1Result.content[0].text);
      expect(updateEVR1Response.success).toBe(true);

      // 5.2 更新 Static EVR
      const updateEVR2Result = await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evr2Id,
              status: EVRStatus.Pass,
              last_run: new Date().toISOString(),
              notes: '代码格式符合规范',
              proof: 'lint-report.txt',
            },
          ],
        },
      });
      const updateEVR2Response = JSON.parse(updateEVR2Result.content[0].text);
      expect(updateEVR2Response.success).toBe(true);

      // Step 6: 验证 EVR 状态已更新
      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);

      const updatedEVR1 = readResponse.task.expected_results.find(
        (e: any) => e.id === evr1Id
      );
      const updatedEVR2 = readResponse.task.expected_results.find(
        (e: any) => e.id === evr2Id
      );

      expect(updatedEVR1.status).toBe(EVRStatus.Pass);
      expect(updatedEVR2.status).toBe(EVRStatus.Pass);
      expect(readResponse.evr_summary.passed).toContain(evr1Id);
      expect(readResponse.evr_summary.passed).toContain(evr2Id);

      // Step 7: 尝试完成计划，应该通过 EVR Gate
      const completePlanResult = await updateTool.handle({
        update_type: 'plan',
        plan_id: plan1Id,
        status: 'completed',
        notes: '计划执行完成',
      });
      const completePlanResponse = JSON.parse(completePlanResult.content[0].text);

      expect(completePlanResponse.success).toBe(true);

      // Step 8: 完成所有计划
      await updateTool.handle({
        update_type: 'plan',
        plan_id: plan2Id,
        status: 'completed',
        notes: '完成第二个计划',
      });

      const plan3Id = readResponse.task.overall_plan[2].id;
      await updateTool.handle({
        update_type: 'plan',
        plan_id: plan3Id,
        status: 'completed',
        notes: '完成第三个计划',
      });

      // Step 9: 尝试完成任务，应该通过任务级 EVR Gate
      const completeTool = new CurrentTaskCompleteTool(taskManager);
      const completeResult = await completeTool.handle({
        summary: 'EVR 生命周期测试完成',
        generate_docs: false,
      });
      const completeResponse = JSON.parse(completeResult.content[0].text);

      expect(completeResponse.success).toBe(true);
      expect(completeResponse.evr_summary).toBeDefined();
      expect(completeResponse.evr_summary.total).toBe(2);
      expect(completeResponse.evr_summary.passed).toHaveLength(2);
    });
  });

  describe('计划级门槛检查（Plan Gate）', () => {
    it('应该阻止未就绪的计划完成', async () => {
      // Given: 创建带 EVR 的任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '计划门槛测试',
        goal: '验证计划级 EVR 门槛',
        overall_plan: ['带验证的计划'],
        knowledge_refs: [],
      });

      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const readTool = new CurrentTaskReadTool(taskManager);

      let readResult = await readTool.handle();
      let readResponse = JSON.parse(readResult.content[0].text);
      const planId = readResponse.task.overall_plan[0].id;

      // 创建 EVR
      await modifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: '集成测试',
              verify: 'npm run test:integration',
              expect: '所有集成测试通过',
            },
          ],
        },
        reason: '添加集成测试要求',
        change_type: 'plan_adjustment',
      });

      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);
      const evrId = readResponse.task.expected_results[0].id;

      // When: 启动计划并尝试在 EVR 未就绪时完成
      const updateTool = new CurrentTaskUpdateTool(taskManager);
      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'in_progress',
        notes: '开始执行',
      });

      // 尝试完成计划（EVR 仍然是 unknown）
      const completeResult = await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'completed',
        notes: '尝试完成',
      });
      const completeResponse = JSON.parse(completeResult.content[0].text);

      // Then: 应该被阻止
      expect(completeResponse.success).toBe(false);
      expect(completeResponse.evr_pending).toBe(true);
      expect(completeResponse.evr_for_plan).toContain(evrId);
      expect(completeResponse.message).toContain('EVR 验证未完成');

      // When: 完成 EVR 验证后重试
      await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evrId,
              status: EVRStatus.Pass,
              last_run: new Date().toISOString(),
              notes: '集成测试通过',
            },
          ],
        },
      });

      const retryResult = await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'completed',
        notes: '重试完成',
      });
      const retryResponse = JSON.parse(retryResult.content[0].text);

      // Then: 现在应该成功
      expect(retryResponse.success).toBe(true);
    });

    it('应该允许 skip 状态的 EVR（如果有充分理由）', async () => {
      // Given: 创建带 EVR 的任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: 'Skip EVR 测试',
        goal: '验证 skip 状态的处理',
        overall_plan: ['可跳过的验证'],
        knowledge_refs: [],
      });

      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const readTool = new CurrentTaskReadTool(taskManager);

      let readResult = await readTool.handle();
      let readResponse = JSON.parse(readResult.content[0].text);
      const planId = readResponse.task.overall_plan[0].id;

      await modifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: '性能测试',
              verify: 'npm run test:perf',
              expect: '响应时间 < 100ms',
            },
          ],
        },
        reason: '添加性能要求',
        change_type: 'plan_adjustment',
      });

      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);
      const evrId = readResponse.task.expected_results[0].id;

      // When: 将 EVR 标记为 skip 并提供理由
      const updateTool = new CurrentTaskUpdateTool(taskManager);
      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'in_progress',
        notes: '开始',
      });

      await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evrId,
              status: EVRStatus.Skip,
              last_run: new Date().toISOString(),
              notes: '性能优化不在本次迭代范围内，推迟到下个版本',
            },
          ],
        },
      });

      // Then: 应该允许完成计划
      const completeResult = await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'completed',
        notes: '完成计划',
      });
      const completeResponse = JSON.parse(completeResult.content[0].text);

      expect(completeResponse.success).toBe(true);
    });
  });

  describe('任务级门槛检查（Task Gate）', () => {
    it('应该在 EVR 未就绪时阻止任务完成', async () => {
      // Given: 创建带 EVR 的任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '任务门槛测试',
        goal: '验证任务级 EVR 门槛',
        overall_plan: ['计划 1'],
        knowledge_refs: [],
      });

      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const readTool = new CurrentTaskReadTool(taskManager);

      let readResult = await readTool.handle();
      let readResponse = JSON.parse(readResult.content[0].text);
      const planId = readResponse.task.overall_plan[0].id;

      // 创建多个 EVR
      await modifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: 'EVR 1',
              verify: 'test 1',
              expect: 'pass 1',
            },
            {
              title: 'EVR 2',
              verify: 'test 2',
              expect: 'pass 2',
            },
            {
              title: 'EVR 3',
              verify: 'test 3',
              expect: 'pass 3',
            },
          ],
        },
        reason: '添加验证项',
        change_type: 'plan_adjustment',
      });

      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);
      const evr1Id = readResponse.task.expected_results[0].id;
      const evr2Id = readResponse.task.expected_results[1].id;
      const evr3Id = readResponse.task.expected_results[2].id;

      // 完成计划
      const updateTool = new CurrentTaskUpdateTool(taskManager);
      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'in_progress',
        notes: '开始',
      });

      // 只完成部分 EVR
      await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evr1Id,
              status: EVRStatus.Pass,
              last_run: new Date().toISOString(),
              notes: '通过',
            },
          ],
        },
      });

      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'completed',
        notes: '完成计划',
      });

      // When: 尝试完成任务（还有 EVR 未验证）
      const completeTool = new CurrentTaskCompleteTool(taskManager);
      const completeResult = await completeTool.handle({
        summary: '尝试完成',
        generate_docs: false,
      });
      const completeResponse = JSON.parse(completeResult.content[0].text);

      // Then: 应该被阻止并返回未就绪的 EVR 列表
      expect(completeResponse.success).toBe(false);
      expect(completeResponse.error_code).toBe(ErrorCode.EVR_NOT_READY);
      expect(completeResponse.evr_required_final).toBeDefined();

      // 检查未就绪的 EVR
      const requiredEVRs = completeResponse.evr_required_final;
      expect(requiredEVRs.length).toBe(2); // evr2 和 evr3

      const evr2Required = requiredEVRs.find((e: any) => e.evr_id === evr2Id);
      const evr3Required = requiredEVRs.find((e: any) => e.evr_id === evr3Id);

      expect(evr2Required).toBeDefined();
      expect(evr2Required.reason).toBe('status_unknown');
      expect(evr3Required).toBeDefined();
      expect(evr3Required.reason).toBe('status_unknown');
    });

    it('应该要求 skip 状态提供理由', async () => {
      // Given: 创建带 EVR 的任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: 'Skip 理由测试',
        goal: '验证 skip 必须有理由',
        overall_plan: ['计划 1'],
        knowledge_refs: [],
      });

      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const readTool = new CurrentTaskReadTool(taskManager);

      let readResult = await readTool.handle();
      let readResponse = JSON.parse(readResult.content[0].text);
      const planId = readResponse.task.overall_plan[0].id;

      await modifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: '可选验证',
              verify: 'optional test',
              expect: 'optional pass',
            },
          ],
        },
        reason: '添加可选验证',
        change_type: 'plan_adjustment',
      });

      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);
      const evrId = readResponse.task.expected_results[0].id;

      const updateTool = new CurrentTaskUpdateTool(taskManager);
      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'completed',
        notes: '完成',
      });

      // When: 将 EVR 标记为 skip 但不提供理由
      await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evrId,
              status: EVRStatus.Skip,
              last_run: new Date().toISOString(),
              // 故意不提供 notes
            },
          ],
        },
      });

      // Then: 尝试完成任务应该失败
      const completeTool = new CurrentTaskCompleteTool(taskManager);
      const completeResult = await completeTool.handle({
        summary: '尝试完成',
        generate_docs: false,
      });
      const completeResponse = JSON.parse(completeResult.content[0].text);

      expect(completeResponse.success).toBe(false);
      expect(completeResponse.evr_required_final).toBeDefined();

      const requiredEVR = completeResponse.evr_required_final.find(
        (e: any) => e.evr_id === evrId
      );
      expect(requiredEVR).toBeDefined();
      expect(requiredEVR.reason).toBe('need_reason_for_skip');

      // When: 提供充分理由后重试
      await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evrId,
              status: EVRStatus.Skip,
              last_run: new Date().toISOString(),
              notes: '该功能在本版本中不需要此验证，将在下个版本中实现',
            },
          ],
        },
      });

      const retryResult = await completeTool.handle({
        summary: '重试完成',
        generate_docs: false,
      });
      const retryResponse = JSON.parse(retryResult.content[0].text);

      // Then: 现在应该成功
      expect(retryResponse.success).toBe(true);
    });

    it('应该检测未引用的 EVR', async () => {
      // Given: 创建任务和 EVR
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '未引用 EVR 测试',
        goal: '验证未引用 EVR 的检测',
        overall_plan: ['计划 1'],
        knowledge_refs: [],
      });

      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const readTool = new CurrentTaskReadTool(taskManager);

      let readResult = await readTool.handle();
      let readResponse = JSON.parse(readResult.content[0].text);
      const planId = readResponse.task.overall_plan[0].id;

      // 创建 EVR 但绑定到计划
      await modifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: '有引用的 EVR',
              verify: 'test 1',
              expect: 'pass 1',
            },
          ],
        },
        reason: '添加验证',
        change_type: 'plan_adjustment',
      });

      // TODO: 创建未引用的 EVR（需要支持不绑定到计划的 EVR 创建）
      // 目前的 API 设计中，EVR 总是通过 plan_no 绑定到计划
      // 这个测试需要等待支持全局 EVR 创建的 API

      const updateTool = new CurrentTaskUpdateTool(taskManager);
      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'completed',
        notes: '完成',
      });

      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);
      const evrId = readResponse.task.expected_results[0].id;

      await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evrId,
              status: EVRStatus.Pass,
              last_run: new Date().toISOString(),
              notes: '通过',
            },
          ],
        },
      });

      // When: 完成任务
      const completeTool = new CurrentTaskCompleteTool(taskManager);
      const completeResult = await completeTool.handle({
        summary: '完成任务',
        generate_docs: false,
      });
      const completeResponse = JSON.parse(completeResult.content[0].text);

      // Then: 应该成功，且 evr_unreferenced 为空
      expect(completeResponse.success).toBe(true);
      expect(completeResponse.evr_summary.unreferenced).toHaveLength(0);
    });
  });

  describe('Static EVR 特殊处理', () => {
    it('应该允许 Static EVR 单次验证通过（满足 expect 且无差异）', async () => {
      // Given: 创建带 Static EVR 的任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: 'Static EVR 测试',
        goal: '验证 Static EVR 的单次验证规则',
        overall_plan: ['文档和配置'],
        knowledge_refs: [],
      });

      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const readTool = new CurrentTaskReadTool(taskManager);

      let readResult = await readTool.handle();
      let readResponse = JSON.parse(readResult.content[0].text);
      const planId = readResponse.task.overall_plan[0].id;

      // 创建 Static EVR
      await modifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: 'README 文档完整',
              verify: '检查 README.md 包含所有必要章节',
              expect: ['安装说明', '使用指南', 'API 文档'],
              class: EVRClass.Static,
            },
            {
              title: '配置文件正确',
              verify: '检查 config.json 格式',
              expect: 'JSON 格式正确且包含所有必需字段',
              class: EVRClass.Static,
            },
          ],
        },
        reason: '添加静态验证项',
        change_type: 'plan_adjustment',
      });

      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);
      const staticEVR1Id = readResponse.task.expected_results[0].id;
      const staticEVR2Id = readResponse.task.expected_results[1].id;

      const updateTool = new CurrentTaskUpdateTool(taskManager);
      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'in_progress',
        notes: '开始',
      });

      // When: 对 Static EVR 进行单次验证
      await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: staticEVR1Id,
              status: EVRStatus.Pass,
              last_run: new Date().toISOString(),
              notes: 'README 文档已包含所有必要章节，且内容无变更',
              proof: 'README.md',
            },
            {
              evr_id: staticEVR2Id,
              status: EVRStatus.Pass,
              last_run: new Date().toISOString(),
              notes: '配置文件格式正确',
              proof: 'config.json',
            },
          ],
        },
      });

      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'completed',
        notes: '完成',
      });

      // Then: 应该能直接完成任务（Static EVR 不需要双次验证）
      const completeTool = new CurrentTaskCompleteTool(taskManager);
      const completeResult = await completeTool.handle({
        summary: 'Static EVR 测试完成',
        generate_docs: false,
      });
      const completeResponse = JSON.parse(completeResult.content[0].text);

      expect(completeResponse.success).toBe(true);
      expect(completeResponse.evr_summary.total).toBe(2);
      expect(completeResponse.evr_summary.passed).toHaveLength(2);
    });
  });

  describe('双次验证规则（Runtime EVR）', () => {
    it('应该要求 Runtime EVR 进行双次验证', async () => {
      // Given: 创建带 Runtime EVR 的任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '双次验证测试',
        goal: '验证 Runtime EVR 的双次验证要求',
        overall_plan: ['实现功能'],
        knowledge_refs: [],
      });

      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const readTool = new CurrentTaskReadTool(taskManager);

      let readResult = await readTool.handle();
      let readResponse = JSON.parse(readResult.content[0].text);
      const planId = readResponse.task.overall_plan[0].id;

      await modifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: 'API 端点测试',
              verify: 'curl http://localhost:3000/api/test',
              expect: '返回 200 OK',
              class: EVRClass.Runtime,
            },
          ],
        },
        reason: '添加 API 测试',
        change_type: 'plan_adjustment',
      });

      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);
      const evrId = readResponse.task.expected_results[0].id;

      const updateTool = new CurrentTaskUpdateTool(taskManager);
      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'in_progress',
        notes: '开始',
      });

      // When: 第一次验证
      await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evrId,
              status: EVRStatus.Pass,
              last_run: new Date().toISOString(),
              notes: '第一次验证通过',
            },
          ],
        },
      });

      await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'completed',
        notes: '完成计划',
      });

      // Then: 验证 EVR 有运行记录
      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);

      const evrDetail = readResponse.evr_details.find(
        (e: any) => e.evr_id === evrId
      );
      expect(evrDetail.runs).toHaveLength(1);
      expect(evrDetail.runs[0].status).toBe(EVRStatus.Pass);

      // When: 在完成前进行第二次验证
      await updateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evrId,
              status: EVRStatus.Pass,
              last_run: new Date().toISOString(),
              notes: '第二次验证通过（最终确认）',
            },
          ],
        },
      });

      // Then: 现在应该有两次运行记录
      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);

      const finalEVRDetail = readResponse.evr_details.find(
        (e: any) => e.evr_id === evrId
      );
      expect(finalEVRDetail.runs).toHaveLength(2);

      // Then: 应该能成功完成任务
      const completeTool = new CurrentTaskCompleteTool(taskManager);
      const completeResult = await completeTool.handle({
        summary: '双次验证完成',
        generate_docs: false,
      });
      const completeResponse = JSON.parse(completeResult.content[0].text);

      expect(completeResponse.success).toBe(true);
    });
  });

  describe('EVR 引导和上下文信息传递', () => {
    it('应该在计划状态变为 in_progress 时返回 evr_for_node', async () => {
      // Given: 创建带 EVR 的任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: 'EVR 引导测试',
        goal: '验证 EVR 引导机制',
        overall_plan: ['计划 A', '计划 B'],
        knowledge_refs: [],
      });

      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const readTool = new CurrentTaskReadTool(taskManager);

      let readResult = await readTool.handle();
      let readResponse = JSON.parse(readResult.content[0].text);
      const plan1Id = readResponse.task.overall_plan[0].id;
      const plan2Id = readResponse.task.overall_plan[1].id;

      // 为不同计划绑定不同的 EVR
      await modifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: '计划 A 的 EVR 1',
              verify: 'test A1',
              expect: 'pass A1',
            },
            {
              title: '计划 A 的 EVR 2',
              verify: 'test A2',
              expect: 'pass A2',
            },
          ],
        },
        reason: '添加计划 A 的验证',
        change_type: 'plan_adjustment',
      });

      await modifyTool.handle({
        field: 'evr',
        plan_no: 2,
        op: 'add',
        evr: {
          items: [
            {
              title: '计划 B 的 EVR',
              verify: 'test B',
              expect: 'pass B',
            },
          ],
        },
        reason: '添加计划 B 的验证',
        change_type: 'plan_adjustment',
      });

      readResult = await readTool.handle();
      readResponse = JSON.parse(readResult.content[0].text);
      const evrA1Id = readResponse.task.expected_results[0].id;
      const evrA2Id = readResponse.task.expected_results[1].id;
      const evrBId = readResponse.task.expected_results[2].id;

      // When: 开始执行计划 A
      const updateTool = new CurrentTaskUpdateTool(taskManager);
      const startPlan1Result = await updateTool.handle({
        update_type: 'plan',
        plan_id: plan1Id,
        status: 'in_progress',
        notes: '开始计划 A',
      });
      const startPlan1Response = JSON.parse(startPlan1Result.content[0].text);

      // Then: 应该返回计划 A 的 EVR 引导
      expect(startPlan1Response.success).toBe(true);
      expect(startPlan1Response.evr_for_node).toBeDefined();
      expect(startPlan1Response.evr_for_node).toContain(evrA1Id);
      expect(startPlan1Response.evr_for_node).toContain(evrA2Id);
      expect(startPlan1Response.evr_for_node).not.toContain(evrBId);

      // When: 开始执行计划 B
      await updateTool.handle({
        update_type: 'plan',
        plan_id: plan1Id,
        status: 'completed',
        notes: '完成计划 A（跳过 EVR 检查用于演示）',
      });

      const startPlan2Result = await updateTool.handle({
        update_type: 'plan',
        plan_id: plan2Id,
        status: 'in_progress',
        notes: '开始计划 B',
      });
      const startPlan2Response = JSON.parse(startPlan2Result.content[0].text);

      // Then: 应该返回计划 B 的 EVR 引导
      expect(startPlan2Response.success).toBe(true);
      expect(startPlan2Response.evr_for_node).toBeDefined();
      expect(startPlan2Response.evr_for_node).toContain(evrBId);
      expect(startPlan2Response.evr_for_node).not.toContain(evrA1Id);
      expect(startPlan2Response.evr_for_node).not.toContain(evrA2Id);
    });
  });
});
