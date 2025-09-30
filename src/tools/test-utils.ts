/**
 * 任务管理工具测试的Mock数据和辅助函数
 */

import {
  TaskStatus,
  TaskPlan,
  TaskStep,
  CurrentTask,
  TaskLog,
  LogLevel,
  LogCategory,
  LogAction,
} from '../types/index.js';
import { ulid } from 'ulid';

/**
 * 生成测试用的ULID
 */
export function generateTestULID(): string {
  return ulid();
}

/**
 * 生成测试用的时间戳
 */
export function generateTestTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 创建测试用的任务步骤
 */
export function createMockTaskStep(
  overrides: Partial<TaskStep> = {}
): TaskStep {
  const id = overrides.id || `step-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = generateTestTimestamp();

  return {
    id,
    description: '测试步骤描述',
    status: TaskStatus.ToDo,
    evidence: undefined,
    notes: undefined,
    hints: [],
    usesEVR: [],
    contextTags: [],
    created_at: timestamp,
    completed_at: undefined,
    ...overrides,
  };
}

/**
 * 创建测试用的任务计划
 */
export function createMockTaskPlan(
  overrides: Partial<TaskPlan> = {}
): TaskPlan {
  const id = overrides.id || `plan-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = generateTestTimestamp();

  return {
    id,
    description: '测试计划描述',
    status: TaskStatus.ToDo,
    evidence: undefined,
    hints: [],
    steps: [],
    evrBindings: [],
    contextTags: [],
    created_at: timestamp,
    completed_at: undefined,
    ...overrides,
  };
}

/**
 * 创建测试用的任务日志
 */
export function createMockTaskLog(overrides: Partial<TaskLog> = {}): TaskLog {
  return {
    timestamp: generateTestTimestamp(),
    level: LogLevel.Info,
    category: LogCategory.Task,
    action: LogAction.Create,
    message: '测试日志消息',
    ai_notes: '测试AI备注',
    details: {},
    ...overrides,
  };
}

/**
 * 创建测试用的完整任务
 */
export function createMockCurrentTask(
  overrides: Partial<CurrentTask> = {}
): CurrentTask {
  const id = overrides.id || generateTestULID();
  const timestamp = generateTestTimestamp();

  const defaultPlans = [
    createMockTaskPlan({
      id: 'plan-001',
      description: '第一个计划',
      status: TaskStatus.InProgress,
    }),
    createMockTaskPlan({
      id: 'plan-002',
      description: '第二个计划',
    }),
  ];

  const defaultLogs = [
    createMockTaskLog({
      category: LogCategory.Task,
      action: LogAction.Create,
      message: '任务初始化完成',
    }),
  ];

  return {
    id,
    title: '测试任务标题',
    slug: '测试任务标题',
    story: undefined,
    requirement: undefined,
    knowledge_refs: ['测试知识引用1', '测试知识引用2'],
    goal: '测试任务的验收标准和成功指标',
    task_hints: ['测试任务提示1', '测试任务提示2'],
    overall_plan: defaultPlans,
    current_plan_id: 'plan-001',
    current_step_details: '当前步骤详情描述',
    logs: defaultLogs,
    provenance: {
      git: {
        repo: 'test-repo',
        branch: 'main',
        since: 'abc123',
        until: 'def456',
        commits: ['abc123', 'def456'],
      },
      pr_links: ['https://github.com/test/repo/pull/123'],
      issue_links: ['https://github.com/test/repo/issues/456'],
      doc_links: ['https://docs.test.com/feature'],
      sources: ['src/test.ts', 'docs/test.md'],
    },
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: undefined,
    ...overrides,
  };
}

/**
 * 创建测试用的任务初始化参数
 */
export function createMockTaskInitParams(overrides: any = {}) {
  return {
    title: '实现用户认证系统',
    goal: '支持用户注册、登录、JWT鉴权和审计日志功能，确保安全性和可扩展性',
    story: 'https://github.com/project/issues/123',
    description: '为应用添加完整的用户认证和授权系统',
    knowledge_refs: ['JWT最佳实践', '密码安全指南'],
    overall_plan: [
      '数据库设计和用户模型',
      '认证API端点实现',
      '前端集成和用户界面',
      '安全测试和审计日志',
    ],
    ...overrides,
  };
}

/**
 * 创建测试用的任务更新参数
 */
export function createMockTaskUpdateParams(overrides: any = {}) {
  return {
    update_type: 'plan',
    plan_id: 'plan-001',
    status: 'in_progress',
    evidence: 'https://github.com/project/commit/abc123',
    notes: '计划开始执行',
    ...overrides,
  };
}

/**
 * 创建测试用的任务修改参数
 */
export function createMockTaskModifyParams(overrides: any = {}) {
  return {
    field: 'goal',
    content: '更新后的验收标准',
    reason: '根据需求变更调整目标',
    change_type: 'refine_goal',
    ...overrides,
  };
}

/**
 * 创建测试用的任务完成参数
 */
export function createMockTaskCompleteParams(overrides: any = {}) {
  return {
    summary: '任务已成功完成，所有功能都已实现并通过测试',
    generate_docs: true,
    ...overrides,
  };
}

/**
 * 创建测试用的日志记录参数
 */
export function createMockTaskLogParams(overrides: any = {}) {
  return {
    category: 'discussion',
    action: 'create',
    message: '讨论技术方案',
    notes: 'AI提供的详细分析和建议',
    ...overrides,
  };
}

/**
 * 验证任务数据完整性的辅助函数
 */
