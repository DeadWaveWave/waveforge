/**
 * LazySync - Lazy 同步引擎
 * 负责检测面板与结构化数据的差异，并实现智能同步
 * 支持差异检测、冲突解决、请求级缓存和审计日志记录
 */

import { createHash } from 'crypto';
import { logger } from './logger.js';
import { SyncError } from './error-handler.js';
import { PanelParser, createPanelParser } from './panel-parser.js';
import { PanelRenderer, createPanelRenderer } from './panel-renderer.js';
import {
  LogCategory,
  LogAction,
  TaskStatus,
  CheckboxState,
  SyncConflictType,
  ConflictResolution,
  type ParsedPanel,
  type SyncConflict,
  type ResolvedConflict,
  type SectionFingerprints,
  type AuditEntry,
  type TaskData,
} from '../types/index.js';

/**
 * 冲突策略类型
 */
export type ConflictStrategy = 'etag_first_then_ts' | 'ts_only';

/**
 * 同步差异接口
 */
export interface SyncDiff {
  /** 是否有变更 */
  hasChanges: boolean;
  /** 内容变更（可回写） */
  contentChanges: ContentChange[];
  /** 状态变更（待定，不回写） */
  statusChanges: StatusChange[];
  /** 冲突列表 */
  conflicts: SyncConflict[];
  /** 区域指纹 */
  sectionFingerprints: SectionFingerprints;
}

/**
 * 内容变更接口
 */
export interface ContentChange {
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
 * 状态变更接口
 */
export interface StatusChange {
  /** 目标类型 */
  target: 'plan' | 'step' | 'evr';
  /** 目标 ID */
  id: string;
  /** 旧状态 */
  oldStatus: any;
  /** 新状态 */
  newStatus: any;
}

/**
 * 应用变更接口
 */
export interface AppliedChange extends ContentChange {
  /** 应用时间 */
  appliedAt: string;
}

/**
 * 同步结果接口
 */
export interface SyncResult {
  /** 是否已应用 */
  applied: boolean;
  /** 应用的变更 */
  changes: AppliedChange[];
  /** 已解决的冲突 */
  conflicts: ResolvedConflict[];
  /** 审计条目 */
  auditEntries: AuditEntry[];
  /** MD 版本（ETag） */
  mdVersion: string;
}

/**
 * LazySync 选项接口
 */
export interface LazySyncOptions {
  /** 是否启用请求级缓存 */
  enableRequestCache: boolean;
  /** 缓存过期时间（毫秒） */
  cacheExpiration: number;
  /** 默认冲突策略 */
  defaultConflictStrategy: ConflictStrategy;
  /** 是否记录审计日志 */
  enableAuditLog: boolean;
  /** 最大冲突解决尝试次数 */
  maxConflictResolutionAttempts: number;
}

/**
 * 默认 LazySync 选项
 */
const DEFAULT_LAZY_SYNC_OPTIONS: LazySyncOptions = {
  enableRequestCache: true,
  cacheExpiration: 5 * 60 * 1000, // 5分钟
  defaultConflictStrategy: 'etag_first_then_ts',
  enableAuditLog: true,
  maxConflictResolutionAttempts: 3,
};

/**
 * 请求缓存条目接口
 */
interface RequestCacheEntry {
  /** 同步结果 */
  result: SyncResult;
  /** 缓存时间 */
  cachedAt: number;
  /** 面板内容哈希 */
  panelHash: string;
  /** 结构化数据哈希 */
  structuredHash: string;
}

/**
 * Lazy 同步引擎类
 */
export class LazySync {
  private readonly options: LazySyncOptions;
  private readonly parser: PanelParser;
  private readonly renderer: PanelRenderer;
  private readonly requestCache = new Map<string, RequestCacheEntry>();

