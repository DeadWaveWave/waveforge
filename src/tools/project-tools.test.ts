/**
 * 项目管理工具集成测试
 * 测试 ProjectBindTool 和 ProjectInfoTool 的完整功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ProjectBindTool, ProjectInfoTool } from './project-tools.js';
import { ProjectManager } from '../core/project-manager.js';
import { ProjectRegistry } from '../core/project-registry.js';
import type { ProjectBindParams } from '../types/index.js';

describe('项目管理工具集成测试', () => {
  let testDir: string;
  let projectManager: ProjectManager;
  let projectBindTool: ProjectBindTool;
  let projectInfoTool: ProjectInfoTool;
  let globalRegistryPath: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'waveforge-project-test-')
    );

    globalRegistryPath = path.join(testDir, 'global-registry.json');

    // 模拟全局注册表路径
    const registry = new ProjectRegistry();
    (registry as any).getGlobalRegistryPath = () => globalRegistryPath;

    // 创建项目管理器和工具实例
    projectManager = new ProjectManager();
    (projectManager as any).projectRegistry = registry;

    projectBindTool = new ProjectBindTool(projectManager);
    projectInfoTool = new ProjectInfoTool(projectManager);
  });

  afterEach(async () => {
    // 清理测试目录
    await fs.remove(testDir);

    // 清理可能创建的全局注册表文件
    if (await fs.pathExists(globalRegistryPath)) {
      await fs.remove(globalRegistryPath);
    }
  });

  describe('ProjectBindTool 集成测试', () => {
    it('应该通过项目路径成功绑定新项目', async () => {
      // 创建测试项目目录
      const projectPath = path.join(testDir, 'test-project');
      await fs.ensureDir(projectPath);

      // 调用 project_bind 工具
      const params: ProjectBindParams = { project_path: projectPath };
      const result = await projectBindTool.handle(params);

      // 验证响应格式
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.message).toBe('项目绑定成功');
      expect(response.data.project).toMatchObject({
        id: expect.any(String),
        root: path.resolve(projectPath),
        slug: 'test-project',
      });

      // 验证项目信息文件已创建
      const projectInfoPath = path.join(projectPath, '.wave', 'project.json');
      expect(await fs.pathExists(projectInfoPath)).toBe(true);

      const projectInfo = await fs.readJson(projectInfoPath);
      expect(projectInfo).toMatchObject({
        id: expect.any(String),
        slug: 'test-project',
      });

      // 验证全局注册表已更新
      expect(await fs.pathExists(globalRegistryPath)).toBe(true);
      const globalRegistry = await fs.readJson(globalRegistryPath);
      expect(globalRegistry.projects[projectInfo.id]).toMatchObject({
        id: projectInfo.id,
        root: path.resolve(projectPath),
        slug: 'test-project',
      });
    });

    it('应该通过项目ID成功绑定已存在的项目', async () => {
      // 先创建一个项目
      const projectPath = path.join(testDir, 'existing-project');
      await fs.ensureDir(projectPath);

      const createParams: ProjectBindParams = { project_path: projectPath };
      const createResult = await projectBindTool.handle(createParams);
      const createResponse = JSON.parse(createResult.content[0].text);
      const projectId = createResponse.data.project.id;

      // 清除当前绑定
      projectManager.clearBinding();

      // 通过项目ID重新绑定
      const bindParams: ProjectBindParams = { project_id: projectId };
      const bindResult = await projectBindTool.handle(bindParams);

      const bindResponse = JSON.parse(bindResult.content[0].text);
      expect(bindResponse.success).toBe(true);
      expect(bindResponse.data.project.id).toBe(projectId);
      expect(bindResponse.data.project.root).toBe(path.resolve(projectPath));
    });

    it('应该拒绝无效的项目路径', async () => {
      const invalidPath = path.join(testDir, 'non-existent-project');

      const params: ProjectBindParams = { project_path: invalidPath };
      const result = await projectBindTool.handle(params);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('路径不存在');
    });

    it('应该拒绝同时提供 project_id 和 project_path', async () => {
      const projectPath = path.join(testDir, 'test-project');
      await fs.ensureDir(projectPath);

      const params = {
        project_id: 'some-id',
        project_path: projectPath,
      } as ProjectBindParams;

      const result = await projectBindTool.handle(params);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('不能同时提供');
    });

    it('应该拒绝空参数', async () => {
      const params = {} as ProjectBindParams;
      const result = await projectBindTool.handle(params);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('必须提供');
    });
  });

  describe('ProjectInfoTool 集成测试', () => {
    it('应该返回当前活跃项目信息', async () => {
      // 先绑定一个项目
      const projectPath = path.join(testDir, 'active-project');
      await fs.ensureDir(projectPath);

      const bindParams: ProjectBindParams = { project_path: projectPath };
      await projectBindTool.handle(bindParams);

      // 获取项目信息
      const result = await projectInfoTool.handle();

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.message).toBe('获取项目信息成功');
      expect(response.data.project).toMatchObject({
        id: expect.any(String),
        root: path.resolve(projectPath),
        slug: 'active-project',
      });
    });

    it('应该在没有活跃项目时返回错误', async () => {
      const result = await projectInfoTool.handle();

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('NO_ACTIVE_PROJECT');
    });

    it('应该在项目失效时清除绑定并返回错误', async () => {
      // 先绑定一个项目
      const projectPath = path.join(testDir, 'temp-project');
      await fs.ensureDir(projectPath);

      const bindParams: ProjectBindParams = { project_path: projectPath };
      await projectBindTool.handle(bindParams);

      // 删除项目目录模拟项目失效
      await fs.remove(projectPath);

      // 尝试获取项目信息
      const result = await projectInfoTool.handle();

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('NO_ACTIVE_PROJECT');
      expect(response.error).toContain('已失效');

      // 验证绑定已被清除
      expect(projectManager.hasActiveProject()).toBe(false);
    });
  });

  describe('项目状态持久化测试', () => {
    it('应该确保项目ID的一致性', async () => {
      const projectPath = path.join(testDir, 'consistent-project');
      await fs.ensureDir(projectPath);

      // 第一次绑定
      const firstBindParams: ProjectBindParams = { project_path: projectPath };
      const firstResult = await projectBindTool.handle(firstBindParams);
      const firstResponse = JSON.parse(firstResult.content[0].text);
      const firstProjectId = firstResponse.data.project.id;

      // 清除绑定
      projectManager.clearBinding();

      // 第二次绑定同一个项目
      const secondBindParams: ProjectBindParams = { project_path: projectPath };
      const secondResult = await projectBindTool.handle(secondBindParams);
      const secondResponse = JSON.parse(secondResult.content[0].text);
      const secondProjectId = secondResponse.data.project.id;

      // 项目ID应该保持一致
      expect(secondProjectId).toBe(firstProjectId);
    });

    it('应该正确更新全局注册表的最后访问时间', async () => {
      const projectPath = path.join(testDir, 'timestamp-project');
      await fs.ensureDir(projectPath);

      // 绑定项目
      const bindParams: ProjectBindParams = { project_path: projectPath };
      const bindResult = await projectBindTool.handle(bindParams);
      const bindResponse = JSON.parse(bindResult.content[0].text);
      const projectId = bindResponse.data.project.id;

      // 获取初始时间戳
      const initialRegistry = await fs.readJson(globalRegistryPath);
      const initialTimestamp = initialRegistry.projects[projectId].last_seen;

      // 等待一小段时间
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 再次获取项目信息（应该更新时间戳）
      await projectInfoTool.handle();

      // 验证时间戳已更新
      const updatedRegistry = await fs.readJson(globalRegistryPath);
      const updatedTimestamp = updatedRegistry.projects[projectId].last_seen;

      expect(new Date(updatedTimestamp).getTime()).toBeGreaterThan(
        new Date(initialTimestamp).getTime()
      );
    });
  });

  describe('自动修复机制测试', () => {
    it('应该检测并修复损坏的项目结构', async () => {
      const projectPath = path.join(testDir, 'broken-project');
      await fs.ensureDir(projectPath);

      // 先正常绑定项目
      const bindParams: ProjectBindParams = { project_path: projectPath };
      const firstResult = await projectBindTool.handle(bindParams);
      const firstResponse = JSON.parse(firstResult.content[0].text);
      expect(firstResponse.success).toBe(true);

      // 获取原始项目ID
      const originalProjectId = firstResponse.data.project.id;

      // 模拟项目信息文件损坏
      const projectInfoPath = path.join(projectPath, '.wave', 'project.json');
      await fs.writeFile(projectInfoPath, 'invalid json content');

      // 清除当前绑定，模拟重新连接
      projectManager.clearBinding();

      // 尝试重新绑定（应该自动修复）
      const repairResult = await projectBindTool.handle(bindParams);
      const repairResponse = JSON.parse(repairResult.content[0].text);

      // 如果失败，打印错误信息以便调试
      if (!repairResponse.success) {
        console.log('Repair failed:', repairResponse);
      }

      expect(repairResponse.success).toBe(true);

      // 验证项目信息文件已修复
      const repairedInfo = await fs.readJson(projectInfoPath);
      expect(repairedInfo).toMatchObject({
        id: expect.any(String),
        slug: 'broken-project',
      });

      // 注意：由于文件损坏，会生成新的项目ID，这是正确的行为
      expect(repairedInfo.id).not.toBe(originalProjectId);
    });

    it('应该清理无效的全局注册表项目', async () => {
      // 创建一个有效项目
      const validProjectPath = path.join(testDir, 'valid-project');
      await fs.ensureDir(validProjectPath);

      const bindParams: ProjectBindParams = { project_path: validProjectPath };
      const bindResult = await projectBindTool.handle(bindParams);
      const bindResponse = JSON.parse(bindResult.content[0].text);
      const validProjectId = bindResponse.data.project.id;

      // 手动添加一个无效项目到全局注册表
      const registry = await fs.readJson(globalRegistryPath);
      const invalidProjectId = 'invalid-project-id';
      registry.projects[invalidProjectId] = {
        id: invalidProjectId,
        root: path.join(testDir, 'non-existent-project'),
        slug: 'invalid-project',
        last_seen: new Date().toISOString(),
      };
      await fs.writeJson(globalRegistryPath, registry);

      // 调用清理方法
      const projectRegistry = projectManager.getProjectRegistry();
      const cleanupResult = await projectRegistry.cleanupInvalidProjects();

      // 验证清理结果
      expect(cleanupResult.removed).toContain(invalidProjectId);
      expect(cleanupResult.removed).not.toContain(validProjectId);

      // 验证注册表已更新
      const cleanedRegistry = await fs.readJson(globalRegistryPath);
      expect(cleanedRegistry.projects[invalidProjectId]).toBeUndefined();
      expect(cleanedRegistry.projects[validProjectId]).toBeDefined();
    });
  });

  describe('错误处理和边界情况测试', () => {
    it('应该处理全局注册表操作超时', async () => {
      const projectPath = path.join(testDir, 'timeout-project');
      await fs.ensureDir(projectPath);

      // 模拟全局注册表操作超时
      const registry = projectManager.getProjectRegistry();
      const originalUpsert = registry.upsertGlobal.bind(registry);

      registry.upsertGlobal = async (record: any) => {
        await new Promise((resolve) => setTimeout(resolve, 6000)); // 超过5秒超时
        return originalUpsert(record);
      };

      // 绑定项目（应该静默处理超时）
      const bindParams: ProjectBindParams = { project_path: projectPath };
      const result = await projectBindTool.handle(bindParams);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true); // 应该成功，即使全局注册表更新超时
    }, 10000); // 增加测试超时时间到10秒

    it('应该处理权限不足的情况', async () => {
      // 在某些系统上可能无法测试权限，跳过或模拟
      if (process.platform === 'win32') {
        return; // Windows 权限模型不同，跳过此测试
      }

      const restrictedPath = path.join(testDir, 'restricted-project');
      await fs.ensureDir(restrictedPath);

      // 移除写权限
      await fs.chmod(restrictedPath, 0o444);

      try {
        const bindParams: ProjectBindParams = { project_path: restrictedPath };
        const result = await projectBindTool.handle(bindParams);

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(false);
        expect(response.error).toContain('权限');
      } finally {
        // 恢复权限以便清理
        await fs.chmod(restrictedPath, 0o755);
      }
    });

    it('应该处理中文项目名称', async () => {
      const chineseProjectPath = path.join(testDir, '中文项目名称');
      await fs.ensureDir(chineseProjectPath);

      const bindParams: ProjectBindParams = {
        project_path: chineseProjectPath,
      };
      const result = await projectBindTool.handle(bindParams);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.project.slug).toBe('中文项目名称');
    });

    it('应该处理特殊字符的项目名称', async () => {
      const specialProjectPath = path.join(testDir, 'project-with-@#$-chars');
      await fs.ensureDir(specialProjectPath);

      const bindParams: ProjectBindParams = {
        project_path: specialProjectPath,
      };
      const result = await projectBindTool.handle(bindParams);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.project.slug).toBe('project-with-chars'); // 特殊字符应被清理
    });
  });

  describe('工具定义测试', () => {
    it('ProjectBindTool 应该返回正确的工具定义', () => {
      const definition = ProjectBindTool.getDefinition();

      expect(definition.name).toBe('project_bind');
      expect(definition.description).toContain('绑定项目到当前连接');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('project_id');
      expect(definition.inputSchema.properties).toHaveProperty('project_path');
      expect(definition.inputSchema.oneOf).toHaveLength(2);
    });

    it('ProjectInfoTool 应该返回正确的工具定义', () => {
      const definition = ProjectInfoTool.getDefinition();

      expect(definition.name).toBe('project_info');
      expect(definition.description).toContain('获取当前连接的活跃项目信息');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toEqual({});
    });
  });
});
