/**
 * 增强的项目连接管理器
 * 实现设计文档中要求的项目连接状态管理、多种连接方式支持、会话绑定等功能
 */

import fs from 'fs-extra';
import * as path from 'path';
import { ulid } from 'ulid';
import { logger } from './logger.js';
import { ProjectRegistry } from './project-registry.js';
import {
  LogCategory,
  LogAction,
  type ConnectParams,
  type ConnectionResult,
  type ConnectionStatus,
  type EnhancedProjectInfo,
  type ProjectResolveResult,
  type SessionBinding,
  type ProjectRegistryState,
  type TaskSummary,
  type ProjectRecord,
  type ErrorCode,
} from '../types/index.js';

/**
 * 增强的项目连接管理器
 * 基于现有 ProjectRegistry，增加连接状态管理和会话绑定功能
 */
export class EnhancedProjectRegistry {
  private baseRegistry: ProjectRegistry;
  private currentBinding: SessionBinding | null = null;
  private sessionId: string;
  private connectionHistory: Array<{
    projectId: string;
    connectedAt: string;
    disconnectedAt?: string;
    duration?: number;
  }> = [];

  constructor(baseRegistry?: ProjectRegistry) {
    this.baseRegistry = baseRegistry || new ProjectRegistry();
    this.sessionId = ulid();

    logger.info(LogCategory.Task, LogAction.Create, '增强项目注册表初始化', {
      sessionId: this.sessionId,
    });
  }

