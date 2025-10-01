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
  // 高亮标记
  Verified = 'VERIFIED',
  Failed = 'FAILED',
  PanelEdit = 'PANEL_EDIT',
  Decision = 'DECISION',
  Impact = 'IMPACT',
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
 * @deprecated 使用 ConnectParams 代替，该类型仅为向后兼容保留
 */
export interface ProjectBindParams {
  /** 项目ID（可选，与project_path二选一） */
  project_id?: string;
  /** 项目路径（可选，与project_id二选一） */
  project_path?: string;
}

/**
 * project_bind 工具响应
 * @deprecated 使用 ConnectionResult 代替，该类型仅为向后兼容保留
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
  /** 只读引用的 EVR IDs */
  usesEVR: string[];
  /** 上下文标签 */
  contextTags: ContextTag[];
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
  /** 绑定的 EVR IDs */
  evrBindings: string[];
  /** 上下文标签 */
  contextTags: ContextTag[];
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
 * 项目类型枚举
 * 定义支持的项目类型
 */
export enum ProjectType {
  /** Node.js 项目 */
  NodeJS = 'nodejs',
  /** Python 项目 */
  Python = 'python',
  /** Rust 项目 */
  Rust = 'rust',
  /** Java 项目 */
  Java = 'java',
  /** Go 项目 */
  Go = 'go',
  /** C/C++ 项目 */
  CPP = 'cpp',
  /** C# 项目 */
  CSharp = 'csharp',
  /** PHP 项目 */
  PHP = 'php',
  /** Ruby 项目 */
  Ruby = 'ruby',
  /** Git 仓库 */
  Git = 'git',
  /** 通用项目 */
  Generic = 'generic',
  /** 未知类型 */
  Unknown = 'unknown',
}

/**
 * 项目类型检测结果接口
 */
export interface ProjectTypeDetectionResult {
  /** 检测到的项目类型 */
  type: ProjectType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 检测依据的文件列表 */
  evidenceFiles: string[];
  /** 检测到的特征 */
  features: ProjectFeature[];
  /** 项目根目录路径 */
  rootPath?: string;
  /** 检测到的版本信息 */
  version?: string;
  /** 项目名称 */
  name?: string;
  /** 项目描述 */
  description?: string;
}

/**
 * 项目特征接口
 */
export interface ProjectFeature {
  /** 特征类型 */
  type:
  | 'config_file'
  | 'dependency_file'
  | 'source_file'
  | 'build_file'
  | 'git_repo'
  | 'directory_structure';
  /** 特征名称 */
  name: string;
  /** 特征文件路径 */
  path: string;
  /** 特征权重 */
  weight: number;
  /** 特征描述 */
  description?: string;
}

/**
 * 项目根目录检测结果接口
 */
export interface ProjectRootDetectionResult {
  /** 检测到的项目根目录 */
  rootPath: string;
  /** 检测方法 */
  method: 'git_root' | 'config_file' | 'parent_search' | 'current_dir';
  /** 检测依据的文件 */
  evidenceFile?: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 搜索深度 */
  searchDepth: number;
}

/**
 * 项目结构验证结果接口
 */
export interface ProjectStructureValidationResult {
  /** 验证是否通过 */
  valid: boolean;
  /** 项目类型 */
  projectType: ProjectType;
  /** 验证错误列表 */
  errors: string[];
  /** 验证警告列表 */
  warnings: string[];
  /** 缺失的必需文件 */
  missingRequiredFiles: string[];
  /** 建议的改进 */
  suggestions: string[];
  /** 项目健康度评分 (0-100) */
  healthScore: number;
}

/**
 * 项目健康检查结果接口
 */
export interface ProjectHealthCheckResult {
  /** 整体健康状态 */
  status: 'healthy' | 'warning' | 'error';
  /** 健康度评分 (0-100) */
  score: number;
  /** 检查项目结果 */
  checks: ProjectHealthCheck[];
  /** .wave 目录结构状态 */
  waveStructure: WaveStructureStatus;
  /** 项目配置状态 */
  projectConfig: ProjectConfigStatus;
  /** 建议的修复操作 */
  recommendations: string[];
}

