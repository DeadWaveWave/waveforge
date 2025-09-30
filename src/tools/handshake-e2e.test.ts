/**
 * 握手流程端到端测试
 * 测试完整的握手流程，包括错误路径和恢复路径
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from '../core/project-manager.js';
import { TaskManager } from '../core/task-manager.js';
import {
  ProjectInfoTool,
  ConnectProjectTool,
  HandshakeChecker,
} from './handshake-tools.js';
import {
  CurrentTaskInitTool,
  CurrentTaskReadTool,
  CurrentTaskUpdateTool,
  CurrentTaskModifyTool,
  CurrentTaskCompleteTool as _CurrentTaskCompleteTool,
  CurrentTaskLogTool,
} from './task-tools.js';
import { ErrorCode } from '../types/index.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('握手流程端到端测试', () => {
  let tempDir: string;
  let projectManager: ProjectManager;
  let taskManager: TaskManager;
  let handshakeChecker: HandshakeChecker;
  let projectInfoTool: ProjectInfoTool;
  let connectProjectTool: ConnectProjectTool;

  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'handshake-e2e-'));

    // 初始化管理器
    projectManager = new ProjectManager();
    taskManager = new TaskManager(path.join(tempDir, '.wave'), projectManager);

    // 初始化工具
    handshakeChecker = new HandshakeChecker(projectManager, taskManager);
    projectInfoTool = new ProjectInfoTool(projectManager, taskManager);
    connectProjectTool = new ConnectProjectTool(projectManager, taskManager);
  });

  afterEach(async () => {
    // 清理临时目录
    await fs.remove(tempDir);
  });

  describe('完整用户工作流', () => {
    it('应该支持完整的从零开始的工作流', async () => {
      // 1. 用户首次启动，调用 project_info 检查状态
      const step1 = await projectInfoTool.handle();
      const step1Response = JSON.parse(step1.content[0].text);

      expect(step1Response.success).toBe(true);
      expect(step1Response.data.connected).toBe(false);
      expect(step1Response.data.next_action.tool).toBe('connect_project');

      // 2. 用户尝试直接调用任务工具（应该被阻止）
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const createToolWithCheck = (tool: any) => ({
        async handle(args?: any) {
          const check = await handshakeChecker.checkActiveTask();
          if (check) return check;
          return await tool.handle(args);
        },
      });

      const checkedReadTool = createToolWithCheck(taskReadTool);
      const step2 = await checkedReadTool.handle();
      const step2Response = JSON.parse(step2.content[0].text);

      expect(step2Response.success).toBe(false);
      expect(step2Response.error_code).toBe(ErrorCode.NO_PROJECT_BOUND);

      // 3. 用户按照指引连接项目
      const testProjectPath = path.join(tempDir, 'my-project');
      await fs.ensureDir(testProjectPath);

      const step3 = await connectProjectTool.handle({
        project_path: testProjectPath,
      });
      const step3Response = JSON.parse(step3.content[0].text);

      expect(step3Response.success).toBe(true);
      expect(step3Response.data.connected).toBe(true);

      // 4. 用户再次检查项目状态
      const step4 = await projectInfoTool.handle();
      const step4Response = JSON.parse(step4.content[0].text);

      expect(step4Response.success).toBe(true);
      expect(step4Response.data.connected).toBe(true);
      expect(step4Response.data.active_task).toBeNull();

      // 5. 用户尝试读取任务（应该提示没有活动任务）
      const step5 = await checkedReadTool.handle();
      const step5Response = JSON.parse(step5.content[0].text);

      expect(step5Response.success).toBe(false);
      expect(step5Response.error_code).toBe(ErrorCode.NO_ACTIVE_TASK);

      // 6. 用户按照指引创建任务
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      const createInitToolWithCheck = (tool: any) => ({
        async handle(args?: any) {
          const check = await handshakeChecker.checkProjectConnection();
          if (check) return check;
          return await tool.handle(args);
        },
      });

      const checkedInitTool = createInitToolWithCheck(taskInitTool);
      const step6 = await checkedInitTool.handle({
        title: '我的第一个任务',
        goal: '这是一个测试任务的验收标准和成功指标，用于验证握手流程',
        overall_plan: ['完成基础设置', '实现核心功能', '编写测试'],
        knowledge_refs: [],
      });
      const step6Response = JSON.parse(step6.content[0].text);

      expect(step6Response.success).toBe(true);
      expect(step6Response.task_id).toBeDefined();

      // 7. 用户现在可以正常使用所有任务工具
      const step7 = await checkedReadTool.handle();
      const step7Response = JSON.parse(step7.content[0].text);

      expect(step7Response.success).toBe(true);
      expect(step7Response.task.title).toBe('我的第一个任务');

      // 8. 用户可以更新任务状态
      const taskUpdateTool = new CurrentTaskUpdateTool(taskManager);
      const checkedUpdateTool = createToolWithCheck(taskUpdateTool);

      const step8 = await checkedUpdateTool.handle({
        update_type: 'plan',
        plan_id: step7Response.task.overall_plan[0].id,
        status: 'in_progress',
        notes: '开始执行第一个计划',
      });
      const step8Response = JSON.parse(step8.content[0].text);

      expect(step8Response.success).toBe(true);

      // 9. 最终验证项目信息包含活动任务
      const step9 = await projectInfoTool.handle();
      const step9Response = JSON.parse(step9.content[0].text);

      expect(step9Response.success).toBe(true);
      expect(step9Response.data.connected).toBe(true);
      expect(step9Response.data.active_task).toBeDefined();
      expect(step9Response.data.active_task.title).toBe('我的第一个任务');
    });
  });

  describe('错误恢复场景', () => {
    it('应该处理项目连接失效的情况', async () => {
      // 1. 正常连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      // 2. 创建任务
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      await taskInitTool.handle({
        title: '测试任务',
        goal: '这是一个测试任务的验收标准和成功指标',
        overall_plan: [],
        knowledge_refs: [],
      });

      // 3. 验证正常状态
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const normalRead = await taskReadTool.handle();
      const normalResponse = JSON.parse(normalRead.content[0].text);
      expect(normalResponse.success).toBe(true);

      // 4. 模拟项目连接失效（清除项目绑定）
      projectManager.clearBinding();

      // 5. 再次尝试读取任务（应该被阻止）
      const createToolWithCheck = (tool: any) => ({
        async handle(args?: any) {
          const check = await handshakeChecker.checkActiveTask();
          if (check) return check;
          return await tool.handle(args);
        },
      });

      const checkedReadTool = createToolWithCheck(taskReadTool);
      const failedRead = await checkedReadTool.handle();
      const failedResponse = JSON.parse(failedRead.content[0].text);

      expect(failedResponse.success).toBe(false);
      expect(failedResponse.error_code).toBe(ErrorCode.NO_PROJECT_BOUND);

      // 6. 重新连接项目后应该恢复正常
      await connectProjectTool.handle({ project_path: testProjectPath });

      const recoveredRead = await checkedReadTool.handle();
      const recoveredResponse = JSON.parse(recoveredRead.content[0].text);

      expect(recoveredResponse.success).toBe(true);
      expect(recoveredResponse.task.title).toBe('测试任务');
    });

    it('应该处理无效项目路径的恢复', async () => {
      // 1. 尝试连接无效路径
      const invalidPath = path.join(tempDir, 'non-existent');
      const failedConnect = await connectProjectTool.handle({
        project_path: invalidPath,
      });
      const failedResponse = JSON.parse(failedConnect.content[0].text);

      expect(failedResponse.success).toBe(false);
      expect(failedResponse.error_code).toBe(ErrorCode.INVALID_ROOT);
      expect(failedResponse.recovery).toBeDefined();

      // 2. 按照恢复指引使用正确路径
      const validPath = path.join(tempDir, 'valid-project');
      await fs.ensureDir(validPath);

      const successConnect = await connectProjectTool.handle({
        project_path: validPath,
      });
      const successResponse = JSON.parse(successConnect.content[0].text);

      expect(successResponse.success).toBe(true);
      expect(successResponse.data.connected).toBe(true);

      // 3. 验证项目信息正确
      const projectInfo = await projectInfoTool.handle();
      const infoResponse = JSON.parse(projectInfo.content[0].text);

      expect(infoResponse.success).toBe(true);
      expect(infoResponse.data.connected).toBe(true);
      expect(infoResponse.data.project.root).toBe(validPath);
    });
  });

  describe('多工具协作场景', () => {
    it('应该支持多个工具的协作使用', async () => {
      // 1. 设置项目和任务
      const testProjectPath = path.join(tempDir, 'collab-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      const taskInitTool = new CurrentTaskInitTool(taskManager);
      await taskInitTool.handle({
        title: '协作测试任务',
        goal: '测试多个工具的协作使用场景和握手检查',
        overall_plan: ['设计阶段', '开发阶段', '测试阶段'],
        knowledge_refs: [],
      });

      // 2. 创建带握手检查的工具包装器
      const createToolWithCheck = (tool: any) => ({
        async handle(args?: any) {
          const check = await handshakeChecker.checkActiveTask();
          if (check) return check;
          return await tool.handle(args);
        },
      });

      const taskReadTool = createToolWithCheck(
        new CurrentTaskReadTool(taskManager)
      );
      const taskUpdateTool = createToolWithCheck(
        new CurrentTaskUpdateTool(taskManager)
      );
      const taskModifyTool = createToolWithCheck(
        new CurrentTaskModifyTool(taskManager)
      );
      const taskLogTool = createToolWithCheck(
        new CurrentTaskLogTool(taskManager)
      );

      // 3. 读取任务状态
      const readResult = await taskReadTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);
      expect(readResponse.success).toBe(true);

      // 4. 修改任务内容
      const modifyResult = await taskModifyTool.handle({
        field: 'goal',
        content:
          '更新后的验收标准：测试多个工具的协作使用场景和握手检查，确保所有工具都能正常工作',
        reason: '完善任务目标描述',
        change_type: 'refine_goal',
      });
      const modifyResponse = JSON.parse(modifyResult.content[0].text);
      expect(modifyResponse.success).toBe(true);

      // 5. 更新计划状态
      const updateResult = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_id: readResponse.task.overall_plan[0].id,
        status: 'in_progress',
        notes: '开始设计阶段',
      });
      const updateResponse = JSON.parse(updateResult.content[0].text);
      expect(updateResponse.success).toBe(true);

      // 6. 记录日志
      const logResult = await taskLogTool.handle({
        category: 'discussion',
        action: 'update',
        message: '多工具协作测试进行中',
        notes: '验证所有工具都能通过握手检查正常工作',
      });
      const logResponse = JSON.parse(logResult.content[0].text);
      expect(logResponse.success).toBe(true);

      // 7. 最终验证所有更改都生效
      const finalRead = await taskReadTool.handle();
      const finalResponse = JSON.parse(finalRead.content[0].text);

      expect(finalResponse.success).toBe(true);
      expect(finalResponse.task.goal).toContain('更新后的验收标准');
      expect(finalResponse.task.overall_plan[0].status).toBe('in_progress');
      expect(finalResponse.task.logs.length).toBeGreaterThan(1);
    });
  });

  describe('边界情况处理', () => {
    it('应该处理并发握手检查', async () => {
      // 模拟多个工具同时进行握手检查
      const checks = await Promise.all([
        handshakeChecker.checkProjectConnection(),
        handshakeChecker.checkProjectConnection(),
        handshakeChecker.checkProjectConnection(),
      ]);

      // 所有检查都应该返回相同的结果
      for (const check of checks) {
        expect(check).toBeDefined();
        const response = JSON.parse(check!.content[0].text);
        expect(response.error_code).toBe(ErrorCode.NO_PROJECT_BOUND);
      }
    });

    it('应该处理快速连接和断开连接', async () => {
      const testProjectPath = path.join(tempDir, 'rapid-test');
      await fs.ensureDir(testProjectPath);

      // 快速连接
      const connectResult = await connectProjectTool.handle({
        project_path: testProjectPath,
      });
      expect(JSON.parse(connectResult.content[0].text).success).toBe(true);

      // 立即检查状态
      const infoResult = await projectInfoTool.handle();
      expect(JSON.parse(infoResult.content[0].text).data.connected).toBe(true);

      // 断开连接
      projectManager.clearBinding();

      // 立即检查状态
      const checkResult = await handshakeChecker.checkProjectConnection();
      expect(checkResult).toBeDefined();
      expect(JSON.parse(checkResult!.content[0].text).error_code).toBe(
        ErrorCode.NO_PROJECT_BOUND
      );
    });
  });
});
