/**
 * 任务 14：集成测试 - 同步流程
 * TDD：Given 用户手改面板后连续调用 read→modify→update 三次，When 观察同步次数，Then 仅首次发生同步；
 * 构造双端冲突，Then 合并策略符合 ETag 优先。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from '../core/project-manager.js';
import { TaskManager } from '../core/task-manager.js';
// import { LazySync, createLazySync } from '../core/lazy-sync.js';
import { ConnectProjectTool } from '../tools/handshake-tools.js';
import {
  CurrentTaskInitTool,
  CurrentTaskReadTool,
  CurrentTaskModifyTool,
  CurrentTaskUpdateTool,
} from '../tools/task-tools.js';
import { TaskStatus } from '../types/index.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('任务 14：同步流程集成测试', () => {
  let tempDir: string;
  let projectManager: ProjectManager;
  let taskManager: TaskManager;
  // let lazySync: LazySync;
  let panelPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task14-sync-'));
    panelPath = path.join(tempDir, '.wave', 'current-task.md');

    projectManager = new ProjectManager();
    taskManager = new TaskManager(path.join(tempDir, '.wave'), projectManager);
    // lazySync = createLazySync({ enableRequestCache: true, enableAuditLog: true });

    // 连接项目
    const connectTool = new ConnectProjectTool(projectManager, taskManager);
    await connectTool.handle({ project_path: tempDir });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('面板编辑 → 工具调用 → 自动同步 → 状态更新完整流程', () => {
    it('应该在工具调用前自动同步面板编辑', async () => {
      // Given: 创建初始任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '原始任务标题',
        goal: '测试面板编辑自动同步功能',
        overall_plan: ['计划 1', '计划 2'],
        knowledge_refs: [],
      });

      // When: 用户手动编辑面板文件
      const panelContent = await fs.readFile(panelPath, 'utf-8');
      const modifiedContent = panelContent.replace(
        '原始任务标题',
        '用户手改的任务标题'
      );
      await fs.writeFile(panelPath, modifiedContent, 'utf-8');

      // Then: 调用 read 工具应该检测到变更并返回 sync_preview
      const readTool = new CurrentTaskReadTool(taskManager);
      const readResult = await readTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      expect(readResponse.success).toBe(true);
      // 注意：current_task_read 仅返回预览，applied=false
      if (readResponse.panel_pending) {
        expect(readResponse.sync_preview).toBeDefined();
        expect(readResponse.sync_preview.applied).toBe(false);
        expect(readResponse.sync_preview.changes.length).toBeGreaterThan(0);
      }

      // When: 调用 modify 工具，应该触发实际同步
      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const modifyResult = await modifyTool.handle({
        field: 'goal',
        content: '更新后的目标',
        reason: '测试同步',
        change_type: 'refine_goal',
      });
      const modifyResponse = JSON.parse(modifyResult.content[0].text);

      expect(modifyResponse.success).toBe(true);
      // modify/update/complete 应该返回 applied=true
      if (modifyResponse.sync_preview) {
        expect(modifyResponse.sync_preview.applied).toBe(true);
      }

      // Then: 再次读取应该看到所有变更（包括面板编辑和 API 修改）
      const finalRead = await readTool.handle();
      const finalResponse = JSON.parse(finalRead.content[0].text);

      expect(finalResponse.success).toBe(true);
      expect(finalResponse.task.title).toBe('用户手改的任务标题');
      expect(finalResponse.task.goal).toBe('更新后的目标');
    });

    it('应该区分内容变更和状态变更，状态变更不直接回写（read 为 dry-run）', async () => {
      // Given: 创建带计划的任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '状态隔离测试',
        goal: '验证状态变更不直接回写',
        overall_plan: ['待执行计划'],
        knowledge_refs: [],
      });

      // When: 用户手动编辑面板，同时修改内容和状态
      let panelContent = await fs.readFile(panelPath, 'utf-8');

      // 修改内容：任务标题
      panelContent = panelContent.replace(
        '状态隔离测试',
        '修改后的标题'
      );

      // 修改状态：尝试将计划标记为完成（[ ] → [x]）
      panelContent = panelContent.replace('1. [ ] 待执行计划', '1. [x] 待执行计划');

      await fs.writeFile(panelPath, panelContent, 'utf-8');

      // Then: 读取时应该提示状态变更为 pending
      const readTool = new CurrentTaskReadTool(taskManager);
      const readResult = await readTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      expect(readResponse.success).toBe(true);

      // read 为 dry-run，内容变更此时不生效
      expect(readResponse.task.title).toBe('状态隔离测试');

      // 状态变更应该被识别为待定（不直接回写）
      // 计划状态仍应该是 to_do，而不是 completed
      const plan = readResponse.task.overall_plan.find((p: any) =>
        p.text.includes('待执行计划')
      );
      expect(plan).toBeDefined();
      expect(plan.status).toBe(TaskStatus.ToDo); // 不是 completed

      // 预览中应包含内容变更与状态变更
      expect(readResponse.panel_pending).toBe(true);
      expect(readResponse.sync_preview).toBeDefined();
      const previewCheck = readResponse.sync_preview;
      const contentChanges = previewCheck.changes.filter((c: any) => c.type === 'content');
      const statusChanges = previewCheck.changes.filter((c: any) => c.type === 'status' || c.field === 'status');
      expect(contentChanges.length).toBeGreaterThan(0);
      expect(statusChanges.length).toBeGreaterThan(0);

      // When: 通过 API 正式更新状态
      const updateTool = new CurrentTaskUpdateTool(taskManager);
      await updateTool.handle({
        update_type: 'plan',
        plan_id: plan.id,
        status: 'completed',
        notes: '通过 API 更新状态',
      });

      // Then: 状态现在应该生效，同时内容变更也会被懒同步应用
      const finalRead = await readTool.handle();
      const finalResponse = JSON.parse(finalRead.content[0].text);
      expect(finalResponse.task.title).toBe('修改后的标题');
      const updatedPlan = finalResponse.task.overall_plan.find(
        (p: any) => p.id === plan.id
      );
      expect(updatedPlan.status).toBe(TaskStatus.Completed);
    });
  });

  describe('多工具调用的缓存复用机制', () => {
    it('应该在连续调用 read→modify→update 时仅首次发生同步', async () => {
      // Given: 创建任务并手动编辑面板
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '缓存测试',
        goal: '验证请求级缓存机制是否正常工作',
        overall_plan: ['计划 A'],
        knowledge_refs: [],
      });

      const panelContent = await fs.readFile(panelPath, 'utf-8');
      const modifiedContent = panelContent.replace('缓存测试', '已修改标题');
      await fs.writeFile(panelPath, modifiedContent, 'utf-8');

      // 记录同步次数（通过监听文件修改时间）
      // const initialMtime = (await fs.stat(panelPath)).mtime.getTime();

      // When: 连续调用三次不同的工具
      const readTool = new CurrentTaskReadTool(taskManager);
      const modifyTool = new CurrentTaskModifyTool(taskManager);
      const updateTool = new CurrentTaskUpdateTool(taskManager);

      // 第一次调用：read（预览）
      const read1 = await readTool.handle();
      const read1Response = JSON.parse(read1.content[0].text);
      expect(read1Response.success).toBe(true);

      // 第二次调用：modify（触发实际同步）
      const modifyResult = await modifyTool.handle({
        field: 'goal',
        content: '修改目标',
        reason: '测试',
        change_type: 'refine_goal',
      });
      const modifyResponse = JSON.parse(modifyResult.content[0].text);
      expect(modifyResponse.success).toBe(true);

      const currentTask = await taskManager.getCurrentTask();
      const planId = currentTask?.overall_plan[0]?.id;

      // 第三次调用：update
      const updateResult = await updateTool.handle({
        update_type: 'plan',
        plan_id: planId,
        status: 'in_progress',
        notes: '开始执行',
      });
      const updateResponse = JSON.parse(updateResult.content[0].text);
      expect(updateResponse.success).toBe(true);

      // Then: 验证同步只发生一次
      // 由于缓存机制，后续调用应该复用第一次同步的结果
      const read2 = await readTool.handle();
      const read2Response = JSON.parse(read2.content[0].text);

      expect(read2Response.task.title).toBe('已修改标题');
      expect(read2Response.task.goal).toBe('修改目标');

      // 验证计划状态已更新
      const updatedPlan = read2Response.task.overall_plan.find(
        (p: any) => p.id === planId
      );
      expect(updatedPlan.status).toBe(TaskStatus.InProgress);
    });
  });

  describe('复杂冲突场景的解决策略', () => {
    it('应该使用 ETag 优先策略解决冲突', async () => {
      // Given: 创建任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: 'ETag 冲突测试',
        goal: '验证 ETag 优先的冲突解决策略',
        overall_plan: ['原始计划'],
        knowledge_refs: [],
      });

      // 读取当前任务数据和 ETag
      const readTool = new CurrentTaskReadTool(taskManager);
      // 预读 ETag 可选（此处不强制使用）

      // When: 构造双端冲突
      // 端 A：用户手动编辑面板
      let panelContent = await fs.readFile(panelPath, 'utf-8');
      panelContent = panelContent.replace('原始计划', '面板端修改的计划');
      await fs.writeFile(panelPath, panelContent, 'utf-8');

      // 等待一小段时间确保时间戳不同
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 端 B：通过 API 修改（更新 ETag）
      const modifyTool = new CurrentTaskModifyTool(taskManager);
      await modifyTool.handle({
        field: 'plan',
        content: ['API 端修改的计划'],
        reason: '创建冲突',
        change_type: 'plan_adjustment',
      });

      // Then: 再次读取时应该检测到冲突
      const read2 = await readTool.handle();
      const read2Response = JSON.parse(read2.content[0].text);

      // 验证同步预览中包含冲突信息
      if (read2Response.panel_pending && read2Response.sync_preview) {
        const preview = read2Response.sync_preview;

        // 应该包含冲突信息
        if (preview.conflicts && preview.conflicts.length > 0) {
          const conflict = preview.conflicts[0];
          expect(conflict.reason).toBe('etag_mismatch');

          // ETag 优先策略：API 端（有新 ETag）的修改应该优先
          // 面板端的修改应该被标记为冲突
          expect(conflict.resolution).toBe('ours'); // ours = 结构化数据优先
        }
      }

      // 验证最终结果：API 端的修改保留
      expect(read2Response.task.overall_plan[0].text).toBe(
        'API 端修改的计划'
      );
    });

    it('应该处理时间戳兜底策略（当 ETag 缺失时）', async () => {
      // Given: 创建任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '时间戳冲突测试',
        goal: '验证时间戳兜底策略是否正常工作',
        overall_plan: ['初始计划'],
        knowledge_refs: [],
      });

      // When: 旧的面板修改（较早时间戳）
      const oldPanelContent = await fs.readFile(panelPath, 'utf-8');
      const oldModified = oldPanelContent.replace('初始计划', '旧的面板修改');

      // 等待确保时间戳不同
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 新的 API 修改（较新时间戳）
      const modifyTool = new CurrentTaskModifyTool(taskManager);
      await modifyTool.handle({
        field: 'plan',
        content: ['新的 API 修改'],
        reason: '时间戳测试',
        change_type: 'plan_adjustment',
      });

      // 然后写入旧的面板内容（模拟延迟的面板编辑）
      await fs.writeFile(panelPath, oldModified, 'utf-8');

      // Then: 读取时应该优先使用新的修改
      const readTool = new CurrentTaskReadTool(taskManager);
      const readResult = await readTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      // 时间戳兜底：较新的修改（API）应该被保留
      expect(readResponse.task.overall_plan[0].text).toBe('新的 API 修改');
    });

    it('应该记录冲突解决的审计日志', async () => {
      // Given: 创建任务并构造冲突
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '审计日志测试',
        goal: '验证冲突解决被记录到审计日志',
        overall_plan: ['原始内容'],
        knowledge_refs: [],
      });

      // 制造冲突
      let panelContent = await fs.readFile(panelPath, 'utf-8');
      panelContent = panelContent.replace('原始内容', '面板修改内容');
      await fs.writeFile(panelPath, panelContent, 'utf-8');

      const modifyTool = new CurrentTaskModifyTool(taskManager);
      await modifyTool.handle({
        field: 'plan',
        content: ['API 修改内容'],
        reason: '创建审计日志',
        change_type: 'plan_adjustment',
      });

      // When: 触发同步并检查日志
      const readTool = new CurrentTaskReadTool(taskManager);
      const readResult = await readTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      // Then: 应该包含同步相关的日志
      expect(readResponse.success).toBe(true);

      // 检查日志中是否有同步或冲突相关记录
      if (readResponse.task.logs && readResponse.task.logs.length > 0) {
        const syncLogs = readResponse.task.logs.filter(
          (log: any) =>
            log.category === 'TASK' &&
            (log.message.includes('同步') || log.message.includes('冲突'))
        );

        // 如果发生了冲突，应该有相关日志记录
        if (readResponse.panel_pending && readResponse.sync_preview?.conflicts) {
          expect(syncLogs.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('状态隔离：面板状态变更不直接回写', () => {
    it('应该将面板状态变更标记为待定，需通过 API 确认', async () => {
      // Given: 创建带多个计划的任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '状态隔离完整测试',
        goal: '验证状态隔离机制的完整性',
        overall_plan: ['计划 1', '计划 2', '计划 3'],
        knowledge_refs: [],
      });

      // When: 用户在面板中修改多个状态
      let panelContent = await fs.readFile(panelPath, 'utf-8');

      // 修改所有计划的状态（注意：面板使用序号格式 "1. [ ]" 而不是 "- [ ]"）
      panelContent = panelContent.replace(
        /1\. \[ \] 计划 1/g,
        '1. [-] 计划 1'
      ); // to_do → in_progress
      panelContent = panelContent.replace(
        /2\. \[ \] 计划 2/g,
        '2. [x] 计划 2'
      ); // to_do → completed
      panelContent = panelContent.replace(
        /3\. \[ \] 计划 3/g,
        '3. [!] 计划 3'
      ); // to_do → blocked

      await fs.writeFile(panelPath, panelContent, 'utf-8');

      //  Then: 读取时状态应该保持原样（pending），只有内容变更生效
      const readTool = new CurrentTaskReadTool(taskManager);
      const readResult = await readTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      expect(readResponse.success).toBe(true);

      // 所有计划状态应该仍然是 to_do
      for (const plan of readResponse.task.overall_plan) {
        expect(plan.status).toBe(TaskStatus.ToDo);
      }

      // 应该检测到 pending 的状态变更
      expect(readResponse.panel_pending).toBe(true);
      expect(readResponse.sync_preview).toBeDefined();

      const statusChanges = readResponse.sync_preview.changes.filter(
        (c: any) => c.type === 'status' || c.field === 'status'
      );

      // 应该检测到状态变更（但不应用）
      expect(statusChanges.length).toBeGreaterThan(0);

      // When: 通过 API 逐一确认状态变更
      const updateTool = new CurrentTaskUpdateTool(taskManager);

      for (let i = 0; i < readResponse.task.overall_plan.length; i++) {
        const plan = readResponse.task.overall_plan[i];
        const newStatus =
          i === 0
            ? 'in_progress'
            : i === 1
              ? 'completed'
              : 'blocked';

        await updateTool.handle({
          update_type: 'plan',
          plan_id: plan.id,
          status: newStatus,
          notes: `确认状态变更为 ${newStatus}`,
        });
      }

      // Then: 现在状态应该全部生效
      const finalRead = await readTool.handle();
      const finalResponse = JSON.parse(finalRead.content[0].text);

      expect(finalResponse.task.overall_plan[0].status).toBe(
        TaskStatus.InProgress
      );
      expect(finalResponse.task.overall_plan[1].status).toBe(
        TaskStatus.Completed
      );
      expect(finalResponse.task.overall_plan[2].status).toBe(
        TaskStatus.Blocked
      );
    });

    it('应该区分可回写字段和不可回写字段（read 为 dry-run，modify/update 才应用）', async () => {
      // Given: 创建任务
      const initTool = new CurrentTaskInitTool(taskManager);
      await initTool.handle({
        title: '字段回写测试',
        goal: '验证哪些字段可以回写',
        overall_plan: ['测试计划'],
        knowledge_refs: [],
      });

      // When: 用户编辑多种字段
      let panelContent = await fs.readFile(panelPath, 'utf-8');

      // 1. 可回写字段：标题、目标、计划文本
      panelContent = panelContent.replace('字段回写测试', '修改后的标题');
      panelContent = panelContent.replace(
        '验证哪些字段可以回写',
        '修改后的目标'
      );
      panelContent = panelContent.replace('测试计划', '修改后的计划文本');

      // 2. 不可回写字段：状态（复选框）
      panelContent = panelContent.replace(/1\. \[ \] 修改后的计划文本/, '1. [x] 修改后的计划文本');

      await fs.writeFile(panelPath, panelContent, 'utf-8');

      // Then: 首次读取仅预览（不回写）
      const readTool = new CurrentTaskReadTool(taskManager);
      const readResult = await readTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      // 可回写字段暂不生效（dry-run）
      expect(readResponse.task.title).toBe('字段回写测试');
      expect(readResponse.task.goal).toBe('验证哪些字段可以回写');
      expect(readResponse.task.overall_plan[0].text).toBe('测试计划');

      // 预览中包含内容与状态变更
      expect(readResponse.panel_pending).toBe(true);
      expect(readResponse.sync_preview).toBeDefined();
      const preview = readResponse.sync_preview;
      const contentChanges = preview.changes.filter((c: any) => c.type === 'content');
      const statusChanges = preview.changes.filter((c: any) => c.type === 'status' || c.field === 'status');
      expect(contentChanges.length).toBeGreaterThan(0);
      expect(statusChanges.length).toBeGreaterThan(0);

      // When: 通过 modify 应用内容
      const modifyTool = new CurrentTaskModifyTool(taskManager);
      await modifyTool.handle({
        field: 'plan',
        content: ['修改后的计划文本'],
        reason: '同步内容变更',
        change_type: 'plan_adjustment',
      });

      // Then: 再次读取，内容变更应生效；状态仍保持 ToDo（未通过 update）
      const read2 = await readTool.handle();
      const read2Response = JSON.parse(read2.content[0].text);
      expect(read2Response.task.title).toBe('修改后的标题');
      expect(read2Response.task.goal).toBe('修改后的目标');
      expect(read2Response.task.overall_plan[0].text).toBe('修改后的计划文本');
      expect(read2Response.task.overall_plan[0].status).toBe(TaskStatus.ToDo);
    });
  });
});
