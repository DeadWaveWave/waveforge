/**
 * 项目根目录管理器测试用例
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectRootManager } from './project-root-manager.js';
import * as fs from 'fs/promises';

// Mock fs 模块
vi.mock('fs/promises');

describe('ProjectRootManager', () => {
  let manager: ProjectRootManager;

  beforeEach(() => {
    manager = new ProjectRootManager();
    vi.clearAllMocks();
  });

  describe('客户端根目录管理', () => {
    it('应该设置和获取客户端根目录', () => {
      const roots = ['/test/project1', '/test/project2'];
      manager.setClientRoots(roots);
      
      expect(manager.getClientRoots()).toEqual(roots);
    });

    it('应该返回客户端根目录的副本', () => {
      const roots = ['/test/project'];
      manager.setClientRoots(roots);
      
      const retrieved = manager.getClientRoots();
      retrieved.push('/modified');
      
      expect(manager.getClientRoots()).toEqual(roots);
    });
  });

  describe('项目根目录初始化', () => {
    it('应该优先使用有效的客户端根目录', async () => {
      const clientRoot = '/test/valid-project';
      manager.setClientRoots([clientRoot]);

      // Mock fs.stat 和 fs.access 成功
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await manager.initializeProjectRoot();

      expect(result.root).toBe(clientRoot);
      expect(result.source).toBe('client_roots');
      expect(result.available).toBe(true);
    });

    it('应该在客户端根目录无效时降级到 CWD', async () => {
      const invalidRoot = '/test/invalid-project';
      manager.setClientRoots([invalidRoot]);

      // Mock 客户端根目录验证失败
      vi.mocked(fs.stat).mockRejectedValueOnce(new Error('Directory not found'));
      
      // Mock CWD 成功
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/current/working/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await manager.initializeProjectRoot();

      expect(result.root).toBe('/current/working/dir');
      expect(result.source).toBe('cwd_fallback');
      expect(result.available).toBe(true);

      // 恢复原始 process.cwd
      process.cwd = originalCwd;
    });

    it('应该在没有客户端根目录时直接使用 CWD', async () => {
      // 不设置客户端根目录
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/current/working/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await manager.initializeProjectRoot();

      expect(result.root).toBe('/current/working/dir');
      expect(result.source).toBe('cwd_fallback');
      expect(result.available).toBe(true);

      process.cwd = originalCwd;
    });

    it('应该在 CWD 也无法访问时返回不可用状态', async () => {
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/inaccessible/dir');
      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));

      const result = await manager.initializeProjectRoot();

      expect(result.root).toBe('');
      expect(result.source).toBe('cwd_fallback');
      expect(result.available).toBe(false);

      process.cwd = originalCwd;
    });
  });

  describe('路径解析功能', () => {
    beforeEach(async () => {
      // 设置一个有效的项目根目录
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/test/project');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      await manager.initializeProjectRoot();
      
      process.cwd = originalCwd;
    });

    it('应该解析相对路径', () => {
      const result = manager.resolvePath('src/index.ts');
      expect(result).toBe('/test/project/src/index.ts');
    });

    it('应该检查路径是否在项目内', () => {
      expect(manager.isPathInProject('/test/project/src/file.ts')).toBe(true);
      expect(manager.isPathInProject('/other/project/file.ts')).toBe(false);
    });

    it('应该获取相对路径', () => {
      const result = manager.getRelativePath('/test/project/src/index.ts');
      expect(result).toBe('src/index.ts');
    });

    it('应该在路径不在项目内时返回 null', () => {
      const result = manager.getRelativePath('/other/project/file.ts');
      expect(result).toBeNull();
    });
  });

  describe('状态查询', () => {
    it('应该返回正确的项目根目录统计信息', async () => {
      manager.setClientRoots(['/test/project1', '/test/project2']);
      
      // Mock 客户端根目录验证成功
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      await manager.initializeProjectRoot();
      
      const stats = manager.getProjectRootStats();
      
      expect(stats.available).toBe(true);
      expect(stats.source).toBe('client_roots'); // 应该使用客户端根目录
      expect(stats.path).toBe('/test/project1'); // 使用第一个客户端根目录
      expect(stats.clientRootsCount).toBe(2);
    });

    it('应该在项目根目录不可用时返回正确状态', async () => {
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/inaccessible');
      vi.mocked(fs.access).mockRejectedValue(new Error('Access denied'));
      
      await manager.initializeProjectRoot();
      
      const stats = manager.getProjectRootStats();
      
      expect(stats.available).toBe(false);
      expect(stats.path).toBeNull();
      
      process.cwd = originalCwd;
    });
  });

  describe('刷新功能', () => {
    it('应该能够刷新项目根目录状态', async () => {
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue('/initial/dir');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      await manager.initializeProjectRoot();
      expect(manager.getProjectRootPath()).toBe('/initial/dir');
      
      // 更改 CWD 并刷新
      process.cwd = vi.fn().mockReturnValue('/new/dir');
      await manager.refreshProjectRoot();
      
      expect(manager.getProjectRootPath()).toBe('/new/dir');
      
      process.cwd = originalCwd;
    });
  });
});