/**
 * FakeTaskStore - 假任务存储实现
 * 用于内存后端测试，支持 LazySync 测试场景
 */

import { ulid } from 'ulid';
import { logger } from './logger.js';
import {
  LogCategory,
  LogAction,
  TaskStatus,
  EVRStatus,
  EVRClass,
  type TaskData,
  type TaskPlan,
  type ExpectedResult,
  type ContextTag,
  type SectionFingerprints,
} from '../types/index.js';

/**
 * 假任务存储选项
 */
export interface FakeTaskStoreOptions {
  /** 是否启用日志记录 */
  enableLogging: boolean;
  /** 是否模拟延迟 */
  simulateDelay: boolean;
  /** 模拟延迟时间（毫秒） */
  delayMs: number;
  /** 是否模拟错误 */
  simulateErrors: boolean;
  /** 错误概率（0-1） */
  errorProbability: number;
}

/**
 * 默认假任务存储选项
 */
const DEFAULT_FAKE_STORE_OPTIONS: FakeTaskStoreOptions = {
  enableLogging: true,
  simulateDelay: false,
  delayMs: 100,
  simulateErrors: false,
  errorProbability: 0.1,
};

/**
 * 假任务存储类
 */
export class FakeTaskStore {
  private readonly options: FakeTaskStoreOptions;
  private readonly tasks = new Map<string, TaskData>();
  private readonly versions = new Map<string, number>();

  constructor(options?: Partial<FakeTaskStoreOptions>) {
    this.options = { ...DEFAULT_FAKE_STORE_OPTIONS, ...options };

    if (this.options.enableLogging) {
      logger.info(
        LogCategory.Task,
        LogAction.Create,
        'FakeTaskStore 已初始化',
        {
          simulateDelay: this.options.simulateDelay,
          simulateErrors: this.options.simulateErrors,
        }
      );
    }
  }

  /**
   * 获取任务数据
   */
  async getTask(taskId: string): Promise<TaskData | null> {
    await this.maybeDelay();
    this.maybeThrowError('获取任务失败');

    const task = this.tasks.get(taskId);

    if (this.options.enableLogging) {
      logger.info(LogCategory.Task, LogAction.Handle, '获取任务', {
        taskId,
        found: !!task,
      });
    }

    return task || null;
  }

  /**
   * 保存任务数据
   */
  async saveTask(task: TaskData): Promise<void> {
    await this.maybeDelay();
    this.maybeThrowError('保存任务失败');

    const now = new Date().toISOString();
    const updatedTask: TaskData = {
      ...task,
      updatedAt: now,
    };

    this.tasks.set(task.id, updatedTask);
    this.incrementVersion(task.id);

    if (this.options.enableLogging) {
      logger.info(LogCategory.Task, LogAction.Update, '保存任务', {
        taskId: task.id,
        version: this.versions.get(task.id),
      });
    }
  }

