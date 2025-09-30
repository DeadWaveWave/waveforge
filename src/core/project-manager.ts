/**
 * 项目管理器
 * 负责连接级项目绑定和多项目数据隔离
 */

import { ProjectRegistry } from './project-registry.js';
import { EnhancedProjectRegistry } from './enhanced-project-registry.js';
import { logger } from './logger.js';
import {
  LogCategory,
  LogAction,
  type ActiveProjectBinding,
  type ProjectRecord,
  type ProjectBindParams,
  type ProjectBindResponse,
  type ProjectInfoResponse,
  type ConnectParams,
  type ConnectionResult,
} from '../types/index.js';

/**
 * 项目管理器
 * 管理连接级的活跃项目绑定
 */
export class ProjectManager {
  private projectRegistry: ProjectRegistry;
  private enhancedRegistry: EnhancedProjectRegistry;
  private activeBinding: ActiveProjectBinding | null = null;

  constructor() {
    this.projectRegistry = new ProjectRegistry();
    this.enhancedRegistry = new EnhancedProjectRegistry();
  }

  /**
   * 绑定项目到当前连接
   * @deprecated 使用 connectProject() 代替，该方法仅为向后兼容保留
   */
  async bindProject(params: ProjectBindParams): Promise<ProjectBindResponse> {
    try {
      // 添加超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('项目绑定操作超时')), 10000); // 10秒超时
      });

      const bindPromise = this.performBind(params);

      const projectRecord = await Promise.race([bindPromise, timeoutPromise]);

      // 创建活跃绑定
      this.activeBinding = {
        project_id: projectRecord.id,
        root: projectRecord.root,
        slug: projectRecord.slug,
        origin: projectRecord.origin,
        bound_at: new Date().toISOString(),
      };

      logger.info(LogCategory.Task, LogAction.Create, '项目绑定成功', {
        projectId: projectRecord.id,
        root: projectRecord.root,
        slug: projectRecord.slug,
        bindMethod: params.project_id ? 'by_id' : 'by_path',
      });

      return {
        project: {
          id: projectRecord.id,
          root: projectRecord.root,
          slug: projectRecord.slug,
          origin: projectRecord.origin,
        },
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '项目绑定失败', {
        params,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `项目绑定失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 执行实际的绑定操作
   */
  private async performBind(params: ProjectBindParams): Promise<ProjectRecord> {
    if (params.project_id) {
      // 通过项目ID绑定
      return await this.bindByProjectId(params.project_id);
    } else if (params.project_path) {
      // 通过项目路径绑定
      return await this.bindByProjectPath(params.project_path);
    } else {
      throw new Error('必须提供 project_id 或 project_path 参数');
    }
  }

  /**
   * 获取当前活跃项目信息
   */
  async getProjectInfo(): Promise<ProjectInfoResponse> {
    if (!this.activeBinding) {
      throw new Error(
        'NO_ACTIVE_PROJECT: 当前连接没有绑定活跃项目，请先调用 project_bind'
      );
    }

    try {
      // 验证项目是否仍然有效
      const projectRecord = await this.projectRegistry.resolveProject(
        this.activeBinding.project_id
      );

      if (!projectRecord) {
        // 项目已失效，清除绑定
        this.activeBinding = null;
        throw new Error(
          'NO_ACTIVE_PROJECT: 绑定的项目已失效，请重新调用 project_bind'
        );
      }

      // 更新绑定信息（如果项目信息有变化）
      if (
        projectRecord.root !== this.activeBinding.root ||
        projectRecord.slug !== this.activeBinding.slug
      ) {
        this.activeBinding = {
          ...this.activeBinding,
          root: projectRecord.root,
          slug: projectRecord.slug,
          origin: projectRecord.origin,
        };
      }

      logger.info(LogCategory.Task, LogAction.Handle, '获取项目信息成功', {
        projectId: projectRecord.id,
        root: projectRecord.root,
        slug: projectRecord.slug,
      });

      return {
        project: {
          id: projectRecord.id,
          root: projectRecord.root,
          slug: projectRecord.slug,
          origin: projectRecord.origin,
        },
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '获取项目信息失败', {
        activeBinding: this.activeBinding,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 获取当前活跃项目的根目录路径
   */
  getActiveProjectRoot(): string | null {
    return this.activeBinding?.root || null;
  }

  /**
   * 获取当前活跃项目信息
   */
  getActiveProject(): ActiveProjectBinding | null {
    return this.activeBinding;
  }

  /**
   * 检查是否有活跃项目绑定
   */
  hasActiveProject(): boolean {
    return this.activeBinding !== null;
  }

  /**
   * 清除当前项目绑定
   */
  clearBinding(): void {
    if (this.activeBinding) {
      logger.info(LogCategory.Task, LogAction.Update, '清除项目绑定', {
        projectId: this.activeBinding.project_id,
        root: this.activeBinding.root,
      });

      this.activeBinding = null;
    }
  }

  /**
   * 获取项目注册表实例（用于其他组件访问）
   */
  getProjectRegistry(): ProjectRegistry {
    return this.projectRegistry;
  }

  /**
   * 获取增强项目注册表实例（用于连接管理）
   */
  getEnhancedRegistry(): EnhancedProjectRegistry {
    return this.enhancedRegistry;
  }

  /**
   * 使用新的连接方式连接项目（推荐）
   * 使用 EnhancedProjectRegistry 而不是旧的 bindProject
   */
  async connectProject(params: ConnectParams): Promise<ConnectionResult> {
    const result = await this.enhancedRegistry.connectProject(params);

    // 如果连接成功，同步更新活跃绑定
    if (result.connected && result.project) {
      this.activeBinding = {
        project_id: result.project.id,
        root: result.project.root,
        slug: result.project.slug,
        origin: result.project.origin,
        bound_at: new Date().toISOString(),
      };
    }

    return result;
  }

  // 私有方法

  /**
   * 通过项目ID绑定项目
   */
  private async bindByProjectId(projectId: string): Promise<ProjectRecord> {
    const projectRecord = await this.projectRegistry.resolveProject(projectId);

    if (!projectRecord) {
      throw new Error(`项目ID ${projectId} 不存在或已失效`);
    }

    return projectRecord;
  }

  /**
   * 通过项目路径绑定项目
   */
  private async bindByProjectPath(projectPath: string): Promise<ProjectRecord> {
    // 验证路径有效性
    const validation =
      await this.projectRegistry.validateProjectPath(projectPath);
    if (!validation.valid) {
      throw new Error(`项目路径无效: ${validation.reason}`);
    }

    // 初始化项目（如果不存在则创建）
    const projectRecord =
      await this.projectRegistry.initializeProject(projectPath);

    return projectRecord;
  }
}