/**
 * 项目健康检查项接口
 */
export interface ProjectHealthCheck {
  /** 检查项名称 */
  name: string;
  /** 检查状态 */
  status: 'pass' | 'warning' | 'fail';
  /** 检查消息 */
  message: string;
  /** 检查详情 */
  details?: Record<string, any>;
  /** 修复建议 */
  suggestion?: string;
}

/**
 * .wave 目录结构状态接口
 */
export interface WaveStructureStatus {
  /** 目录是否存在 */
  exists: boolean;
  /** 必需的子目录状态 */
  directories: Record<string, boolean>;
  /** 必需的文件状态 */
  files: Record<string, boolean>;
  /** 权限状态 */
  permissions: {
    readable: boolean;
    writable: boolean;
  };
  /** 缺失的项目 */
  missing: string[];
  /** 损坏的项目 */
  corrupted: string[];
}

/**
 * 项目配置状态接口
 */
export interface ProjectConfigStatus {
  /** 项目信息文件状态 */
  projectInfo: {
    exists: boolean;
    valid: boolean;
    error?: string;
  };
  /** 全局注册表状态 */
  globalRegistry: {
    exists: boolean;
    valid: boolean;
    registered: boolean;
    error?: string;
  };
  /** 配置一致性 */
  consistency: {
    valid: boolean;
    issues: string[];
  };
}

/**
 * 项目类型检测器配置接口
 */
export interface ProjectTypeDetectorConfig {
  /** 最大搜索深度 */
  maxSearchDepth: number;
  /** 最小置信度阈值 */
  minConfidenceThreshold: number;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 缓存过期时间（毫秒） */
  cacheExpiration: number;
  /** 自定义检测规则 */
  customRules?: ProjectDetectionRule[];
}

/**
 * 项目检测规则接口
 */
