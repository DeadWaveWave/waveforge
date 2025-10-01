/**
 * TaskManager - 任务管理器核心类
 * 负责任务的初始化、状态更新、修改等核心功能
 * 使用单文件存储 (.wave/current-task.json) 作为过渡方案
 */

import fs from 'fs-extra';
import * as path from 'path';
import { ulid } from 'ulid';
import { logger } from './logger.js';
import { MultiTaskDirectoryManager } from './multi-task-directory-manager.js';
import { DataMigrationTool } from './data-migration-tool.js';
import { EVRValidator, createEVRValidator } from './evr-validator.js';
import { LazySync, createLazySync } from './lazy-sync.js';
import { PanelRenderer, createPanelRenderer } from './panel-renderer.js';
import { PanelParser, createPanelParser } from './panel-parser.js';
import {
  TaskStatus,
  LogLevel,
  LogCategory,
  LogAction,
  EVRStatus,
  EVRClass,
  type CurrentTask,
  type TaskPlan,
  type TaskStep,
  type TaskLog,
  type SyncPreview,
  type ExpectedResult,
  type EVRContentItem,
  type ContextTag,
} from '../types/index.js';

/**
 * 任务初始化参数接口
 */
export interface TaskInitParams {
  title: string;
  goal: string;
  story?: string;
  description?: string;
  knowledge_refs?: string[];
  overall_plan?: string[];
  project_id?: string;
}

/**
 * 任务初始化结果接口
 */
export interface TaskInitResult {
  success: boolean;
  task_id: string;
  slug: string;
  current_plan_id: string | null;
  plan_required: boolean;
  plan_ids?: string[];
}

/**
 * 任务状态更新参数接口
 */
export interface TaskUpdateParams {
  update_type: 'plan' | 'step' | 'evr';
  plan_id?: string;
  step_id?: string;
  status?: TaskStatus;
  evidence?: string;
  notes?: string;
  project_id?: string;
  evr?: {
    items: Array<{
      evr_id: string;
      status: 'pass' | 'fail' | 'skip' | 'unknown';
      last_run: string;
      notes?: string;
      proof?: string;
    }>;
  };
}

/**
 * 任务状态更新结果接口
 */
export interface TaskUpdateResult {
  success: boolean;
  current_plan_id?: string;
  next_step?: TaskStep;
  auto_advanced?: boolean;
  steps_required?: boolean;
  started_new_plan?: boolean;
  hints?: {
    task?: string[];
    plan?: string[];
    step?: string[];
  };
  logs_highlights?: TaskLog[];
  // EVR 相关字段
  evr_for_node?: string[];
  evr_pending?: boolean;
  evr_for_plan?: string[];
  // Lazy 同步相关字段
  sync_preview?: SyncPreview;
}

/**
 * 任务修改参数接口
 */
export interface TaskModifyParams {
  field: 'goal' | 'plan' | 'steps' | 'hints' | 'evr';
  content?: string | string[];
  reason: string;
  plan_id?: string;
  step_id?: string;
  change_type:
  | 'generate_steps'
  | 'plan_adjustment'
  | 'steps_adjustment'
  | 'refine_goal'
  | 'bug_fix_replan'
  | 'user_request'
  | 'scope_change';
  project_id?: string;

  // EVR 专用参数
  evr?: {
    items?: EVRContentItem[];
    evrIds?: string[];  // for remove/rebind operations
  };

  // 通用参数
  op?: 'replace' | 'append' | 'insert' | 'remove' | 'update' | 'add';
  hints?: string[];
  tags?: ContextTag[];
}

/**
 * 任务修改结果接口
 */
export interface TaskModifyResult {
  success: boolean;
  field: string;
  affected_ids?: string[];
  // 扩展字段用于测试
  plan_reset?: boolean;
  new_current_plan_id?: string;
  steps_added?: number;
  steps_replaced?: boolean;
  first_step_started?: boolean;
  hints_added?: number;
  hint_level?: string;
  // EVR 相关字段
  evr_modified?: number;
  operation_type?: string;
}

/**
 * TaskManager - 任务管理器核心类
 */
export class TaskManager {
  private docsPath: string;
  private currentTaskPath: string;
  private projectManager?: import('./project-manager.js').ProjectManager;
  private multiTaskDirectoryManager: MultiTaskDirectoryManager;
  private dataMigrationTool: DataMigrationTool;
  private evrValidator: EVRValidator;
  private lazySync: LazySync;
  private panelRenderer: PanelRenderer;
  private panelParser: PanelParser;
  private migrationChecked: boolean = false;

  constructor(
    docsPath: string,
    projectManager?: import('./project-manager.js').ProjectManager
  ) {
    if (!docsPath || docsPath.trim() === '') {
      throw new Error('docsPath 不能为空');
    }

    this.docsPath = docsPath.trim();
    this.currentTaskPath = path.join(this.docsPath, 'current-task.json');
    this.projectManager = projectManager;
    this.multiTaskDirectoryManager = new MultiTaskDirectoryManager(
      this.docsPath
    );
    this.dataMigrationTool = new DataMigrationTool(this.docsPath);
    this.evrValidator = createEVRValidator();
    this.lazySync = createLazySync();
    this.panelRenderer = createPanelRenderer();
    this.panelParser = createPanelParser({
      generateMissingAnchors: false, // 禁用自动生成锚点，因为 PanelRenderer 已经生成了正确的锚点
    });
  }

  getDocsPath(): string {
    return this.docsPath;
  }

  getCurrentTaskPath(): string {
    return this.currentTaskPath;
  }

