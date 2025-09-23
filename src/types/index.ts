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
  Silent = 'SILENT',
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
 * 项目身份信息（本地身份证，不含root）
 * 存储在 .wave/project.json 中
 */
export interface ProjectInfo {
  /** 项目唯一标识符 */
  id: string;
  /** 项目slug（用于显示和引用） */
  slug: string;
  /** 项目来源（可选，如Git仓库URL） */
  origin?: string;
}

/**
 * 项目记录（解析后的项目记录，含root）
 * 存储在全局注册表 ~/.wave/projects.json 中
 */
export interface ProjectRecord {
  /** 项目唯一标识符 */
  id: string;
  /** 项目根目录路径 */
  root: string;
  /** 项目slug（用于显示和引用） */
  slug: string;
  /** 项目来源（可选，如Git仓库URL） */
  origin?: string;
  /** 最后访问时间 */
  last_seen?: string;
}

/**
 * 全局项目注册表结构
 * 存储在 ~/.wave/projects.json 中
 */
export interface GlobalProjectRegistry {
  /** 项目记录映射表：project_id -> ProjectRecord */
  projects: Record<string, ProjectRecord>;
  /** 注册表版本 */
  version: string;
  /** 最后更新时间 */
  updated_at: string;
}

/**
 * 连接级项目绑定状态
 * 每个MCP连接维护一个活跃项目绑定
 */
export interface ActiveProjectBinding {
  /** 当前绑定的项目ID */
  project_id: string;
  /** 项目根目录路径 */
  root: string;
  /** 项目slug */
  slug: string;
  /** 项目来源 */
  origin?: string;
  /** 绑定时间 */
  bound_at: string;
}

/**
 * project_bind 工具参数
 */
export interface ProjectBindParams {
  /** 项目ID（可选，与project_path二选一） */
  project_id?: string;
  /** 项目路径（可选，与project_id二选一） */
  project_path?: string;
}

/**
 * project_bind 工具响应
 */
export interface ProjectBindResponse {
  /** 绑定的项目信息 */
  project: {
    id: string;
    root: string;
    slug: string;
    origin?: string;
  };
}

/**
 * project_info 工具响应
 */
export interface ProjectInfoResponse {
  /** 当前活跃项目信息 */
  project: {
    id: string;
    root: string;
    slug: string;
    origin?: string;
  };
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
 * 跨进程任务操作接口
 * 用于记录和跟踪跨进程的任务操作
 */
export interface TaskOperation {
  /** 操作类型 */
  type: 'init' | 'update' | 'modify' | 'complete' | 'read' | 'log';
  /** 代理标识 */
  agentId: string;
  /** 进程标识（工具名称+PID） */
  processId: string;
  /** 工具名称（kiro/cursor/codex等） */
  toolName: string;
  /** 操作时间戳 */
  timestamp: string;
  /** 操作参数 */
  params: any;
}

/**
 * 文件锁接口
 * 用于跨进程文件锁管理
 */
export interface FileLock {
  /** 锁文件路径 */
  lockPath: string;
  /** 进程标识 */
  processId: string;
  /** 锁创建时间戳 */
  timestamp: string;
  /** 关联的任务ID */
  taskId: string;
  /** 锁超时时间（毫秒） */
  timeout?: number;
  /** 锁类型（读锁/写锁） */
  type?: 'read' | 'write';
}

/**
 * 任务状态接口
 * 用于状态版本管理和一致性检查
 */
export interface TaskState {
  /** 状态版本号 */
  version: number;
  /** 最后修改时间 */
  lastModified: string;
  /** 修改者（进程ID） */
  modifiedBy: string;
  /** 数据校验和 */
  checksum: string;
  /** 锁状态 */
  locked: boolean;
  /** 锁持有者 */
  lockHolder?: string;
}

/**
 * 冲突信息接口
 * 用于描述跨进程操作冲突
 */
export interface ConflictInfo {
  /** 冲突类型 */
  type:
    | 'concurrent_update'
    | 'state_mismatch'
    | 'hint_collision'
    | 'version_conflict'
    | 'lock_timeout';
  /** 冲突的操作列表 */
  operations: TaskOperation[];
  /** 解决方案 */
  resolution: 'merge' | 'reject' | 'queue' | 'retry';
  /** 冲突的进程列表 */
  conflictingProcesses: string[];
  /** 冲突详情 */
  details?: Record<string, any>;
}

/**
 * 提示集合接口
 * 用于管理不同层级的提示信息
 */
export interface HintCollection {
  /** 任务级提示 */
  task: string[];
  /** 计划级提示 */
  plan: string[];
  /** 步骤级提示 */
  step: string[];
}

/**
 * 任务上下文接口
 * 用于提供操作上下文信息
 */
export interface TaskContext {
  /** 当前计划ID */
  currentPlanId?: string;
  /** 当前步骤ID */
  currentStepId?: string;
  /** 操作类型 */
  operationType: string;
  /** 进程ID */
  processId: string;
  /** 期望的状态版本 */
  expectedVersion?: number;
}

/**
 * 文件锁获取选项接口
 */
export interface LockAcquisitionOptions {
  /** 超时时间（毫秒），默认30秒 */
  timeout?: number;
  /** 重试间隔（毫秒），默认100毫秒 */
  retryInterval?: number;
  /** 最大重试次数，默认300次 */
  maxRetries?: number;
  /** 锁类型，默认写锁 */
  lockType?: 'read' | 'write';
  /** 是否强制获取锁（清理过期锁） */
  force?: boolean;
  /** 取消信号 */
  signal?: AbortSignal;
  /** 当前持有的锁（用于死锁预防） */
  currentHeldLocks?: string[];
}

/**
 * 原子操作结果接口
 */
export interface AtomicOperationResult<T = any> {
  /** 操作是否成功 */
  success: boolean;
  /** 操作结果数据 */
  data?: T;
  /** 新的状态版本 */
  version?: number;
  /** 错误信息 */
  error?: string;
  /** 是否发生了冲突 */
  conflict?: boolean;
  /** 冲突详情 */
  conflictInfo?: ConflictInfo;
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