export interface ProjectDetectionRule {
  /** 规则名称 */
  name: string;
  /** 项目类型 */
  projectType: ProjectType;
  /** 必需文件模式 */
  requiredFiles: string[];
  /** 可选文件模式 */
  optionalFiles?: string[];
  /** 排除文件模式 */
  excludeFiles?: string[];
  /** 目录结构模式 */
  directoryPatterns?: string[];
  /** 文件内容模式 */
  contentPatterns?: Array<{
    file: string;
    pattern: RegExp;
    weight: number;
  }>;
  /** 规则权重 */
  weight: number;
  /** 最小置信度 */
  minConfidence: number;
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
  /** 预期可见结果列表 */
  expectedResults?: ExpectedResult[];
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

/**
 * 多任务管理相关接口
 */

/**
 * 任务归档信息接口
 * 用于多任务目录结构中的任务存储
 */
export interface TaskArchive {
  /** 任务完整信息 */
  task: CurrentTask;
  /** 归档路径 */
  archivePath: string;
  /** 归档时间 */
  archivedAt: string;
  /** 任务目录路径 */
  taskDir: string;
  /** 任务文件路径映射 */
  files: {
    /** 任务数据文件 */
    taskJson: string;
    /** 当前任务文档 */
    currentMd: string;
    /** 结构化日志文件 */
    logsJsonl: string;
    /** 开发日志文件（可选） */
    devlogMd?: string;
  };
}

/**
 * 任务摘要信息接口
 * 用于任务列表和索引
 */
export interface TaskSummary {
  /** 任务唯一标识 */
  id: string;
  /** 任务标题 */
  title: string;
  /** 任务slug */
  slug: string;
  /** 任务状态 */
  status: 'active' | 'completed' | 'archived';
  /** 创建时间 */
  created_at: string;
  /** 完成时间（可选） */
  completed_at?: string;
  /** 更新时间 */
  updated_at: string;
  /** 任务目标摘要 */
  goal: string;
  /** 任务目录路径 */
  taskDir: string;
  /** 计划进度 */
  progress: {
    /** 总计划数 */
    totalPlans: number;
    /** 已完成计划数 */
    completedPlans: number;
    /** 当前计划ID */
    currentPlanId?: string;
  };
}

/**
 * 任务索引接口
 * 用于管理所有任务的索引信息
 */
export interface TaskIndex {
  /** 索引版本 */
  version: string;
  /** 最后更新时间 */
  updated_at: string;
  /** 任务摘要列表 */
  tasks: TaskSummary[];
  /** 统计信息 */
  stats: {
    /** 总任务数 */
    total: number;
    /** 活跃任务数 */
    active: number;
    /** 已完成任务数 */
    completed: number;
    /** 已归档任务数 */
    archived: number;
  };
}

/**
 * 最新任务指针接口
 * 用于快速访问最新任务
 */
export interface LatestTaskPointer {
  /** 当前活跃任务ID */
  current_task_id?: string;
  /** 最后更新时间 */
  updated_at: string;
  /** 最近任务列表（最多10个） */
  recent_tasks: Array<{
    id: string;
    title: string;
    slug: string;
    updated_at: string;
    taskDir: string;
  }>;
}

/**
 * Slug视图索引接口
 * 用于按slug快速查找任务
 */
export interface SlugViewIndex {
  /** slug名称 */
  slug: string;
  /** 关联的任务列表 */
  tasks: Array<{
    id: string;
    title: string;
    created_at: string;
    taskDir: string;
    status: 'active' | 'completed' | 'archived';
  }>;
  /** 最后更新时间 */
  updated_at: string;
}

/**
 * 任务目录路径信息接口
 */
export interface TaskDirectoryInfo {
  /** 任务ID */
  taskId: string;
  /** 任务slug */
  slug: string;
  /** 创建日期 */
  date: Date;
  /** 完整目录路径 */
  fullPath: string;
  /** 相对路径（相对于.wave/tasks/） */
  relativePath: string;
  /** 目录名称（<slug>--<id8>格式） */
  dirName: string;
  /** 短ID（ULID前8位） */
  shortId: string;
}

/**
 * 任务列表查询参数接口
 */
export interface TaskListParams {
  /** 状态过滤 */
  status?: 'active' | 'completed' | 'archived' | 'all';
  /** 限制返回数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 排序方式 */
  sort?: 'created_at' | 'updated_at' | 'title';
  /** 排序方向 */
  order?: 'asc' | 'desc';
  /** 搜索关键词 */
  search?: string;
  /** 项目ID过滤 */
  project_id?: string;
}

/**
 * 任务列表响应接口
 */
export interface TaskListResponse {
  /** 任务摘要列表 */
  tasks: TaskSummary[];
  /** 总数 */
  total: number;
  /** 分页信息 */
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  /** 统计信息 */
  stats: TaskIndex['stats'];
}

/**
 * 任务切换参数接口
 */
export interface TaskSwitchParams {
  /** 目标任务ID */
  task_id: string;
  /** 项目ID（可选） */
  project_id?: string;
}

/**
 * 任务切换响应接口
 */
export interface TaskSwitchResponse {
  /** 切换成功标志 */
  switched: true;
  /** 当前任务ID */
  current_task_id: string;
  /** 任务信息 */
  task: CurrentTask;
  /** 切换时间 */
  switched_at: string;
}

/**
 * 数据迁移状态接口
 */
export interface MigrationStatus {
  /** 是否需要迁移 */
  needsMigration: boolean;
  /** 迁移类型 */
  migrationType: 'single_to_multi' | 'structure_upgrade' | 'none';
  /** 发现的旧数据 */
  legacyData: {
    /** 旧的current-task.json文件 */
    currentTaskJson?: string;
    /** 旧的history目录 */
    historyDir?: string;
    /** 其他需要迁移的文件 */
    otherFiles: string[];
  };
  /** 迁移计划 */
  migrationPlan: {
    /** 需要创建的目录 */
    directoriesToCreate: string[];
    /** 需要移动的文件 */
    filesToMove: Array<{
      from: string;
      to: string;
    }>;
    /** 需要转换的数据 */
    dataToTransform: Array<{
      source: string;
      target: string;
      type: 'task_json' | 'logs_jsonl' | 'current_md';
    }>;
  };
}

/**
 * 数据迁移结果接口
 */
export interface MigrationResult {
  /** 迁移是否成功 */
  success: boolean;
  /** 迁移的任务数量 */
  migratedTasks: number;
  /** 创建的文件列表 */
  createdFiles: string[];
  /** 移动的文件列表 */
  movedFiles: string[];
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
  /** 迁移耗时（毫秒） */
  duration: number;
}

// ============================================================================
// 面向结果的任务管理系统 - 核心类型定义
// ============================================================================

/**
 * 预期可见结果（EVR）状态枚举
 */
export enum EVRStatus {
  /** 通过 - 验证成功 */
  Pass = 'pass',
  /** 失败 - 验证失败 */
  Fail = 'fail',
  /** 跳过 - 有理由跳过验证 */
  Skip = 'skip',
  /** 未知 - 尚未验证 */
  Unknown = 'unknown',
}

/**
 * EVR 类别枚举
 */
export enum EVRClass {
  /** 运行时验证 - 需要执行后验证 */
  Runtime = 'runtime',
  /** 静态验证 - 可一次性验证 */
  Static = 'static',
}

/**
 * 同步冲突类型枚举
 */
export enum SyncConflictType {
  /** ETag 不匹配 */
  EtagMismatch = 'etag_mismatch',
  /** 并发更新 */
  ConcurrentUpdate = 'concurrent_update',
  /** 解析错误 */
  ParseError = 'parse_error',
}

/**
 * 冲突解决策略枚举
 */
export enum ConflictResolution {
  /** 使用我们的版本 */
  Ours = 'ours',
  /** 使用他们的版本 */
  Theirs = 'theirs',
  /** 合并版本 */
  Merged = 'merged',
}

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 连接相关
  NO_PROJECT_BOUND = 'NO_PROJECT_BOUND',
  NO_ACTIVE_TASK = 'NO_ACTIVE_TASK',
  INVALID_ROOT = 'INVALID_ROOT',
  NOT_FOUND = 'NOT_FOUND',
  MULTIPLE_CANDIDATES = 'MULTIPLE_CANDIDATES',
  MISSING_PERMISSIONS = 'MISSING_PERMISSIONS',

