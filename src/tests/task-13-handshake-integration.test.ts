/**
 * 任务 13：集成测试 - 握手和连接流程
 * TDD：Given 冷启动会话，When project_info→connect_project→current_task_read，Then 流程通畅；
 * 在任意一步注入错误，Then 能给出可恢复指引。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from '../core/project-manager.js';
import { TaskManager } from '../core/task-manager.js';
import {
  ProjectInfoTool,
  ConnectProjectTool,
  HandshakeChecker,
} from '../tools/handshake-tools.js';
import {
  CurrentTaskInitTool,
  CurrentTaskReadTool,
} from '../tools/task-tools.js';
import { ErrorCode } from '../types/index.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('任务 13：握手和连接流程集成测试', () => {
  let tempDir: string;
  let projectManager: ProjectManager;
  let taskManager: TaskManager;
  let handshakeChecker: HandshakeChecker;
  let projectInfoTool: ProjectInfoTool;
  let connectProjectTool: ConnectProjectTool;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task13-handshake-'));
    projectManager = new ProjectManager();
    taskManager = new TaskManager(path.join(tempDir, '.wave'), projectManager);
    handshakeChecker = new HandshakeChecker(projectManager, taskManager);
    projectInfoTool = new ProjectInfoTool(projectManager, taskManager);
    connectProjectTool = new ConnectProjectTool(projectManager, taskManager);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('完整握手流程：project_info → connect_project → current_task_read', () => {
    it('应该在冷启动会话中按顺序执行完整握手流程', async () => {
      // Given: 冷启动会话（无项目连接，无活动任务）

      // When: Step 1 - 调用 project_info 检查初始状态
      const infoResult1 = await projectInfoTool.handle();
      const infoResponse1 = JSON.parse(infoResult1.content[0].text);

      // Then: 应返回未连接状态，并提示下一步操作
      expect(infoResponse1.success).toBe(true);
      expect(infoResponse1.data.connected).toBe(false);
      expect(infoResponse1.data.project).toBeNull();
      expect(infoResponse1.data.active_task).toBeNull();
      expect(infoResponse1.data.next_action.tool).toBe('connect_project');
      expect(infoResponse1.data.next_action.description).toContain('连接项目');

      // When: Step 2 - 连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);

      const connectResult = await connectProjectTool.handle({
        project_path: testProjectPath,
      });
      const connectResponse = JSON.parse(connectResult.content[0].text);

      // Then: 连接成功，返回项目信息
      expect(connectResponse.success).toBe(true);
      expect(connectResponse.data.connected).toBe(true);
      expect(connectResponse.data.project.root).toBe(testProjectPath);
      expect(connectResponse.data.next_action.tool).toBe('project_info');

      // When: Step 3 - 再次调用 project_info 确认连接状态
      const infoResult2 = await projectInfoTool.handle();
      const infoResponse2 = JSON.parse(infoResult2.content[0].text);

      // Then: 应返回已连接但无活动任务
      expect(infoResponse2.success).toBe(true);
      expect(infoResponse2.data.connected).toBe(true);
      expect(infoResponse2.data.project.root).toBe(testProjectPath);
      expect(infoResponse2.data.active_task).toBeNull();
      expect(infoResponse2.data.next_action.tool).toBe('current_task_init');

      // When: Step 4 - 创建任务
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      const initResult = await taskInitTool.handle({
        title: '测试任务',
        goal: '验证握手流程的完整性和边界错误处理能力',
        overall_plan: ['计划 1', '计划 2'],
        knowledge_refs: [],
      });
      const initResponse = JSON.parse(initResult.content[0].text);

      // Then: 任务创建成功
      expect(initResponse.success).toBe(true);
      expect(initResponse.task_id).toBeDefined();

      // When: Step 5 - 调用 current_task_read 读取任务
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const readResult = await taskReadTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      // Then: 流程通畅，成功读取任务
      expect(readResponse.success).toBe(true);
      expect(readResponse.task.title).toBe('测试任务');
      expect(readResponse.task.goal).toContain('握手流程');
    });
  });

  describe('错误注入与恢复指引', () => {
    it('在 Step 1 (project_info) 阶段注入错误：未连接项目时尝试任务操作', async () => {
      // Given: 未连接项目的状态
      const taskReadTool = new CurrentTaskReadTool(taskManager);

      // 创建带握手检查的工具
      const createToolWithCheck = (tool: any) => ({
        async handle(args?: any) {
          const check = await handshakeChecker.checkActiveTask();
          if (check) return check;
          return await tool.handle(args);
        },
      });

      const checkedReadTool = createToolWithCheck(taskReadTool);

      // When: 尝试读取任务（注入错误：跳过连接步骤）
      const readResult = await checkedReadTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      // Then: 能给出可恢复指引
      expect(readResponse.success).toBe(false);
      expect(readResponse.error_code).toBe(ErrorCode.NO_PROJECT_BOUND);
      expect(readResponse.recovery).toBeDefined();
      expect(readResponse.recovery.next_action).toBe('connect_project');
      expect(readResponse.recovery.required_params).toContain('project_path');
      expect(readResponse.recovery.example).toBeDefined();
      expect(readResponse.recovery.description).toContain('连接项目');
    });

    it('在 Step 2 (connect_project) 阶段注入错误：使用无效路径', async () => {
      // Given: 无效的项目路径
      const invalidPath = path.join(tempDir, 'non-existent-project');

      // When: 尝试连接不存在的项目（注入错误）
      const connectResult = await connectProjectTool.handle({
        project_path: invalidPath,
      });
      const connectResponse = JSON.parse(connectResult.content[0].text);

      // Then: 能给出可恢复指引
      expect(connectResponse.success).toBe(false);
      expect(connectResponse.error_code).toBe(ErrorCode.INVALID_ROOT);
      expect(connectResponse.recovery).toBeDefined();
      expect(connectResponse.recovery.next_action).toBe('connect_project');
      expect(connectResponse.recovery.suggestions).toContain(
        '确保路径存在且可访问'
      );

      // When: 按照恢复指引创建有效路径并重试
      await fs.ensureDir(invalidPath);
      const retryResult = await connectProjectTool.handle({
        project_path: invalidPath,
      });
      const retryResponse = JSON.parse(retryResult.content[0].text);

      // Then: 恢复成功
      expect(retryResponse.success).toBe(true);
      expect(retryResponse.data.connected).toBe(true);
    });

    it('在 Step 3 (current_task_read) 阶段注入错误：连接后无活动任务', async () => {
      // Given: 已连接项目但无活动任务
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      // When: 尝试读取任务（注入错误：跳过创建任务步骤）
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const createToolWithCheck = (tool: any) => ({
        async handle(args?: any) {
          const check = await handshakeChecker.checkActiveTask();
          if (check) return check;
          return await tool.handle(args);
        },
      });

      const checkedReadTool = createToolWithCheck(taskReadTool);
      const readResult = await checkedReadTool.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      // Then: 能给出可恢复指引
      expect(readResponse.success).toBe(false);
      expect(readResponse.error_code).toBe(ErrorCode.NO_ACTIVE_TASK);
      expect(readResponse.recovery).toBeDefined();
      expect(readResponse.recovery.next_action).toBe('current_task_init');
      expect(readResponse.recovery.required_params).toContain('title');
      expect(readResponse.recovery.required_params).toContain('goal');
      expect(readResponse.recovery.example).toBeDefined();
    });
  });

  describe('多项目隔离和会话绑定', () => {
    it('应该支持切换到不同项目，确保会话隔离', async () => {
      // Given: 创建两个不同的项目
      const project1Path = path.join(tempDir, 'project-1');
      const project2Path = path.join(tempDir, 'project-2');
      await fs.ensureDir(project1Path);
      await fs.ensureDir(project2Path);

      // When: 连接项目 1
      await connectProjectTool.handle({ project_path: project1Path });

      // Then: 验证连接到项目 1
      let infoResult = await projectInfoTool.handle();
      let infoResponse = JSON.parse(infoResult.content[0].text);
      expect(infoResponse.data.connected).toBe(true);
      expect(infoResponse.data.project.root).toBe(project1Path);

      // When: 切换到项目 2
      await connectProjectTool.handle({ project_path: project2Path });

      // Then: 验证会话已切换到项目 2
      infoResult = await projectInfoTool.handle();
      infoResponse = JSON.parse(infoResult.content[0].text);
      expect(infoResponse.data.connected).toBe(true);
      expect(infoResponse.data.project.root).toBe(project2Path);

      // When: 在项目 2 中创建任务
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      await taskInitTool.handle({
        title: '项目 2 的任务',
        goal: '验证多项目隔离是否正常工作',
        overall_plan: [],
        knowledge_refs: [],
      });

      // Then: 验证任务属于项目 2
      infoResult = await projectInfoTool.handle();
      infoResponse = JSON.parse(infoResult.content[0].text);
      expect(infoResponse.data.active_task).toBeDefined();
      expect(infoResponse.data.active_task.title).toBe('项目 2 的任务');
    });

    it('应该防止跨项目的数据泄露', async () => {
      // Given: 两个独立的 TaskManager 实例（模拟不同会话）
      const project1Path = path.join(tempDir, 'isolated-project-1');
      const project2Path = path.join(tempDir, 'isolated-project-2');
      await fs.ensureDir(project1Path);
      await fs.ensureDir(project2Path);

      const projectManager1 = new ProjectManager();
      const taskManager1 = new TaskManager(
        path.join(project1Path, '.wave'),
        projectManager1
      );

      const projectManager2 = new ProjectManager();
      const taskManager2 = new TaskManager(
        path.join(project2Path, '.wave'),
        projectManager2
      );

      // When: 在项目 1 中创建任务
      const connectTool1 = new ConnectProjectTool(
        projectManager1,
        taskManager1
      );
      await connectTool1.handle({ project_path: project1Path });

      const initTool1 = new CurrentTaskInitTool(taskManager1);
      await initTool1.handle({
        title: '项目 1 专属任务',
        goal: '验证项目隔离是否正常工作',
        overall_plan: [],
        knowledge_refs: [],
      });

      // When: 在项目 2 中尝试读取
      const connectTool2 = new ConnectProjectTool(
        projectManager2,
        taskManager2
      );
      await connectTool2.handle({ project_path: project2Path });

      const readTool2 = new CurrentTaskReadTool(taskManager2);
      const handshakeChecker2 = new HandshakeChecker(
        projectManager2,
        taskManager2
      );

      const createToolWithCheck = (tool: any) => ({
        async handle(args?: any) {
          const check = await handshakeChecker2.checkActiveTask();
          if (check) return check;
          return await tool.handle(args);
        },
      });

      const checkedReadTool2 = createToolWithCheck(readTool2);
      const readResult = await checkedReadTool2.handle();
      const readResponse = JSON.parse(readResult.content[0].text);

      // Then: 项目 2 不应该看到项目 1 的任务
      expect(readResponse.success).toBe(false);
      expect(readResponse.error_code).toBe(ErrorCode.NO_ACTIVE_TASK);
    });
  });

  describe('连接参数的各种组合和边界情况', () => {
    it('应该支持使用绝对路径连接（root 参数）', async () => {
      const testPath = path.join(tempDir, 'abs-path-project');
      await fs.ensureDir(testPath);

      const result = await connectProjectTool.handle({
        project_path: testPath,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.data.project.root).toBe(testPath);
    });

    it('应该处理路径中包含特殊字符的情况', async () => {
      const specialPath = path.join(tempDir, 'project-with-特殊字符-123');
      await fs.ensureDir(specialPath);

      const result = await connectProjectTool.handle({
        project_path: specialPath,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.data.project.root).toBe(specialPath);
    });

    it('应该幂等处理重复连接相同项目', async () => {
      const testPath = path.join(tempDir, 'idempotent-project');
      await fs.ensureDir(testPath);

      // 第一次连接
      const result1 = await connectProjectTool.handle({
        project_path: testPath,
      });
      const response1 = JSON.parse(result1.content[0].text);

      // 第二次连接相同项目
      const result2 = await connectProjectTool.handle({
        project_path: testPath,
      });
      const response2 = JSON.parse(result2.content[0].text);

      // 应该返回相同的项目 ID
      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      expect(response1.data.project.id).toBe(response2.data.project.id);
    });

    it('应该拒绝没有读取权限的路径', async () => {
      const restrictedPath = '/root/restricted-access';

      const result = await connectProjectTool.handle({
        project_path: restrictedPath,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect([ErrorCode.INVALID_ROOT, ErrorCode.MISSING_PERMISSIONS]).toContain(
        response.error_code
      );
    });
  });

  describe('边界错误可恢复性', () => {
    it('应该能从连接失败恢复到正常工作流', async () => {
      // Step 1: 尝试连接失败
      const invalidPath = path.join(tempDir, 'will-fail');
      const failResult = await connectProjectTool.handle({
        project_path: invalidPath,
      });
      const failResponse = JSON.parse(failResult.content[0].text);
      expect(failResponse.success).toBe(false);

      // Step 2: 修复问题后重试
      await fs.ensureDir(invalidPath);
      const successResult = await connectProjectTool.handle({
        project_path: invalidPath,
      });
      const successResponse = JSON.parse(successResult.content[0].text);
      expect(successResponse.success).toBe(true);

      // Step 3: 验证可以继续正常流程
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      const initResult = await taskInitTool.handle({
        title: '恢复后的任务',
        goal: '验证错误恢复机制是否正常工作',
        overall_plan: [],
        knowledge_refs: [],
      });
      const initResponse = JSON.parse(initResult.content[0].text);
      expect(initResponse.success).toBe(true);
    });

    it('应该能从任务操作失败恢复', async () => {
      // Step 1: 连接项目
      const testPath = path.join(tempDir, 'recovery-test');
      await fs.ensureDir(testPath);
      await connectProjectTool.handle({ project_path: testPath });

      // Step 2: 尝试读取不存在的任务（失败）
      const taskReadTool = new CurrentTaskReadTool(taskManager);
      const createToolWithCheck = (tool: any) => ({
        async handle(args?: any) {
          const check = await handshakeChecker.checkActiveTask();
          if (check) return check;
          return await tool.handle(args);
        },
      });

      const checkedReadTool = createToolWithCheck(taskReadTool);
      const failResult = await checkedReadTool.handle();
      const failResponse = JSON.parse(failResult.content[0].text);
      expect(failResponse.success).toBe(false);
      expect(failResponse.error_code).toBe(ErrorCode.NO_ACTIVE_TASK);

      // Step 3: 按照恢复指引创建任务
      const taskInitTool = new CurrentTaskInitTool(taskManager);
      await taskInitTool.handle({
        title: '新创建的任务',
        goal: '验证从失败中恢复是否正常工作',
        overall_plan: [],
        knowledge_refs: [],
      });

      // Step 4: 验证现在可以正常读取
      const successResult = await checkedReadTool.handle();
      const successResponse = JSON.parse(successResult.content[0].text);
      expect(successResponse.success).toBe(true);
      expect(successResponse.task.title).toBe('新创建的任务');
    });
  });
});
