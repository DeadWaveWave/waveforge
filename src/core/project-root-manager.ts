/**
 * 项目根目录管理器
 * 负责检测和管理项目根目录，支持 MCP 客户端 roots 能力和 CWD 降级
 */

import { ProjectRootInfo } from '../types/index.js';
import { logger } from './logger.js';
import { LogCategory, LogAction } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 项目根目录管理器
 */
export class ProjectRootManager {
  private projectRoot: ProjectRootInfo | null = null;
  private clientRoots: string[] = [];

  /**
   * 设置客户端提供的根目录列表
   */
  setClientRoots(roots: string[]): void {
    this.clientRoots = roots;
    logger.info(LogCategory.Task, LogAction.Update, '客户端根目录已更新', {
      roots,
      count: roots.length,
    });
  }

  /**
   * 获取客户端根目录列表
   */
  getClientRoots(): string[] {
    return [...this.clientRoots];
  }

  /**
   * 初始化项目根目录
   */
  async initializeProjectRoot(): Promise<ProjectRootInfo> {
    try {
      // 优先使用客户端提供的根目录
      if (this.clientRoots.length > 0) {
        const clientRoot = await this.validateClientRoot(this.clientRoots[0]);
        if (clientRoot) {
          this.projectRoot = clientRoot;
          logger.info(LogCategory.Task, LogAction.Create, '使用客户端根目录', {
            root: clientRoot.root,
            source: clientRoot.source,
          });
          return this.projectRoot;
        }
      }

      // 降级到当前工作目录
      const cwdRoot = await this.fallbackToCwd();
      this.projectRoot = cwdRoot;

      logger.warning(LogCategory.Task, LogAction.Create, '降级到当前工作目录', {
        root: cwdRoot.root,
        source: cwdRoot.source,
      });

      return this.projectRoot;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '项目根目录初始化失败', {
        error: error instanceof Error ? error.message : String(error),
      });

      // 返回不可用的根目录信息
      this.projectRoot = {
        root: '',
        source: 'cwd_fallback',
        available: false,
      };

      return this.projectRoot;
    }
  }

  /**
   * 验证客户端提供的根目录
   */
  private async validateClientRoot(
    rootPath: string
  ): Promise<ProjectRootInfo | null> {
    try {
      // 解析绝对路径
      const absolutePath = path.resolve(rootPath);

      // 检查目录是否存在
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        logger.warning(
          LogCategory.Task,
          LogAction.Handle,
          '客户端根目录不是有效目录',
          { path: absolutePath }
        );
        return null;
      }

      // 检查目录是否可访问
      await fs.access(absolutePath, fs.constants.R_OK);

      return {
        root: absolutePath,
        source: 'client_roots',
        available: true,
      };
    } catch (error) {
      logger.warning(
        LogCategory.Task,
        LogAction.Handle,
        '客户端根目录验证失败',
        {
          path: rootPath,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return null;
    }
  }

  /**
   * 降级到当前工作目录
   */
  private async fallbackToCwd(): Promise<ProjectRootInfo> {
    try {
      const cwd = process.cwd();

      // 验证当前工作目录是否可访问
      await fs.access(cwd, fs.constants.R_OK);

      return {
        root: cwd,
        source: 'cwd_fallback',
        available: true,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, 'CWD 降级失败', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `无法访问当前工作目录: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取当前项目根目录信息
   */
  getProjectRoot(): ProjectRootInfo | null {
    return this.projectRoot;
  }

  /**
   * 检查项目根目录是否可用
   */
  isProjectRootAvailable(): boolean {
    return this.projectRoot?.available === true;
  }

  /**
   * 获取项目根目录路径
   */
  getProjectRootPath(): string | null {
    return this.projectRoot?.root || null;
  }

  /**
   * 解析相对于项目根目录的路径
   */
  resolvePath(relativePath: string): string | null {
    if (!this.isProjectRootAvailable()) {
      return null;
    }

    return path.resolve(this.projectRoot!.root, relativePath);
  }

  /**
   * 检查路径是否在项目根目录内
   */
  isPathInProject(targetPath: string): boolean {
    if (!this.isProjectRootAvailable()) {
      return false;
    }

    const absolutePath = path.resolve(targetPath);
    const rootPath = this.projectRoot!.root;

    return absolutePath.startsWith(rootPath);
  }

  /**
   * 获取相对于项目根目录的路径
   */
  getRelativePath(absolutePath: string): string | null {
    if (!this.isProjectRootAvailable()) {
      return null;
    }

    const rootPath = this.projectRoot!.root;
    if (!absolutePath.startsWith(rootPath)) {
      return null;
    }

    return path.relative(rootPath, absolutePath);
  }

  /**
   * 刷新项目根目录状态
   */
  async refreshProjectRoot(): Promise<ProjectRootInfo> {
    logger.info(LogCategory.Task, LogAction.Update, '刷新项目根目录状态');

    return await this.initializeProjectRoot();
  }

  /**
   * 获取项目根目录的统计信息
   */
  getProjectRootStats(): {
    available: boolean;
    source: string;
    path: string | null;
    clientRootsCount: number;
  } {
    return {
      available: this.isProjectRootAvailable(),
      source: this.projectRoot?.source || 'unknown',
      path: this.getProjectRootPath(),
      clientRootsCount: this.clientRoots.length,
    };
  }
}