  // EVR 相关
  EVR_NOT_READY = 'EVR_NOT_READY',
  EVR_VALIDATION_FAILED = 'EVR_VALIDATION_FAILED',

  // 同步相关
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  PARSE_ERROR = 'PARSE_ERROR',
  RENDER_ERROR = 'RENDER_ERROR',

  // 业务逻辑
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  PLAN_GATE_BLOCKED = 'PLAN_GATE_BLOCKED',
}

/**
 * 预期可见结果（EVR）接口
 */
export interface ExpectedResult {
  /** EVR 唯一标识 */
  id: string;
  /** EVR 标题 */
  title: string;
  /** 验证方法（字符串或字符串数组） */
  verify: string | string[];
  /** 预期结果（字符串或字符串数组） */
  expect: string | string[];
  /** EVR 状态 */
  status: EVRStatus;
  /** EVR 类别 */
  class?: EVRClass;
  /** 最后运行时间 */
  lastRun?: string;
  /** 备注信息 */
  notes?: string;
  /** 证据链接 */
  proof?: string;
  /** 引用该 EVR 的计划 IDs */
  referencedBy: string[];
  /** 验证运行记录 */
  runs: VerificationRun[];
}

/**
 * 验证运行记录接口
 */
export interface VerificationRun {
  /** 运行时间 */
  at: string;
  /** 运行者 */
  by: 'ai' | 'user' | 'ci' | string;
  /** 运行状态 */
  status: EVRStatus;
  /** 运行备注 */
  notes?: string;
  /** 运行证据 */
  proof?: string;
}

