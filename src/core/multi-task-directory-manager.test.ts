/**
 * MultiTaskDirectoryManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import * as path from 'path';
import { MultiTaskDirectoryManager } from './multi-task-directory-manager.js';
import {
  TaskStatus,
  LogLevel,
  LogCategory,
  LogAction,
} from '../types/index.js';
import type { CurrentTask } from '../types/index.js';

describe('MultiTaskDirectoryManager', () => {
  let manager: MultiTaskDirectoryManager;
  let testDocsPath: string;
  let mockTask: CurrentTask;

  beforeEach(async () => {
    // 创建临时测试目录
    testDocsPath = path.join(
      process.cwd(),
      'test-temp',
      `multi-task-${Date.now()}`
    );
    await fs.ensureDir(testDocsPath);

    manager = new MultiTaskDirectoryManager(testDocsPath);

    // 创建模拟任务数据
    mockTask = {
      id: '01HZXYZ123456789ABCDEFGHIJ',
      title: '测试任务',
      slug: '测试任务',
      knowledge_refs: [],
      goal: '这是一个测试任务的目标',
      task_hints: [],
      overall_plan: [
        {
          id: 'plan-1',
          description: '第一个计划',
          status: TaskStatus.InProgress,
          hints: [],
          steps: [
            {
              id: 'step-1',
              description: '第一个步骤',
              status: TaskStatus.Completed,
              hints: [],
              created_at: '2025-09-24T10:00:00.000Z',
              completed_at: '2025-09-24T10:30:00.000Z',
            },
            {
              id: 'step-2',
              description: '第二个步骤',
              status: TaskStatus.InProgress,
              hints: [],
              created_at: '2025-09-24T10:30:00.000Z',
            },
          ],
          created_at: '2025-09-24T10:00:00.000Z',
        },
      ],
      current_plan_id: 'plan-1',
      logs: [
        {
          timestamp: '2025-09-24T10:00:00.000Z',
          level: LogLevel.Info,
          category: LogCategory.Task,
          action: LogAction.Create,
          message: '任务创建',
          ai_notes: '创建了测试任务',
        },
      ],
      created_at: '2025-09-24T10:00:00.000Z',
      updated_at: '2025-09-24T10:30:00.000Z',
    };
  });

  afterEach(async () => {
    // 清理测试目录
    if (await fs.pathExists(testDocsPath)) {
      await fs.remove(testDocsPath);
    }
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      expect(manager.getTasksBasePath()).toBe(path.join(testDocsPath, 'tasks'));
    });

    it('应该在docsPath为空时抛出错误', () => {
      expect(() => new MultiTaskDirectoryManager('')).toThrow(
        'docsPath 不能为空'
      );
    });
  });

  describe('generateTaskDirectoryInfo', () => {
    it('应该生成正确的目录信息', () => {
      const dirInfo = manager.generateTaskDirectoryInfo(mockTask);

      expect(dirInfo.taskId).toBe(mockTask.id);
      expect(dirInfo.slug).toBe(mockTask.slug);
      expect(dirInfo.shortId).toBe('01HZXYZ1');
      expect(dirInfo.dirName).toBe('测试任务--01HZXYZ1');
      expect(dirInfo.relativePath).toBe('2025/09/24/测试任务--01HZXYZ1');
      expect(dirInfo.fullPath).toBe(
        path.join(
          testDocsPath,
          'tasks',
          '2025',
          '09',
          '24',
          '测试任务--01HZXYZ1'
        )
      );
    });

    it('应该处理不同的日期', () => {
      const taskWithDifferentDate = {
        ...mockTask,
        created_at: '2024-12-01T15:30:45.123Z',
      };

      const dirInfo = manager.generateTaskDirectoryInfo(taskWithDifferentDate);
      expect(dirInfo.relativePath).toBe('2024/12/01/测试任务--01HZXYZ1');
    });
  });

  describe('parseTaskDirectoryPath', () => {
    it('应该正确解析任务目录路径', () => {
      const taskDir = path.join(
        testDocsPath,
        'tasks',
        '2025',
        '09',
        '24',
        '测试任务--01HZXYZ1'
      );
      const dirInfo = manager.parseTaskDirectoryPath(taskDir);

      expect(dirInfo).not.toBeNull();
      expect(dirInfo!.slug).toBe('测试任务');
      expect(dirInfo!.shortId).toBe('01HZXYZ1');
      expect(dirInfo!.dirName).toBe('测试任务--01HZXYZ1');
      expect(dirInfo!.date.getFullYear()).toBe(2025);
      expect(dirInfo!.date.getMonth()).toBe(8); // 0-based
      expect(dirInfo!.date.getDate()).toBe(24);
    });

    it('应该在路径格式无效时返回null', () => {
      const invalidPaths = [
        path.join(testDocsPath, 'tasks', '2025', '09'),
        path.join(testDocsPath, 'tasks', 'invalid', '09', '24', 'task'),
        path.join(testDocsPath, 'tasks', '2025', '09', '24', 'invalid-format'),
      ];

      for (const invalidPath of invalidPaths) {
        const dirInfo = manager.parseTaskDirectoryPath(invalidPath);
        expect(dirInfo).toBeNull();
      }
    });
  });

  describe('createTaskDirectory', () => {
    it('应该创建任务目录', async () => {
      const dirInfo = await manager.createTaskDirectory(mockTask);

      expect(await fs.pathExists(dirInfo.fullPath)).toBe(true);
      expect(dirInfo.taskId).toBe(mockTask.id);
      expect(dirInfo.slug).toBe(mockTask.slug);
    });
  });

  describe('getTaskFilePaths', () => {
    it('应该返回正确的文件路径', () => {
      const dirInfo = manager.generateTaskDirectoryInfo(mockTask);
      const filePaths = manager.getTaskFilePaths(dirInfo);

      expect(filePaths.taskJson).toBe(path.join(dirInfo.fullPath, 'task.json'));
      expect(filePaths.currentMd).toBe(
        path.join(dirInfo.fullPath, 'current.md')
      );
      expect(filePaths.logsJsonl).toBe(
        path.join(dirInfo.fullPath, 'logs.jsonl')
      );
    });
  });

  describe('saveTaskToDirectory', () => {
    it('应该保存任务到目录', async () => {
      const archive = await manager.saveTaskToDirectory(mockTask);

      // 验证目录存在
      expect(await fs.pathExists(archive.taskDir)).toBe(true);

      // 验证文件存在
      expect(await fs.pathExists(archive.files.taskJson)).toBe(true);
      expect(await fs.pathExists(archive.files.currentMd)).toBe(true);
      expect(await fs.pathExists(archive.files.logsJsonl)).toBe(true);

      // 验证任务数据文件内容
      const savedTaskData = await fs.readFile(archive.files.taskJson, 'utf8');
      const savedTask = JSON.parse(savedTaskData);
      expect(savedTask.id).toBe(mockTask.id);
      expect(savedTask.title).toBe(mockTask.title);

      // 验证Markdown文档存在且包含标题
      const markdownContent = await fs.readFile(
        archive.files.currentMd,
        'utf8'
      );
      expect(markdownContent).toContain(mockTask.title);
      expect(markdownContent).toContain(mockTask.goal);

      // 验证日志文件存在且格式正确
      const logsContent = await fs.readFile(archive.files.logsJsonl, 'utf8');
      const logLines = logsContent.trim().split('\n');
      expect(logLines.length).toBe(mockTask.logs.length);

      const firstLog = JSON.parse(logLines[0]);
      expect(firstLog.message).toBe(mockTask.logs[0].message);
    });

    it('应该处理复杂的任务数据', async () => {
      const complexTask = {
        ...mockTask,
        task_hints: ['提示1', '提示2'],
        overall_plan: [
          {
            ...mockTask.overall_plan[0],
            hints: ['计划提示1'],
            steps: [
              {
                ...mockTask.overall_plan[0].steps[0],
                hints: ['步骤提示1'],
                evidence: 'test-evidence.txt',
                notes: '步骤备注',
              },
            ],
          },
        ],
      };

      const archive = await manager.saveTaskToDirectory(complexTask);

      // 验证Markdown文档包含提示信息
      const markdownContent = await fs.readFile(
        archive.files.currentMd,
        'utf8'
      );
      // 验证面板包含关键信息（新格式）
      expect(markdownContent).toContain('# Task:');
      expect(markdownContent).toContain('## Plans & Steps');
      // 注意：evidence 字段已废弃，新格式不渲染
      // expect(markdownContent).toContain('test-evidence.txt');
    });
  });

  describe('loadTaskFromDirectory', () => {
    it('应该从目录加载任务', async () => {
      // 先保存任务
      const archive = await manager.saveTaskToDirectory(mockTask);

      // 然后加载任务
      const loadedTask = await manager.loadTaskFromDirectory(archive.taskDir);

      expect(loadedTask).not.toBeNull();
      expect(loadedTask!.id).toBe(mockTask.id);
      expect(loadedTask!.title).toBe(mockTask.title);
      expect(loadedTask!.goal).toBe(mockTask.goal);
      expect(loadedTask!.overall_plan.length).toBe(
        mockTask.overall_plan.length
      );
      expect(loadedTask!.logs.length).toBe(mockTask.logs.length);
    });

    it('应该在目录不存在时返回null', async () => {
      const nonExistentDir = path.join(testDocsPath, 'non-existent');
      const loadedTask = await manager.loadTaskFromDirectory(nonExistentDir);
      expect(loadedTask).toBeNull();
    });

    it('应该在任务文件损坏时返回null', async () => {
      const taskDir = path.join(testDocsPath, 'corrupted-task');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'task.json'),
        'invalid json',
        'utf8'
      );

      const loadedTask = await manager.loadTaskFromDirectory(taskDir);
      expect(loadedTask).toBeNull();
    });
  });

  describe('updateTaskInDirectory', () => {
    it('应该更新目录中的任务', async () => {
      // 先保存任务
      const archive = await manager.saveTaskToDirectory(mockTask);

      // 修改任务
      const updatedTask = {
        ...mockTask,
        title: '更新后的任务标题',
        updated_at: '2025-09-24T11:00:00.000Z',
      };

      // 更新任务
      await manager.updateTaskInDirectory(updatedTask, archive.taskDir);

      // 验证更新
      const loadedTask = await manager.loadTaskFromDirectory(archive.taskDir);
      expect(loadedTask!.title).toBe('更新后的任务标题');
      expect(loadedTask!.updated_at).toBe('2025-09-24T11:00:00.000Z');

      // 验证Markdown文档也被更新
      const markdownContent = await fs.readFile(
        archive.files.currentMd,
        'utf8'
      );
      expect(markdownContent).toContain('更新后的任务标题');
    });
  });

  describe('findTaskDirectory', () => {
    it('应该找到任务目录', async () => {
      // 先保存任务
      const archive = await manager.saveTaskToDirectory(mockTask);

      // 查找任务目录
      const foundDir = await manager.findTaskDirectory(mockTask.id);

      expect(foundDir).toBe(archive.taskDir);
    });

    it('应该在任务不存在时返回null', async () => {
      const foundDir = await manager.findTaskDirectory('non-existent-task-id');
      expect(foundDir).toBeNull();
    });

    it('应该处理短ID冲突', async () => {
      // 创建两个具有相同短ID前缀的任务
      const task1 = { ...mockTask, id: '01HZXYZ123456789ABCDEFGHIJ' };
      const task2 = {
        ...mockTask,
        id: '01HZXYZ987654321ZYXWVUTSRQ',
        title: '另一个任务',
      };

      await manager.saveTaskToDirectory(task1);
      await manager.saveTaskToDirectory(task2);

      // 应该能正确找到每个任务
      const foundDir1 = await manager.findTaskDirectory(task1.id);
      const foundDir2 = await manager.findTaskDirectory(task2.id);

      expect(foundDir1).not.toBeNull();
      expect(foundDir2).not.toBeNull();
      expect(foundDir1).not.toBe(foundDir2);

      // 验证加载的任务是正确的
      const loadedTask1 = await manager.loadTaskFromDirectory(foundDir1!);
      const loadedTask2 = await manager.loadTaskFromDirectory(foundDir2!);

      expect(loadedTask1!.id).toBe(task1.id);
      expect(loadedTask2!.id).toBe(task2.id);
    });
  });

  describe('listAllTaskDirectories', () => {
    it('应该列出所有任务目录', async () => {
      // 创建多个任务
      const task1 = {
        ...mockTask,
        id: '01HZXYZ123456789ABCDEFGHIJ',
        title: '任务1',
      };
      const task2 = {
        ...mockTask,
        id: '01HZABC987654321ZYXWVUTSRQ',
        title: '任务2',
        created_at: '2025-09-25T10:00:00.000Z',
      };
      const task3 = {
        ...mockTask,
        id: '01HZDEF555666777MNOPQRSTUV',
        title: '任务3',
        created_at: '2025-09-23T10:00:00.000Z',
      };

      await manager.saveTaskToDirectory(task1);
      await manager.saveTaskToDirectory(task2);
      await manager.saveTaskToDirectory(task3);

      // 列出所有任务目录
      const taskDirs = await manager.listAllTaskDirectories();

      expect(taskDirs.length).toBe(3);

      // 验证排序（按创建时间倒序）
      expect(taskDirs[0].taskId).toBe(task2.id); // 2025-09-25
      expect(taskDirs[1].taskId).toBe(task1.id); // 2025-09-24
      expect(taskDirs[2].taskId).toBe(task3.id); // 2025-09-23

      // 验证目录信息
      for (const dirInfo of taskDirs) {
        expect(dirInfo.taskId).toBeTruthy();
        expect(dirInfo.slug).toBeTruthy();
        expect(dirInfo.fullPath).toBeTruthy();
        expect(await fs.pathExists(dirInfo.fullPath)).toBe(true);
      }
    });

    it('应该在没有任务时返回空数组', async () => {
      const taskDirs = await manager.listAllTaskDirectories();
      expect(taskDirs).toEqual([]);
    });

    it('应该跳过损坏的任务目录', async () => {
      // 创建一个正常任务
      await manager.saveTaskToDirectory(mockTask);

      // 创建一个损坏的任务目录
      const corruptedDir = path.join(
        testDocsPath,
        'tasks',
        '2025',
        '09',
        '24',
        '损坏任务--01HZCORR'
      );
      await fs.ensureDir(corruptedDir);
      await fs.writeFile(
        path.join(corruptedDir, 'task.json'),
        'invalid json',
        'utf8'
      );

      // 列出任务目录
      const taskDirs = await manager.listAllTaskDirectories();

      // 应该只返回正常的任务，跳过损坏的
      expect(taskDirs.length).toBe(1);
      expect(taskDirs[0].taskId).toBe(mockTask.id);
    });
  });

  describe('deleteTaskDirectory', () => {
    it('应该删除任务目录', async () => {
      // 先保存任务
      const archive = await manager.saveTaskToDirectory(mockTask);

      // 验证目录存在
      expect(await fs.pathExists(archive.taskDir)).toBe(true);

      // 删除目录
      await manager.deleteTaskDirectory(archive.taskDir);

      // 验证目录已删除
      expect(await fs.pathExists(archive.taskDir)).toBe(false);
    });

    it('应该在目录不存在时不抛出错误', async () => {
      const nonExistentDir = path.join(testDocsPath, 'non-existent');

      // 不应该抛出错误
      await expect(
        manager.deleteTaskDirectory(nonExistentDir)
      ).resolves.not.toThrow();
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理特殊字符的任务标题', async () => {
      const specialTask = {
        ...mockTask,
        title: '特殊字符任务!@#$%^&*()_+{}|:"<>?[]\\;\',./',
        slug: '特殊字符任务',
      };

      const archive = await manager.saveTaskToDirectory(specialTask);
      const loadedTask = await manager.loadTaskFromDirectory(archive.taskDir);

      expect(loadedTask).not.toBeNull();
      expect(loadedTask!.title).toBe(specialTask.title);
    });

    it('应该处理长标题', async () => {
      const longTitle = 'A'.repeat(300);
      const longTask = {
        ...mockTask,
        title: longTitle,
        slug: longTitle.toLowerCase(),
      };

      const archive = await manager.saveTaskToDirectory(longTask);
      const loadedTask = await manager.loadTaskFromDirectory(archive.taskDir);

      expect(loadedTask).not.toBeNull();
      expect(loadedTask!.title).toBe(longTitle);

      // 验证目录名称被正确截断
      const dirInfo = manager.generateTaskDirectoryInfo(longTask);
      expect(dirInfo.dirName.length).toBeLessThanOrEqual(110); // 100 + '--' + 8
    });

    it('应该处理空的计划和日志', async () => {
      const emptyTask = {
        ...mockTask,
        overall_plan: [],
        logs: [],
      };

      const archive = await manager.saveTaskToDirectory(emptyTask);
      const loadedTask = await manager.loadTaskFromDirectory(archive.taskDir);

      expect(loadedTask).not.toBeNull();
      expect(loadedTask!.overall_plan).toEqual([]);
      expect(loadedTask!.logs).toEqual([]);

      // 验证Markdown文档仍然生成
      const markdownContent = await fs.readFile(
        archive.files.currentMd,
        'utf8'
      );
      expect(markdownContent).toContain(`# Task: ${emptyTask.title}`);
      // 新格式：空计划时不显示 "暂无计划"，Plans section 不出现
    });
  });
});