export function validateTaskIntegrity(task: CurrentTask): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证必填字段
  if (!task.id) errors.push('缺少任务ID');
  if (!task.title) errors.push('缺少任务标题');
  if (!task.goal) errors.push('缺少任务目标');
  if (!task.created_at) errors.push('缺少创建时间');
  if (!task.updated_at) errors.push('缺少更新时间');

  // 验证数组字段
  if (!Array.isArray(task.knowledge_refs))
    errors.push('knowledge_refs必须是数组');
  if (!Array.isArray(task.task_hints)) errors.push('task_hints必须是数组');
  if (!Array.isArray(task.overall_plan)) errors.push('overall_plan必须是数组');
  if (!Array.isArray(task.logs)) errors.push('logs必须是数组');

  // 验证计划结构
  task.overall_plan.forEach((plan, index) => {
    if (!plan.id) errors.push(`计划${index}缺少ID`);
    if (!plan.description) errors.push(`计划${index}缺少描述`);
    if (!Object.values(TaskStatus).includes(plan.status)) {
      errors.push(`计划${index}状态无效`);
    }
    if (!Array.isArray(plan.steps))
      errors.push(`计划${index}的steps必须是数组`);
    if (!Array.isArray(plan.hints))
      errors.push(`计划${index}的hints必须是数组`);
  });

  // 验证当前计划ID
  if (task.current_plan_id) {
    const currentPlan = task.overall_plan.find(
      (p) => p.id === task.current_plan_id
    );
    if (!currentPlan) errors.push('当前计划ID无效');
  }

  // 验证日志结构
  task.logs.forEach((log, index) => {
    if (!log.timestamp) errors.push(`日志${index}缺少时间戳`);
    if (!log.message) errors.push(`日志${index}缺少消息`);
    if (!Object.values(LogLevel).includes(log.level)) {
      errors.push(`日志${index}级别无效`);
    }
    if (!Object.values(LogCategory).includes(log.category)) {
      errors.push(`日志${index}类别无效`);
    }
    if (!Object.values(LogAction).includes(log.action)) {
      errors.push(`日志${index}操作无效`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 比较两个任务对象的差异
 */
export function compareTaskDifferences(
  task1: CurrentTask,
  task2: CurrentTask
): {
  differences: string[];
  identical: boolean;
} {
  const differences: string[] = [];

  // 比较基本字段
  const basicFields = [
    'id',
    'title',
    'slug',
    'goal',
    'current_plan_id',
    'current_step_details',
  ];
  basicFields.forEach((field) => {
    if (
      task1[field as keyof CurrentTask] !== task2[field as keyof CurrentTask]
    ) {
      differences.push(`${field}字段不同`);
    }
  });

  // 比较数组字段
  if (
    JSON.stringify(task1.knowledge_refs) !==
    JSON.stringify(task2.knowledge_refs)
  ) {
    differences.push('knowledge_refs不同');
  }
  if (JSON.stringify(task1.task_hints) !== JSON.stringify(task2.task_hints)) {
    differences.push('task_hints不同');
  }

  // 比较计划数量
  if (task1.overall_plan.length !== task2.overall_plan.length) {
    differences.push('计划数量不同');
  }

  // 比较日志数量
  if (task1.logs.length !== task2.logs.length) {
    differences.push('日志数量不同');
  }

  return {
    differences,
    identical: differences.length === 0,
  };
}

/**
 * 生成测试用的文件路径
 */
export function generateTestFilePath(filename: string): string {
  return `test-data/${filename}`;
}

/**
 * 创建测试用的错误响应
 */
export function createMockErrorResponse(
  error: string,
  type: string = 'VALIDATION_ERROR'
) {
  return {
    success: false,
    error,
    type,
    timestamp: generateTestTimestamp(),
  };
}

/**
 * 创建测试用的成功响应
 */
export function createMockSuccessResponse(data: any = {}) {
  return {
    success: true,
    timestamp: generateTestTimestamp(),
    ...data,
  };
}

/**
 * 模拟异步延迟
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 生成随机字符串
 */
export function generateRandomString(length: number = 10): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * 验证ULID格式
 */
export function isValidULID(id: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id);
}

/**
 * 验证ISO 8601时间戳格式
 */
export function isValidTimestamp(timestamp: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp);
}

/**
 * 验证URL格式
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建测试用的健康检查响应
 */
export function createMockHealthResponse(
  status: 'healthy' | 'warning' | 'error' = 'healthy'
) {
  return {
    status,
    checks: {
      task_integrity: {
        status: status === 'healthy' ? 'passed' : 'failed',
        issues: status === 'healthy' ? [] : ['数据完整性问题'],
      },
      file_system: {
        status: 'passed',
        issues: [],
      },
      data_consistency: {
        status: status === 'error' ? 'failed' : 'passed',
        issues: status === 'error' ? ['数据不一致'] : [],
      },
    },
    recommendations: status === 'healthy' ? [] : ['建议重新初始化任务'],
    last_check: generateTestTimestamp(),
  };
}

/**
 * 创建测试用的性能信息
 */
export function createMockPerformanceInfo() {
  return {
    read_time_ms: Math.floor(Math.random() * 100) + 10,
    cache_hit: Math.random() > 0.5,
    data_size_kb: Math.floor(Math.random() * 50) + 5,
  };
}

/**
 * 创建测试用的历史引用
 */
export function createMockHistoryRefs() {
  return {
    recent_tasks: [
      {
        id: generateTestULID(),
        title: '历史任务1',
        completed_at: generateTestTimestamp(),
        status: 'completed',
      },
      {
        id: generateTestULID(),
        title: '历史任务2',
        completed_at: generateTestTimestamp(),
        status: 'completed',
      },
    ],
    total_count: 5,
    last_updated: generateTestTimestamp(),
  };
}