/**
 * EVR 摘要接口
 */
export interface EVRSummary {
  /** 总数 */
  total: number;
  /** 通过的 EVR IDs */
  passed: string[];
  /** 跳过的 EVR IDs */
  skipped: string[];
  /** 失败的 EVR IDs */
  failed: string[];
  /** 未知状态的 EVR IDs */
  unknown: string[];
  /** 未被引用的 EVR IDs */
  unreferenced: string[];
}

/**
 * EVR 详情接口（用于 TaskReadResponse）
 */
export interface EVRDetail {
  /** EVR ID */
  evrId: string;
  /** EVR 标题 */
  title: string;
  /** EVR 状态 */
  status: EVRStatus;
  /** 最后运行时间 */
  lastRun?: string;
  /** 引用该 EVR 的计划 IDs */
  referencedBy: string[];
  /** 验证运行记录 */
  runs: VerificationRun[];
}

/**
 * 上下文标签接口
 */
export interface ContextTag {
  /** 标签类型 */
  tag: string;
  /** 标签值 */
  value: string;
  /** 标签类型分类 */
  type:
  | 'ref'
  | 'decision'
  | 'discuss'
  | 'inputs'
  | 'constraints'
  | 'evr'
  | 'uses_evr';
}

/**
 * 同步冲突接口
 */
export interface SyncConflict {
  /** 冲突区域 */
  region: string;
  /** 冲突字段 */
  field: string;
  /** 冲突原因 */
  reason: SyncConflictType;
  /** 我们的时间戳 */
  oursTs?: string;
  /** 他们的时间戳 */
  theirsTs?: string;
}

/**
 * 已解决冲突接口
 */
export interface ResolvedConflict extends SyncConflict {
  /** 解决方案 */
  resolution: ConflictResolution;
}

/**
 * 同步变更接口
 */
export interface SyncChange {
  /** 变更类型 */
  type: 'content' | 'structure';
  /** 变更区域 */
  section: string;
  /** 变更字段 */
  field: string;
  /** 旧值 */
  oldValue: any;
  /** 新值 */
  newValue: any;
  /** 变更来源 */
  source: 'panel' | 'structured';
}

/**
 * 同步预览接口
 */
export interface SyncPreview {
  /** 是否已应用 */
  applied: boolean;
  /** 变更列表 */
  changes: SyncChange[];
  /** 冲突列表 */
  conflicts: SyncConflict[];
  /** 受影响的区域 */
  affectedSections: string[];
}

/**
 * 区域指纹接口
 */
export interface SectionFingerprints {
  /** 标题指纹 */
  title: string;
  /** 需求指纹 */
  requirements: string;
  /** 问题指纹 */
  issues: string;
  /** 提示指纹 */
  hints: string;
  /** 计划指纹映射 */
  plans: Record<string, string>;
  /** EVR 指纹映射 */
  evrs: Record<string, string>;
  /** 日志指纹 */
  logs: string;
}

/**
 * 审计日志条目接口
 */
export interface AuditEntry {
  /** 时间戳 */
  timestamp: string;
  /** 类型 */
  type: 'sync' | 'conflict' | 'panel_edit';
  /** 详情 */
  details: Record<string, any>;
  /** 受影响的 IDs */
  affectedIds: string[];
}

/**
 * EVR 验证结果接口
 */
export interface EVRValidationResult {
  /** 是否就绪 */
  ready: boolean;
  /** EVR 摘要 */
  summary: EVRSummary;
  /** 需要最终验证的 EVR 列表 */
  requiredFinal: Array<{
    evr_id: string;
    reason: 'need_reason_for_skip' | 'status_unknown' | 'failed';
  }>;
}

/**
 * 计划门槛检查结果接口
 */
export interface PlanGateResult {
  /** 是否可以完成 */
  canComplete: boolean;
  /** 待处理的 EVR IDs */
  pendingEVRs: string[];
  /** 绑定的 EVR IDs */
  boundEVRs: string[];
}

