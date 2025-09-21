// 核心类型定义

/**
 * 任务状态枚举
 * 定义任务和步骤的执行状态
 */
export enum TaskStatus {
  /** 待办状态 - 任务或步骤尚未开始 */
  ToDo = 'to_do',
  /** 进行中状态 - 任务或步骤正在执行 */
  InProgress = 'in_progress',
  /** 已完成状态 - 任务或步骤已成功完成 */
  Completed = 'completed',
  /** 阻塞状态 - 任务或步骤因某些原因无法继续 */
  Blocked = 'blocked',
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  Info = 'INFO',
  Warning = 'WARNING',
  Error = 'ERROR',
  Teach = 'TEACH',
}

/**
 * 日志类别枚举
 */
export enum LogCategory {
  Plan = 'PLAN',
  Step = 'STEP',
  Task = 'TASK',
  Knowledge = 'KNOWLEDGE',
  Discussion = 'DISCUSSION',
  Exception = 'EXCEPTION',
  Test = 'TEST',
  Health = 'HEALTH',
}

/**
 * 日志操作枚举
 */
export enum LogAction {
  Update = 'UPDATE',
  Create = 'CREATE',
  Modify = 'MODIFY',
  Switch = 'SWITCH',
  Handle = 'HANDLE',
}

/**
 * MCP 工具响应基础接口
 */
export interface MCPResponse {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * 健康检查响应接口
 */
export interface HealthCheckResponse extends MCPResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
}

/**
 * 项目根目录信息
 */
export interface ProjectRootInfo {
  root: string;
  source: 'client_roots' | 'cwd_fallback';
  available: boolean;
}

/**
 * 任务步骤接口
 * 表示任务计划中的具体执行步骤
 */
export interface TaskStep {
  /** 步骤唯一标识 */
  id: string;
  /** 步骤描述 */
  description: string;
  /** 步骤状态 */
  status: TaskStatus;
  /** 完成证据链接（可选） */
  evidence?: string;
  /** 步骤备注（可选） */
  notes?: string;
  /** 步骤级用户提示 */
  hints: string[];
  /** 创建时间 (ISO 8601) */
  created_at: string;
  /** 完成时间 (ISO 8601)（可选） */
  completed_at?: string;
}

/**
 * 整体计划项接口
 * 表示任务的高层级计划，包含多个执行步骤
 */
export interface TaskPlan {
  /** 计划唯一标识 */
  id: string;
  /** 计划描述 */
  description: string;
  /** 计划状态 */
  status: TaskStatus;
  /** 完成证据链接（可选） */
  evidence?: string;
  /** 计划备注（可选） */
  notes?: string;
  /** 计划级用户提示 */
  hints: string[];
  /** 该计划下的具体步骤 */
  steps: TaskStep[];
  /** 创建时间 (ISO 8601) */
  created_at: string;
  /** 完成时间 (ISO 8601)（可选） */
  completed_at?: string;
}

/**
 * 任务日志接口
 * 记录任务执行过程中的各种活动和状态变更
 */
export interface TaskLog {
  /** 时间戳 (ISO 8601) */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 内容类别 */
  category: LogCategory;
  /** 操作类别 */
  action: LogAction;
  /** 日志消息 */
  message: string;
  /** AI 提供的详细说明（可选） */
  ai_notes?: string;
  /** 详细信息（可选） */
  details?: Record<string, any>;
}

/**
 * 当前任务接口
 * 表示完整的任务信息，包含计划、步骤、日志等所有相关数据
 */
export interface CurrentTask {
  /** 任务唯一标识（ULID） */
  id: string;
  /** 任务标题 */
  title: string;
  /** 标题生成的稳定 slug */
  slug: string;
  /** Story 元信息（可选） */
  story?: {
    id?: string;
    slug?: string;
    url?: string;
    title?: string;
  };
  /** Requirement 元信息（可选） */
  requirement?: {
    id?: string;
    url?: string;
    title?: string;
  };
  /** 知识引用 */
  knowledge_refs: string[];
  /** 任务验收标准和成功指标 */
  goal: string;
  /** 任务级用户提示 */
  task_hints: string[];
  /** 整体计划列表 */
  overall_plan: TaskPlan[];
  /** 当前执行的计划ID（可选） */
  current_plan_id?: string;
  /** 当前步骤详情描述（可选） */
  current_step_details?: string;
  /** 任务日志 */
  logs: TaskLog[];
  /** 可溯源信息（可选） */
  provenance?: {
    git?: {
      repo?: string;
      branch?: string;
      since?: string;
      until?: string;
      commits?: string[];
    };
    pr_links?: string[];
    issue_links?: string[];
    doc_links?: string[];
    sources?: string[];
  };
  /** 创建时间 (ISO 8601) */
  created_at: string;
  /** 更新时间 (ISO 8601) */
  updated_at: string;
  /** 完成时间 (ISO 8601)（可选） */
  completed_at?: string;
}
