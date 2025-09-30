/**
 * 握手流程集成测试
 * 测试完整的握手流程和强制检查机制
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
} from './task-tools.js';
import { ErrorCode } from '../types/index.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('握手流程集成测试', () => {
  let tempDir: string;
  let projectManager: ProjectManager;
  let taskManager: TaskManager;
  let handshakeChecker: HandshakeChecker;
  let projectInfoTool: ProjectInfoTool;
  let connectProjectTool: ConnectProjectTool;

  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'handshake-integration-')
    );

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

  describe('完整握手流程', () => {
    it('应该按正确顺序执行握手流程', async () => {
      // 1. 首先调用 project_info 检查状态
      const infoResult1 = await projectInfoTool.handle();
      const infoResponse1 = JSON.parse(infoResult1.content[0].text);

      expect(infoResponse1.success).toBe(true);
      expect(infoResponse1.data.connected).toBe(false);
      expect(infoResponse1.data.next_action.tool).toBe('connect_project');

      // 2. 连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);

      const connectResult = await connectProjectTool.handle({
        project_path: testProjectPath,
      });
      const connectResponse = JSON.parse(connectResult.content[0].text);

      expect(connectResponse.success).toBe(true);
      expect(connectResponse.data.connected).toBe(true);
      expect(connectResponse.data.project.root).toBe(testProjectPath);

      // 3. 再次调用 project_info 确认连接状态
      const infoResult2 = await projectInfoTool.handle();
      const infoResponse2 = JSON.parse(infoResult2.content[0].text);

      expect(infoResponse2.success).toBe(true);
      expect(infoResponse2.data.connected).toBe(true);
      expect(infoResponse2.data.project.root).toBe(testProjectPath);
      expect(infoResponse2.data.active_task).toBeNull();

      // 4. 现在可以创建任务
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      const initResult = await taskInitTool.handle({
        title: '测试任务',
        goal: '这是一个测试任务的验收标准和成功指标',
        overall_plan: [],
        knowledge_refs: [],
      });
      const initResponse = JSON.parse(initResult.content[0].text);

      expect(initResponse.success).toBe(true);
      expect(initResponse.task_id).toBeDefined();

      // 5. 最后确认可以读取任务
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const readResult = await taskReadTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      expect(readResponse.success).toBe(true);
      expect(readResponse.task.title).toBe('测试任务');
    });
  });

  describe('强制握手检查', () => {
    it('未连接时应阻止任务工具调用', async () => {
      // 创建任务工具实例
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const taskUpdateTool = new CurrentTaskUpdateTool(taskManager);

      // 模拟带握手检查的工具调用
      const createToolWithHandshakeCheck = (tool: any) => ({
        async handle(args?: any) {
          const connectionCheck =
            await handshakeChecker.checkProjectConnection();
          if (connectionCheck) {
            return connectionCheck;
          }
          return await tool.handle(args);
        },
      });

      const checkedInitTool = createToolWithHandshakeCheck(taskInitTool);
      const checkedReadTool = createToolWithHandshakeCheck(taskReadTool);
      const checkedUpdateTool = createToolWithHandshakeCheck(taskUpdateTool);

      // 测试 current_task_init
      const initResult = await checkedInitTool.handle({
        title: '测试任务',
        goal: '测试目标',
      });
      const initResponse = JSON.parse(initResult.content[0].text);

      expect(initResponse.success).toBe(false);
      expect(initResponse.error_code).toBe(ErrorCode.NO_PROJECT_BOUND);
      expect(initResponse.recovery.next_action).toBe('connect_project');

      // 测试 current_task_read
      const readResult = await checkedReadTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      expect(readResponse.success).toBe(false);
      expect(readResponse.error_code).toBe(ErrorCode.NO_PROJECT_BOUND);

      // 测试 current_task_update
      const updateResult = await checkedUpdateTool.handle({
        update_type: 'plan',
        plan_id: 'test-plan',
        status: 'completed',
      });
      const updateResponse = JSON.parse(updateResult.content[0].text);

      expect(updateResponse.success).toBe(false);
      expect(updateResponse.error_code).toBe(ErrorCode.NO_PROJECT_BOUND);
    });

    it('连接后但无活动任务时应阻止需要任务的工具调用', async () => {
      // 先连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      // 创建需要活动任务的工具
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const taskUpdateTool = new CurrentTaskUpdateTool(taskManager);

      // 模拟带握手检查的工具调用
      const createToolWithTaskCheck = (tool: any) => ({
        async handle(args?: any) {
          const taskCheck = await handshakeChecker.checkActiveTask();
          if (taskCheck) {
            return taskCheck;
          }
          return await tool.handle(args);
        },
      });

      const checkedReadTool = createToolWithTaskCheck(taskReadTool);
      const checkedUpdateTool = createToolWithTaskCheck(taskUpdateTool);

      // 测试 current_task_read
      const readResult = await checkedReadTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      expect(readResponse.success).toBe(false);
      expect(readResponse.error_code).toBe(ErrorCode.NO_ACTIVE_TASK);
      expect(readResponse.recovery.next_action).toBe('current_task_init');

      // 测试 current_task_update
      const updateResult = await checkedUpdateTool.handle({
        update_type: 'plan',
        plan_id: 'test-plan',
        status: 'completed',
      });
      const updateResponse = JSON.parse(updateResult.content[0].text);

      expect(updateResponse.success).toBe(false);
      expect(updateResponse.error_code).toBe(ErrorCode.NO_ACTIVE_TASK);
    });

    it('连接且有活动任务时应允许所有工具调用', async () => {
      // 1. 连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      // 2. 创建活动任务
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      await taskInitTool.handle({
        title: '测试任务',
        goal: '这是一个测试任务的验收标准和成功指标',
        overall_plan: [],
        knowledge_refs: [],
      });

      // 3. 测试所有工具都可以正常调用
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const taskUpdateTool = new CurrentTaskUpdateTool(taskManager);

      // 模拟带握手检查的工具调用
      const createToolWithTaskCheck = (tool: any) => ({
        async handle(args?: any) {
          const taskCheck = await handshakeChecker.checkActiveTask();
          if (taskCheck) {
            return taskCheck;
          }
          return await tool.handle(args);
        },
      });

      const checkedReadTool = createToolWithTaskCheck(taskReadTool);
      const checkedUpdateTool = createToolWithTaskCheck(taskUpdateTool);

      // 测试 current_task_read
      const readResult = await checkedReadTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      expect(readResponse.success).toBe(true);
      expect(readResponse.task.title).toBe('测试任务');

      // 测试 current_task_update（由于任务没有计划，我们测试一个会成功的操作）
      // 先添加一个计划
      const modifyTool = new (
        await import('./task-tools.js')
      ).CurrentTaskModifyTool(taskManager);
      await modifyTool.handle({
        field: 'plan',
        content: ['测试计划'],
        reason: '添加测试计划',
        change_type: 'plan_adjustment',
      });

      // 重新读取任务获取计划ID
      const readResult2 = await checkedReadTool.handle();
      const readResponse2 = JSON.parse(readResult2.content[0].text);

      // 现在测试更新计划状态
      const updateResult = await checkedUpdateTool.handle({
        update_type: 'plan',
        plan_id: readResponse2.task.overall_plan[0]?.id,
        status: 'in_progress',
        notes: '开始执行计划',
      });
      const updateResponse = JSON.parse(updateResult.content[0].text);

      expect(updateResponse.success).toBe(true);
    });
  });

  describe('错误恢复路径', () => {
    it('应该提供清晰的错误恢复指引', async () => {
      // 测试 NO_PROJECT_BOUND 错误的恢复指引
      const connectionCheck = await handshakeChecker.checkProjectConnection();
      expect(connectionCheck).toBeDefined();

      const response = JSON.parse(connectionCheck!.content[0].text);
      expect(response.recovery).toBeDefined();
      expect(response.recovery.next_action).toBe('connect_project');
      expect(response.recovery.required_params).toContain('project_path');
      expect(response.recovery.example).toBeDefined();

      // 连接项目后测试 NO_ACTIVE_TASK 错误的恢复指引
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      const taskCheck = await handshakeChecker.checkActiveTask();
      expect(taskCheck).toBeDefined();

      const taskResponse = JSON.parse(taskCheck!.content[0].text);
      expect(taskResponse.recovery).toBeDefined();
      expect(taskResponse.recovery.next_action).toBe('current_task_init');
      expect(taskResponse.recovery.required_params).toContain('title');
      expect(taskResponse.recovery.required_params).toContain('goal');
    });

    it('应该在错误解决后允许正常操作', async () => {
      // 1. 初始状态 - 未连接
      let connectionCheck = await handshakeChecker.checkProjectConnection();
      expect(connectionCheck).toBeDefined();

      // 2. 连接项目 - 解决连接问题
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      // 3. 验证连接问题已解决
      connectionCheck = await handshakeChecker.checkProjectConnection();
      expect(connectionCheck).toBeNull(); // null 表示检查通过

      // 4. 但仍然没有活动任务
      let taskCheck = await handshakeChecker.checkActiveTask();
      expect(taskCheck).toBeDefined();

      // 5. 创建任务 - 解决任务问题
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      await taskInitTool.handle({
        title: '测试任务',
        goal: '这是一个测试任务的验收标准和成功指标',
        overall_plan: [],
        knowledge_refs: [],
      });

      // 6. 验证任务问题已解决
      taskCheck = await handshakeChecker.checkActiveTask();
      expect(taskCheck).toBeNull(); // null 表示检查通过

      // 7. 现在所有工具都应该可以正常使用
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const readResult = await taskReadTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      expect(readResponse.success).toBe(true);
      expect(readResponse.task.title).toBe('测试任务');
    });
  });
});