/**
 * 任务完成检查结果接口
 */
export interface TaskCompletionResult {
  /** 是否可以完成 */
  canComplete: boolean;
  /** EVR 验证结果 */
  evrValidation: EVRValidationResult;
  /** 错误码 */
  errorCode?: ErrorCode;
}

/**
 * 静态 EVR 验证结果接口
 */
export interface StaticValidationResult {
  /** 是否通过 */
  passed: boolean;
  /** 是否满足预期 */
  meetsExpectation: boolean;
  /** 是否无差异 */
  isDiffClean: boolean;
  /** 验证消息 */
  message?: string;
}
// ============================================================================
// 面板解析器相关类型定义
// ============================================================================

/**
 * 复选框状态映射
 */
export enum CheckboxState {
  /** 待办 - [ ] */
  ToDo = 'to_do',
  /** 进行中 - [-] */
  InProgress = 'in_progress',
  /** 已完成 - [x] */
  Completed = 'completed',
  /** 阻塞 - [!] */
  Blocked = 'blocked',
}

/**
 * 解析的面板数据结构
 */
export interface ParsedPanel {
  /** 任务标题 */
  title: string;
  /** 需求列表 */
  requirements: string[];
  /** 问题列表 */
  issues: string[];
  /** 提示列表 */
  hints: string[];
  /** 解析的计划列表 */
  plans: ParsedPlan[];
  /** 解析的 EVR 列表 */
  evrs: ParsedEVR[];
  /** 解析的日志列表 */
  logs: ParsedLog[];
  /** 面板元数据 */
  metadata: PanelMetadata;
}

/**
 * 解析的计划数据结构
 */
export interface ParsedPlan {
  /** 计划 ID（从锚点或序号推导） */
  id: string;
  /** 计划描述文本 */
  text: string;
  /** 计划状态 */
  status: CheckboxState;
  /** 计划级提示 */
  hints: string[];
  /** 上下文标签 */
  contextTags: ContextTag[];
  /** EVR 绑定 */
  evrBindings: string[];
  /** 解析的步骤列表 */
  steps: ParsedStep[];
  /** 稳定锚点 */
  anchor?: string;
  /** 序号路径（如 "1", "2.1" 等） */
  numberPath?: string;
}

/**
 * 解析的步骤数据结构
 */
export interface ParsedStep {
  /** 步骤 ID（从锚点或序号推导） */
  id: string;
  /** 步骤描述文本 */
  text: string;
  /** 步骤状态 */
  status: CheckboxState;
  /** 步骤级提示 */
  hints: string[];
  /** 上下文标签 */
  contextTags: ContextTag[];
  /** EVR 引用 */
  usesEVR: string[];
  /** 稳定锚点 */
  anchor?: string;
  /** 序号路径（如 "1.1", "2.3" 等） */
  numberPath?: string;
}

/**
 * 解析的 EVR 数据结构
 */
export interface ParsedEVR {
  /** EVR ID */
  id: string;
  /** EVR 标题 */
  title: string;
  /** 验证方法 */
  verify: string | string[];
  /** 预期结果 */
  expect: string | string[];
  /** EVR 状态 */
  status: EVRStatus;
  /** EVR 类别 */
  class?: EVRClass;
  /** 最后运行时间 */
  lastRun?: string;
  /** 备注信息 */
  notes?: string;
  /** 证据链接 */
  proof?: string;
  /** 验证运行记录 */
  runs: VerificationRun[];
  /** 稳定锚点 */
  anchor?: string;
}

/**
 * 解析的日志数据结构
 */
export interface ParsedLog {
  /** 时间戳 */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 内容类别 */
  category: LogCategory;
  /** 操作类别 */
  action: LogAction;
  /** 日志消息 */
  message: string;
  /** AI 提供的详细说明 */
  aiNotes?: string;
  /** 详细信息 */
  details?: Record<string, any>;
}

/**
 * 面板元数据
 */
