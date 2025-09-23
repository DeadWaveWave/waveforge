/**
 * 路径验证器
 * 提供路径存在性验证、权限检查、安全防护和路径规范化功能
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger.js';
import { LogCategory, LogAction } from '../types/index.js';

/**
 * 路径验证结果接口
 */
export interface PathValidationResult {
  /** 验证是否通过 */
  valid: boolean;
  /** 规范化后的绝对路径 */
  normalizedPath?: string;
  /** 错误信息列表 */
  errors: string[];
  /** 警告信息列表 */
  warnings: string[];
  /** 权限信息 */
  permissions?: {
    readable: boolean;
    writable: boolean;
  };
  /** 安全风险等级 */
  securityRisk?: 'system_critical' | 'user_sensitive' | 'dangerous_symlink';
  /** 是否为符号链接 */
  isSymlink?: boolean;
  /** 符号链接目标路径 */
  symlinkTarget?: string;
  /** 路径元数据 */
  metadata?: {
    isDirectory: boolean;
    size?: number;
    created?: Date;
    modified?: Date;
  };
}

/**
 * 路径验证器类
 * 负责验证项目路径的安全性和有效性
 */
export class PathValidator {
  private static readonly SYSTEM_CRITICAL_PATHS = [
    // Unix/Linux 系统关键目录
    '/',
    '/usr',
    '/bin',
    '/sbin',
    '/etc',
    '/lib',
    '/lib64',
    '/boot',
    '/dev',
    '/proc',
    '/sys',
    '/run',
    '/root',

    // macOS 系统关键目录
    '/System',
    '/Library',
    '/Applications',
    '/usr/bin',
    '/usr/sbin',
    '/private',
    '/Volumes',

    // Windows 系统关键目录
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'C:\\System32',
    'C:\\Windows\\System32',
    'C:\\Windows\\SysWOW64',
    'C:\\ProgramData',
  ];

  private static readonly USER_SENSITIVE_DIRS = [
    '.ssh',
    '.gnupg',
    '.aws',
    '.docker',
    '.kube',
    '.config',
    'AppData',
    'Library/Keychains',
    'Library/Application Support',
  ];

  /**
   * 验证路径的安全性和有效性
   */
  async validatePath(inputPath: string): Promise<PathValidationResult> {
    const result: PathValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // 基本输入验证
      if (!this.isValidInput(inputPath)) {
        result.valid = false;
        result.errors.push('路径不能为空');
        return result;
      }

      // 路径规范化
      const normalizedPath = await this.normalizePath(inputPath);
      result.normalizedPath = normalizedPath;

      // 检查路径存在性
      const existsCheck = await this.checkPathExists(normalizedPath);
      if (!existsCheck.exists) {
        result.valid = false;
        result.errors.push('路径不存在');
      }

      // 检查是否为目录
      if (existsCheck.exists) {
        const directoryCheck = await this.checkIsDirectory(normalizedPath);
        if (!directoryCheck.isDirectory) {
          result.valid = false;
          result.errors.push('路径不是目录');
        }
        result.metadata = directoryCheck.metadata;
      }

      // 安全检查（无论路径是否存在都要检查）
      const securityCheck = await this.checkSecurity(normalizedPath);
      if (securityCheck.risk) {
        result.valid = false;
        result.securityRisk = securityCheck.risk;
        result.errors.push(...securityCheck.errors);
      }
      result.warnings.push(...securityCheck.warnings);

      // 符号链接检查（只在路径存在时检查，但不覆盖系统安全风险）
      if (existsCheck.exists) {
        const symlinkCheck = await this.checkSymlink(normalizedPath);
        if (symlinkCheck.isSymlink) {
          result.isSymlink = true;
          result.symlinkTarget = symlinkCheck.target;

          // 只有在没有系统安全风险时才设置符号链接风险
          if (symlinkCheck.dangerous && !result.securityRisk) {
            result.valid = false;
            result.securityRisk = 'dangerous_symlink';
            result.errors.push('符号链接指向禁止的目录');
          }
        }
      }

      // 权限检查
      if (existsCheck.exists) {
        const permissionCheck = await this.checkPermissions(normalizedPath);
        result.permissions = permissionCheck.permissions;
        if (!permissionCheck.valid) {
          result.valid = false;
          result.errors.push(...permissionCheck.errors);
        }
      }

      logger.info(LogCategory.Task, LogAction.Handle, '路径验证完成', {
        inputPath,
        normalizedPath,
        valid: result.valid,
        errorsCount: result.errors.length,
        warningsCount: result.warnings.length,
      });

      return result;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '路径验证失败', {
        inputPath,
        error: error instanceof Error ? error.message : String(error),
      });