  /**
   * 创建新任务
   */
  async createTask(taskData: Partial<TaskData>): Promise<TaskData> {
    await this.maybeDelay();
    this.maybeThrowError('创建任务失败');

    const now = new Date().toISOString();
    const task: TaskData = {
      id: ulid(),
      title: taskData.title || '未命名任务',
      goal: taskData.goal || '待定义目标',
      requirements: taskData.requirements || [],
      issues: taskData.issues || [],
      hints: taskData.hints || [],
      plans: taskData.plans || [],
      expectedResults: taskData.expectedResults || [],
      contextTags: taskData.contextTags || [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      projectId: taskData.projectId || 'default-project',
      mdVersion: this.generateMdVersion(),
      sectionFingerprints: this.generateEmptyFingerprints(),
      ...taskData,
    };

    this.tasks.set(task.id, task);
    this.versions.set(task.id, 1);

    if (this.options.enableLogging) {
      logger.info(LogCategory.Task, LogAction.Create, '创建任务', {
        taskId: task.id,
        title: task.title,
      });
    }

    return task;
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<boolean> {
    await this.maybeDelay();
    this.maybeThrowError('删除任务失败');

    const existed = this.tasks.has(taskId);
    this.tasks.delete(taskId);
    this.versions.delete(taskId);

    if (this.options.enableLogging) {
      logger.info(LogCategory.Task, LogAction.Handle, '删除任务', {
        taskId,
        existed,
      });
    }

    return existed;
  }

  /**
   * 获取任务版本
   */
  async getTaskVersion(taskId: string): Promise<number> {
    await this.maybeDelay();
    return this.versions.get(taskId) || 0;
  }

  /**
   * 列出所有任务
   */
  async listTasks(): Promise<TaskData[]> {
    await this.maybeDelay();
    this.maybeThrowError('列出任务失败');

    const tasks = Array.from(this.tasks.values());

    if (this.options.enableLogging) {
      logger.info(LogCategory.Task, LogAction.Handle, '列出任务', {
        count: tasks.length,
      });
    }

    return tasks;
  }

  /**
   * 清空所有任务
   */
  async clearAll(): Promise<void> {
    await this.maybeDelay();

    const count = this.tasks.size;
    this.tasks.clear();
    this.versions.clear();

    if (this.options.enableLogging) {
      logger.info(LogCategory.Task, LogAction.Handle, '清空所有任务', {
        clearedCount: count,
      });
    }
  }

  /**
   * 获取存储统计信息
   */
  getStats(): {
    taskCount: number;
    totalPlans: number;
    totalSteps: number;
    totalEVRs: number;
  } {
    const tasks = Array.from(this.tasks.values());

    return {
      taskCount: tasks.length,
      totalPlans: tasks.reduce(
        (sum, task) => sum + (task.plans?.length || 0),
        0
      ),
      totalSteps: tasks.reduce(
        (sum, task) =>
          sum +
          (task.plans?.reduce(
            (planSum, plan) => planSum + (plan.steps?.length || 0),
            0
          ) || 0),
        0
      ),
      totalEVRs: tasks.reduce(
        (sum, task) => sum + (task.expectedResults?.length || 0),
        0
      ),
    };
  }

  /**
   * 创建示例任务数据
   */
  async createSampleTask(): Promise<TaskData> {
    const samplePlans: TaskPlan[] = [
      {
        id: 'plan-1',
        description: '实现基础功能',
        status: TaskStatus.InProgress,
        hints: ['使用 TDD 方式开发'],
        steps: [
          {
            id: 'step-1-1',
            description: '创建核心类型定义',
            status: TaskStatus.Completed,
            hints: [],
            created_at: new Date().toISOString(),
          },
          {
            id: 'step-1-2',
            description: '实现主要逻辑',
            status: TaskStatus.InProgress,
            hints: ['注意错误处理'],
            created_at: new Date().toISOString(),
          },
        ],
        created_at: new Date().toISOString(),
      },
      {
        id: 'plan-2',
        description: '编写测试用例',
        status: TaskStatus.ToDo,
        hints: [],
        steps: [
          {
            id: 'step-2-1',
            description: '单元测试',
            status: TaskStatus.ToDo,
            hints: [],
            created_at: new Date().toISOString(),
          },
          {
            id: 'step-2-2',
            description: '集成测试',
            status: TaskStatus.ToDo,
            hints: [],
            created_at: new Date().toISOString(),
          },
        ],
        created_at: new Date().toISOString(),
      },
    ];

    const sampleEVRs: ExpectedResult[] = [
      {
        id: 'evr-001',
        title: '功能正常工作',
        verify: '运行测试套件',
        expect: '所有测试通过',
        status: EVRStatus.Unknown,
        class: EVRClass.Runtime,
        referencedBy: ['plan-1'],
        runs: [],
      },
      {
        id: 'evr-002',
        title: '代码质量检查',
        verify: ['运行 lint 检查', '运行类型检查'],
        expect: ['无 lint 错误', '无类型错误'],
        status: EVRStatus.Unknown,
        class: EVRClass.Static,
        referencedBy: ['plan-2'],
        runs: [],
      },
    ];

    const sampleContextTags: ContextTag[] = [
      {
        tag: 'ref',
        value: 'docs/api.md',
        type: 'ref',
      },
      {
        tag: 'decision',
        value: '使用 TypeScript 严格模式',
        type: 'decision',
      },
    ];

    return await this.createTask({
      title: '示例任务：实现 LazySync 功能',
      goal: '实现一个高性能的同步引擎，支持差异检测和冲突解决',
      requirements: [
        '支持面板与结构化数据的双向同步',
        '实现智能冲突解决策略',
        '提供请求级缓存机制',
        '记录详细的审计日志',
      ],
      issues: ['需要处理复杂的嵌套数据结构', '性能优化需要进一步测试'],
      hints: ['使用节级指纹优化性能', 'ETag 优先 + 时间戳兜底策略'],
      plans: samplePlans,
      expectedResults: sampleEVRs,
      contextTags: sampleContextTags,
      currentPlan: 'plan-1',
      currentStep: 'step-1-2',
      projectId: 'sample-project',
    });
  }

  // 私有方法

  /**
   * 可能延迟执行
   */
  private async maybeDelay(): Promise<void> {
    if (this.options.simulateDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.options.delayMs));
    }
  }

  /**
   * 可能抛出错误
   */
  private maybeThrowError(message: string): void {
    if (
      this.options.simulateErrors &&
      Math.random() < this.options.errorProbability
    ) {
      throw new Error(`模拟错误: ${message}`);
    }
  }

  /**
   * 递增版本号
   */
  private incrementVersion(taskId: string): void {
    const currentVersion = this.versions.get(taskId) || 0;
    this.versions.set(taskId, currentVersion + 1);
  }

  /**
   * 生成 MD 版本
   */
  private generateMdVersion(): string {
    return `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成空的区域指纹
   */
  private generateEmptyFingerprints(): SectionFingerprints {
    return {
      title: '',
      requirements: '',
      issues: '',
      hints: '',
      plans: {},
      evrs: {},
      logs: '',
    };
  }
}

/**
 * 创建假任务存储实例
 */
export function createFakeTaskStore(
  options?: Partial<FakeTaskStoreOptions>
): FakeTaskStore {
  return new FakeTaskStore(options);
}