  /**
   * 连接项目到当前会话
   * 支持 root、slug、repo 三种连接方式
   */
  async connectProject(params: ConnectParams): Promise<ConnectionResult> {
    try {
      logger.info(LogCategory.Task, LogAction.Handle, '开始项目连接', {
        params,
        sessionId: this.sessionId,
      });

      // 验证参数
      if (!params.root && !params.slug && !params.repo) {
        return {
          connected: false,
          error: 'INVALID_ROOT' as ErrorCode,
          message: '必须提供 root、slug 或 repo 参数之一',
        };
      }

      // 按优先级尝试连接
      let resolveResult: ProjectResolveResult;

      if (params.root) {
        resolveResult = await this.resolveByRoot(params.root);
      } else if (params.slug) {
        resolveResult = await this.resolveBySlug(params.slug);
      } else if (params.repo) {
        resolveResult = await this.resolveByRepo(params.repo);
      } else {
        return {
          connected: false,
          error: 'INVALID_ROOT' as ErrorCode,
          message: '无效的连接参数',
        };
      }

      // 处理解析结果
      if (!resolveResult.found) {
        // 如果是通过 root 路径解析且有错误原因，说明是路径验证失败
        if (resolveResult.method === 'root' && resolveResult.error) {
          return {
            connected: false,
            error: 'INVALID_ROOT' as ErrorCode,
            message: `项目路径无效: ${resolveResult.error}`,
          };
        }

        return {
          connected: false,
          error: 'NOT_FOUND' as ErrorCode,
          message: `未找到匹配的项目: ${resolveResult.searchParam}`,
        };
      }

      if (resolveResult.projects.length === 0) {
        return {
          connected: false,
          error: 'NOT_FOUND' as ErrorCode,
          message: '未找到匹配的项目',
        };
      }

      if (resolveResult.projects.length > 1) {
        // 尝试进行更精确的匹配
        const exactMatches = this.findExactMatches(
          resolveResult.projects,
          params
        );
        if (exactMatches.length === 1) {
          const project = exactMatches[0];
          await this.bindToSession(project.id);
          return {
            connected: true,
            project,
          };
        }

        return {
          connected: false,
          error: 'MULTIPLE_CANDIDATES' as ErrorCode,
          message: '找到多个匹配的项目，请提供更具体的参数',
          candidates: resolveResult.projects,
        };
      }

      // 连接到唯一匹配的项目
      const project = resolveResult.projects[0];
      await this.bindToSession(project.id);

      logger.info(LogCategory.Task, LogAction.Update, '项目连接成功', {
        projectId: project.id,
        root: project.root,
        slug: project.slug,
        sessionId: this.sessionId,
      });

      return {
        connected: true,
        project,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '项目连接失败', {
        params,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        connected: false,
        error: 'INVALID_ROOT' as ErrorCode,
        message: `连接失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 获取当前连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    if (!this.currentBinding) {
      return {
        connected: false,
      };
    }

    return {
      connected: true,
      project: {
        id: this.currentBinding.projectId,
        slug: '', // 需要从项目记录中获取
        origin: undefined,
      },
      connectedAt: this.currentBinding.boundAt,
      sessionId: this.sessionId,
    };
  }

  /**
   * 获取当前连接的项目信息
   */
  async getCurrentProject(): Promise<EnhancedProjectInfo | null> {
    if (!this.currentBinding) {
      return null;
    }

    try {
      const projectRecord = await this.baseRegistry.resolveProject(
        this.currentBinding.projectId
      );

      if (!projectRecord) {
        // 项目记录不存在，清除绑定
        await this.unbindFromSession();
        return null;
      }

      // 获取活动任务和最近任务
      const activeTask = await this.getActiveTask(projectRecord.root);
      const recentTasks = await this.getRecentTasks(projectRecord.root);

      return {
        id: projectRecord.id,
        slug: projectRecord.slug,
        origin: projectRecord.origin,
        root: projectRecord.root,
        repo: this.extractRepoFromOrigin(projectRecord.origin),
        activeTask,
        recentTasks,
        lastAccessed: this.currentBinding.lastActivity,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '获取当前项目失败', {
        projectId: this.currentBinding.projectId,
        error: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  }

  /**
   * 根据绝对路径解析项目
   */
  async resolveByRoot(root: string): Promise<ProjectResolveResult> {
    try {
      const resolvedPath = path.resolve(root);

      // 验证路径
      const validation =
        await this.baseRegistry.validateProjectPath(resolvedPath);
      if (!validation.valid) {
        return {
          found: false,
          projects: [],
          method: 'root',
          searchParam: root,
          error: validation.reason,
        };
      }

      // 初始化或加载项目
      const projectRecord =
        await this.baseRegistry.initializeProject(resolvedPath);
      const enhancedProject = await this.enhanceProjectInfo(projectRecord);

      return {
        found: true,
        projects: [enhancedProject],
        method: 'root',
        searchParam: root,
      };
    } catch (error) {
      return {
        found: false,
        projects: [],
        method: 'root',
        searchParam: root,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 根据项目标识符解析项目
   */
  async resolveBySlug(slug: string): Promise<ProjectResolveResult> {
    try {
      const projectRecords = await this.baseRegistry.findProjects({ slug });
      const enhancedProjects = await Promise.all(
        projectRecords.map((record) => this.enhanceProjectInfo(record))
      );

      // 对候选项目进行排序
      const sortedProjects = this.sortCandidates(enhancedProjects, { slug });

      return {
        found: sortedProjects.length > 0,
        projects: sortedProjects,
        method: 'slug',
        searchParam: slug,
      };
    } catch (error) {
      return {
        found: false,
        projects: [],
        method: 'slug',
        searchParam: slug,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 根据仓库地址解析项目
   */
  async resolveByRepo(repo: string): Promise<ProjectResolveResult> {
    try {
      // 由于基础注册表没有直接的按仓库搜索方法，我们需要通过其他方式实现
      // 这里使用一个简化的实现，实际应该扩展基础注册表的功能
      const matchingProjects: ProjectRecord[] = [];

      // 尝试通过 slug 搜索（如果 repo URL 包含项目名）
      const repoName = this.extractRepoName(repo);
      if (repoName) {
        const slugResults = await this.baseRegistry.findProjects({
          slug: repoName,
        });
        for (const record of slugResults) {
          if (record.origin && this.isRepoMatch(record.origin, repo)) {
            matchingProjects.push(record);
          }
        }
      }

      const enhancedProjects = await Promise.all(
        matchingProjects.map((record) => this.enhanceProjectInfo(record))
      );

      // 对候选项目进行排序
      const sortedProjects = this.sortCandidates(enhancedProjects, { repo });

      return {
        found: sortedProjects.length > 0,
        projects: sortedProjects,
        method: 'repo',
        searchParam: repo,
      };
    } catch (error) {
      return {
        found: false,
        projects: [],
        method: 'repo',
        searchParam: repo,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 绑定项目到当前会话
   */
  async bindToSession(projectId: string): Promise<void> {
    // 如果已有绑定，先解绑
    if (this.currentBinding) {
      await this.unbindFromSession();
    }

    const now = new Date().toISOString();
    this.currentBinding = {
      sessionId: this.sessionId,
      projectId,
      boundAt: now,
      lastActivity: now,
      status: 'active',
    };

    // 记录连接历史
    this.connectionHistory.push({
      projectId,
      connectedAt: now,
    });

    logger.info(LogCategory.Task, LogAction.Update, '项目会话绑定成功', {
      projectId,
      sessionId: this.sessionId,
    });
  }

  /**
   * 解除当前会话绑定
   */
  async unbindFromSession(): Promise<void> {
    if (!this.currentBinding) {
      return;
    }

    const now = new Date().toISOString();
    const projectId = this.currentBinding.projectId;

    // 更新连接历史
    const lastConnection =
      this.connectionHistory[this.connectionHistory.length - 1];
    if (
      lastConnection &&
      lastConnection.projectId === projectId &&
      !lastConnection.disconnectedAt
    ) {
      lastConnection.disconnectedAt = now;
      lastConnection.duration =
        new Date(now).getTime() -
        new Date(lastConnection.connectedAt).getTime();
    }

    this.currentBinding = null;

    logger.info(LogCategory.Task, LogAction.Update, '项目会话绑定解除', {
      projectId,
      sessionId: this.sessionId,
    });
  }

  /**
   * 更新会话活动时间
   */
  updateLastActivity(): void {
    if (this.currentBinding) {
      this.currentBinding.lastActivity = new Date().toISOString();
    }
  }

  /**
   * 获取注册表状态
   */
  getRegistryState(): ProjectRegistryState {
    const totalConnections = this.connectionHistory.length;
    const uniqueProjects = new Set(
      this.connectionHistory.map((h) => h.projectId)
    ).size;

    const completedConnections = this.connectionHistory.filter(
      (h) => h.duration
    );
    const averageConnectionDuration =
      completedConnections.length > 0
        ? completedConnections.reduce((sum, h) => sum + (h.duration || 0), 0) /
          completedConnections.length
        : 0;

    return {
      currentBinding: this.currentBinding || undefined,
      connectionHistory: this.connectionHistory,
      stats: {
        totalConnections,
        uniqueProjects,
        averageConnectionDuration,
      },
    };
  }

  /**
   * 检查项目连接是否有效
   */
  async isConnectionValid(): Promise<boolean> {
    if (!this.currentBinding) {
      return false;
    }

    try {
      const projectRecord = await this.baseRegistry.resolveProject(
        this.currentBinding.projectId
      );
      return projectRecord !== null;
    } catch {
      return false;
    }
  }

  /**
   * 刷新会话绑定
   * 验证当前绑定的项目是否仍然有效，如果无效则自动解绑
   */
  async refreshBinding(): Promise<boolean> {
    if (!this.currentBinding) {
      return false;
    }

    const isValid = await this.isConnectionValid();
    if (!isValid) {
      logger.warning(
        LogCategory.Task,
        LogAction.Handle,
        '项目连接已失效，自动解绑',
        {
          projectId: this.currentBinding.projectId,
          sessionId: this.sessionId,
        }
      );
      await this.unbindFromSession();
      return false;
    }

    this.updateLastActivity();
    return true;
  }

  /**
   * 获取会话隔离的项目根目录
   * 确保只能访问当前绑定项目的数据
   */
  async getIsolatedProjectRoot(): Promise<string | null> {
    if (!this.currentBinding) {
      return null;
    }

    const isValid = await this.refreshBinding();
    if (!isValid) {
      return null;
    }

    const projectRecord = await this.baseRegistry.resolveProject(
      this.currentBinding.projectId
    );

    return projectRecord?.root || null;
  }

  /**
   * 检查路径是否在当前项目范围内
   * 用于确保项目隔离
   */
  async isPathInCurrentProject(targetPath: string): Promise<boolean> {
    const projectRoot = await this.getIsolatedProjectRoot();
    if (!projectRoot) {
      return false;
    }

    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(projectRoot);

    return resolvedTarget.startsWith(resolvedRoot);
  }

  /**
   * 强制项目隔离检查
   * 如果没有绑定项目或路径不在项目范围内，抛出错误
   */
  async enforceProjectIsolation(targetPath?: string): Promise<string> {
    const projectRoot = await this.getIsolatedProjectRoot();
    if (!projectRoot) {
      throw new Error('NO_PROJECT_BOUND: 当前会话未绑定项目');
    }

    if (targetPath) {
      const isInProject = await this.isPathInCurrentProject(targetPath);
      if (!isInProject) {
        throw new Error('INVALID_PATH: 路径不在当前项目范围内');
      }
    }

    return projectRoot;
  }

  /**
   * 获取项目隔离的任务数据路径
   */
  async getIsolatedTaskDataPath(): Promise<string | null> {
    const projectRoot = await this.getIsolatedProjectRoot();
    if (!projectRoot) {
      return null;
    }

    return path.join(projectRoot, '.wave');
  }

  /**
   * 清理过期的会话绑定
   */
  cleanupExpiredBindings(): void {
    if (!this.currentBinding) {
      return;
    }

    const now = new Date().getTime();
    const lastActivity = new Date(this.currentBinding.lastActivity).getTime();
    const maxInactiveTime = 24 * 60 * 60 * 1000; // 24小时

    if (now - lastActivity > maxInactiveTime) {
      logger.info(LogCategory.Task, LogAction.Update, '清理过期会话绑定', {
        projectId: this.currentBinding.projectId,
        sessionId: this.sessionId,
        inactiveTime: now - lastActivity,
      });

      this.currentBinding.status = 'expired';
      // 不立即解绑，让用户有机会恢复
    }
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  /**
   * 增强项目信息
   */
  private async enhanceProjectInfo(
    record: ProjectRecord
  ): Promise<EnhancedProjectInfo> {
    const activeTask = await this.getActiveTask(record.root);
    const recentTasks = await this.getRecentTasks(record.root);

    return {
      id: record.id,
      slug: record.slug,
      origin: record.origin,
      root: record.root,
      repo: this.extractRepoFromOrigin(record.origin),
      activeTask,
      recentTasks,
      lastAccessed: record.last_seen,
    };
  }

  /**
   * 获取活动任务
   */
  private async getActiveTask(
    projectRoot: string
  ): Promise<TaskSummary | undefined> {
    try {
      const currentTaskPath = path.join(
        projectRoot,
        '.wave',
        'current-task.md'
      );
      if (!(await fs.pathExists(currentTaskPath))) {
        return undefined;
      }

      // 这里应该解析 current-task.md 获取任务信息
      // 暂时返回模拟数据
      return {
        id: 'mock-task-id',
        title: 'Mock Active Task',
        slug: 'mock-active-task',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        goal: 'Mock task goal',
        taskDir: path.join(projectRoot, '.wave', 'tasks'),
        progress: {
          totalPlans: 1,
          completedPlans: 0,
          currentPlanId: 'plan-1',
        },
      };
    } catch {
      return undefined;
    }
  }

  /**
   * 获取最近任务列表
   */
  private async getRecentTasks(projectRoot: string): Promise<TaskSummary[]> {
    try {
      const tasksIndexPath = path.join(
        projectRoot,
        '.wave',
        'tasks',
        'index.json'
      );
      if (!(await fs.pathExists(tasksIndexPath))) {
        return [];
      }

      // 这里应该读取任务索引文件
      // 暂时返回空数组
      return [];
    } catch {
      return [];
    }
  }

  /**
   * 从 origin 提取仓库地址
   */
  private extractRepoFromOrigin(origin?: string): string | undefined {
    if (!origin) {
      return undefined;
    }

    // 简单的 Git URL 提取逻辑
    if (
      origin.includes('github.com') ||
      origin.includes('gitlab.com') ||
      origin.includes('.git')
    ) {
      return origin;
    }

    return undefined;
  }

  /**
   * 查找精确匹配的项目
   */
  private findExactMatches(
    candidates: EnhancedProjectInfo[],
    params: ConnectParams
  ): EnhancedProjectInfo[] {
    const exactMatches: EnhancedProjectInfo[] = [];

    for (const candidate of candidates) {
      let isExactMatch = false;

      if (params.root && candidate.root === path.resolve(params.root)) {
        isExactMatch = true;
      } else if (params.slug && candidate.slug === params.slug) {
        isExactMatch = true;
      } else if (
        params.repo &&
        candidate.repo &&
        this.isExactRepoMatch(candidate.repo, params.repo)
      ) {
        isExactMatch = true;
      }

      if (isExactMatch) {
        exactMatches.push(candidate);
      }
    }

    return exactMatches;
  }

  /**
   * 检查是否为精确的仓库匹配
   */
  private isExactRepoMatch(origin: string, repo: string): boolean {
    const normalizeUrl = (url: string) => {
      return url
        .toLowerCase()
        .replace(/\.git$/, '')
        .replace(/\/$/, '')
        .replace(/^https?:\/\//, '')
        .replace(/^git@/, '')
        .replace(/:/g, '/');
    };

    return normalizeUrl(origin) === normalizeUrl(repo);
  }

  /**
   * 对候选项目进行排序
   * 按照最后访问时间、匹配度等因素排序
   */
  private sortCandidates(
    candidates: EnhancedProjectInfo[],
    params: ConnectParams
  ): EnhancedProjectInfo[] {
    return candidates.sort((a, b) => {
      // 优先级1：精确匹配
      const aExact = this.isExactCandidate(a, params);
      const bExact = this.isExactCandidate(b, params);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // 优先级2：最近访问时间
      const aTime = new Date(a.lastAccessed || 0).getTime();
      const bTime = new Date(b.lastAccessed || 0).getTime();
      if (aTime !== bTime) return bTime - aTime;

      // 优先级3：是否有活动任务
      if (a.activeTask && !b.activeTask) return -1;
      if (!a.activeTask && b.activeTask) return 1;

      // 优先级4：字母顺序
      return a.slug.localeCompare(b.slug);
    });
  }

  /**
   * 检查是否为精确候选
   */
  private isExactCandidate(
    candidate: EnhancedProjectInfo,
    params: ConnectParams
  ): boolean {
    if (params.root && candidate.root === path.resolve(params.root)) {
      return true;
    }
    if (params.slug && candidate.slug === params.slug) {
      return true;
    }
    if (
      params.repo &&
      candidate.repo &&
      this.isExactRepoMatch(candidate.repo, params.repo)
    ) {
      return true;
    }
    return false;
  }

  /**
   * 从仓库 URL 提取项目名称
   */
  private extractRepoName(repo: string): string | null {
    try {
      // 处理各种 Git URL 格式
      let repoPath = repo;

      // 移除协议前缀
      repoPath = repoPath.replace(/^https?:\/\//, '');
      repoPath = repoPath.replace(/^git@/, '');

      // 处理 SSH 格式的冒号
      repoPath = repoPath.replace(/:/g, '/');

      // 移除 .git 后缀
      repoPath = repoPath.replace(/\.git$/, '');

      // 提取最后一部分作为项目名
      const parts = repoPath.split('/');
      return parts[parts.length - 1] || null;
    } catch {
      return null;
    }
  }

  /**
   * 检查仓库地址是否匹配
   */
  private isRepoMatch(origin: string, repo: string): boolean {
    // 标准化 URL 进行比较
    const normalizeUrl = (url: string) => {
      return url
        .toLowerCase()
        .replace(/\.git$/, '')
        .replace(/\/$/, '')
        .replace(/^https?:\/\//, '')
        .replace(/^git@/, '')
        .replace(/:/g, '/');
    };

    return (
      normalizeUrl(origin).includes(normalizeUrl(repo)) ||
      normalizeUrl(repo).includes(normalizeUrl(origin))
    );
  }

  /**
   * 加载全局注册表（委托给基础注册表）
   */
  private async loadGlobalRegistry() {
    // 通过基础注册表的公共方法获取统计信息，然后构造注册表结构
    try {
      const stats = await this.baseRegistry.getRegistryStats();
      // 这里需要一个更好的方式来访问全局注册表数据
      // 暂时返回空的注册表结构
      return {
        projects: {} as Record<string, ProjectRecord>,
        version: stats.registryVersion,
        updated_at: stats.lastUpdated,
      };
    } catch {
      return {
        projects: {} as Record<string, ProjectRecord>,
        version: '1.0.0',
        updated_at: new Date().toISOString(),
      };
    }
  }

  /**
   * 验证项目路径的有效性
   */
  async validateProjectPath(
    projectPath: string
  ): Promise<{ valid: boolean; reason?: string }> {
    return this.baseRegistry.validateProjectPath(projectPath);
  }

  /**
   * 查找项目（委托给基础注册表）
   */
  async findProjects(query: {
    slug?: string;
    path?: string;
  }): Promise<ProjectRecord[]> {
    return this.baseRegistry.findProjects(query);
  }

  /**
   * 初始化项目（委托给基础注册表）
   */
  async initializeProject(dir: string): Promise<ProjectRecord> {
    return this.baseRegistry.initializeProject(dir);
  }

  /**
   * 解析项目（委托给基础注册表）
   */
  async resolveProject(projectId: string): Promise<ProjectRecord | null> {
    return this.baseRegistry.resolveProject(projectId);
  }
}