  /**
   * 获取当前任务面板路径
   */
  getCurrentTaskPanelPath(): string | null {
    try {
      const fs = require('fs');
      const path = require('path');

      // current-task.md 应该在 .wave 目录下
      const panelPath = path.join(this.docsPath, 'current-task.md');

      // 不检查文件是否存在，直接返回路径
      // 这样在同步检测时可以正确找到路径
      return panelPath;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查并执行自动迁移
   */
  private async checkAndPerformMigration(): Promise<void> {
    if (this.migrationChecked) {
      return;
    }

    try {
      // 在测试环境中跳过迁移检查
      if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
        this.migrationChecked = true;
        return;
      }

      const migrationStatus =
        await this.dataMigrationTool.checkMigrationStatus();

      if (migrationStatus.needsMigration) {
        logger.info(
          LogCategory.Task,
          LogAction.Create,
          '检测到需要数据迁移，开始自动迁移',
          {
            migrationType: migrationStatus.migrationType,
          }
        );

        const migrationResult = await this.dataMigrationTool.performMigration();

        if (migrationResult.success) {
          logger.info(LogCategory.Task, LogAction.Create, '数据迁移完成', {
            migratedTasks: migrationResult.migratedTasks,
            duration: migrationResult.duration,
          });
        } else {
          logger.error(LogCategory.Task, LogAction.Create, '数据迁移失败', {
            errors: migrationResult.errors,
          });
        }
      }
    } catch (error) {
      // 迁移失败不应该影响正常的任务操作
      logger.warning(
        LogCategory.Task,
        LogAction.Create,
        '迁移检查失败，继续正常操作',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    } finally {
      this.migrationChecked = true;
    }
  }

  /**
   * 解析项目特定的文档路径
   */
  private async resolveProjectPath(projectId?: string): Promise<string> {
    if (!this.projectManager) {
      return this.docsPath;
    }

    // 如果没有提供 projectId,尝试从当前活动项目获取
    let effectiveProjectId = projectId;
    if (!effectiveProjectId) {
      const activeProject = this.projectManager.getActiveProject();
      if (activeProject) {
        effectiveProjectId = activeProject.root;
      } else {
        // 没有活动项目,使用默认路径
        return this.docsPath;
      }
    }

    try {
      // 如果提供了项目ID，尝试从项目注册表解析项目根目录
      const projectRegistry = this.projectManager.getProjectRegistry();
      const projectRecord = await projectRegistry.resolveProject(effectiveProjectId);

      if (projectRecord) {
        return path.join(projectRecord.root, '.wave');
      }
    } catch (error) {
      // 如果解析失败，使用默认路径
      logger.warning(
        LogCategory.Task,
        LogAction.Handle,
        '项目路径解析失败，使用默认路径',
        {
          projectId: effectiveProjectId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    return this.docsPath;
  }

  /**
   * 解析项目特定的任务文件路径
   */
  private async resolveTaskPath(projectId?: string): Promise<string> {
    const docsPath = await this.resolveProjectPath(projectId);
    return path.join(docsPath, 'current-task.json');
  }

  /**
   * 初始化新任务
   */
  async initTask(params: TaskInitParams): Promise<TaskInitResult> {
    try {
      this.validateInitParams(params);

      const taskId = ulid();
      const slug = this.generateTaskSlug(params.title);
      const timestamp = new Date().toISOString();

      const story = params.story
        ? this.parseStoryInfo(params.story)
        : undefined;

      const overallPlan: TaskPlan[] = [];
      let currentPlanId: string | null = null;
      let planRequired = false;

      if (params.overall_plan && params.overall_plan.length > 0) {
        for (let i = 0; i < params.overall_plan.length; i++) {
          const plan = this.createTaskPlan(
            params.overall_plan[i],
            timestamp,
            i
          );
          overallPlan.push(plan);
        }
        currentPlanId = overallPlan[0].id;
      } else {
        planRequired = true;
      }

      const initialLog: TaskLog = {
        timestamp,
        level: LogLevel.Info,
        category: LogCategory.Task,
        action: LogAction.Create,
        message: '任务初始化完成',
        ai_notes: `创建任务: ${params.title}`,
        details: {
          task_id: taskId,
          slug,
          plan_count: overallPlan.length,
          has_story: !!story,
          project_id: params.project_id,
        },
      };

      const task: CurrentTask = {
        id: taskId,
        title: params.title,
        slug,
        story,
        knowledge_refs: params.knowledge_refs || [],
        goal: params.goal,
        task_hints: [],
        overall_plan: overallPlan,
        current_plan_id: currentPlanId || undefined,
        current_step_details: undefined,
        logs: [initialLog],
        created_at: timestamp,
        updated_at: timestamp,
      };

      await this.ensureDirectoryExists(params.project_id);
      await this.saveTask(task, params.project_id);

      return {
        success: true,
        task_id: taskId,
        slug,
        current_plan_id: currentPlanId,
        plan_required: planRequired,
        plan_ids: planRequired ? undefined : overallPlan.map((p) => p.id),
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '任务初始化失败', {
        error: error instanceof Error ? error.message : String(error),
        project_id: params.project_id,
      });
      throw error;
    }
  }

  /**
   * 执行 Lazy 同步
   */
  private async performLazySync(task: CurrentTask, projectId?: string): Promise<any | null> {
    try {
      const panelPath = this.getCurrentTaskPanelPath();
      if (!panelPath) {
        // 没有面板文件，无需同步
        return null;
      }

      // 读取面板内容
      const panelContent = await fs.readFile(panelPath, 'utf8');
      if (!panelContent || panelContent.trim() === '') {
        return null;
      }

      // 获取面板文件的修改时间
      let panelModTime: string | undefined;
      try {
        const stats = await fs.stat(panelPath);
        panelModTime = stats.mtime.toISOString();
      } catch (error) {
        // 忽略获取文件时间的错误
      }

      // 将 CurrentTask 转换为 TaskData 格式（匹配 LazySync 期望的结构）
      const taskData: any = {
        id: task.id,
        title: task.title,
        goal: task.goal,
        requirements: task.goal ? [task.goal] : [], // goal 映射为 requirements 数组
        issues: [],
        hints: task.task_hints || [],
        plans: task.overall_plan || [],
        expectedResults: task.expectedResults || [],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        projectId: this.projectManager?.getActiveProject()?.root || '',
        panelModTime, // 传递面板修改时间
      };

      // 检测差异
      const diff = this.lazySync.detectDifferences(panelContent, taskData);

      if (!diff.hasChanges || diff.contentChanges.length === 0) {
        // 检查是否有状态变更
        if (diff.statusChanges && diff.statusChanges.length > 0) {
          // 只有状态变更，返回包含状态变更的预览信息
          return {
            applied: false,
            changes: [],
            statusChanges: diff.statusChanges,
            conflicts: [],
            auditEntries: [],
            mdVersion: '',
          };
        }
        // 没有任何变更，无需同步
        return null;
      }

      // 应用同步变更
      const syncResult = await this.lazySync.applySyncChanges(diff, 'etag_first_then_ts');

      // 将变更应用到任务数据
      this.applyContentChangesToTask(task, syncResult.changes);

      // 将审计日志添加到任务日志中
      if (syncResult.auditEntries && syncResult.auditEntries.length > 0) {
        for (const auditEntry of syncResult.auditEntries) {
          const log: TaskLog = {
            timestamp: auditEntry.timestamp,
            level: LogLevel.Info,
            category: LogCategory.Task,
            action: LogAction.Handle,
            message: auditEntry.type === 'conflict' ? '冲突解决完成' : 'Lazy 同步完成',
            ai_notes: JSON.stringify(auditEntry.details),
            details: {
              type: auditEntry.type,
              affectedIds: auditEntry.affectedIds,
              ...auditEntry.details,
            },
          };
          task.logs.push(log);
        }
      }

      // 持久化变更到文件系统
      await this.saveTask(task, projectId);

      logger.info(LogCategory.Task, LogAction.Update, 'Lazy 同步完成', {
        changesCount: syncResult.changes.length,
        conflictsCount: syncResult.conflicts.length,
        affectedSections: [...new Set(syncResult.changes.map(c => c.section))],
      });

      // 返回完整的同步结果，包括状态变更
      return {
        ...syncResult,
        statusChanges: diff.statusChanges || [],
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, 'Lazy 同步失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      // 同步失败不应该阻止主流程
      return null;
    }
  }

  /**
   * 将内容变更应用到任务数据
   */
  private applyContentChangesToTask(task: CurrentTask, changes: any[]): void {
    for (const change of changes) {
      try {
        // 根据变更类型应用到任务数据
        if (change.section === 'title' && change.field === 'title') {
          // 任务标题
          task.title = change.newValue;
        } else if (change.section === 'requirements' && change.field === 'requirements') {
          // 任务目标（requirements 对应 goal 字段）
          // requirements 可能是字符串或数组，取第一个元素或整个字符串
          if (Array.isArray(change.newValue) && change.newValue.length > 0) {
            task.goal = change.newValue.join('\n');
          } else if (typeof change.newValue === 'string') {
            task.goal = change.newValue;
          }
        } else if (change.section.startsWith('plan-')) {
          const planId = change.section;
          const plan = task.overall_plan.find(p => p.id === planId);
          if (plan && change.field === 'description') {
            plan.description = change.newValue;
            plan.text = change.newValue; // 同时更新 text 别名
          }
        } else if (change.section.startsWith('evr-')) {
          const evrId = change.section;
          const evr = task.expectedResults?.find(e => e.id === evrId);
          if (evr) {
            if (change.field === 'title') {
              evr.title = change.newValue;
            } else if (change.field === 'verify') {
              evr.verify = change.newValue;
            } else if (change.field === 'expect') {
              evr.expect = change.newValue;
            }
          }
        } else if (change.section === 'hints') {
          if (Array.isArray(change.newValue)) {
            task.task_hints = change.newValue;
          }
        }
      } catch (error) {
        logger.error(LogCategory.Task, LogAction.Handle, '应用内容变更失败', {
          change,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(params: TaskUpdateParams): Promise<TaskUpdateResult> {
    try {
      this.validateUpdateParams(params);

      const task = await this.getCurrentTask(params.project_id);
      if (!task) {
        throw new Error('当前没有活跃的任务');
      }

      // 执行 Lazy 同步（在状态更新前）
      const syncResult = await this.performLazySync(task);

      const timestamp = new Date().toISOString();
      let result: TaskUpdateResult = { success: true };

      if (params.update_type === 'plan') {
        result = await this.updatePlanStatus(task, params, timestamp);
      } else if (params.update_type === 'step') {
        result = await this.updateStepStatus(task, params, timestamp);
      } else if (params.update_type === 'evr') {
        result = await this.updateEVRStatus(task, params, timestamp);
      }

      task.updated_at = timestamp;
      await this.saveTask(task, params.project_id);

      // 添加提示信息
      result.hints = this.getActiveHints(task, params);

      // 添加同步预览信息（如果有变更）
      if (syncResult) {
        const allChanges: any[] = [
          ...syncResult.changes.map((change: any) => ({
            type: 'content' as const,
            section: change.section,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            source: change.source,
          })),
        ];

        // 将状态变更添加到 changes 中
        if (syncResult.statusChanges && syncResult.statusChanges.length > 0) {
          allChanges.push(...syncResult.statusChanges.map((statusChange: any) => ({
            type: 'status' as const,
            section: statusChange.target === 'plan' ? statusChange.id : `${statusChange.target}:${statusChange.id}`,
            field: 'status',
            oldValue: statusChange.oldStatus,
            newValue: statusChange.newStatus,
            source: 'panel' as const,
          })));
        }

        if (allChanges.length > 0 || (syncResult.conflicts && syncResult.conflicts.length > 0)) {
          result.sync_preview = {
            applied: syncResult.applied || false,
            changes: allChanges,
            conflicts: syncResult.conflicts.map((conflict: any) => ({
              region: conflict.region,
              field: conflict.field,
              reason: conflict.reason,
              oursTs: conflict.oursTs,
              theirsTs: conflict.theirsTs,
            })),
            affectedSections: [...new Set(allChanges.map((c: any) => c.section))] as string[],
          };
        }
      }

      return result;
    } catch (error) {
      logger.error(LogCategory.Plan, LogAction.Update, '任务状态更新失败', {
        error: error instanceof Error ? error.message : String(error),
        project_id: params.project_id,
      });
      throw error;
    }
  }

  /**
   * 修改任务内容
   */
  async modifyTask(params: TaskModifyParams): Promise<TaskModifyResult> {
    try {
      this.validateModifyParams(params);

      const task = await this.getCurrentTask(params.project_id);
      if (!task) {
        throw new Error('当前没有活跃的任务');
      }

      // 执行 Lazy 同步（在修改前应用面板变更）
      await this.performLazySync(task);

      const timestamp = new Date().toISOString();
      let result: TaskModifyResult;

      switch (params.field) {
        case 'goal':
          result = await this.modifyGoal(task, params, timestamp);
          break;
        case 'plan':
          result = await this.modifyPlan(task, params, timestamp);
          break;
        case 'steps':
          result = await this.modifySteps(task, params, timestamp);
          break;
        case 'hints':
          result = await this.modifyHints(task, params, timestamp);
          break;
        case 'evr':
          result = await this.modifyEVR(task, params, timestamp);
          break;
        default:
          throw new Error(`不支持的修改字段: ${params.field}`);
      }

      task.updated_at = timestamp;
      await this.saveTask(task, params.project_id);

      return result;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Modify, '任务修改失败', {
        error: error instanceof Error ? error.message : String(error),
        project_id: params.project_id,
      });
      throw error;
    }
  }

  /**
   * 获取当前任务
   */
  async getCurrentTask(projectId?: string): Promise<CurrentTask | null> {
    try {
      // 首先检查并执行自动迁移
      await this.checkAndPerformMigration();

      // 如果没有传入 projectId，尝试从当前活动项目获取
      const effectiveProjectId =
        projectId || this.projectManager?.getActiveProject()?.root;

      const taskPath = await this.resolveTaskPath(effectiveProjectId);

      // 检查文件是否存在
      if (!(await fs.pathExists(taskPath))) {
        return null;
      }

      const data = await fs.readFile(taskPath, 'utf8');

      if (!data || data.trim() === '') {
        return null;
      }

      let taskData: any;
      try {
        taskData = JSON.parse(data);
      } catch (parseError) {
        throw new Error('任务数据格式错误');
      }

      this.validateTaskDataStructure(taskData);

      const task = taskData as CurrentTask;

      // 执行 Lazy 同步（如果有面板修改）
      await this.performLazySync(task, effectiveProjectId);

      // 重新加载任务以获取同步后的最新数据
      const updatedData = await fs.readFile(taskPath, 'utf8');
      return JSON.parse(updatedData) as CurrentTask;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('ENOENT') ||
          error.message.includes('no such file'))
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 完成当前任务
   */
  async completeTask(
    summary: string,
    projectId?: string
  ): Promise<{
    archived_task_id: string;
    evr_summary?: any;
    evr_required_final?: Array<{
      evr_id: string;
      reason: 'need_reason_for_skip' | 'status_unknown' | 'failed';
    }>;
    evr_ready?: boolean;
  }> {
    try {
      const task = await this.getCurrentTask(projectId);
      if (!task) {
        throw new Error('当前没有活跃的任务');
      }

      // 检查 EVR 就绪性
      const evrValidator = createEVRValidator();
      const evrs = task.expectedResults || [];
      const evrValidation = evrValidator.validateEVRReadiness(evrs);

      // 如果 EVR 未就绪，抛出错误并附带详细信息
      if (!evrValidation.ready) {
        const error: any = new Error('EVR 验证未就绪，无法完成任务');
        error.code = 'EVR_NOT_READY';
        error.evrValidation = evrValidation;
        throw error;
      }

      const timestamp = new Date().toISOString();
      task.completed_at = timestamp;
      task.updated_at = timestamp;

      // 添加完成日志
      const completeLog: TaskLog = {
        timestamp,
        level: LogLevel.Info,
        category: LogCategory.Task,
        action: LogAction.Update,
        message: '任务完成',
        ai_notes: summary,
        details: {
          task_id: task.id,
          completion_summary: summary,
        },
      };
      task.logs.push(completeLog);

      // 添加 EVR 验证成功日志
      if (evrs.length > 0) {
        const evrLog: TaskLog = {
          timestamp,
          level: LogLevel.Info,
          category: LogCategory.Test,
          action: LogAction.Handle,
          message: 'EVR 验证成功',
          ai_notes: `所有 EVR 已就绪: ${evrValidation.summary.passed.length} passed, ${evrValidation.summary.skipped.length} skipped`,
          details: {
            evr_summary: evrValidation.summary,
          },
        };
        task.logs.push(evrLog);
      }

      // 保存最终状态
      await this.saveTask(task, projectId);

      // 归档任务到历史目录
      await this.archiveTask(task, projectId);

      // 删除当前任务文件
      try {
        const taskPath = await this.resolveTaskPath(projectId);
        await fs.remove(taskPath);
      } catch (error) {
        // 忽略删除错误
      }

      logger.info(LogCategory.Task, LogAction.Update, '任务完成', {
        taskId: task.id,
        title: task.title,
        summary,
        evrSummary: evrValidation.summary,
      });

      return {
        archived_task_id: task.id,
        evr_summary: evrValidation.summary,
        evr_ready: true,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Update, '任务完成失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 记录任务活动日志
   */
  async logActivity(params: {
    category: LogCategory;
    action: LogAction;
    message: string;
    ai_notes?: string;
    details?: Record<string, any>;
    project_id?: string;
  }): Promise<{ log_id: string; timestamp: string }> {
    try {
      const task = await this.getCurrentTask(params.project_id);
      if (!task) {
        throw new Error('当前没有活跃的任务');
      }

      const timestamp = new Date().toISOString();
      const logId = ulid();

      const log: TaskLog = {
        timestamp,
        level: LogLevel.Info,
        category: params.category,
        action: params.action,
        message: params.message,
        ai_notes: params.ai_notes,
        details: {
          log_id: logId,
          ...params.details,
        },
      };

      task.logs.push(log);
      task.updated_at = timestamp;

      await this.saveTask(task, params.project_id);

      logger.info(params.category, params.action, '活动日志记录', {
        logId,
        message: params.message,
      });

      return {
        log_id: logId,
        timestamp,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '活动日志记录失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // 私有方法实现
  private validateInitParams(params: TaskInitParams): void {
    if (
      !params.title ||
      typeof params.title !== 'string' ||
      params.title.trim() === ''
    ) {
      throw new Error('任务标题不能为空');
    }

    if (params.title.length > 200) {
      throw new Error('任务标题不能超过200个字符');
    }

    if (
      !params.goal ||
      typeof params.goal !== 'string' ||
      params.goal.trim() === ''
    ) {
      throw new Error('任务目标不能为空');
    }

    if (params.goal.length < 10) {
      throw new Error('任务目标至少需要10个字符');
    }

    if (params.goal.length > 2000) {
      throw new Error('任务目标不能超过2000个字符');
    }

    if (params.knowledge_refs) {
      if (!Array.isArray(params.knowledge_refs)) {
        throw new Error('知识引用必须是字符串数组');
      }

      for (const ref of params.knowledge_refs) {
        if (typeof ref !== 'string') {
          throw new Error('知识引用必须是字符串数组');
        }
      }
    }

    if (params.overall_plan) {
      if (!Array.isArray(params.overall_plan)) {
        throw new Error('整体计划必须是字符串数组');
      }

      if (params.overall_plan.length > 20) {
        throw new Error('计划数量不能超过20个');
      }

      for (const plan of params.overall_plan) {
        if (typeof plan !== 'string' || plan.trim() === '') {
          throw new Error('计划描述不能为空');
        }

        if (plan.length > 500) {
          throw new Error('单个计划描述不能超过500个字符');
        }
      }
    }

    const now = new Date();
    if (isNaN(now.getTime())) {
      throw new Error('系统时钟异常');
    }
  }

  private generateTaskSlug(title: string): string {
    let slug = title.trim();

    slug = slug
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    if (/^[\u4e00-\u9fa5-]+$/.test(slug)) {
      return slug.replace(/-/g, '');
    }

    if (slug.length > 100) {
      slug = slug.substring(0, 100).replace(/-[^-]*$/, '');
    }

    return slug || 'untitled-task';
  }

  private parseStoryInfo(story: string): CurrentTask['story'] {
    if (story.startsWith('http')) {
      return { url: story };
    }
    return { url: story };
  }

  private createTaskPlan(
    description: string,
    timestamp: string,
    index?: number
  ): TaskPlan {
    const desc = description.trim();
    return {
      id: index !== undefined ? `plan-${index + 1}` : `plan-${ulid()}`,
      description: desc,
      text: desc, // 兼容性别名，用于旧API
      status: TaskStatus.ToDo,
      hints: [],
      steps: [],
      evrBindings: [],
      contextTags: [],
      created_at: timestamp,
    };
  }

  private async ensureDirectoryExists(projectId?: string): Promise<void> {
    const docsPath = await this.resolveProjectPath(projectId);
    try {
      await fs.access(docsPath);
    } catch {
      await fs.mkdir(docsPath, { recursive: true });
    }
  }

  private async saveTask(task: CurrentTask, projectId?: string): Promise<void> {
    // 确保目录存在
    await this.ensureDirectoryExists(projectId);

    // 保存到当前任务文件（向后兼容）
    const taskPath = await this.resolveTaskPath(projectId);
    const taskData = JSON.stringify(task, null, 2);
    await fs.writeFile(taskPath, taskData, 'utf8');

    // 生成并保存 current-task.md
    await this.generateCurrentTaskMarkdown(task, projectId);

    // 同时保存到多任务目录结构
    try {
      // 检查任务是否已经存在于多任务目录中
      const existingTaskDir =
        await this.multiTaskDirectoryManager.findTaskDirectory(task.id);

      if (existingTaskDir) {
        // 更新现有任务
        await this.multiTaskDirectoryManager.updateTaskInDirectory(
          task,
          existingTaskDir
        );
      } else {
        // 创建新的任务目录
        await this.multiTaskDirectoryManager.saveTaskToDirectory(task);
      }
    } catch (error) {
      // 多任务目录保存失败不应该影响主要功能
      logger.warning(LogCategory.Task, LogAction.Create, '多任务目录保存失败', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 生成并保存 current-task.md 文件
   */
  private async generateCurrentTaskMarkdown(
    task: CurrentTask,
    projectId?: string
  ): Promise<void> {
    try {
      const projectPath = await this.resolveProjectPath(projectId);
      // current-task.md 应该在 .wave 目录下
      const markdownPath = path.join(projectPath, 'current-task.md');

      const markdownContent = this.generateTaskMarkdownContent(task);
      await fs.writeFile(markdownPath, markdownContent, 'utf8');

      logger.info(
        LogCategory.Task,
        LogAction.Update,
        'current-task.md 已更新',
        {
          taskId: task.id,
          markdownPath,
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.Task,
        LogAction.Update,
        'current-task.md 生成失败',
        {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * 生成任务的 Markdown 内容（使用 PanelRenderer）
   */
  private generateTaskMarkdownContent(task: CurrentTask): string {
    try {
      // 将 CurrentTask 转换为 ParsedPanel 格式
      const panelData = this.convertTaskToPanelData(task);

      // 调试日志
      logger.info(LogCategory.Task, LogAction.Create, '准备渲染面板', {
        hasEVRs: panelData.evrs?.length || 0,
        hasPlans: panelData.plans?.length || 0,
        hasLogs: panelData.logs?.length || 0,
      });

      // 使用 PanelRenderer 渲染
      const result = this.panelRenderer.renderToMarkdown(panelData);

      logger.info(LogCategory.Task, LogAction.Create, '面板渲染成功', {
        contentLength: result.length,
      });

      return result;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '面板渲染失败', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 将 CurrentTask 转换为 ParsedPanel 格式
   */
  private convertTaskToPanelData(task: CurrentTask): any {
    return {
      title: task.title,
      taskId: task.id,
      references: task.knowledge_refs || [],
      requirements: [task.goal], // goal 作为 requirements
      issues: [],
      hints: task.task_hints || [],
      plans: (task.overall_plan || []).map(plan => ({
        id: plan.id,
        anchor: plan.id, // 添加锚点以便 PanelParser 识别
        text: plan.description,
        status: plan.status,
        hints: plan.hints || [],
        contextTags: plan.contextTags || [],
        evrBindings: plan.evrBindings || [],
        steps: (plan.steps || []).map(step => ({
          id: step.id,
          anchor: step.id, // 添加锚点以便 PanelParser 识别
          text: step.description,
          status: step.status,
          hints: step.hints || [],
          contextTags: step.contextTags || [],
          usesEVR: [],
        })),
      })),
      evrs: (task.expectedResults || []).map(evr => ({
        id: evr.id,
        title: evr.title,
        verify: evr.verify,
        expect: evr.expect,
        status: evr.status,
        class: evr.class,
        lastRun: evr.lastRun,
        notes: evr.notes,
        proof: evr.proof,
        referencedBy: evr.referencedBy || [],
      })),
      logs: (task.logs || []).map(log => ({
        timestamp: log.timestamp,
        level: log.level,
        category: log.category,
        action: log.action,
        message: log.message,
        aiNotes: log.ai_notes,
      })),
      metadata: {
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        completedAt: task.completed_at,
        currentPlanId: task.current_plan_id,
      },
    };
  }


  private validateUpdateParams(params: TaskUpdateParams): void {
    if (!['plan', 'step', 'evr'].includes(params.update_type)) {
      throw new Error('无效的更新类型');
    }

    if (params.update_type === 'evr') {
      if (!params.evr || !params.evr.items || params.evr.items.length === 0) {
        throw new Error('EVR更新必须提供evr.items');
      }

      for (const item of params.evr.items) {
        if (!item.evr_id || !item.status || !item.last_run) {
          throw new Error('EVR更新项目必须包含evr_id、status和last_run');
        }

        if (!['pass', 'fail', 'skip', 'unknown'].includes(item.status)) {
          throw new Error('无效的EVR状态');
        }
      }
      return; // EVR更新不需要检查其他字段
    }

    if (!params.status || !Object.values(TaskStatus).includes(params.status)) {
      throw new Error('无效的任务状态');
    }

    if (params.update_type === 'plan' && !params.plan_id) {
      throw new Error('计划级更新必须提供plan_id');
    }

    if (params.update_type === 'step' && !params.step_id) {
      throw new Error('步骤级更新必须提供step_id');
    }

    if (
      params.status === TaskStatus.Completed &&
      (!params.notes || params.notes.trim() === '')
    ) {
      throw new Error('完成状态必须提供备注');
    }
  }

  private async updatePlanStatus(
    task: CurrentTask,
    params: TaskUpdateParams,
    timestamp: string
  ): Promise<TaskUpdateResult> {
    const plan = task.overall_plan.find((p) => p.id === params.plan_id);
    if (!plan) {
      throw new Error('指定的计划不存在');
    }

    // 验证状态转换的合法性
    if (
      plan.status === TaskStatus.Blocked &&
      params.status === TaskStatus.Completed
    ) {
      throw new Error('状态转换无效：不能从阻塞状态直接转换到完成状态');
    }

    // 计划级门槛检查：尝试完成计划时检查 EVR 就绪性
    if (params.status === TaskStatus.Completed && plan.evrBindings?.length > 0) {
      const allEVRs = task.expectedResults || [];

      const gateResult = this.evrValidator.checkPlanGate(plan.id, allEVRs);
      if (!gateResult.canComplete) {
        // 阻止计划完成，返回 evr_pending
        return {
          success: false,
          current_plan_id: task.current_plan_id,
          evr_pending: true,
          evr_for_plan: gateResult.pendingEVRs || [],
        };
      }
    }

    if (params.status) {
      plan.status = params.status;
    }

    if (params.evidence) {
      plan.evidence = params.evidence;
    }

    if (params.notes) {
      plan.notes = params.notes;
    }

    if (params.status === TaskStatus.Completed) {
      plan.completed_at = timestamp;
    }

    const log: TaskLog = {
      timestamp,
      level: LogLevel.Info,
      category: LogCategory.Plan,
      action: LogAction.Update,
      message: '计划状态更新',
      ai_notes: params.notes,
      details: {
        plan_id: params.plan_id,
        new_status: params.status,
        evidence: params.evidence,
      },
    };
    task.logs.push(log);

    if (params.status === TaskStatus.InProgress) {
      task.current_plan_id = params.plan_id;
    }

    // 检查是否需要生成步骤
    const stepsRequired =
      params.status === TaskStatus.InProgress && plan.steps.length === 0;

    // 检查是否需要自动推进到下一个计划
    let autoAdvanced = false;
    let startedNewPlan = false;

    if (params.status === TaskStatus.Completed) {
      // 找到下一个计划
      const currentIndex = task.overall_plan.findIndex(
        (p) => p.id === params.plan_id
      );
      if (currentIndex >= 0 && currentIndex < task.overall_plan.length - 1) {
        const nextPlan = task.overall_plan[currentIndex + 1];
        nextPlan.status = TaskStatus.InProgress;
        task.current_plan_id = nextPlan.id;
        autoAdvanced = true;
        startedNewPlan = true;

        // 记录自动推进日志
        const advanceLog: TaskLog = {
          timestamp,
          level: LogLevel.Info,
          category: LogCategory.Plan,
          action: LogAction.Update,
          message: '自动推进到下一个计划',
          details: {
            from_plan_id: params.plan_id,
            to_plan_id: nextPlan.id,
          },
        };
        task.logs.push(advanceLog);
      }
    }

    // EVR 引导：当计划从 to_do 切换到 in_progress 时返回绑定的 EVR
    let evrForNode: string[] | undefined;
    if (params.status === TaskStatus.InProgress && plan.evrBindings?.length > 0) {
      evrForNode = plan.evrBindings;
    }

    return {
      success: true,
      current_plan_id: task.current_plan_id,
      steps_required: stepsRequired,
      auto_advanced: autoAdvanced,
      started_new_plan: startedNewPlan,
      evr_for_node: evrForNode,
    };
  }

  private async updateStepStatus(
    task: CurrentTask,
    params: TaskUpdateParams,
    timestamp: string
  ): Promise<TaskUpdateResult> {
    let targetPlan: TaskPlan | undefined;
    let targetStep: TaskStep | undefined;

    for (const plan of task.overall_plan) {
      const step = plan.steps.find((s) => s.id === params.step_id);
      if (step) {
        targetPlan = plan;
        targetStep = step;
        break;
      }
    }

    if (!targetStep || !targetPlan) {
      throw new Error('指定的步骤不存在');
    }

    if (params.status) {
      targetStep.status = params.status;
    }

    if (params.evidence) {
      targetStep.evidence = params.evidence;
    }

    if (params.notes) {
      targetStep.notes = params.notes;
    }

    if (params.status === TaskStatus.Completed) {
      targetStep.completed_at = timestamp;
    }

    const log: TaskLog = {
      timestamp,
      level: LogLevel.Info,
      category: LogCategory.Step,
      action: LogAction.Update,
      message: '步骤状态更新',
      ai_notes: params.notes,
      details: {
        step_id: params.step_id,
        plan_id: targetPlan.id,
        new_status: params.status,
        evidence: params.evidence,
      },
    };
    task.logs.push(log);

    return this.handleStepAdvancement(task, targetPlan, targetStep, timestamp);
  }

  /**
   * 更新 EVR 状态
   */
  private async updateEVRStatus(
    task: CurrentTask,
    params: TaskUpdateParams,
    timestamp: string
  ): Promise<TaskUpdateResult> {
    if (!params.evr || !params.evr.items) {
      throw new Error('EVR更新参数无效');
    }

    // 确保任务有 expectedResults 字段
    if (!task.expectedResults) {
      task.expectedResults = [];
    }

    const updatedEVRs: string[] = [];
    const logsHighlights: TaskLog[] = [];

    // 处理每个 EVR 更新项
    for (const item of params.evr.items) {
      // 验证必需字段
      if (!item.status || !item.last_run) {
        throw new Error(`EVR 更新项缺少必需字段: evr_id=${item.evr_id}`);
      }
      // 查找现有的 EVR
      let existingEVR = task.expectedResults.find(
        (evr) => evr.id === item.evr_id
      );

      if (!existingEVR) {
        // 如果 EVR 不存在，创建一个新的
        existingEVR = {
          id: item.evr_id,
          title: `EVR ${item.evr_id}`,
          verify: '',
          expect: '',
          status: item.status as any,
          referencedBy: [],
          runs: [],
        };
        task.expectedResults.push(existingEVR);
      }

      // 使用 EVRValidator 跟踪验证运行
      this.evrValidator.trackVerificationRun(existingEVR, {
        status: item.status as any,
        by: 'ai', // 可以根据实际情况调整
        notes: item.notes,
        proof: item.proof,
      });

      updatedEVRs.push(item.evr_id);

      // 生成高亮日志
      const highlightCategory =
        item.status === 'pass'
          ? 'VERIFIED'
          : item.status === 'fail'
            ? 'FAILED'
            : 'TEST';

      const highlightLog: TaskLog = {
        timestamp,
        level: LogLevel.Info,
        category: LogCategory.Test,
        action: LogAction.Update,
        message: `EVR ${item.evr_id} ${highlightCategory}`,
        ai_notes: item.notes,
        details: {
          evr_id: item.evr_id,
          status: item.status,
          proof: item.proof,
        },
      };

      task.logs.push(highlightLog);
      logsHighlights.push(highlightLog);
    }

    // 记录 EVR 更新操作日志
    const operationLog: TaskLog = {
      timestamp,
      level: LogLevel.Info,
      category: LogCategory.Task,
      action: LogAction.Update,
      message: 'EVR 运行态更新完成',
      details: {
        updated_evrs: updatedEVRs,
        total_updates: params.evr.items.length,
      },
    };
    task.logs.push(operationLog);

    return {
      success: true,
      current_plan_id: task.current_plan_id,
      logs_highlights: logsHighlights,
      auto_advanced: false,
      steps_required: false,
      started_new_plan: false,
    };
  }

  private handleStepAdvancement(
    task: CurrentTask,
    plan: TaskPlan,
    completedStep: TaskStep,
    timestamp: string
  ): TaskUpdateResult {
    const result: TaskUpdateResult = { success: true };

    if (completedStep.status !== TaskStatus.Completed) {
      return {
        ...result,
        current_plan_id: task.current_plan_id,
        next_step: completedStep, // 返回当前步骤作为next_step
      };
    }

    const currentStepIndex = plan.steps.findIndex(
      (s) => s.id === completedStep.id
    );
    const nextStep = plan.steps.find(
      (step, index) =>
        index > currentStepIndex && step.status === TaskStatus.ToDo
    );

    if (nextStep) {
      nextStep.status = TaskStatus.InProgress;

      const advanceLog: TaskLog = {
        timestamp,
        level: LogLevel.Info,
        category: LogCategory.Step,
        action: LogAction.Update,
        message: '自动推进到下一步骤',
        details: {
          from_step: completedStep.id,
          to_step: nextStep.id,
          plan_id: plan.id,
        },
      };
      task.logs.push(advanceLog);

      result.auto_advanced = true;
      result.next_step = nextStep;
      result.current_plan_id = plan.id;
      task.current_plan_id = plan.id;
    } else {
      const allStepsCompleted = plan.steps.every(
        (s) => s.status === TaskStatus.Completed
      );

      if (allStepsCompleted && plan.steps.length > 0) {
        plan.status = TaskStatus.Completed;
        plan.completed_at = timestamp;

        const planCompleteLog: TaskLog = {
          timestamp,
          level: LogLevel.Info,
          category: LogCategory.Plan,
          action: LogAction.Update,
          message: '计划自动完成',
          details: {
            plan_id: plan.id,
            completed_steps: plan.steps.length,
          },
        };
        task.logs.push(planCompleteLog);

        const nextPlan = task.overall_plan.find(
          (p) => p.status === TaskStatus.ToDo && p.id !== plan.id
        );

        if (nextPlan) {
          nextPlan.status = TaskStatus.InProgress;
          task.current_plan_id = nextPlan.id;

          const nextPlanLog: TaskLog = {
            timestamp,
            level: LogLevel.Info,
            category: LogCategory.Plan,
            action: LogAction.Update,
            message: '自动推进到下一计划',
            details: {
              from_plan: plan.id,
              to_plan: nextPlan.id,
            },
          };
          task.logs.push(nextPlanLog);

          result.auto_advanced = true;
          result.started_new_plan = true;
          result.current_plan_id = nextPlan.id;
          result.steps_required = nextPlan.steps.length === 0;
        }
      }
    }

    return result;
  }

  /**
   * 归档任务到历史目录
   */
  private async archiveTask(
    task: CurrentTask,
    projectId?: string
  ): Promise<void> {
    try {
      const docsPath = await this.resolveProjectPath(projectId);
      const historyDir = path.join(docsPath, 'history');
      await fs.ensureDir(historyDir);

      const historyFile = path.join(historyDir, `${task.id}.json`);
      const taskData = JSON.stringify(task, null, 2);
      await fs.writeFile(historyFile, taskData, 'utf8');
    } catch (error) {
      // 归档失败不应该阻止任务完成
      logger.error(LogCategory.Task, LogAction.Update, '任务归档失败', {
        taskId: task.id,
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 获取任务历史
   */
  async getTaskHistory(): Promise<any[]> {
    try {
      const historyDir = path.join(this.docsPath, 'history');

      if (!(await fs.pathExists(historyDir))) {
        return [];
      }

      const files = await fs.readdir(historyDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      const tasks = [];
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(historyDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const task = JSON.parse(data);
          tasks.push({
            id: task.id,
            title: task.title,
            slug: task.slug,
            created_at: task.created_at,
            completed_at: task.completed_at,
            goal: task.goal,
          });
        } catch (error) {
          // 忽略损坏的文件
          continue;
        }
      }

      // 按完成时间排序，最新的在前
      return tasks.sort(
        (a, b) =>
          new Date(b.completed_at || b.created_at).getTime() -
          new Date(a.completed_at || a.created_at).getTime()
      );
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '获取任务历史失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 获取当前上下文的活跃提示
   */
  private getActiveHints(task: CurrentTask, params: TaskUpdateParams) {
    const hints = {
      task: task.task_hints || [],
      plan: [] as string[],
      step: [] as string[],
    };

    let targetPlan: TaskPlan | undefined;

    // 获取计划级提示
    if (params.plan_id) {
      targetPlan = task.overall_plan.find((p) => p.id === params.plan_id);
      if (targetPlan) {
        hints.plan = targetPlan.hints || [];
      }
    }

    // 获取步骤级提示
    if (params.step_id) {
      for (const plan of task.overall_plan) {
        const step = plan.steps.find((s) => s.id === params.step_id);
        if (step) {
          hints.step = step.hints || [];
          // 如果没有明确的 plan_id，从步骤所属的计划获取计划级提示
          if (!targetPlan) {
            targetPlan = plan;
            hints.plan = plan.hints || [];
          }
          break;
        }
      }
    }

    return hints;
  }

  private validateModifyParams(params: TaskModifyParams): void {
    if (!['goal', 'plan', 'steps', 'hints', 'evr'].includes(params.field)) {
      throw new Error(`不支持的修改字段: ${params.field}`);
    }

    // EVR 字段的内容验证特殊处理
    if (params.field === 'evr') {
      if (!params.evr ||
        ((!params.evr.items || params.evr.items.length === 0) &&
          (!params.evr.evrIds || params.evr.evrIds.length === 0))) {
        throw new Error('EVR修改时必须提供evr.items或evr.evrIds');
      }
    } else {
      if (params.content === undefined || params.content === null) {
        throw new Error('修改内容不能为空');
      }
    }

    if (!params.reason || params.reason.trim() === '') {
      throw new Error('修改原因不能为空');
    }

    const validChangeTypes = [
      'generate_steps',
      'plan_adjustment',
      'steps_adjustment',
      'refine_goal',
      'bug_fix_replan',
      'user_request',
      'scope_change',
    ];
    if (!validChangeTypes.includes(params.change_type)) {
      throw new Error(`无效的变更类型: ${params.change_type}`);
    }

    this.validateContentFormat(params.field, params.content);

    if (params.field === 'steps' && !params.plan_id) {
      throw new Error('修改步骤时必须提供plan_id');
    }

    if (params.field === 'hints' && params.step_id && !params.plan_id) {
      throw new Error('修改步骤级提示时必须同时提供plan_id和step_id');
    }
  }

  private validateContentFormat(
    field: string,
    content: string | string[] | undefined
  ): void {
    // EVR 字段有自己的验证逻辑，跳过通用验证
    if (field === 'evr') {
      return;
    }

    if (content === undefined || content === null) {
      throw new Error(`${field}字段的内容不能为空`);
    }

    switch (field) {
      case 'goal':
        if (typeof content !== 'string') {
          throw new Error('goal字段的内容必须是字符串');
        }
        if (content.trim() === '') {
          throw new Error('任务目标不能为空');
        }
        if (content.length > 2000) {
          throw new Error('任务目标不能超过2000个字符');
        }
        break;

      case 'plan':
        if (!Array.isArray(content)) {
          throw new Error('plan字段的内容必须是字符串数组');
        }
        if (content.length === 0) {
          throw new Error('计划列表不能为空');
        }
        if (content.length > 20) {
          throw new Error('计划数量不能超过20个');
        }
        for (const plan of content) {
          if (typeof plan !== 'string' || plan.trim() === '') {
            throw new Error('计划描述不能为空');
          }
          if (plan.length > 500) {
            throw new Error('单个计划描述不能超过500个字符');
          }
        }
        break;

      case 'steps':
      case 'hints':
        if (!Array.isArray(content)) {
          throw new Error(`${field}字段的内容必须是字符串数组`);
        }
        for (const item of content) {
          if (typeof item !== 'string') {
            throw new Error(`${field}字段的内容必须是字符串数组`);
          }
        }
        break;
    }
  }

  private async modifyGoal(
    task: CurrentTask,
    params: TaskModifyParams,
    timestamp: string
  ): Promise<TaskModifyResult> {
    const oldGoal = task.goal;
    const newGoal = params.content as string;

    task.goal = newGoal.trim();

    const log: TaskLog = {
      timestamp,
      level: LogLevel.Info,
      category: LogCategory.Task,
      action: LogAction.Modify,
      message: '任务目标修改',
      ai_notes: params.reason,
      details: {
        field: 'goal',
        change_type: params.change_type,
        reason: params.reason,
        old_value: oldGoal,
        new_value: newGoal,
      },
    };
    task.logs.push(log);

    return {
      success: true,
      field: 'goal',
    };
  }

  private async modifyPlan(
    task: CurrentTask,
    params: TaskModifyParams,
    timestamp: string
  ): Promise<TaskModifyResult> {
    const oldPlanCount = task.overall_plan.length;
    const newPlanDescriptions = params.content as string[];

    task.overall_plan = newPlanDescriptions.map((description, index) =>
      this.createTaskPlan(description, timestamp, index)
    );

    task.current_plan_id =
      task.overall_plan.length > 0 ? task.overall_plan[0].id : undefined;

    const log: TaskLog = {
      timestamp,
      level: LogLevel.Info,
      category: LogCategory.Plan,
      action: LogAction.Modify,
      message: '整体计划修改',
      ai_notes: params.reason,
      details: {
        field: 'plan',
        change_type: params.change_type,
        reason: params.reason,
        old_plan_count: oldPlanCount,
        new_plan_count: task.overall_plan.length,
        reset_to_first_plan: true,
      },
    };
    task.logs.push(log);

    return {
      success: true,
      field: 'plan',
      affected_ids: task.overall_plan.map((p) => p.id),
      plan_reset: true,
      new_current_plan_id: task.current_plan_id,
    };
  }

  private async modifySteps(
    task: CurrentTask,
    params: TaskModifyParams,
    timestamp: string
  ): Promise<TaskModifyResult> {
    const plan = task.overall_plan.find((p) => p.id === params.plan_id);
    if (!plan) {
      throw new Error('指定的计划不存在');
    }

    const oldStepCount = plan.steps.length;
    const newStepDescriptions = params.content as string[];

    plan.steps = newStepDescriptions.map((description, index) => ({
      id: `step-${index + 1}`,
      description: description.trim(),
      status: TaskStatus.ToDo,
      hints: [],
      usesEVR: [],
      contextTags: [],
      created_at: timestamp,
    }));

    const log: TaskLog = {
      timestamp,
      level: LogLevel.Info,
      category: LogCategory.Step,
      action: LogAction.Modify,
      message: '计划步骤修改',
      ai_notes: params.reason,
      details: {
        field: 'steps',
        change_type: params.change_type,
        reason: params.reason,
        plan_id: params.plan_id,
        old_step_count: oldStepCount,
        new_step_count: plan.steps.length,
      },
    };
    task.logs.push(log);

    // 如果是新添加步骤，设置第一个步骤为进行中
    if (oldStepCount === 0 && plan.steps.length > 0) {
      plan.steps[0].status = TaskStatus.InProgress;
    }

    return {
      success: true,
      field: 'steps',
      affected_ids: [params.plan_id!, ...plan.steps.map((s) => s.id)],
      steps_added: plan.steps.length,
      steps_replaced: oldStepCount > 0,
      first_step_started: oldStepCount === 0 && plan.steps.length > 0,
    };
  }

  private async modifyHints(
    task: CurrentTask,
    params: TaskModifyParams,
    timestamp: string
  ): Promise<TaskModifyResult> {
    const newHints = params.content as string[];
    let targetLevel: string;
    let affectedIds: string[] = [];

    if (params.step_id && params.plan_id) {
      const plan = task.overall_plan.find((p) => p.id === params.plan_id);
      if (!plan) {
        throw new Error('指定的计划不存在');
      }

      const step = plan.steps.find((s) => s.id === params.step_id);
      if (!step) {
        throw new Error('指定的步骤不存在');
      }

      step.hints = [...newHints];
      targetLevel = 'step';
      affectedIds = [params.step_id];
    } else if (params.plan_id) {
      const plan = task.overall_plan.find((p) => p.id === params.plan_id);
      if (!plan) {
        throw new Error('指定的计划不存在');
      }

      plan.hints = [...newHints];
      targetLevel = 'plan';
      affectedIds = [params.plan_id];
    } else {
      task.task_hints = [...newHints];
      targetLevel = 'task';
    }

    const log: TaskLog = {
      timestamp,
      level: LogLevel.Info,
      category: LogCategory.Task,
      action: LogAction.Modify,
      message: `${targetLevel}级提示修改`,
      ai_notes: params.reason,
      details: {
        field: 'hints',
        change_type: params.change_type,
        reason: params.reason,
        target_level: targetLevel,
        plan_id: params.plan_id,
        step_id: params.step_id,
        hint_count: newHints.length,
      },
    };
    task.logs.push(log);

    return {
      success: true,
      field: 'hints',
      affected_ids: affectedIds,
      hints_added: newHints.length,
      hint_level: targetLevel,
    };
  }

  private async modifyEVR(
    task: CurrentTask,
    params: TaskModifyParams,
    timestamp: string
  ): Promise<TaskModifyResult> {
    if (!params.evr) {
      throw new Error('EVR修改参数不能为空');
    }

    // 确保 expectedResults 数组存在
    if (!task.expectedResults) {
      task.expectedResults = [];
    }

    const affectedIds: string[] = [];
    let operationCount = 0;
    let operationType = 'update';

    // 处理 plan_no 参数（用于绑定 EVR 到计划）
    let targetPlan: TaskPlan | undefined;
    if (params.plan_id) {
      targetPlan = task.overall_plan.find(p => p.id === params.plan_id);
      if (!targetPlan) {
        throw new Error(`计划 ${params.plan_id} 不存在`);
      }
    }

    // 处理 EVR 内容修改
    if (params.evr.items && params.evr.items.length > 0) {
      for (const item of params.evr.items) {
        if (item.evrId) {
          // 更新现有 EVR
          const existingEVR = task.expectedResults.find(evr => evr.id === item.evrId);
          if (!existingEVR) {
            throw new Error(`EVR ${item.evrId} 不存在`);
          }

          // 更新 EVR 内容字段，保持数组结构
          if (item.title !== undefined) {
            existingEVR.title = item.title;
          }
          if (item.verify !== undefined) {
            existingEVR.verify = item.verify;
          }
          if (item.expect !== undefined) {
            existingEVR.expect = item.expect;
          }
          if (item.class !== undefined) {
            existingEVR.class = item.class;
          }

          affectedIds.push(item.evrId);
          operationCount++;
        } else {
          // 创建新 EVR
          const newEVR: ExpectedResult = {
            id: `evr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: item.title || '新EVR',
            verify: item.verify || '',
            expect: item.expect || '',
            status: EVRStatus.Unknown,
            class: item.class || EVRClass.Runtime,
            referencedBy: [],
            runs: [],
          };

          task.expectedResults.push(newEVR);
          affectedIds.push(newEVR.id);
          operationCount++;
          operationType = 'create';

          // 如果指定了目标计划，将 EVR 绑定到该计划
          if (targetPlan) {
            if (!targetPlan.evrBindings) {
              targetPlan.evrBindings = [];
            }
            targetPlan.evrBindings.push(newEVR.id);

            // 更新 EVR 的 referencedBy
            if (!newEVR.referencedBy) {
              newEVR.referencedBy = [];
            }
            newEVR.referencedBy.push(targetPlan.id);
          }
        }
      }
    }

    // 处理 EVR 删除或解绑
    if (params.evr.evrIds && params.evr.evrIds.length > 0) {
      for (const evrId of params.evr.evrIds) {
        const evrIndex = task.expectedResults.findIndex(evr => evr.id === evrId);
        if (evrIndex >= 0) {
          // 从计划中解绑 EVR
          task.overall_plan.forEach(plan => {
            const bindingIndex = plan.evrBindings?.indexOf(evrId);
            if (bindingIndex !== undefined && bindingIndex >= 0) {
              plan.evrBindings.splice(bindingIndex, 1);
            }
          });

          // 删除 EVR
          task.expectedResults.splice(evrIndex, 1);
          affectedIds.push(evrId);
          operationCount++;
          operationType = 'remove';
        }
      }
    }

    // 记录操作日志
    const log: TaskLog = {
      timestamp,
      level: LogLevel.Info,
      category: LogCategory.Task,
      action: LogAction.Modify,
      message: `EVR内容修改: ${operationType}`,
      ai_notes: params.reason,
      details: {
        field: 'evr',
        change_type: params.change_type,
        reason: params.reason,
        operation_type: operationType,
        operation_count: operationCount,
        affected_evr_ids: affectedIds,
        evr_items: params.evr.items?.length || 0,
        evr_ids: params.evr.evrIds?.length || 0,
      },
    };
    task.logs.push(log);

    return {
      success: true,
      field: 'evr',
      affected_ids: affectedIds,
      evr_modified: operationCount,
      operation_type: operationType,
    };
  }

  private validateTaskDataStructure(data: any): void {
    const requiredFields = [
      'id',
      'title',
      'slug',
      'goal',
      'knowledge_refs',
      'task_hints',
      'overall_plan',
      'logs',
      'created_at',
      'updated_at',
    ];

    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`任务数据结构不完整: 缺少字段 ${field}`);
      }
    }

    const arrayFields = [
      'knowledge_refs',
      'task_hints',
      'overall_plan',
      'logs',
    ];
    for (const field of arrayFields) {
      if (!Array.isArray(data[field])) {
        throw new Error(`任务数据结构不完整: ${field} 必须是数组`);
      }
    }
  }
}

/**
 * 创建TaskManager实例的工厂函数
 */
export function createTaskManager(docsPath: string): TaskManager {
  return new TaskManager(docsPath);
}

/**
 * TaskManager错误类型枚举
 */
export enum TaskManagerErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  DATA_FORMAT_ERROR = 'DATA_FORMAT_ERROR',
  STATE_TRANSITION_ERROR = 'STATE_TRANSITION_ERROR',
  REFERENCE_ERROR = 'REFERENCE_ERROR',
  CONCURRENCY_ERROR = 'CONCURRENCY_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
}

/**
 * TaskManager自定义错误类
 */
export class TaskManagerError extends Error {
  public readonly type: TaskManagerErrorType;
  public readonly details?: Record<string, any>;

  constructor(
    type: TaskManagerErrorType,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TaskManagerError';
    this.type = type;
    this.details = details;
  }

  static validation(
    message: string,
    details?: Record<string, any>
  ): TaskManagerError {
    return new TaskManagerError(
      TaskManagerErrorType.VALIDATION_ERROR,
      message,
      details
    );
  }

  static fileSystem(
    message: string,
    details?: Record<string, any>
  ): TaskManagerError {
    return new TaskManagerError(
      TaskManagerErrorType.FILE_SYSTEM_ERROR,
      message,
      details
    );
  }

  static dataFormat(
    message: string,
    details?: Record<string, any>
  ): TaskManagerError {
    return new TaskManagerError(
      TaskManagerErrorType.DATA_FORMAT_ERROR,
      message,
      details
    );
  }

  static stateTransition(
    message: string,
    details?: Record<string, any>
  ): TaskManagerError {
    return new TaskManagerError(
      TaskManagerErrorType.STATE_TRANSITION_ERROR,
      message,
      details
    );
  }
}