      result.valid = false;
      result.errors.push(
        `验证过程出错: ${error instanceof Error ? error.message : String(error)}`
      );
      return result;
    }
  }

  /**
   * 检查输入是否有效
   */
  private isValidInput(inputPath: any): inputPath is string {
    return typeof inputPath === 'string' && inputPath.trim().length > 0;
  }

  /**
   * 规范化路径
   */
  private async normalizePath(inputPath: string): Promise<string> {
    // 去除首尾空格
    const cleanPath = inputPath.trim();

    // 解析相对路径和绝对路径
    const resolvedPath = path.resolve(cleanPath);

    // 规范化路径分隔符
    const normalizedPath = path.normalize(resolvedPath);

    return normalizedPath;
  }

  /**
   * 检查路径是否存在
   */
  private async checkPathExists(
    normalizedPath: string
  ): Promise<{ exists: boolean }> {
    try {
      await fs.access(normalizedPath);
      return { exists: true };
    } catch {
      return { exists: false };
    }
  }

  /**
   * 检查是否为目录
   */
  private async checkIsDirectory(normalizedPath: string): Promise<{
    isDirectory: boolean;
    metadata?: PathValidationResult['metadata'];
  }> {
    try {
      const stats = await fs.stat(normalizedPath);

      return {
        isDirectory: stats.isDirectory(),
        metadata: {
          isDirectory: stats.isDirectory(),
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        },
      };
    } catch {
      return { isDirectory: false };
    }
  }

  /**
   * 安全检查
   */
  private async checkSecurity(normalizedPath: string): Promise<{
    risk?: PathValidationResult['securityRisk'];
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查系统关键目录
    if (this.isSystemCriticalPath(normalizedPath)) {
      errors.push('禁止连接到系统关键目录');
      return { risk: 'system_critical', errors, warnings };
    }

    // 检查用户敏感目录
    if (this.isUserSensitivePath(normalizedPath)) {
      errors.push('禁止连接到敏感目录');
      return { risk: 'user_sensitive', errors, warnings };
    }

    // 检查可疑的目录名称
    const suspiciousWarnings = this.checkSuspiciousNames(normalizedPath);
    warnings.push(...suspiciousWarnings);

    return { errors, warnings };
  }

  /**
   * 检查是否为系统关键路径
   */
  private isSystemCriticalPath(normalizedPath: string): boolean {
    const lowerPath = normalizedPath.toLowerCase();

    // 特殊处理：允许临时目录下的子目录
    const tempDir = os.tmpdir().toLowerCase();
    if (lowerPath.startsWith(tempDir + path.sep)) {
      return false;
    }

    return PathValidator.SYSTEM_CRITICAL_PATHS.some((criticalPath) => {
      const lowerCriticalPath = criticalPath.toLowerCase();

      // Windows 路径特殊处理
      if (criticalPath.includes('\\')) {
        // 在非 Windows 系统上，Windows 路径不会匹配
        if (process.platform !== 'win32') {
          return false;
        }
        // 规范化 Windows 路径分隔符
        const normalizedCriticalPath = lowerCriticalPath.replace(
          /\\/g,
          path.sep
        );
        const normalizedInputPath = lowerPath.replace(/\\/g, path.sep);
        return (
          normalizedInputPath === normalizedCriticalPath ||
          normalizedInputPath.startsWith(normalizedCriticalPath + path.sep)
        );
      }

      return (
        lowerPath === lowerCriticalPath ||
        lowerPath.startsWith(lowerCriticalPath + path.sep)
      );
    });
  }

  /**
   * 检查是否为用户敏感路径
   */
  private isUserSensitivePath(normalizedPath: string): boolean {
    const homeDir = os.homedir();

    return PathValidator.USER_SENSITIVE_DIRS.some((sensitiveDir) => {
      const sensitivePath = path.join(homeDir, sensitiveDir);
      return (
        normalizedPath === sensitivePath ||
        normalizedPath.startsWith(sensitivePath + path.sep)
      );
    });
  }

  /**
   * 检查可疑的目录名称
   */
  private checkSuspiciousNames(normalizedPath: string): string[] {
    const warnings: string[] = [];
    const basename = path.basename(normalizedPath);

    // 检查是否包含系统目录名称
    const systemDirNames = [
      'bin',
      'sbin',
      'etc',
      'usr',
      'var',
      'lib',
      'system',
    ];
    if (systemDirNames.includes(basename.toLowerCase())) {
      warnings.push(
        `目录名称 "${basename}" 与系统目录同名，请确认这是预期的项目目录`
      );
    }

    return warnings;
  }

  /**
   * 权限检查
   */
  private async checkPermissions(normalizedPath: string): Promise<{
    valid: boolean;
    permissions: { readable: boolean; writable: boolean };
    errors: string[];
  }> {
    const errors: string[] = [];
    let readable = false;
    let writable = false;

    try {
      // 检查读取权限
      await fs.access(normalizedPath, fs.constants.R_OK);
      readable = true;
    } catch {
      errors.push('没有读取权限');
    }

    try {
      // 检查写入权限
      await fs.access(normalizedPath, fs.constants.W_OK);
      writable = true;
    } catch {
      errors.push('没有写入权限');
    }

    const valid = readable && writable;

    return {
      valid,
      permissions: { readable, writable },
      errors,
    };
  }

  /**
   * 符号链接检查
   */
  private async checkSymlink(normalizedPath: string): Promise<{
    isSymlink: boolean;
    target?: string;
    dangerous: boolean;
  }> {
    try {
      const lstat = await fs.lstat(normalizedPath);

      if (!lstat.isSymbolicLink()) {
        return { isSymlink: false, dangerous: false };
      }

      // 获取符号链接目标
      const target = await fs.readlink(normalizedPath);
      const resolvedTarget = path.resolve(path.dirname(normalizedPath), target);

      // 检查目标是否指向危险位置
      const dangerous =
        this.isSystemCriticalPath(resolvedTarget) ||
        this.isUserSensitivePath(resolvedTarget);

      return {
        isSymlink: true,
        target: resolvedTarget,
        dangerous,
      };
    } catch {
      return { isSymlink: false, dangerous: false };
    }
  }
}