export interface PanelMetadata {
  /** 解析时间戳 */
  parsedAt: string;
  /** 面板版本/ETag */
  version?: string;
  /** 解析器版本 */
  parserVersion: string;
  /** 解析统计 */
  stats: {
    /** 总计划数 */
    totalPlans: number;
    /** 总步骤数 */
    totalSteps: number;
    /** 总 EVR 数 */
    totalEVRs: number;
    /** 解析错误数 */
    parseErrors: number;
    /** 容错修复数 */
    toleranceFixCount: number;
  };
  /** 解析错误列表 */
  parseErrors: PanelParseError[];
  /** 容错修复记录 */
  toleranceFixes: ToleranceFix[];
}

/**
 * 解析错误信息
 */
export interface PanelParseError {
  /** 错误类型 */
  type:
  | 'missing_anchor'
  | 'invalid_checkbox'
  | 'malformed_section'
  | 'duplicate_id';
  /** 错误消息 */
  message: string;
  /** 错误位置（行号） */
  line?: number;
  /** 错误上下文 */
  context?: string;
  /** 修复建议 */
  suggestion?: string;
}

/**
 * 容错修复记录
 */
export interface ToleranceFix {
  /** 修复类型 */
  type:
  | 'normalize_checkbox'
  | 'generate_anchor'
  | 'fix_indentation'
  | 'add_missing_line';
  /** 修复描述 */
  description: string;
  /** 修复位置（行号） */
  line?: number;
  /** 原始内容 */
  original?: string;
  /** 修复后内容 */
  fixed?: string;
}

/**
 * 面板解析选项
 */
export interface PanelParseOptions {
  /** 是否启用容错解析 */
  enableTolerance: boolean;
  /** 是否自动生成缺失的锚点 */
  generateMissingAnchors: boolean;
  /** 是否标准化复选框格式 */
  normalizeCheckboxes: boolean;
  /** 是否修复缩进问题 */
  fixIndentation: boolean;
  /** 最大容错修复次数 */
  maxToleranceFixes: number;
  /** 解析器版本 */
  parserVersion: string;
}

/**
 * 面板区域类型
 */
export enum PanelSection {
  /** 标题区域 */
  Title = 'title',
  /** 需求区域 */
  Requirements = 'requirements',
  /** 问题区域 */
  Issues = 'issues',
  /** 提示区域 */
  Hints = 'hints',
  /** 计划区域 */
  Plans = 'plans',
  /** EVR 区域 */
  EVRs = 'evrs',
  /** 日志区域 */
  Logs = 'logs',
}

/**
 * 锚点匹配结果
 */
export interface AnchorMatch {
  /** 锚点 ID */
  id: string;
  /** 锚点类型 */
  type: 'plan' | 'step' | 'evr';
  /** 匹配的行号 */
  line: number;
  /** 原始锚点文本 */
  raw: string;
}

/**
 * 序号路径匹配结果
 */
export interface NumberPathMatch {
  /** 序号路径（如 "1", "2.1" 等） */
  path: string;
  /** 匹配的行号 */
  line: number;
  /** 层级深度 */
  depth: number;
  /** 是否为计划级（深度为1） */
  isPlan: boolean;
  /** 是否为步骤级（深度大于1） */
  isStep: boolean;
}
/**
 * 任务数据接口（用于同步引擎）
 * 基于 CurrentTask 的简化版本，专门用于同步操作
 */
export interface TaskData {
  /** 任务唯一标识 */
  id: string;
  /** 任务标题 */
  title: string;
  /** 任务验收标准和成功指标 */
  goal: string;
  /** 需求列表 */
  requirements: string[];
  /** 问题列表 */
  issues?: string[];
  /** 任务级提示 */
  hints?: string[];
  /** 整体计划列表 */
  plans?: TaskPlan[];
  /** 当前执行的计划ID */
  currentPlan?: string;
  /** 当前步骤ID */
  currentStep?: string;
  /** 预期可见结果列表 */
  expectedResults?: ExpectedResult[];
  /** 上下文标签 */
  contextTags?: ContextTag[];
  /** 任务状态 */
  status?: 'active' | 'completed' | 'archived';
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 项目ID */
  projectId: string;
  /** MD 版本（ETag） */
  mdVersion?: string;
  /** 区域指纹 */
  sectionFingerprints?: SectionFingerprints;
}

