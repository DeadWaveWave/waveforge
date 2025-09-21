import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  TaskStatus,
  LogLevel,
  LogCategory,
  LogAction,
  type TaskStep,
  type TaskPlan,
  type CurrentTask,
  type TaskLog,
} from './index.js';

describe('基础数据类型测试', () => {
  describe('TaskStatus 枚举', () => {
    it('应该包含所有必需的状态值', () => {
      expect(TaskStatus.ToDo).toBe('to_do');
      expect(TaskStatus.InProgress).toBe('in_progress');
      expect(TaskStatus.Completed).toBe('completed');
      expect(TaskStatus.Blocked).toBe('blocked');
    });

    it('应该是字符串类型', () => {
      expectTypeOf(TaskStatus.ToDo).toBeString();
      expectTypeOf(TaskStatus.InProgress).toBeString();
      expectTypeOf(TaskStatus.Completed).toBeString();
      expectTypeOf(TaskStatus.Blocked).toBeString();
    });

    it('应该支持类型检查', () => {
      const status: TaskStatus = TaskStatus.ToDo;
      expectTypeOf(status).toMatchTypeOf<TaskStatus>();
    });
  });

  describe('日志相关枚举', () => {
    it('LogLevel 应该包含所有级别', () => {
      expect(LogLevel.Info).toBe('INFO');
      expect(LogLevel.Warning).toBe('WARNING');
      expect(LogLevel.Error).toBe('ERROR');
      expect(LogLevel.Teach).toBe('TEACH');
    });

    it('LogCategory 应该包含所有类别', () => {
      expect(LogCategory.Plan).toBe('PLAN');
      expect(LogCategory.Step).toBe('STEP');
      expect(LogCategory.Task).toBe('TASK');
      expect(LogCategory.Knowledge).toBe('KNOWLEDGE');
      expect(LogCategory.Discussion).toBe('DISCUSSION');
      expect(LogCategory.Exception).toBe('EXCEPTION');
      expect(LogCategory.Test).toBe('TEST');
      expect(LogCategory.Health).toBe('HEALTH');
    });

    it('LogAction 应该包含所有操作', () => {
      expect(LogAction.Update).toBe('UPDATE');
      expect(LogAction.Create).toBe('CREATE');
      expect(LogAction.Modify).toBe('MODIFY');
      expect(LogAction.Switch).toBe('SWITCH');
      expect(LogAction.Handle).toBe('HANDLE');
    });
  });

  describe('TaskStep 接口类型测试', () => {
    it('应该具有正确的类型结构', () => {
      const taskStep: TaskStep = {
        id: 'step-001',
        description: '测试步骤描述',
        status: TaskStatus.ToDo,
        hints: [],
        created_at: '2025-09-21T22:00:00.000Z',
      };

      expectTypeOf(taskStep).toEqualTypeOf<TaskStep>();
      expectTypeOf(taskStep.id).toBeString();
      expectTypeOf(taskStep.description).toBeString();
      expectTypeOf(taskStep.status).toEqualTypeOf<TaskStatus>();
      expectTypeOf(taskStep.hints).toEqualTypeOf<string[]>();
      expectTypeOf(taskStep.created_at).toBeString();
    });

    it('应该支持可选字段', () => {
      const taskStepWithOptionals: TaskStep = {
        id: 'step-002',
        description: '带可选字段的步骤',
        status: TaskStatus.Completed,
        evidence: 'https://example.com/evidence',
        notes: '完成说明',
        hints: ['提示1', '提示2'],
        created_at: '2025-09-21T22:00:00.000Z',
        completed_at: '2025-09-21T22:30:00.000Z',
      };

      expectTypeOf(taskStepWithOptionals.evidence).toEqualTypeOf<
        string | undefined
      >();
      expectTypeOf(taskStepWithOptionals.notes).toEqualTypeOf<
        string | undefined
      >();
      expectTypeOf(taskStepWithOptionals.completed_at).toEqualTypeOf<
        string | undefined
      >();
    });
  });

  describe('TaskPlan 接口类型测试', () => {
    it('应该具有正确的类型结构', () => {
      const taskPlan: TaskPlan = {
        id: 'plan-001',
        description: '测试计划描述',
        status: TaskStatus.InProgress,
        hints: [],
        steps: [],
        created_at: '2025-09-21T22:00:00.000Z',
      };

      expectTypeOf(taskPlan).toEqualTypeOf<TaskPlan>();
      expectTypeOf(taskPlan.id).toBeString();
      expectTypeOf(taskPlan.description).toBeString();
      expectTypeOf(taskPlan.status).toEqualTypeOf<TaskStatus>();
      expectTypeOf(taskPlan.hints).toEqualTypeOf<string[]>();
      expectTypeOf(taskPlan.steps).toEqualTypeOf<TaskStep[]>();
      expectTypeOf(taskPlan.created_at).toBeString();
    });

    it('应该支持可选字段', () => {
      const taskPlanWithOptionals: TaskPlan = {
        id: 'plan-002',
        description: '带可选字段的计划',
        status: TaskStatus.Completed,
        evidence: 'https://example.com/plan-evidence',
        hints: ['计划提示'],
        steps: [],
        created_at: '2025-09-21T22:00:00.000Z',
        completed_at: '2025-09-21T22:45:00.000Z',
      };

      expectTypeOf(taskPlanWithOptionals.evidence).toEqualTypeOf<
        string | undefined
      >();
      expectTypeOf(taskPlanWithOptionals.completed_at).toEqualTypeOf<
        string | undefined
      >();
    });
  });

  describe('CurrentTask 接口类型测试', () => {
    it('应该具有正确的类型结构', () => {
      const currentTask: CurrentTask = {
        id: 'task-001',
        title: '测试任务',
        slug: 'test-task',
        knowledge_refs: [],
        goal: '测试目标',
        task_hints: [],
        overall_plan: [],
        logs: [],
        created_at: '2025-09-21T22:00:00.000Z',
        updated_at: '2025-09-21T22:00:00.000Z',
      };

      expectTypeOf(currentTask).toEqualTypeOf<CurrentTask>();
      expectTypeOf(currentTask.id).toBeString();
      expectTypeOf(currentTask.title).toBeString();
      expectTypeOf(currentTask.slug).toBeString();
      expectTypeOf(currentTask.knowledge_refs).toEqualTypeOf<string[]>();
      expectTypeOf(currentTask.goal).toBeString();
      expectTypeOf(currentTask.task_hints).toEqualTypeOf<string[]>();
      expectTypeOf(currentTask.overall_plan).toEqualTypeOf<TaskPlan[]>();
      expectTypeOf(currentTask.logs).toEqualTypeOf<TaskLog[]>();
      expectTypeOf(currentTask.created_at).toBeString();
      expectTypeOf(currentTask.updated_at).toBeString();
    });

    it('应该支持可选字段', () => {
      const currentTaskWithOptionals: CurrentTask = {
        id: 'task-002',
        title: '带可选字段的任务',
        slug: 'task-with-optionals',
        story: {
          id: 'story-001',
          slug: 'story-slug',
          url: 'https://example.com/story',
          title: 'Story 标题',
        },
        requirement: {
          id: 'req-001',
          url: 'https://example.com/requirement',
          title: 'Requirement 标题',
        },
        knowledge_refs: ['ref1', 'ref2'],
        goal: '测试目标',
        task_hints: ['任务提示'],
        overall_plan: [],
        current_plan_id: 'plan-001',
        current_step_details: '当前步骤详情',
        logs: [],
        provenance: {
          git: {
            repo: 'test-repo',
            branch: 'main',
            since: 'abc123',
            until: 'def456',
            commits: ['commit1', 'commit2'],
          },
          pr_links: ['https://github.com/test/pr/1'],
          issue_links: ['https://github.com/test/issues/1'],
          doc_links: ['https://docs.example.com'],
          sources: ['source1', 'source2'],
        },
        created_at: '2025-09-21T22:00:00.000Z',
        updated_at: '2025-09-21T22:00:00.000Z',
        completed_at: '2025-09-21T23:00:00.000Z',
      };

      expectTypeOf(currentTaskWithOptionals.story).toEqualTypeOf<
        | {
            id?: string;
            slug?: string;
            url?: string;
            title?: string;
          }
        | undefined
      >();
      expectTypeOf(currentTaskWithOptionals.requirement).toEqualTypeOf<
        | {
            id?: string;
            url?: string;
            title?: string;
          }
        | undefined
      >();
      expectTypeOf(currentTaskWithOptionals.current_plan_id).toEqualTypeOf<
        string | undefined
      >();
      expectTypeOf(currentTaskWithOptionals.current_step_details).toEqualTypeOf<
        string | undefined
      >();
      expectTypeOf(currentTaskWithOptionals.completed_at).toEqualTypeOf<
        string | undefined
      >();
    });
  });

  describe('TaskLog 接口类型测试', () => {
    it('应该具有正确的类型结构', () => {
      const taskLog: TaskLog = {
        timestamp: '2025-09-21T22:00:00.000Z',
        level: LogLevel.Info,
        category: LogCategory.Task,
        action: LogAction.Create,
        message: '测试日志消息',
      };

      expectTypeOf(taskLog).toEqualTypeOf<TaskLog>();
      expectTypeOf(taskLog.timestamp).toBeString();
      expectTypeOf(taskLog.level).toEqualTypeOf<LogLevel>();
      expectTypeOf(taskLog.category).toEqualTypeOf<LogCategory>();
      expectTypeOf(taskLog.action).toEqualTypeOf<LogAction>();
      expectTypeOf(taskLog.message).toBeString();
    });

    it('应该支持可选字段', () => {
      const taskLogWithOptionals: TaskLog = {
        timestamp: '2025-09-21T22:00:00.000Z',
        level: LogLevel.Warning,
        category: LogCategory.Exception,
        action: LogAction.Handle,
        message: '带可选字段的日志',
        ai_notes: 'AI 详细说明',
        details: { key: 'value', count: 42 },
      };

      expectTypeOf(taskLogWithOptionals.ai_notes).toEqualTypeOf<
        string | undefined
      >();
      expectTypeOf(taskLogWithOptionals.details).toEqualTypeOf<
        Record<string, any> | undefined
      >();
    });
  });
});
