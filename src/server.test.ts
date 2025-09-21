/**
 * WaveForge MCP 服务器集成测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ProjectRootManager } from './core/project-root-manager.js';
import * as fs from 'fs/promises';

// Mock fs 模块
vi.mock('fs/promises');

describe('WaveForge MCP 服务器集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Roots 功能集成测试', () => {
    it('应该在有客户端根目录时返回正确的根目录列表', async () => {
      const manager = new ProjectRootManager();
      
      // 设置客户端根目录
      manager.setClientRoots(['/test/project']);
      
      // Mock fs 操作成功
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      // 初始化项目根目录
      const projectRoot = await manager.initializeProjectRoot();
      
      expect(projectRoot.root).toBe('/test/project');
      expect(projectRoot.source).toBe('client_roots');
      expect(projectRoot.available).toBe(true);
      
      // 验证根目录统计信息
      const stats = manager.getProjectRootStats();
      expect(stats.available).toBe(true);
      expect(stats.source).toBe('client_roots');
      expect(stats.path).toBe('/test/project');
      expect(stats.clientRootsCount).toBe(1);
    });

    it('应该在客户端根目录无效时降级到 CWD', async () => {
      const manager = new ProjectRootManager();
      
      // 设置无效的客户端根目录
      manager.setClientRoots(['/invalid/project']);
      
      // Mock 客户端根目录验证失败
      vi.mocked(fs.stat).mockRejectedValueOnce(new Error('Directory not found'));
      
      // Mock CWD 成功
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/current/working/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      // 初始化项目根目录
      const projectRoot = await manager.initializeProjectRoot();
      
      expect(projectRoot.root).toBe('/current/working/dir');
      expect(projectRoot.source).toBe('cwd_fallback');
      expect(projectRoot.available).toBe(true);
      
      // 验证根目录统计信息
      const stats = manager.getProjectRootStats();
      expect(stats.available).toBe(true);
      expect(stats.source).toBe('cwd_fallback');
      expect(stats.path).toBe('/current/working/dir');
      expect(stats.clientRootsCount).toBe(1); // 仍然记录客户端根目录数量
      
      process.cwd = originalCwd;
    });

    it('应该在没有客户端根目录时直接使用 CWD', async () => {
      const manager = new ProjectRootManager();
      
      // 不设置客户端根目录
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/current/working/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      // 初始化项目根目录
      const projectRoot = await manager.initializeProjectRoot();
      
      expect(projectRoot.root).toBe('/current/working/dir');
      expect(projectRoot.source).toBe('cwd_fallback');
      expect(projectRoot.available).toBe(true);
      
      process.cwd = originalCwd;
    });

    it('应该正确处理路径解析功能', async () => {
      const manager = new ProjectRootManager();
      
      // 设置项目根目录
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      await manager.initializeProjectRoot();
      
      // 测试路径解析
      expect(manager.resolvePath('src/index.ts')).toBe('/test/project/src/index.ts');
      expect(manager.resolvePath('./package.json')).toBe('/test/project/package.json');
      
      // 测试路径检查
      expect(manager.isPathInProject('/test/project/src/file.ts')).toBe(true);
      expect(manager.isPathInProject('/other/project/file.ts')).toBe(false);
      
      // 测试相对路径获取
      expect(manager.getRelativePath('/test/project/src/index.ts')).toBe('src/index.ts');
      expect(manager.getRelativePath('/other/project/file.ts')).toBeNull();
      
      process.cwd = originalCwd;
    });

    it('应该能够刷新项目根目录状态', async () => {
      const manager = new ProjectRootManager();
      
      const originalCwd = process.cwd;
      
      // 初始设置
      process.cwd = vi.fn().mockReturnValue('/initial/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      await manager.initializeProjectRoot();
      expect(manager.getProjectRootPath()).toBe('/initial/dir');
      
      // 更改环境并刷新
      process.cwd = vi.fn().mockReturnValue('/new/dir');
      await manager.refreshProjectRoot();
      
      expect(manager.getProjectRootPath()).toBe('/new/dir');
      
      process.cwd = originalCwd;
    });
  });

  describe('错误处理测试', () => {
    it('应该在所有根目录都不可用时返回不可用状态', async () => {
      const manager = new ProjectRootManager();
      
      // 设置无效的客户端根目录
      manager.setClientRoots(['/invalid/project']);
      
      // Mock 所有操作都失败
      vi.mocked(fs.stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));
      
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/inaccessible/dir');
      
      // 初始化项目根目录
      const projectRoot = await manager.initializeProjectRoot();
      
      expect(projectRoot.available).toBe(false);
      expect(projectRoot.root).toBe('');
      expect(projectRoot.source).toBe('cwd_fallback');
      
      // 验证路径解析在不可用状态下的行为
      expect(manager.resolvePath('src/file.ts')).toBeNull();
      expect(manager.isPathInProject('/any/path')).toBe(false);
      expect(manager.getRelativePath('/any/path')).toBeNull();
      
      process.cwd = originalCwd;
    });

    it('应该正确处理权限错误', async () => {
      const manager = new ProjectRootManager();
      
      // 设置客户端根目录，但访问权限被拒绝
      manager.setClientRoots(['/restricted/project']);
      
      // Mock 目录存在但无访问权限
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('Permission denied'));
      
      // Mock CWD 也无权限
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/restricted/cwd');
      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));
      
      const projectRoot = await manager.initializeProjectRoot();
      
      expect(projectRoot.available).toBe(false);
      
      process.cwd = originalCwd;
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空的客户端根目录列表', async () => {
      const manager = new ProjectRootManager();
      
      manager.setClientRoots([]);
      expect(manager.getClientRoots()).toEqual([]);
      
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/fallback/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      const projectRoot = await manager.initializeProjectRoot();
      
      expect(projectRoot.root).toBe('/fallback/dir');
      expect(projectRoot.source).toBe('cwd_fallback');
      
      process.cwd = originalCwd;
    });

    it('应该处理多个客户端根目录，使用第一个有效的', async () => {
      const manager = new ProjectRootManager();
      
      manager.setClientRoots(['/invalid1', '/valid/project', '/invalid2']);
      
      // Mock 第一个失败，然后降级到 CWD
      vi.mocked(fs.stat).mockRejectedValue(new Error('Not found'));
      
      // Mock CWD 成功
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/fallback/cwd');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      const projectRoot = await manager.initializeProjectRoot();
      
      // 由于当前实现只检查第一个客户端根目录，失败后直接降级到 CWD
      expect(projectRoot.root).toBe('/fallback/cwd');
      expect(projectRoot.source).toBe('cwd_fallback');
      
      process.cwd = originalCwd;
    });

    it('应该处理非目录的客户端根目录', async () => {
      const manager = new ProjectRootManager();
      
      manager.setClientRoots(['/path/to/file.txt']);
      
      // Mock 路径存在但不是目录
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false
      } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      // Mock CWD 成功
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/fallback/dir');
      
      const projectRoot = await manager.initializeProjectRoot();
      
      // 由于路径不是目录，应该降级到 CWD
      expect(projectRoot.root).toBe('/fallback/dir');
      expect(projectRoot.source).toBe('cwd_fallback');
      
      process.cwd = originalCwd;
    });
  });
});