// ============================================================================
// 项目连接管理系统 - 新增类型定义
// ============================================================================

/**
 * 项目连接参数接口
 */
export interface ConnectParams {
  /** 绝对路径，优先级最高 */
  root?: string;
  /** 项目标识符 */
  slug?: string;
  /** 仓库地址 */
  repo?: string;
}

/**
 * 项目连接结果接口
 */
export interface ConnectionResult {
  /** 是否连接成功 */
  connected: boolean;
  /** 连接的项目信息 */
  project?: ProjectInfo & { root: string };
  /** 错误码 */
  error?: ErrorCode;
  /** 候选项目列表（当有多个匹配时） */
  candidates?: (ProjectInfo & { root: string })[];
  /** 错误消息 */
  message?: string;
}

/**
 * 连接状态接口
 */
export interface ConnectionStatus {
  /** 是否已连接 */
  connected: boolean;
  /** 当前连接的项目信息 */
  project?: ProjectInfo;
  /** 连接时间 */
  connectedAt?: string;
  /** 会话ID */
  sessionId?: string;
}

/**
 * 增强的项目信息接口（用于连接管理）
 */
export interface EnhancedProjectInfo extends ProjectInfo {
  /** 项目根目录路径 */
  root: string;
  /** 仓库地址（可选） */
  repo?: string;
  /** 活动任务摘要 */
  activeTask?: TaskSummary;
  /** 最近任务列表 */
  recentTasks: TaskSummary[];
  /** 最后访问时间 */
  lastAccessed?: string;
}

/**
 * 项目解析结果接口
 */
export interface ProjectResolveResult {
  /** 是否找到项目 */
  found: boolean;
  /** 匹配的项目列表 */
  projects: EnhancedProjectInfo[];
  /** 解析方法 */
  method: 'root' | 'slug' | 'repo';
  /** 搜索参数 */
  searchParam: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 会话绑定信息接口
 */
export interface SessionBinding {
  /** 会话ID */
  sessionId: string;
  /** 绑定的项目ID */
  projectId: string;
  /** 绑定时间 */
  boundAt: string;
  /** 最后活动时间 */
  lastActivity: string;
  /** 绑定状态 */
  status: 'active' | 'inactive' | 'expired';
}

/**
 * 项目连接管理器状态接口
 */
export interface ProjectRegistryState {
  /** 当前会话绑定 */
  currentBinding?: SessionBinding;
  /** 连接历史 */
  connectionHistory: Array<{
    projectId: string;
    connectedAt: string;
    disconnectedAt?: string;
    duration?: number;
  }>;
  /** 统计信息 */
  stats: {
    /** 总连接次数 */
    totalConnections: number;
    /** 唯一项目数 */
    uniqueProjects: number;
    /** 平均连接时长（毫秒） */
    averageConnectionDuration: number;
  };
}
/**
 * 日志条目接口（用于高亮日志）
 */
export interface LogEntry {
  /** 时间戳 */
  ts: string;
  /** 日志级别 */
  level: 'INFO' | 'WARN' | 'ERROR';
  /** 日志分类 */
  category: 'TEST' | 'TASK' | 'EXCEPTION' | 'DISCUSSION' | 'PLAN' | 'SYSTEM';
  /** 操作类型 */
  action?: string;
  /** 日志消息 */
  message: string;
}

/**
 * EVR 内容修改项接口
 */
export interface EVRContentItem {
  /** EVR ID（用于更新现有 EVR） */
  evrId?: string;
  /** EVR 标题 */
  title?: string;
  /** 验证方法（字符串或字符串数组） */
  verify?: string | string[];
  /** 预期结果（字符串或字符串数组） */
  expect?: string | string[];
  /** EVR 类别 */
  class?: EVRClass;
}
