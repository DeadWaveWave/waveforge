/**
 * 假项目注册表实现
 * 用于测试环境，提供内存中的项目连接管理
 */

import { ulid } from 'ulid';
import {
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
 * 假项目注册表
 * 在内存中模拟项目连接管理功能，用于单元测试
 */
export class FakeProjectRegistry {
  private projects: Map<string, ProjectRecord> = new Map();
  private currentBinding: SessionBinding | null = null;
  private sessionId: string;
  private connectionHistory: Array<{
    projectId: string;
    connectedAt: string;
    disconnectedAt?: string;
    duration?: number;
  }> = [];

  constructor() {
    this.sessionId = ulid();
    this.setupMockProjects();
  }

  /**
   * 连接项目到当前会话
   */
  async connectProject(params: ConnectParams): Promise<ConnectionResult> {
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

    return {
      connected: true,
      project,
    };
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

    const project = this.projects.get(this.currentBinding.projectId);
    return {
      connected: true,
      project: project
        ? {
            id: project.id,
            slug: project.slug,
            origin: project.origin,
          }
        : undefined,
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

    const projectRecord = this.projects.get(this.currentBinding.projectId);
    if (!projectRecord) {
      await this.unbindFromSession();
      return null;
    }

    return this.enhanceProjectInfo(projectRecord);
  }

  /**
   * 根据绝对路径解析项目
   */
  async resolveByRoot(root: string): Promise<ProjectResolveResult> {
    const matchingProjects: EnhancedProjectInfo[] = [];

    for (const record of this.projects.values()) {
      if (record.root === root) {
        matchingProjects.push(await this.enhanceProjectInfo(record));
      }
    }

    return {
      found: matchingProjects.length > 0,
      projects: matchingProjects,
      method: 'root',
      searchParam: root,
    };
  }

  /**
   * 根据项目标识符解析项目
   */
  async resolveBySlug(slug: string): Promise<ProjectResolveResult> {
    const matchingProjects: EnhancedProjectInfo[] = [];

    for (const record of this.projects.values()) {
      if (record.slug.includes(slug)) {
        matchingProjects.push(await this.enhanceProjectInfo(record));
      }
    }

    return {
      found: matchingProjects.length > 0,
      projects: matchingProjects,
      method: 'slug',
      searchParam: slug,
    };
  }

  /**
   * 根据仓库地址解析项目
   */
  async resolveByRepo(repo: string): Promise<ProjectResolveResult> {
    const matchingProjects: EnhancedProjectInfo[] = [];

    for (const record of this.projects.values()) {
      if (record.origin && this.isRepoMatch(record.origin, repo)) {
        matchingProjects.push(await this.enhanceProjectInfo(record));
      }
    }

    return {
      found: matchingProjects.length > 0,
      projects: matchingProjects,
      method: 'repo',
      searchParam: repo,
    };
  }

  /**
   * 绑定项目到当前会话
   */
  async bindToSession(projectId: string): Promise<void> {
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

    this.connectionHistory.push({
      projectId,
      connectedAt: now,
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

    return this.projects.has(this.currentBinding.projectId);
  }

  /**
   * 刷新会话绑定
   */
  async refreshBinding(): Promise<boolean> {
    if (!this.currentBinding) {
      return false;
    }

    const isValid = await this.isConnectionValid();
    if (!isValid) {
      await this.unbindFromSession();
      return false;
    }

    this.updateLastActivity();
    return true;
  }

  /**
   * 获取会话隔离的项目根目录
   */
  async getIsolatedProjectRoot(): Promise<string | null> {
    if (!this.currentBinding) {
      return null;
    }

    const isValid = await this.refreshBinding();
    if (!isValid) {
      return null;
    }

    const project = this.projects.get(this.currentBinding.projectId);
    return project?.root || null;
  }

  /**
   * 检查路径是否在当前项目范围内
   */
  async isPathInCurrentProject(targetPath: string): Promise<boolean> {
    const projectRoot = await this.getIsolatedProjectRoot();
    if (!projectRoot) {
      return false;
    }

    // 在测试环境中，简化路径检查
    return targetPath.startsWith(projectRoot);
  }

  /**
   * 强制项目隔离检查
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

    return `${projectRoot}/.wave`;
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
      this.currentBinding.status = 'expired';
    }
  }

  // ============================================================================
  // 测试辅助方法
  // ============================================================================

  /**
   * 添加模拟项目
   */
  addMockProject(project: ProjectRecord): void {
    this.projects.set(project.id, project);
  }

  /**
   * 移除模拟项目
   */
  removeMockProject(projectId: string): void {
    this.projects.delete(projectId);
  }

  /**
   * 清空所有项目
   */
  clearProjects(): void {
    this.projects.clear();
  }

  /**
   * 获取所有项目
   */
  getAllProjects(): ProjectRecord[] {
    return Array.from(this.projects.values());
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.projects.clear();
    this.currentBinding = null;
    this.connectionHistory = [];
    this.sessionId = ulid();
    this.setupMockProjects();
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  /**
   * 设置模拟项目数据
   */
  private setupMockProjects(): void {
    const mockProjects: ProjectRecord[] = [
      {
        id: 'project-1',
        root: '/path/to/project1',
        slug: 'test-project-1',
        origin: 'https://github.com/user/project1.git',
        last_seen: new Date().toISOString(),
      },
      {
        id: 'project-2',
        root: '/path/to/project2',
        slug: 'test-project-2',
        origin: 'https://github.com/user/project2.git',
        last_seen: new Date().toISOString(),
      },
      {
        id: 'project-3',
        root: '/path/to/project3',
        slug: 'another-project',
        origin: 'https://gitlab.com/user/project3.git',
        last_seen: new Date().toISOString(),
      },
    ];

    mockProjects.forEach((project) => {
      this.projects.set(project.id, project);
    });
  }

  /**
   * 增强项目信息
   */
  private async enhanceProjectInfo(
    record: ProjectRecord
  ): Promise<EnhancedProjectInfo> {
    return {
      id: record.id,
      slug: record.slug,
      origin: record.origin,
      root: record.root,
      repo: this.extractRepoFromOrigin(record.origin),
      activeTask: this.getMockActiveTask(),
      recentTasks: this.getMockRecentTasks(),
      lastAccessed: record.last_seen,
    };
  }

  /**
   * 获取模拟活动任务
   */
  private getMockActiveTask(): TaskSummary | undefined {
    return {
      id: 'mock-task-id',
      title: 'Mock Active Task',
      slug: 'mock-active-task',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      goal: 'Mock task goal for testing',
      taskDir: '/mock/task/dir',
      progress: {
        totalPlans: 3,
        completedPlans: 1,
        currentPlanId: 'plan-2',
      },
    };
  }

  /**
   * 获取模拟最近任务列表
   */
  private getMockRecentTasks(): TaskSummary[] {
    return [
      {
        id: 'recent-task-1',
        title: 'Recent Task 1',
        slug: 'recent-task-1',
        status: 'completed',
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        completed_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        goal: 'Completed task goal',
        taskDir: '/mock/task/dir1',
        progress: {
          totalPlans: 2,
          completedPlans: 2,
        },
      },
      {
        id: 'recent-task-2',
        title: 'Recent Task 2',
        slug: 'recent-task-2',
        status: 'archived',
        created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        completed_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        updated_at: new Date(Date.now() - 86400000).toISOString(),
        goal: 'Archived task goal',
        taskDir: '/mock/task/dir2',
        progress: {
          totalPlans: 1,
          completedPlans: 1,
        },
      },
    ];
  }

  /**
   * 从 origin 提取仓库地址
   */
  private extractRepoFromOrigin(origin?: string): string | undefined {
    if (!origin) {
      return undefined;
    }

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
   * 检查仓库地址是否匹配
   */
  private isRepoMatch(origin: string, repo: string): boolean {
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
}