  constructor(options?: Partial<LazySyncOptions>) {
    this.options = { ...DEFAULT_LAZY_SYNC_OPTIONS, ...options };
    this.parser = createPanelParser({ enableTolerance: true });
    this.renderer = createPanelRenderer({ injectAnchors: true });

    logger.info(LogCategory.Task, LogAction.Create, 'LazySync 引擎已初始化', {
      enableRequestCache: this.options.enableRequestCache,
      cacheExpiration: this.options.cacheExpiration,
      defaultConflictStrategy: this.options.defaultConflictStrategy,
    });
  }

  /**
   * 检测面板内容与结构化数据的差异
   */
  detectDifferences(panelContent: string, structuredData: TaskData): SyncDiff {
    const timer = logger.createTimer('sync-detect-differences');

    try {
      // 解析面板内容
      const parsedPanel = this.parser.parseMarkdown(panelContent);

      // 计算区域指纹
      const sectionFingerprints = this.computeSectionFingerprints(panelContent);

      // 检测内容差异
      const contentChanges = this.detectContentChanges(
        parsedPanel,
        structuredData
      );

      // 检测状态差异
      const statusChanges = this.detectStatusChanges(
        parsedPanel,
        structuredData
      );

      // 检测冲突（仅限内容字段差异）
      const conflicts = this.detectConflicts(parsedPanel, structuredData);

      const diff: SyncDiff = {
        hasChanges: contentChanges.length > 0 || statusChanges.length > 0,
        contentChanges,
        statusChanges,
        conflicts,
        sectionFingerprints,
      };

      timer.end(LogCategory.Task, LogAction.Handle);

      logger.info(LogCategory.Task, LogAction.Handle, '差异检测完成', {
        contentChanges: contentChanges.length,
        statusChanges: statusChanges.length,
        conflicts: conflicts.length,
        hasChanges: diff.hasChanges,
      });

      return diff;
    } catch (error) {
      timer.end(LogCategory.Exception, LogAction.Handle);
      logger.error(LogCategory.Exception, LogAction.Handle, '差异检测失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new SyncError('差异检测失败', { error });
    }
  }

  /**
   * 应用同步变更
   */
  async applySyncChanges(
    diff: SyncDiff,
    strategy: ConflictStrategy = this.options.defaultConflictStrategy
  ): Promise<SyncResult> {
    const timer = logger.createTimer('sync-apply-changes');

    try {
      const appliedChanges: AppliedChange[] = [];
      const resolvedConflicts: ResolvedConflict[] = [];
      const auditEntries: AuditEntry[] = [];
      const timestamp = new Date().toISOString();

      // 解决冲突
      if (diff.conflicts.length > 0) {
        const resolutions = await this.resolveConflicts(
          diff.conflicts,
          strategy
        );
        resolvedConflicts.push(...resolutions);

        // 记录冲突解决审计日志
        auditEntries.push({
          timestamp,
          type: 'conflict',
          details: {
            strategy,
            conflictsCount: diff.conflicts.length,
            resolutions: resolutions.map((r) => ({
              region: r.region,
              resolution: r.resolution,
            })),
          },
          affectedIds: diff.conflicts.map((c) => c.region),
        });
      }

      // 应用内容变更（仅内容变更，状态变更不回写）
      // 根据冲突解决结果过滤变更
      for (const change of diff.contentChanges) {
        // 检查此变更是否与冲突相关
        const relatedConflict = resolvedConflicts.find(
          (rc) => rc.region === change.section && rc.field === change.field
        );

        // 如果存在相关冲突且解决方案是保留"我们的"（结构化数据），则跳过此变更
        if (relatedConflict && relatedConflict.resolution === ConflictResolution.Ours) {
          continue;
        }

        const appliedChange: AppliedChange = {
          ...change,
          appliedAt: timestamp,
        };
        appliedChanges.push(appliedChange);
      }

      // 记录同步审计日志
      if (appliedChanges.length > 0) {
        auditEntries.push({
          timestamp,
          type: 'sync',
          details: {
            changesCount: appliedChanges.length,
            changes: appliedChanges.map((c) => ({
              section: c.section,
              field: c.field,
              source: c.source,
            })),
          },
          affectedIds: appliedChanges.map((c) => c.section),
        });
      }

      // 生成新的 MD 版本（ETag）
      const mdVersion = this.generateMdVersion(diff.sectionFingerprints);

      const result: SyncResult = {
        applied: appliedChanges.length > 0,
        changes: appliedChanges,
        conflicts: resolvedConflicts,
        auditEntries,
        mdVersion,
      };

      timer.end(LogCategory.Task, LogAction.Handle);

      logger.info(LogCategory.Task, LogAction.Handle, '同步变更应用完成', {
        appliedChanges: appliedChanges.length,
        resolvedConflicts: resolvedConflicts.length,
        auditEntries: auditEntries.length,
        mdVersion,
      });

      return result;
    } catch (error) {
      timer.end(LogCategory.Exception, LogAction.Handle);
      logger.error(
        LogCategory.Exception,
        LogAction.Handle,
        '同步变更应用失败',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      throw new SyncError('同步变更应用失败', { error });
    }
  }

  /**
   * 计算区域指纹（用于性能优化）
   */
  computeSectionFingerprints(content: string): SectionFingerprints {
    const lines = content.split('\n');
    const sections = this.identifyContentSections(lines);

    return {
      title: this.hashContent(sections.title || ''),
      requirements: this.hashContent(sections.requirements || ''),
      issues: this.hashContent(sections.issues || ''),
      hints: this.hashContent(sections.hints || ''),
      plans: this.hashSectionMap(sections.plans || {}),
      evrs: this.hashSectionMap(sections.evrs || {}),
      logs: this.hashContent(sections.logs || ''),
    };
  }

  /**
   * 获取缓存的同步结果
   */
  getCachedSync(requestId: string): SyncResult | null {
    if (!this.options.enableRequestCache) {
      return null;
    }

    const cached = this.requestCache.get(requestId);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.cachedAt > this.options.cacheExpiration) {
      this.requestCache.delete(requestId);
      return null;
    }

    logger.info(LogCategory.Task, LogAction.Handle, '使用缓存的同步结果', {
      requestId,
      cachedAt: new Date(cached.cachedAt).toISOString(),
    });

    return cached.result;
  }

  /**
   * 缓存同步结果
   */
  setCachedSync(
    requestId: string,
    result: SyncResult,
    panelContent: string,
    structuredData: TaskData
  ): void {
    if (!this.options.enableRequestCache) {
      return;
    }

    const entry: RequestCacheEntry = {
      result,
      cachedAt: Date.now(),
      panelHash: this.hashContent(panelContent),
      structuredHash: this.hashContent(JSON.stringify(structuredData)),
    };

    this.requestCache.set(requestId, entry);

    logger.info(LogCategory.Task, LogAction.Handle, '缓存同步结果', {
      requestId,
      cacheSize: this.requestCache.size,
    });
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [requestId, entry] of this.requestCache.entries()) {
      if (now - entry.cachedAt > this.options.cacheExpiration) {
        this.requestCache.delete(requestId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(LogCategory.Task, LogAction.Handle, '清理过期缓存', {
        cleanedCount,
        remainingSize: this.requestCache.size,
      });
    }
  }

  // 私有方法实现...

  /**
   * 将 CheckboxState 转换为 TaskStatus
   */
  private checkboxStateToTaskStatus(checkboxState: CheckboxState): TaskStatus {
    switch (checkboxState) {
      case CheckboxState.ToDo:
        return TaskStatus.ToDo;
      case CheckboxState.InProgress:
        return TaskStatus.InProgress;
      case CheckboxState.Completed:
        return TaskStatus.Completed;
      case CheckboxState.Blocked:
        return TaskStatus.Blocked;
      default:
        return TaskStatus.ToDo;
    }
  }

  /**
   * 将 TaskStatus 转换为 CheckboxState
   */
  private taskStatusToCheckboxState(taskStatus: TaskStatus): CheckboxState {
    switch (taskStatus) {
      case TaskStatus.ToDo:
        return CheckboxState.ToDo;
      case TaskStatus.InProgress:
        return CheckboxState.InProgress;
      case TaskStatus.Completed:
        return CheckboxState.Completed;
      case TaskStatus.Blocked:
        return CheckboxState.Blocked;
      default:
        return CheckboxState.ToDo;
    }
  }

  /**
   * 检测内容变更
   */
  private detectContentChanges(
    parsedPanel: ParsedPanel,
    structuredData: TaskData
  ): ContentChange[] {
    const changes: ContentChange[] = [];

    // 检测标题变更
    if (parsedPanel.title !== structuredData.title) {
      changes.push({
        section: 'title',
        field: 'title',
        oldValue: structuredData.title,
        newValue: parsedPanel.title,
        source: 'panel',
      });
    }

    // 检测需求变更
    if (
      !this.arraysEqual(parsedPanel.requirements, structuredData.requirements)
    ) {
      changes.push({
        section: 'requirements',
        field: 'requirements',
        oldValue: structuredData.requirements,
        newValue: parsedPanel.requirements,
        source: 'panel',
      });
    }

    // 检测问题变更
    if (!this.arraysEqual(parsedPanel.issues, structuredData.issues || [])) {
      changes.push({
        section: 'issues',
        field: 'issues',
        oldValue: structuredData.issues || [],
        newValue: parsedPanel.issues,
        source: 'panel',
      });
    }

    // 检测提示变更：仅当面板显式提供非空提示，或结构化侧为空时才同步
    if (!this.arraysEqual(parsedPanel.hints, structuredData.hints || [])) {
      const panelHasHints = Array.isArray(parsedPanel.hints) && parsedPanel.hints.length > 0;
      const structuredHasHints = Array.isArray(structuredData.hints) && structuredData.hints.length > 0;
      if (panelHasHints || !structuredHasHints) {
        changes.push({
          section: 'hints',
          field: 'hints',
          oldValue: structuredData.hints || [],
          newValue: parsedPanel.hints,
          source: 'panel',
        });
      }
    }

    // 检测计划内容变更（不包括状态）
    this.detectPlanContentChanges(parsedPanel, structuredData, changes);

    // 检测 EVR 内容变更（不包括状态）
    this.detectEVRContentChanges(parsedPanel, structuredData, changes);

    return changes;
  }

  /**
   * 检测状态变更（不回写，仅标记为待定）
   */
  private detectStatusChanges(
    parsedPanel: ParsedPanel,
    structuredData: TaskData
  ): StatusChange[] {
    const changes: StatusChange[] = [];

    // 检测计划状态变更
    for (const parsedPlan of parsedPanel.plans) {
      const structuredPlan = structuredData.plans?.find(
        (p) => p.id === parsedPlan.id
      );
      if (structuredPlan) {
        const parsedTaskStatus = this.checkboxStateToTaskStatus(
          parsedPlan.status
        );

        // 添加调试日志（仅在开发环境）
        if (process.env.NODE_ENV !== 'production') {
          logger.info(LogCategory.Task, LogAction.Handle, '状态变更检测', {
            planId: parsedPlan.id,
            parsedStatus: parsedPlan.status,
            parsedTaskStatus,
            structuredStatus: structuredPlan.status,
            different: parsedTaskStatus !== structuredPlan.status,
          });
        }

        if (parsedTaskStatus !== structuredPlan.status) {
          changes.push({
            target: 'plan',
            id: parsedPlan.id,
            oldStatus: structuredPlan.status,
            newStatus: parsedTaskStatus,
          });
        }

        // 检测步骤状态变更
        for (const parsedStep of parsedPlan.steps) {
          const structuredStep = structuredPlan?.steps?.find(
            (s) => s.id === parsedStep.id
          );
          if (structuredStep) {
            const parsedStepTaskStatus = this.checkboxStateToTaskStatus(
              parsedStep.status
            );
            if (parsedStepTaskStatus !== structuredStep.status) {
              changes.push({
                target: 'step',
                id: parsedStep.id,
                oldStatus: structuredStep.status,
                newStatus: parsedStepTaskStatus,
              });
            }
          }
        }
      }
    }

    // 检测 EVR 状态变更
    for (const parsedEVR of parsedPanel.evrs) {
      const structuredEVR = structuredData.expectedResults?.find(
        (e) => e.id === parsedEVR.id
      );
      if (structuredEVR && parsedEVR.status !== structuredEVR.status) {
        changes.push({
          target: 'evr',
          id: parsedEVR.id,
          oldStatus: structuredEVR.status,
          newStatus: parsedEVR.status,
        });
      }
    }

    return changes;
  }

  /**
   * 检测冲突
   */
  private detectConflicts(
    parsedPanel: ParsedPanel,
    structuredData: TaskData
  ): SyncConflict[] {
    const conflicts: SyncConflict[] = [];

    // 从 front matter 获取逻辑时间戳（优先），否则回退到 TaskManager 提供的文件 mtime
    const panelModTime = (parsedPanel.metadata as any)?.lastModified || (structuredData as any).panelModTime;
    const structuredModTime = structuredData.updatedAt;

    // 检查计划是否有冲突 (只要内容不同就是潜在冲突)
    for (const parsedPlan of parsedPanel.plans) {
      const structuredPlan = structuredData.plans?.find(
        (p) => p.id === parsedPlan.id
      );

      if (structuredPlan && parsedPlan.text !== structuredPlan.description) {
        // 内容不同,检测为冲突
        conflicts.push({
          region: parsedPlan.id,
          field: 'description',
          reason: panelModTime && structuredModTime
            ? SyncConflictType.ConcurrentUpdate
            : SyncConflictType.EtagMismatch,
          oursTs: structuredModTime, // 结构化数据时间戳
          theirsTs: panelModTime, // 面板时间戳
        });
      }
    }

    // 仅对计划文本差异进行冲突标记；标题/需求差异直接作为内容变更处理

    return conflicts;
  }

  /**
   * 解决冲突
   */
  private async resolveConflicts(
    conflicts: SyncConflict[],
    strategy: ConflictStrategy
  ): Promise<ResolvedConflict[]> {
    const resolved: ResolvedConflict[] = [];

    for (const conflict of conflicts) {
      let resolution: ConflictResolution;

      switch (strategy) {
        case 'etag_first_then_ts':
          resolution = this.resolveByETagThenTimestamp(conflict);
          break;
        case 'ts_only':
          resolution = this.resolveByTimestamp(conflict);
          break;
        default:
          resolution = ConflictResolution.Ours;
      }

      resolved.push({
        ...conflict,
        resolution,
      });
    }

    return resolved;
  }

  /**
   * 通过 ETag 优先 + 时间戳兜底策略解决冲突
   */
  private resolveByETagThenTimestamp(
    conflict: SyncConflict
  ): ConflictResolution {
    // ETag 优先策略:
    // 1. 如果有 ETag 信息,使用 ETag 比较 (TODO: 实现 ETag 支持)
    // 2. 否则使用时间戳兜底策略
    return this.resolveByTimestamp(conflict);
  }

  /**
   * 通过时间戳解决冲突
   */
  private resolveByTimestamp(conflict: SyncConflict): ConflictResolution {
    // 时间戳策略的核心问题:
    // - oursTs: 结构化数据 updatedAt (相对可靠)
    // - theirsTs: 面板文件 mtime (不可靠, 可能因回写或编辑器行为被刷新)
    // 策略:
    // 1) 如果只有一侧有时间戳 -> 选择有时间戳的一侧为参考, 但默认保留结构化数据
    // 2) 如果双方都有时间戳 -> 仅当面板时间明显更新(超过阈值)时选择面板, 否则保留结构化数据

    const SKEW_THRESHOLD_MS = 0; // 阈值为 0ms：只要面板时间更新即选择 theirs

    if (conflict.oursTs && conflict.theirsTs) {
      const oursTime = new Date(conflict.oursTs).getTime();
      const theirsTime = new Date(conflict.theirsTs).getTime();

      // 当面板时间显著更新时才选择 "theirs"
      if (theirsTime - oursTime > SKEW_THRESHOLD_MS) {
        return ConflictResolution.Theirs;
      }
      return ConflictResolution.Ours;
    }

    // 若缺失任一时间戳, 为保守起见默认保留结构化数据
    return ConflictResolution.Ours;
  }

  /**
   * 检测计划内容变更
   */
  private detectPlanContentChanges(
    parsedPanel: ParsedPanel,
    structuredData: TaskData,
    changes: ContentChange[]
  ): void {
    for (const parsedPlan of parsedPanel.plans) {
      const structuredPlan = structuredData.plans?.find(
        (p) => p.id === parsedPlan.id
      );

      if (structuredPlan) {
        // 检测计划描述变更
        if (parsedPlan.text !== structuredPlan.description) {
          changes.push({
            section: parsedPlan.id, // 使用 plan-1 而不是 plan:plan-1
            field: 'description',
            oldValue: structuredPlan.description,
            newValue: parsedPlan.text,
            source: 'panel',
          });
        }

        // 检测计划提示变更
        if (!this.arraysEqual(parsedPlan.hints, structuredPlan.hints || [])) {
          changes.push({
            section: parsedPlan.id, // 使用 plan-1 而不是 plan:plan-1
            field: 'hints',
            oldValue: structuredPlan.hints || [],
            newValue: parsedPlan.hints,
            source: 'panel',
          });
        }

        // 检测步骤内容变更
        this.detectStepContentChanges(parsedPlan, structuredPlan, changes);
      } else {
        // 新增的计划
        changes.push({
          section: parsedPlan.id, // 使用 plan-1 而不是 plan:plan-1
          field: 'new_plan',
          oldValue: null,
          newValue: parsedPlan,
          source: 'panel',
        });
      }
    }

    // 检测删除的计划
    for (const structuredPlan of structuredData.plans || []) {
      const parsedPlan = parsedPanel.plans.find(
        (p) => p.id === structuredPlan.id
      );
      if (!parsedPlan) {
        changes.push({
          section: structuredPlan.id, // 使用 plan-1 而不是 plan:plan-1
          field: 'deleted_plan',
          oldValue: structuredPlan,
          newValue: null,
          source: 'panel',
        });
      }
    }
  }

  /**
   * 检测步骤内容变更
   */
  private detectStepContentChanges(
    parsedPlan: any,
    structuredPlan: any,
    changes: ContentChange[]
  ): void {
    for (const parsedStep of parsedPlan.steps) {
      const structuredStep = structuredPlan.steps?.find(
        (s: any) => s.id === parsedStep.id
      );

      if (structuredStep) {
        // 检测步骤描述变更
        if (parsedStep.text !== structuredStep.description) {
          changes.push({
            section: `step:${parsedStep.id}`,
            field: 'description',
            oldValue: structuredStep.description,
            newValue: parsedStep.text,
            source: 'panel',
          });
        }

        // 检测步骤提示变更
        if (!this.arraysEqual(parsedStep.hints, structuredStep.hints || [])) {
          changes.push({
            section: `step:${parsedStep.id}`,
            field: 'hints',
            oldValue: structuredStep.hints || [],
            newValue: parsedStep.hints,
            source: 'panel',
          });
        }
      }
    }
  }

  /**
   * 检测 EVR 内容变更
   */
  private detectEVRContentChanges(
    parsedPanel: ParsedPanel,
    structuredData: TaskData,
    changes: ContentChange[]
  ): void {
    for (const parsedEVR of parsedPanel.evrs) {
      const structuredEVR = structuredData.expectedResults?.find(
        (e) => e.id === parsedEVR.id
      );

      if (structuredEVR) {
        // 检测 EVR 标题变更
        if (parsedEVR.title !== structuredEVR.title) {
          changes.push({
            section: `evr:${parsedEVR.id}`,
            field: 'title',
            oldValue: structuredEVR.title,
            newValue: parsedEVR.title,
            source: 'panel',
          });
        }

        // 检测 verify 字段变更
        if (!this.deepEqual(parsedEVR.verify, structuredEVR.verify)) {
          changes.push({
            section: `evr:${parsedEVR.id}`,
            field: 'verify',
            oldValue: structuredEVR.verify,
            newValue: parsedEVR.verify,
            source: 'panel',
          });
        }

        // 检测 expect 字段变更
        if (!this.deepEqual(parsedEVR.expect, structuredEVR.expect)) {
          changes.push({
            section: `evr:${parsedEVR.id}`,
            field: 'expect',
            oldValue: structuredEVR.expect,
            newValue: parsedEVR.expect,
            source: 'panel',
          });
        }
      } else {
        // 新增的 EVR
        changes.push({
          section: `evr:${parsedEVR.id}`,
          field: 'new_evr',
          oldValue: null,
          newValue: parsedEVR,
          source: 'panel',
        });
      }
    }

    // 检测删除的 EVR
    for (const structuredEVR of structuredData.expectedResults || []) {
      const parsedEVR = parsedPanel.evrs.find((e) => e.id === structuredEVR.id);
      if (!parsedEVR) {
        changes.push({
          section: `evr:${structuredEVR.id}`,
          field: 'deleted_evr',
          oldValue: structuredEVR,
          newValue: null,
          source: 'panel',
        });
      }
    }
  }

  /**
   * 识别内容区域
   */
  private identifyContentSections(lines: string[]): Record<string, any> {
    const sections: Record<string, any> = {
      title: '',
      requirements: '',
      issues: '',
      hints: '',
      plans: {},
      evrs: {},
      logs: '',
    };

    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('# ')) {
        // 标题
        sections.title = line.substring(2).trim();
      } else if (line.startsWith('## ')) {
        // 保存上一个区域
        if (currentSection && currentContent.length > 0) {
          const content = currentContent.join('\n');
          switch (currentSection) {
            case 'requirements':
            case 'issues':
            case 'hints':
            case 'logs':
              sections[currentSection] = content;
              break;
            case 'plans':
              sections.plans = this.parsePlansSection(content);
              break;
            case 'evrs':
              sections.evrs = this.parseEVRsSection(content);
              break;
          }
        }

        // 开始新区域
        const sectionTitle = line.substring(3).toLowerCase().trim();
        if (
          sectionTitle.includes('需求') ||
          sectionTitle.includes('requirement')
        ) {
          currentSection = 'requirements';
        } else if (
          sectionTitle.includes('问题') ||
          sectionTitle.includes('issue')
        ) {
          currentSection = 'issues';
        } else if (
          sectionTitle.includes('提示') ||
          sectionTitle.includes('hint')
        ) {
          currentSection = 'hints';
        } else if (
          sectionTitle.includes('计划') ||
          sectionTitle.includes('plan')
        ) {
          currentSection = 'plans';
        } else if (
          sectionTitle.includes('验证') ||
          sectionTitle.includes('evr')
        ) {
          currentSection = 'evrs';
        } else if (
          sectionTitle.includes('日志') ||
          sectionTitle.includes('log')
        ) {
          currentSection = 'logs';
        } else {
          currentSection = '';
        }
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // 保存最后一个区域
    if (currentSection && currentContent.length > 0) {
      const content = currentContent.join('\n');
      switch (currentSection) {
        case 'requirements':
        case 'issues':
        case 'hints':
        case 'logs':
          sections[currentSection] = content;
          break;
        case 'plans':
          sections.plans = this.parsePlansSection(content);
          break;
        case 'evrs':
          sections.evrs = this.parseEVRsSection(content);
          break;
      }
    }

    return sections;
  }

  /**
   * 解析计划区域
   */
  private parsePlansSection(content: string): Record<string, string> {
    const plans: Record<string, string> = {};
    const lines = content.split('\n');
    let currentPlanId = '';
    let currentPlanContent: string[] = [];

    for (const line of lines) {
      // 匹配计划行：1. [x] 计划描述 <!-- plan:plan-1 -->
      const planMatch = line.match(
        /^\d+\.\s*\[.\]\s*(.+?)(?:\s*<!--\s*plan:([^>]+)\s*-->)?/
      );
      if (planMatch) {
        // 保存上一个计划
        if (currentPlanId && currentPlanContent.length > 0) {
          plans[currentPlanId] = currentPlanContent.join('\n');
        }

        // 开始新计划
        currentPlanId = planMatch[2] || `plan-${Object.keys(plans).length + 1}`;
        currentPlanContent = [line];
      } else {
        currentPlanContent.push(line);
      }
    }

    // 保存最后一个计划
    if (currentPlanId && currentPlanContent.length > 0) {
      plans[currentPlanId] = currentPlanContent.join('\n');
    }

    return plans;
  }

  /**
   * 解析 EVR 区域
   */
  private parseEVRsSection(content: string): Record<string, string> {
    const evrs: Record<string, string> = {};
    const lines = content.split('\n');
    let currentEVRId = '';
    let currentEVRContent: string[] = [];

    for (const line of lines) {
      // 匹配 EVR 行：### EVR-001 标题 <!-- evr:evr-001 -->
      const evrMatch = line.match(
        /^###\s*(.+?)(?:\s*<!--\s*evr:([^>]+)\s*-->)?/
      );
      if (evrMatch) {
        // 保存上一个 EVR
        if (currentEVRId && currentEVRContent.length > 0) {
          evrs[currentEVRId] = currentEVRContent.join('\n');
        }

        // 开始新 EVR
        currentEVRId = evrMatch[2] || `evr-${Object.keys(evrs).length + 1}`;
        currentEVRContent = [line];
      } else {
        currentEVRContent.push(line);
      }
    }

    // 保存最后一个 EVR
    if (currentEVRId && currentEVRContent.length > 0) {
      evrs[currentEVRId] = currentEVRContent.join('\n');
    }

    return evrs;
  }

  /**
   * 哈希内容
   */
  private hashContent(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * 哈希区域映射
   */
  private hashSectionMap(
    sections: Record<string, string>
  ): Record<string, string> {
    const hashed: Record<string, string> = {};
    for (const [key, value] of Object.entries(sections)) {
      hashed[key] = this.hashContent(value);
    }
    return hashed;
  }

  /**
   * 生成 MD 版本（ETag）
   */
  private generateMdVersion(fingerprints: SectionFingerprints): string {
    const combined = JSON.stringify(fingerprints);
    return this.hashContent(combined);
  }

  /**
   * 比较数组是否相等
   */
  private arraysEqual(a: any[], b: any[]): boolean {
    // 空值检查
    if (!a || !b) {
      return !a && !b; // 两者都是空/undefined 时才相等
    }
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  /**
   * 深度比较
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      return this.arraysEqual(a, b);
    }

    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) => this.deepEqual(a[key], b[key]));
    }

    return false;
  }
}

/**
 * 创建 LazySync 实例
 */
export function createLazySync(options?: Partial<LazySyncOptions>): LazySync {
  return new LazySync(options);
}
