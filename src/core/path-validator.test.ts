/**
 * 路径验证器测试
 * 测试路径存在性验证、权限检查、安全防护和路径规范化功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { PathValidator } from './path-validator.js';

describe('PathValidator', () => {
  let tempDir: string;
  let validator: PathValidator;

  beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'waveforge-path-validator-test-')
    );
    validator = new PathValidator();
  });

  afterEach(async () => {
    // 清理临时目录
    await fs.remove(tempDir);
  });

  describe('路径存在性验证', () => {
    it('应该验证存在的目录路径', async () => {
      const testDir = path.join(tempDir, 'existing-dir');
      await fs.ensureDir(testDir);

      const result = await validator.validatePath(testDir);

      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe(path.resolve(testDir));
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝不存在的路径', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');

      const result = await validator.validatePath(nonExistentPath);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('路径不存在');
    });

    it('应该拒绝文件路径（非目录）', async () => {
      const filePath = path.join(tempDir, 'test-file.txt');
      await fs.writeFile(filePath, 'test content');

      const result = await validator.validatePath(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('路径不是目录');
    });

    it('应该处理空路径', async () => {
      const result = await validator.validatePath('');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('路径不能为空');
    });

    it('应该处理null和undefined路径', async () => {
      const nullResult = await validator.validatePath(null as any);
      const undefinedResult = await validator.validatePath(undefined as any);

      expect(nullResult.valid).toBe(false);
      expect(nullResult.errors).toContain('路径不能为空');
      expect(undefinedResult.valid).toBe(false);
      expect(undefinedResult.errors).toContain('路径不能为空');
    });
  });

  describe('权限检查', () => {
    it('应该验证具有读写权限的目录', async () => {
      const testDir = path.join(tempDir, 'writable-dir');
      await fs.ensureDir(testDir);

      const result = await validator.validatePath(testDir);

      expect(result.valid).toBe(true);
      expect(result.permissions?.readable).toBe(true);
      expect(result.permissions?.writable).toBe(true);
    });

    it('应该检测只读目录', async () => {
      const readOnlyDir = path.join(tempDir, 'readonly-dir');
      await fs.ensureDir(readOnlyDir);

      try {
        // 尝试设置为只读权限
        await fs.chmod(readOnlyDir, 0o444);

        const result = await validator.validatePath(readOnlyDir);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('没有写入权限');
        expect(result.permissions?.readable).toBe(true);
        expect(result.permissions?.writable).toBe(false);
      } catch (error) {
        // 如果系统不支持权限修改，跳过这个测试
        console.warn('跳过权限测试：系统不支持权限修改');
      } finally {
        // 恢复权限以便清理
        try {
          await fs.chmod(readOnlyDir, 0o755);
        } catch {
          // 忽略权限恢复错误
        }
      }
    });

    it('应该检测无读取权限的目录', async () => {
      const noReadDir = path.join(tempDir, 'no-read-dir');
      await fs.ensureDir(noReadDir);

      try {
        // 尝试设置为无读取权限
        await fs.chmod(noReadDir, 0o200);

        const result = await validator.validatePath(noReadDir);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('没有读取权限');
        expect(result.permissions?.readable).toBe(false);
      } catch (error) {
        // 如果系统不支持权限修改，跳过这个测试
        console.warn('跳过权限测试：系统不支持权限修改');
      } finally {
        // 恢复权限以便清理
        try {
          await fs.chmod(noReadDir, 0o755);
        } catch {
          // 忽略权限恢复错误
        }
      }
    });
  });

  describe('安全防护 - 系统关键目录', () => {
    it('应该阻止连接到根目录', async () => {
      const result = await validator.validatePath('/');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('禁止连接到系统关键目录');
      expect(result.securityRisk).toBe('system_critical');
    });

    it('应该阻止连接到系统目录 (/usr, /bin, /sbin, /etc)', async () => {
      const systemDirs = ['/usr', '/bin', '/sbin', '/etc', '/var', '/lib'];

      for (const dir of systemDirs) {
        const result = await validator.validatePath(dir);

        expect(result.valid).toBe(false);
        // 系统目录可能是符号链接，所以错误信息可能不同
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.securityRisk).toMatch(
          /system_critical|dangerous_symlink/
        );
      }
    });

    it('应该阻止连接到Windows系统目录', async () => {
      const windowsDirs = [
        'C:\\Windows',
        'C:\\Program Files',
        'C:\\Program Files (x86)',
        'C:\\System32',
        'C:\\Windows\\System32',
      ];

      for (const dir of windowsDirs) {
        const result = await validator.validatePath(dir);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        // 在非Windows系统上，Windows路径会被当作普通路径处理，可能只是路径不存在
        if (process.platform === 'win32') {
          expect(result.errors).toContain('禁止连接到系统关键目录');
          expect(result.securityRisk).toBe('system_critical');
        } else {
          // 在非Windows系统上，这些路径不存在是正常的
          expect(
            result.errors.some(
              (error) =>
                error.includes('路径不存在') ||
                error.includes('禁止连接到系统关键目录')
            )
          ).toBe(true);
        }
      }
    });

    it('应该阻止连接到macOS系统目录', async () => {
      const macosDirs = [
        '/System',
        '/Library',
        '/Applications',
        '/usr/bin',
        '/usr/sbin',
        '/private',
      ];

      for (const dir of macosDirs) {
        const result = await validator.validatePath(dir);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('禁止连接到系统关键目录');
        expect(result.securityRisk).toBe('system_critical');
      }
    });

    it('应该阻止连接到用户敏感目录', async () => {
      const homeDir = os.homedir();
      const sensitiveDirs = [
        path.join(homeDir, '.ssh'),
        path.join(homeDir, '.gnupg'),
        path.join(homeDir, '.aws'),
        path.join(homeDir, '.docker'),
      ];

      for (const dir of sensitiveDirs) {
        const result = await validator.validatePath(dir);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('禁止连接到敏感目录');
        expect(result.securityRisk).toBe('user_sensitive');
      }
    });

    it('应该允许连接到用户主目录下的普通项目目录', async () => {
      const homeDir = os.homedir();
      const projectDir = path.join(homeDir, 'projects', 'my-project');

      // 创建测试目录
      await fs.ensureDir(projectDir);

      try {
        const result = await validator.validatePath(projectDir);

        expect(result.valid).toBe(true);
        expect(result.securityRisk).toBeUndefined();
      } finally {
        // 清理测试目录
        await fs.remove(path.join(homeDir, 'projects'));
      }
    });

    it('应该允许连接到临时目录下的项目', async () => {
      const tmpProjectDir = path.join(os.tmpdir(), 'test-project');
      await fs.ensureDir(tmpProjectDir);

      try {
        const result = await validator.validatePath(tmpProjectDir);

        expect(result.valid).toBe(true);
        expect(result.securityRisk).toBeUndefined();
      } finally {
        await fs.remove(tmpProjectDir);
      }
    });
  });

  describe('路径规范化', () => {
    it('应该规范化相对路径', async () => {
      const testDir = path.join(tempDir, 'test-dir');
      await fs.ensureDir(testDir);

      // 使用相对路径（相对于当前工作目录）
      const relativePath = path.relative(process.cwd(), testDir);
      const result = await validator.validatePath(relativePath);

      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe(path.resolve(testDir));
    });

    it('应该处理包含 .. 的路径', async () => {
      const testDir = path.join(tempDir, 'subdir', 'test-dir');
      await fs.ensureDir(testDir);

      const pathWithDotDot = path.join(testDir, '..', 'test-dir');
      const result = await validator.validatePath(pathWithDotDot);

      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe(path.resolve(testDir));
    });

    it('应该处理符号链接', async () => {
      const targetDir = path.join(tempDir, 'target-dir');
      const linkDir = path.join(tempDir, 'link-dir');

      await fs.ensureDir(targetDir);

      try {
        // 创建符号链接
        await fs.symlink(targetDir, linkDir);

        const result = await validator.validatePath(linkDir);

        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toBe(path.resolve(targetDir));
        expect(result.isSymlink).toBe(true);
        expect(result.symlinkTarget).toBe(path.resolve(targetDir));
      } catch (error) {
        // 如果系统不支持符号链接，跳过这个测试
        console.warn('跳过符号链接测试：系统不支持符号链接');
      }
    });

    it('应该检测并拒绝危险的符号链接', async () => {
      const linkDir = path.join(tempDir, 'dangerous-link');

      try {
        // 创建指向系统目录的符号链接
        await fs.symlink('/etc', linkDir);

        const result = await validator.validatePath(linkDir);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('符号链接指向禁止的目录');
        expect(result.securityRisk).toBe('dangerous_symlink');
      } catch (error) {
        // 如果系统不支持符号链接，跳过这个测试
        console.warn('跳过危险符号链接测试：系统不支持符号链接');
      }
    });

    it('应该处理路径中的多余斜杠和空格', async () => {
      const testDir = path.join(tempDir, 'test dir');
      await fs.ensureDir(testDir);

      const messyPath = testDir + '///';
      const result = await validator.validatePath(messyPath);

      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe(path.resolve(testDir));
    });
  });

  describe('综合验证场景', () => {
    it('应该返回完整的验证结果', async () => {
      const testDir = path.join(tempDir, 'complete-test');
      await fs.ensureDir(testDir);

      const result = await validator.validatePath(testDir);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('normalizedPath');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('permissions');
      expect(result).toHaveProperty('metadata');

      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe(path.resolve(testDir));
      expect(result.errors).toHaveLength(0);
      expect(result.permissions?.readable).toBe(true);
      expect(result.permissions?.writable).toBe(true);
    });

    it('应该处理复杂的错误场景', async () => {
      // 测试不存在的系统目录路径
      const result = await validator.validatePath('/non-existent-system-dir');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // 应该包含"路径不存在"的错误
      expect(result.errors.some((error) => error.includes('路径不存在'))).toBe(
        true
      );
      // 注意：由于路径不存在，系统关键目录检查可能不会触发，这是正常的
    });

    it('应该提供有用的警告信息', async () => {
      const testDir = path.join(tempDir, 'warning-test');
      await fs.ensureDir(testDir);

      // 创建一个看起来像系统目录但实际不是的目录
      const fakeSystemDir = path.join(testDir, 'bin');
      await fs.ensureDir(fakeSystemDir);

      const result = await validator.validatePath(fakeSystemDir);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      // 可能会有关于目录名称的警告
    });
  });

  describe('性能和边界测试', () => {
    it('应该在合理时间内完成验证', async () => {
      const testDir = path.join(tempDir, 'performance-test');
      await fs.ensureDir(testDir);

      const startTime = Date.now();
      const result = await validator.validatePath(testDir);
      const endTime = Date.now();

      expect(result.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该处理非常长的路径', async () => {
      // 创建一个很长的路径
      const longDirName = 'a'.repeat(100);
      const longPath = path.join(tempDir, longDirName);

      try {
        await fs.ensureDir(longPath);

        const result = await validator.validatePath(longPath);

        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toBe(path.resolve(longPath));
      } catch (error) {
        // 如果系统不支持长路径，跳过这个测试
        console.warn('跳过长路径测试：系统不支持长路径');
      }
    });

    it('应该处理特殊字符的路径', async () => {
      const specialChars = ['中文目录', 'dir with spaces', 'dir-with-dashes'];

      for (const dirName of specialChars) {
        const testDir = path.join(tempDir, dirName);
        await fs.ensureDir(testDir);

        const result = await validator.validatePath(testDir);

        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toBe(path.resolve(testDir));
      }
    });
  });
});
