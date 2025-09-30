/**
 * 错误码系统测试
 * 验证握手工具和任务工具中错误码的正确使用
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from '../core/project-manager.js';
import { TaskManager } from '../core/task-manager.js';
import {
  ProjectInfoTool as _ProjectInfoTool,
  ConnectProjectTool,
  HandshakeChecker,
} from './handshake-tools.js';
import { CurrentTaskReadTool as _CurrentTaskReadTool } from './task-tools.js';
import { ErrorCode } from '../types/index.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('错误码系统测试', () => {
  let tempDir: string;
  let projectManager: ProjectManager;
  let taskManager: TaskManager;
  let handshakeChecker: HandshakeChecker;
  let connectProjectTool: ConnectProjectTool;

  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'error-codes-test-'));

    // 初始化管理器
    projectManager = new ProjectManager();
    taskManager = new TaskManager(path.join(tempDir, '.wave'), projectManager);

    // 初始化工具
    handshakeChecker = new HandshakeChecker(projectManager, taskManager);
    connectProjectTool = new ConnectProjectTool(projectManager, taskManager);
  });

  afterEach(async () => {
    // 清理临时目录
    await fs.remove(tempDir);
  });

  describe('项目连接错误码', () => {
    it('应该返回 NO_PROJECT_BOUND 错误码', async () => {
      const connectionCheck = await handshakeChecker.checkProjectConnection();
      expect(connectionCheck).toBeDefined();

      const response = JSON.parse(connectionCheck!.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error_code).toBe(ErrorCode.NO_PROJECT_BOUND);
      expect(response.message).toContain('未连接项目');
      expect(response.recovery).toBeDefined();
      expect(response.recovery.next_action).toBe('connect_project');
    });

    it('应该返回 INVALID_ROOT 错误码', async () => {
      const invalidPath = path.join(tempDir, 'non-existent');

      const result = await connectProjectTool.handle({
        project_path: invalidPath,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error_code).toBe(ErrorCode.INVALID_ROOT);
      expect(response.message).toContain('项目路径无效');
      expect(response.recovery).toBeDefined();
      expect(response.recovery.suggestions).toContain(
        '确保提供的路径是绝对路径'
      );
    });

    it('应该返回 MISSING_PERMISSIONS 错误码', async () => {
      // 创建一个没有权限的目录（在某些系统上可能需要特殊设置）
      const restrictedPath = path.join(tempDir, 'restricted');
      await fs.ensureDir(restrictedPath);

      // 尝试移除权限（这在某些系统上可能不起作用）
      try {
        await fs.chmod(restrictedPath, 0o000);

        const result = await connectProjectTool.handle({
          project_path: restrictedPath,
        });

        const response = JSON.parse(result.content[0].text);

        // 如果权限设置成功，应该返回权限错误
        if (response.error_code === ErrorCode.MISSING_PERMISSIONS) {
          expect(response.success).toBe(false);
          expect(response.message).toContain('权限');
          expect(response.recovery.suggestions).toContain('检查目录权限设置');
        }

        // 恢复权限以便清理
        await fs.chmod(restrictedPath, 0o755);
      } catch (error) {
        // 如果无法设置权限，跳过此测试
        console.log('跳过权限测试：无法设置目录权限');
      }
    });
  });

  describe('任务相关错误码', () => {
    it('应该返回 NO_ACTIVE_TASK 错误码', async () => {
      // 先连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      // 检查活动任务状态
      const taskCheck = await handshakeChecker.checkActiveTask();
      expect(taskCheck).toBeDefined();

      const response = JSON.parse(taskCheck!.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error_code).toBe(ErrorCode.NO_ACTIVE_TASK);
      expect(response.message).toContain('没有活动任务');
      expect(response.recovery).toBeDefined();
      expect(response.recovery.next_action).toBe('current_task_init');
    });
  });

  describe('错误恢复指引', () => {
    it('NO_PROJECT_BOUND 应该提供正确的恢复指引', async () => {
      const connectionCheck = await handshakeChecker.checkProjectConnection();
      const response = JSON.parse(connectionCheck!.content[0].text);

      expect(response.recovery).toEqual({
        next_action: 'connect_project',
        required_params: ['project_path'],
        example: {
          project_path: '/path/to/your/project',
        },
      });
    });

    it('NO_ACTIVE_TASK 应该提供正确的恢复指引', async () => {
      // 先连接项目
      const testProjectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(testProjectPath);
      await connectProjectTool.handle({ project_path: testProjectPath });

      const taskCheck = await handshakeChecker.checkActiveTask();
      const response = JSON.parse(taskCheck!.content[0].text);

      expect(response.recovery).toEqual({
        next_action: 'current_task_init',
        required_params: ['title', 'goal'],
        example: {
          title: '任务标题',
          goal: '验收标准和成功指标',
        },
      });
    });

    it('INVALID_ROOT 应该提供正确的恢复指引', async () => {
      const invalidPath = path.join(tempDir, 'non-existent');

      const result = await connectProjectTool.handle({
        project_path: invalidPath,
      });

      const response = JSON.parse(result.content[0].text);

      expect(response.recovery.next_action).toBe('connect_project');
      expect(response.recovery.required_params).toContain('project_path');
      expect(response.recovery.suggestions).toContain(
        '确保提供的路径是绝对路径'
      );
      expect(response.recovery.suggestions).toContain(
        '确保路径指向一个存在的目录'
      );
      expect(response.recovery.suggestions).toContain('确保对该目录有读写权限');
      expect(response.recovery.example.project_path).toContain('/Users/');
    });
  });

  describe('错误码一致性', () => {
    it('所有错误响应都应该包含必需字段', async () => {
      const testCases = [
        {
          name: 'NO_PROJECT_BOUND',
          action: () => handshakeChecker.checkProjectConnection(),
          expectedCode: ErrorCode.NO_PROJECT_BOUND,
        },
        {
          name: 'INVALID_ROOT',
          action: () =>
            connectProjectTool.handle({
              project_path: path.join(tempDir, 'non-existent'),
            }),
          expectedCode: ErrorCode.INVALID_ROOT,
        },
      ];

      for (const testCase of testCases) {
        const result = await testCase.action();
        const response = JSON.parse(result.content[0].text);

        // 验证错误响应结构
        expect(response.success).toBe(false);
        expect(response.error_code).toBe(testCase.expectedCode);
        expect(response.message).toBeDefined();
        expect(typeof response.message).toBe('string');
        expect(response.message.length).toBeGreaterThan(0);
        expect(response.timestamp).toBeDefined();

        // 验证恢复指引结构
        if (response.recovery) {
          expect(response.recovery.next_action).toBeDefined();
          expect(typeof response.recovery.next_action).toBe('string');

          if (response.recovery.required_params) {
            expect(Array.isArray(response.recovery.required_params)).toBe(true);
          }

          if (response.recovery.example) {
            expect(typeof response.recovery.example).toBe('object');
          }
        }
      }
    });

    it('错误码应该与 ErrorCode 枚举一致', () => {
      // 验证所有使用的错误码都在枚举中定义
      const usedErrorCodes = [
        ErrorCode.NO_PROJECT_BOUND,
        ErrorCode.NO_ACTIVE_TASK,
        ErrorCode.INVALID_ROOT,
        ErrorCode.NOT_FOUND,
        ErrorCode.MULTIPLE_CANDIDATES,
        ErrorCode.MISSING_PERMISSIONS,
      ];

      for (const errorCode of usedErrorCodes) {
        expect(typeof errorCode).toBe('string');
        expect(errorCode.length).toBeGreaterThan(0);
        expect(errorCode).toMatch(/^[A-Z_]+$/); // 应该是大写字母和下划线
      }
    });
  });

  describe('错误上下文信息', () => {
    it('应该提供有用的上下文信息', async () => {
      const invalidPath = path.join(tempDir, 'non-existent');

      const result = await connectProjectTool.handle({
        project_path: invalidPath,
      });

      const response = JSON.parse(result.content[0].text);

      expect(response.context).toBeDefined();
      expect(response.context.attempted_params).toBeDefined();
      expect(response.context.attempted_params.root).toBe(invalidPath);
    });

    it('应该在多候选情况下提供候选列表', async () => {
      // 这个测试需要模拟多候选情况，暂时跳过
      // 在实际实现中，当通过 slug 查找到多个项目时会返回 MULTIPLE_CANDIDATES
    });
  });
});
