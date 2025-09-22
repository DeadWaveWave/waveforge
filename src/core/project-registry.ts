/**
 * 项目注册表管理器
 * 负责项目身份识别、全局注册表管理和多项目数据隔离
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ulid } from 'ulid';
import { logger } from './logger.js';
import {
  LogCategory,
  LogAction,
  type ProjectInfo,
  type ProjectRecord,
  type GlobalProjectRegistry,
} from '../types/index.js';

/**
 * 项目注册表管理器
 * 实现项目身份识别和多项目隔离
 */
export class ProjectRegistry {
  private static readonly PROJECT_FILE = 'project.json';
  private static readonly GLOBAL_REGISTRY_DIR = '.wave';
  private static readonly GLOBAL_REGISTRY_FILE = 'projects.json';
  private static readonly REGISTRY_VERSION = '1.0.0';

  /**
   * 根据路径加载项目信息
   * 从指定目录的 .wave/project.json 文件中读取项目身份信息
   */
  async loadByPath(dir: string): Promise<ProjectInfo | null> {
    try {
      const projectFilePath = path.join(
        dir,
        '.wave',
        ProjectRegistry.PROJECT_FILE
      );

      if (!(await fs.pathExists(projectFilePath))) {
        return null;
      }

      const data = await fs.readFile(projectFilePath, 'utf8');
      const projectInfo = JSON.parse(data) as ProjectInfo;

      // 验证项目信息结构
      this.validateProjectInfo(projectInfo);

      logger.info(LogCategory.Task, LogAction.Handle, '项目信息加载成功', {
        dir,
        projectId: projectInfo.id,
        slug: projectInfo.slug,
      });

      return projectInfo;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        return null;
      }

      logger.error(LogCategory.Task, LogAction.Handle, '项目信息加载失败', {
        dir,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `加载项目信息失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 确保指定路径存在项目信息
   * 如果不存在则生成新的项目身份信息
   */
  async ensureAtPath(dir: string): Promise<ProjectInfo> {
    try {
      // 尝试加载现有项目信息
      const existingProject = await this.loadByPath(dir);
      if (existingProject) {
        return existingProject;
      }

      // 生成新的项目信息
      const projectInfo = await this.generateProjectInfo(dir);

      // 保存到本地文件
      await this.saveProjectInfo(dir, projectInfo);

      logger.info(LogCategory.Task, LogAction.Create, '项目信息生成成功', {
        dir,
        projectId: projectInfo.id,
        slug: projectInfo.slug,
      });

      return projectInfo;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '项目信息确保失败', {
        dir,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `确保项目信息失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 从全局注册表读取项目记录
   */
  async readGlobal(id: string): Promise<ProjectRecord | null> {
    try {
      const registry = await this.loadGlobalRegistry();
      return registry.projects[id] || null;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '全局项目记录读取失败', {
        projectId: id,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `读取全局项目记录失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 更新或插入全局项目记录
   */
  async upsertGlobal(record: ProjectRecord): Promise<void> {
    try {
      // 添加超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('全局注册表操作超时')), 5000); // 5秒超时
      });

      const updatePromise = this.performUpsert(record);

      await Promise.race([updatePromise, timeoutPromise]);

      logger.info(LogCategory.Task, LogAction.Update, '全局项目记录更新成功', {
        projectId: record.id,
        root: record.root,
        slug: record.slug,
      });
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Update, '全局项目记录更新失败', {
        projectId: record.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // 如果是超时错误，不抛出异常，只记录警告
      if (error instanceof Error && error.message.includes('超时')) {
        logger.warning(
          LogCategory.Task,
          LogAction.Update,
          '全局注册表更新超时，跳过此操作',
          {
            projectId: record.id,
          }
        );
        return; // 静默失败，不影响主要功能
      }

      throw new Error(
        `更新全局项目记录失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 执行实际的更新操作
   */
  private async performUpsert(record: ProjectRecord): Promise<void> {
    const registry = await this.loadGlobalRegistry();

    // 更新记录
    registry.projects[record.id] = {
      ...record,
      last_seen: new Date().toISOString(),
    };

    registry.updated_at = new Date().toISOString();

    // 保存全局注册表
    await this.saveGlobalRegistry(registry);
  }

  /**
   * 生成新的项目信息
   */
  private async generateProjectInfo(dir: string): Promise<ProjectInfo> {
    const id = ulid();
    const slug = this.generateProjectSlug(dir);
    const origin = await this.detectProjectOrigin(dir);

    return {
      id,
      slug,
      origin,
    };
  }

  /**
   * 保存项目信息到本地文件
   */
  private async saveProjectInfo(
    dir: string,
    projectInfo: ProjectInfo
  ): Promise<void> {
    const waveDir = path.join(dir, '.wave');
    const projectFilePath = path.join(waveDir, ProjectRegistry.PROJECT_FILE);

    // 确保 .wave 目录存在
    await fs.ensureDir(waveDir);

    // 保存项目信息
    const data = JSON.stringify(projectInfo, null, 2);
    await fs.writeFile(projectFilePath, data, 'utf8');
  }

  /**
   * 生成项目slug
   */
  private generateProjectSlug(dir: string): string {
    const baseName = path.basename(dir);

    // 清理文件名，生成合法的slug
    let slug = baseName
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '') // 保留字母、数字、中文、空格和连字符
      .replace(/\s+/g, '-') // 空格转换为连字符
      .replace(/-+/g, '-') // 多个连字符合并为一个
      .replace(/^-|-$/g, '') // 去除首尾连字符
      .toLowerCase();

    // 如果是中文项目名，不转换为小写
    if (/^[\u4e00-\u9fa5-]+$/.test(slug)) {
      slug = baseName
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    // 限制长度
    if (slug.length > 50) {
      slug = slug.substring(0, 50).replace(/-[^-]*$/, '');
    }

    return slug || 'untitled-project';
  }

  /**
   * 检测项目来源（如Git仓库）
   */
  private async detectProjectOrigin(dir: string): Promise<string | undefined> {
    try {
      // 检查是否是Git仓库
      const gitDir = path.join(dir, '.git');
      if (await fs.pathExists(gitDir)) {
        // 尝试读取Git远程仓库URL
        const gitConfigPath = path.join(gitDir, 'config');
        if (await fs.pathExists(gitConfigPath)) {
          const gitConfig = await fs.readFile(gitConfigPath, 'utf8');
          const urlMatch = gitConfig.match(/url\s*=\s*(.+)/);
          if (urlMatch) {
            return urlMatch[1].trim();
          }
        }
        return 'git-repository';
      }

      return undefined;
    } catch (error) {
      // 忽略检测错误，返回undefined
      return undefined;
    }
  }

  /**
   * 验证项目信息结构
   */
  private validateProjectInfo(projectInfo: any): void {
    if (!projectInfo || typeof projectInfo !== 'object') {
      throw new Error('项目信息必须是对象类型');
    }

    if (!projectInfo.id || typeof projectInfo.id !== 'string') {
      throw new Error('项目ID必须是非空字符串');
    }

    if (!projectInfo.slug || typeof projectInfo.slug !== 'string') {
      throw new Error('项目slug必须是非空字符串');
    }

    if (
      projectInfo.origin !== undefined &&
      typeof projectInfo.origin !== 'string'
    ) {
      throw new Error('项目来源必须是字符串类型');
    }
  }

  /**
   * 获取全局注册表文件路径
   */
  private getGlobalRegistryPath(): string {
    const homeDir = os.homedir();
    return path.join(
      homeDir,
      ProjectRegistry.GLOBAL_REGISTRY_DIR,
      ProjectRegistry.GLOBAL_REGISTRY_FILE
    );
  }

  /**
   * 加载全局项目注册表
   */
  private async loadGlobalRegistry(): Promise<GlobalProjectRegistry> {
    try {
      const registryPath = this.getGlobalRegistryPath();

      if (!(await fs.pathExists(registryPath))) {
        // 创建默认注册表
        return this.createDefaultRegistry();
      }

      const data = await fs.readFile(registryPath, 'utf8');
      const registry = JSON.parse(data) as GlobalProjectRegistry;

      // 验证注册表结构
      this.validateGlobalRegistry(registry);

      return registry;
    } catch (error) {
      logger.warning(
        LogCategory.Task,
        LogAction.Handle,
        '全局注册表加载失败，使用默认注册表',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );

      // 返回默认注册表
      return this.createDefaultRegistry();
    }
  }

  /**
   * 保存全局项目注册表
   */
  private async saveGlobalRegistry(
    registry: GlobalProjectRegistry
  ): Promise<void> {
    const registryPath = this.getGlobalRegistryPath();
    const registryDir = path.dirname(registryPath);

    // 确保目录存在
    await fs.ensureDir(registryDir);

    // 保存注册表
    const data = JSON.stringify(registry, null, 2);
    await fs.writeFile(registryPath, data, 'utf8');
  }

  /**
   * 创建默认全局注册表
   */
  private createDefaultRegistry(): GlobalProjectRegistry {
    return {
      projects: {},
      version: ProjectRegistry.REGISTRY_VERSION,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * 验证全局注册表结构
   */
  private validateGlobalRegistry(registry: any): void {
    if (!registry || typeof registry !== 'object') {
      throw new Error('注册表必须是对象类型');
    }

    if (!registry.projects || typeof registry.projects !== 'object') {
      throw new Error('注册表projects字段必须是对象类型');
    }

    if (!registry.version || typeof registry.version !== 'string') {
      throw new Error('注册表version字段必须是字符串类型');
    }

    if (!registry.updated_at || typeof registry.updated_at !== 'string') {
      throw new Error('注册表updated_at字段必须是字符串类型');
    }

    // 验证每个项目记录
    for (const [projectId, record] of Object.entries(registry.projects)) {
      this.validateProjectRecord(projectId, record);
    }
  }

  /**
   * 验证项目记录结构
   */
  private validateProjectRecord(projectId: string, record: any): void {
    if (!record || typeof record !== 'object') {
      throw new Error(`项目记录 ${projectId} 必须是对象类型`);
    }

    if (record.id !== projectId) {
      throw new Error(`项目记录 ${projectId} 的ID字段不匹配`);
    }

    if (!record.root || typeof record.root !== 'string') {
      throw new Error(`项目记录 ${projectId} 的root字段必须是非空字符串`);
    }

    if (!record.slug || typeof record.slug !== 'string') {
      throw new Error(`项目记录 ${projectId} 的slug字段必须是非空字符串`);
    }

    if (record.origin !== undefined && typeof record.origin !== 'string') {
      throw new Error(`项目记录 ${projectId} 的origin字段必须是字符串类型`);
    }

    if (
      record.last_seen !== undefined &&
      typeof record.last_seen !== 'string'
    ) {
      throw new Error(`项目记录 ${projectId} 的last_seen字段必须是字符串类型`);
    }
  }

  /**
   * 初始化项目（确保项目信息存在并注册到全局注册表）
   */
  async initializeProject(dir: string): Promise<ProjectRecord> {
    try {
      // 确保本地项目信息存在
      const projectInfo = await this.ensureAtPath(dir);

      // 创建项目记录
      const projectRecord: ProjectRecord = {
        id: projectInfo.id,
        root: path.resolve(dir),
        slug: projectInfo.slug,
        origin: projectInfo.origin,
        last_seen: new Date().toISOString(),
      };

      // 注册到全局注册表
      await this.upsertGlobal(projectRecord);

      logger.info(LogCategory.Task, LogAction.Create, '项目初始化完成', {
        projectId: projectRecord.id,
        root: projectRecord.root,
        slug: projectRecord.slug,
      });

      return projectRecord;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '项目初始化失败', {
        dir,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `项目初始化失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 根据项目ID解析项目记录
   */
  async resolveProject(projectId: string): Promise<ProjectRecord | null> {
    try {
      const record = await this.readGlobal(projectId);

      if (!record) {
        return null;
      }

      // 验证项目根目录是否仍然存在
      if (!(await fs.pathExists(record.root))) {
        logger.warning(LogCategory.Task, LogAction.Handle, '项目根目录不存在', {
          projectId,
          root: record.root,
        });
        return null;
      }

      // 验证项目信息文件是否存在
      const projectInfo = await this.loadByPath(record.root);
      if (!projectInfo || projectInfo.id !== projectId) {
        logger.warning(LogCategory.Task, LogAction.Handle, '项目信息不匹配', {
          projectId,
          root: record.root,
          localProjectId: projectInfo?.id,
        });
        return null;
      }

      // 更新最后访问时间
      await this.upsertGlobal({
        ...record,
        last_seen: new Date().toISOString(),
      });

      return record;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '项目解析失败', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  }

  /**
   * 清理无效的项目记录
   */
  async cleanupInvalidProjects(): Promise<{
    removed: string[];
    errors: string[];
  }> {
    const result = { removed: [] as string[], errors: [] as string[] };

    try {
      const registry = await this.loadGlobalRegistry();
      const validProjects: Record<string, ProjectRecord> = {};

      for (const [projectId, record] of Object.entries(registry.projects)) {
        try {
          // 检查项目根目录是否存在
          if (!(await fs.pathExists(record.root))) {
            result.removed.push(projectId);
            continue;
          }

          // 检查项目信息文件是否存在且匹配
          const projectInfo = await this.loadByPath(record.root);
          if (!projectInfo || projectInfo.id !== projectId) {
            result.removed.push(projectId);
            continue;
          }

          // 项目有效，保留
          validProjects[projectId] = record;
        } catch (error) {
          result.errors.push(
            `项目 ${projectId}: ${error instanceof Error ? error.message : String(error)}`
          );
          // 出错的项目也移除
          result.removed.push(projectId);
        }
      }

      // 更新注册表
      if (result.removed.length > 0) {
        registry.projects = validProjects;
        registry.updated_at = new Date().toISOString();
        await this.saveGlobalRegistry(registry);

        logger.info(LogCategory.Task, LogAction.Update, '无效项目清理完成', {
          removedCount: result.removed.length,
          errorCount: result.errors.length,
          remainingCount: Object.keys(validProjects).length,
        });
      }

      return result;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '项目清理失败', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `项目清理失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 验证项目路径的有效性
   */
  async validateProjectPath(
    projectPath: string
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const resolvedPath = path.resolve(projectPath);

      // 检查路径是否存在
      if (!(await fs.pathExists(resolvedPath))) {
        return { valid: false, reason: '路径不存在' };
      }

      // 检查是否是目录
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return { valid: false, reason: '路径不是目录' };
      }

      // 检查是否有读写权限
      try {
        await fs.access(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch {
        return { valid: false, reason: '没有读写权限' };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 查找项目（按slug或路径）
   */
  async findProjects(query: {
    slug?: string;
    path?: string;
  }): Promise<ProjectRecord[]> {
    try {
      const registry = await this.loadGlobalRegistry();
      const results: ProjectRecord[] = [];

      for (const record of Object.values(registry.projects)) {
        let matches = false;

        if (query.slug && record.slug.includes(query.slug)) {
          matches = true;
        }

        if (query.path) {
          const queryPath = path.resolve(query.path);
          if (record.root === queryPath || record.root.includes(queryPath)) {
            matches = true;
          }
        }

        if (matches) {
          results.push(record);
        }
      }

      // 按最后访问时间排序
      results.sort((a, b) => {
        const aTime = new Date(a.last_seen || a.id).getTime();
        const bTime = new Date(b.last_seen || b.id).getTime();
        return bTime - aTime;
      });

      return results;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '项目查找失败', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  /**
   * 获取注册表统计信息
   */
  async getRegistryStats(): Promise<{
    totalProjects: number;
    validProjects: number;
    invalidProjects: number;
    registryPath: string;
    registryVersion: string;
    lastUpdated: string;
  }> {
    try {
      const registry = await this.loadGlobalRegistry();
      const totalProjects = Object.keys(registry.projects).length;

      // 快速验证项目有效性（不修改注册表）
      let validProjects = 0;
      let invalidProjects = 0;

      for (const record of Object.values(registry.projects)) {
        try {
          if (await fs.pathExists(record.root)) {
            const projectInfo = await this.loadByPath(record.root);
            if (projectInfo && projectInfo.id === record.id) {
              validProjects++;
            } else {
              invalidProjects++;
            }
          } else {
            invalidProjects++;
          }
        } catch {
          invalidProjects++;
        }
      }

      return {
        totalProjects,
        validProjects,
        invalidProjects,
        registryPath: this.getGlobalRegistryPath(),
        registryVersion: registry.version,
        lastUpdated: registry.updated_at,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '获取注册表统计失败', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        totalProjects: 0,
        validProjects: 0,
        invalidProjects: 0,
        registryPath: this.getGlobalRegistryPath(),
        registryVersion: ProjectRegistry.REGISTRY_VERSION,
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}
