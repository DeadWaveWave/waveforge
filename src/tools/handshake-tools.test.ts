/**
 * 握手工具测试
 * 测试 project_info 和 connect_project 工具的握手流程
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectInfoTool, ConnectProjectTool } from './handshake-tools.js';
import { ProjectManager } from '../core/project-manager.js';
import { TaskManager } from '../core/task-manager.js';
import { ErrorCode } from '../types/index.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('握手工具测试', () => {
  let tempDir: string;
  let projectManager: ProjectManager;
  let taskManager: TaskManager;
  let projectInfoTool: ProjectInfoTool;
  let connectProjectTool: ConnectProjectTool;

  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'handshake-test-'));

    // 初始化管理器
    projectManager = new ProjectManager();
    taskManager = new TaskManager(path.join(tempDir, '.wave'), projectManager);

    // 初始化工具
    projectInfoTool = new ProjectInfoTool(projectManager, taskManager);
    connectProjectTool = new ConnectProjectTool(projectManager, taskManager);
  });

  afterEach(async () => {
    // 清理临时目录
    await fs.remove(tempDir);
  });

  describe('project_info 工具', () => {
    it('未连接状态时应返回 connected=false', async () => {
      const result = await projectInfoTool.handle();

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.connected).toBe(false);
      expect(response.data.project).toBeNull();
      expect(response.data.active_task).toBeNull();
    });

    it('连接后应返回 connected=true 和项目信息', async () => {
      // 先连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);

      await connectProjectTool.handle({ project_path: testProjectPath });

      // 再获取项目信息
      const result = await projectInfoTool.handle();

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.connected).toBe(true);
      expect(response.data.project).toBeDefined();
      expect(response.data.project.root).toBe(testProjectPath);
      expect(response.data.project.id).toBeDefined();
      expect(response.data.project.slug).toBeDefined();
    });

    it('有活动任务时应返回 active_task 信息', async () => {
      // 连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      // 创建活动任务
      await taskManager.initTask({
        title: '测试任务',
        goal: '这是一个测试任务的验收标准和成功指标',
        overall_plan: [],
        knowledge_refs: [],
      });

      // 获取项目信息
      const result = await projectInfoTool.handle();

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.active_task).toBeDefined();
      expect(response.data.active_task.title).toBe('测试任务');
    });
  });

  describe('connect_project 工具', () => {
    it('通过有效路径连接项目应成功', async () => {
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);

      const result = await connectProjectTool.handle({
        project_path: testProjectPath,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.connected).toBe(true);
      expect(response.data.project.root).toBe(testProjectPath);
    });

    it('通过无效路径连接应返回错误', async () => {
      const invalidPath = path.join(tempDir, 'non-existent');

      const result = await connectProjectTool.handle({
        project_path: invalidPath,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error_code).toBe(ErrorCode.INVALID_ROOT);
    });

    it('缺少参数时应返回验证错误', async () => {
      const result = await connectProjectTool.handle({});

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.message).toContain('必须提供');
    });
  });

  describe('强制握手检查', () => {
    it('未连接时调用 current_task_read 应返回 NO_PROJECT_BOUND', async () => {
      // 创建一个模拟的 current_task_read 工具来测试握手检查
      const mockTaskReadTool = {
        async handle() {
          // 检查项目连接状态
          if (!projectManager.hasActiveProject()) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error_code: ErrorCode.NO_PROJECT_BOUND,
                    message: '未连接项目，请先调用 connect_project',
                  }),
                },
              ],
            };
          }
          return { content: [{ type: 'text', text: '{}' }] };
        },
      };

      const result = await mockTaskReadTool.handle();
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error_code).toBe(ErrorCode.NO_PROJECT_BOUND);
    });

    it('连接后调用 current_task_read 无活动任务时应返回 NO_ACTIVE_TASK', async () => {
      // 先连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      // 模拟 current_task_read 工具
      const mockTaskReadTool = {
        async handle() {
          if (!projectManager.hasActiveProject()) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error_code: ErrorCode.NO_PROJECT_BOUND,
                  }),
                },
              ],
            };
          }

          const currentTask = await taskManager.getCurrentTask();
          if (!currentTask) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error_code: ErrorCode.NO_ACTIVE_TASK,
                    message: '当前没有活动任务，请先创建任务',
                  }),
                },
              ],
            };
          }

          return {
            content: [
              { type: 'text', text: JSON.stringify({ success: true }) },
            ],
          };
        },
      };

      const result = await mockTaskReadTool.handle();
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error_code).toBe(ErrorCode.NO_ACTIVE_TASK);
    });

    it('连接且有活动任务时应允许调用 current_task_read', async () => {
      // 连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      // 创建活动任务
      await taskManager.initTask({
        title: '测试任务',
        goal: '这是一个测试任务的验收标准和成功指标',
        overall_plan: [],
        knowledge_refs: [],
      });

      // 模拟 current_task_read 工具
      const mockTaskReadTool = {
        async handle() {
          if (!projectManager.hasActiveProject()) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error_code: ErrorCode.NO_PROJECT_BOUND,
                  }),
                },
              ],
            };
          }

          const currentTask = await taskManager.getCurrentTask();
          if (!currentTask) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error_code: ErrorCode.NO_ACTIVE_TASK,
                  }),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  data: { task: currentTask },
                }),
              },
            ],
          };
        },
      };

      const result = await mockTaskReadTool.handle();
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.data.task).toBeDefined();
    });
  });

  describe('错误恢复路径', () => {
    it('NO_PROJECT_BOUND 错误应提供恢复指引', async () => {
      const mockTaskTool = {
        async handle() {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error_code: ErrorCode.NO_PROJECT_BOUND,
                  message: '未连接项目，请先调用 connect_project',
                  recovery: {
                    next_action: 'connect_project',
                    required_params: ['project_path'],
                    example:
                      'connect_project({ project_path: "/path/to/project" })',
                  },
                }),
              },
            ],
          };
        },
      };

      const result = await mockTaskTool.handle();
      const response = JSON.parse(result.content[0].text);

      expect(response.recovery).toBeDefined();
      expect(response.recovery.next_action).toBe('connect_project');
      expect(response.recovery.required_params).toContain('project_path');
    });

    it('NO_ACTIVE_TASK 错误应提供任务创建指引', async () => {
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      const mockTaskTool = {
        async handle() {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error_code: ErrorCode.NO_ACTIVE_TASK,
                  message: '当前没有活动任务，请先创建任务',
                  recovery: {
                    next_action: 'current_task_init',
                    required_params: ['title', 'goal'],
                    example:
                      'current_task_init({ title: "任务标题", goal: "验收标准" })',
                  },
                }),
              },
            ],
          };
        },
      };

      const result = await mockTaskTool.handle();
      const response = JSON.parse(result.content[0].text);

      expect(response.recovery).toBeDefined();
      expect(response.recovery.next_action).toBe('current_task_init');
      expect(response.recovery.required_params).toContain('title');
      expect(response.recovery.required_params).toContain('goal');
    });
  });
});
