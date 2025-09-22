/**
 * ProjectRegistry 测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ProjectRegistry } from './project-registry.js';

describe('ProjectRegistry', () => {
  let registry: ProjectRegistry;
  let tempDir: string;

  beforeEach(async () => {
    registry = new ProjectRegistry();

    // 创建临时目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'waveforge-test-'));
  });

  afterEach(async () => {
    // 清理临时目录
    await fs.remove(tempDir);
  });

  describe('项目信息管理', () => {
    it('应该能够在新目录中生成项目信息', async () => {
      const projectDir = path.join(tempDir, 'test-project');
      await fs.ensureDir(projectDir);

      const projectInfo = await registry.ensureAtPath(projectDir);

      expect(projectInfo).toBeDefined();
      expect(projectInfo.id).toBeTruthy();
      expect(projectInfo.slug).toBe('test-project');
      expect(typeof projectInfo.id).toBe('string');
    });

    it('应该能够加载现有的项目信息', async () => {
      const projectDir = path.join(tempDir, 'existing-project');
      await fs.ensureDir(projectDir);

      // 第一次创建
      const firstInfo = await registry.ensureAtPath(projectDir);

      // 第二次加载应该返回相同的信息
      const secondInfo = await registry.loadByPath(projectDir);

      expect(secondInfo).toEqual(firstInfo);
    });

    it('应该能够检测Git仓库来源', async () => {
      const projectDir = path.join(tempDir, 'git-project');
      await fs.ensureDir(projectDir);

      // 创建模拟的Git配置
      const gitDir = path.join(projectDir, '.git');
      await fs.ensureDir(gitDir);
      await fs.writeFile(
        path.join(gitDir, 'config'),
        '[remote "origin"]\n\turl = https://github.com/test/repo.git\n'
      );

      const projectInfo = await registry.ensureAtPath(projectDir);

      expect(projectInfo.origin).toBe('https://github.com/test/repo.git');
    });
  });

  describe('本地项目信息', () => {
    it('应该能够保存和加载项目信息到本地文件', async () => {
      const projectDir = path.join(tempDir, 'test-project');
      await fs.ensureDir(projectDir);

      // 确保项目信息存在
      const projectInfo = await registry.ensureAtPath(projectDir);

      // 验证项目信息文件被创建
      const projectFilePath = path.join(projectDir, '.wave', 'project.json');
      expect(await fs.pathExists(projectFilePath)).toBe(true);

      // 验证能够重新加载
      const loadedInfo = await registry.loadByPath(projectDir);
      expect(loadedInfo).toEqual(projectInfo);
    });
  });

  describe('项目验证', () => {
    it('应该验证有效的项目路径', async () => {
      const projectDir = path.join(tempDir, 'valid-project');
      await fs.ensureDir(projectDir);

      const validation = await registry.validateProjectPath(projectDir);

      expect(validation.valid).toBe(true);
      expect(validation.reason).toBeUndefined();
    });

    it('应该拒绝无效的项目路径', async () => {
      const invalidPath = path.join(tempDir, 'non-existent');

      const validation = await registry.validateProjectPath(invalidPath);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('路径不存在');
    });

    it('应该拒绝文件路径（非目录）', async () => {
      const filePath = path.join(tempDir, 'test-file.txt');
      await fs.writeFile(filePath, 'test content');

      const validation = await registry.validateProjectPath(filePath);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('路径不是目录');
    });
  });
});
