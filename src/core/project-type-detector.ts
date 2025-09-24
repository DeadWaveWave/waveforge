/**
 * 项目类型检测器
 * 负责检测项目类型、验证项目结构和进行健康检查
 */

import fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger.js';
import {
  LogCategory,
  LogAction,
  ProjectType,
  type ProjectTypeDetectionResult,
  type ProjectRootDetectionResult,
  type ProjectStructureValidationResult,
  type ProjectHealthCheckResult,
  type ProjectTypeDetectorConfig,
  type ProjectDetectionRule,
  type ProjectFeature,
  type ProjectHealthCheck,
  type WaveStructureStatus,
  type ProjectConfigStatus,
} from '../types/index.js';

/**
 * 项目类型检测器类
 * 提供项目类型识别、结构验证和健康检查功能
 */
export class ProjectTypeDetector {
  private config: ProjectTypeDetectorConfig;
  private detectionCache: Map<string, ProjectTypeDetectionResult> = new Map();

  constructor(config?: Partial<ProjectTypeDetectorConfig>) {
    this.config = {
      maxSearchDepth: 5,
      minConfidenceThreshold: 0.6,
      enableCache: true,
      cacheExpiration: 5 * 60 * 1000, // 5分钟
      ...config,
    };
  }

  /**
   * 检测项目类型
   */
  async detectProjectType(
    projectPath: string
  ): Promise<ProjectTypeDetectionResult> {
    try {
      const normalizedPath = path.resolve(projectPath);

      // 检查缓存
      if (this.config.enableCache) {
        const cached = this.detectionCache.get(normalizedPath);
        if (cached) {
          logger.info(
            LogCategory.Task,
            LogAction.Handle,
            '使用缓存的项目类型检测结果',
            {
              path: normalizedPath,
              type: cached.type,
            }
          );
          return cached;
        }
      }

      // 执行检测
      const result = await this.performDetection(normalizedPath);

      // 缓存结果
      if (
        this.config.enableCache &&
        result.confidence >= this.config.minConfidenceThreshold
      ) {
        this.detectionCache.set(normalizedPath, result);
        // 设置缓存过期
        setTimeout(() => {
          this.detectionCache.delete(normalizedPath);
        }, this.config.cacheExpiration);
      }

      logger.info(LogCategory.Task, LogAction.Handle, '项目类型检测完成', {
        path: normalizedPath,
        type: result.type,
        confidence: result.confidence,
        evidenceFiles: result.evidenceFiles.length,
      });

      return result;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '项目类型检测失败', {
        path: projectPath,
        error: error instanceof Error ? error.message : String(error),
      });

      // 返回未知类型的结果
      return {
        type: ProjectType.Unknown,
        confidence: 0,
        evidenceFiles: [],
        features: [],
      };
    }
  }

  /**
   * 智能检测项目根目录
   */
  async detectProjectRoot(
    startPath: string
  ): Promise<ProjectRootDetectionResult> {
    try {
      const normalizedPath = path.resolve(startPath);

      // 检查是否为目录
      const stats = await fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        throw new Error('起始路径不是目录');
      }

      // 尝试不同的检测方法
      const detectionMethods = [
        () => this.detectGitRoot(normalizedPath),
        () => this.detectByConfigFiles(normalizedPath),
        () => this.detectByParentSearch(normalizedPath),
      ];

      for (const method of detectionMethods) {
        try {
          const result = await method();
          if (result && result.confidence >= 0.7) {
            logger.info(
              LogCategory.Task,
              LogAction.Handle,
              '项目根目录检测成功',
              {
                startPath: normalizedPath,
                rootPath: result.rootPath,
                method: result.method,
                confidence: result.confidence,
              }
            );
            return result;
          }
        } catch (error) {
          // 继续尝试下一个方法
          continue;
        }
      }

      // 如果所有方法都失败，返回当前目录
      logger.warning(
        LogCategory.Task,
        LogAction.Handle,
        '无法检测项目根目录，使用当前目录',
        {
          startPath: normalizedPath,
        }
      );

      return {
        rootPath: normalizedPath,
        method: 'current_dir',
        confidence: 0.3,
        searchDepth: 0,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '项目根目录检测失败', {
        startPath,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `项目根目录检测失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 验证项目结构
   */
  async validateProjectStructure(
    projectPath: string
  ): Promise<ProjectStructureValidationResult> {
    try {
      const normalizedPath = path.resolve(projectPath);

      // 首先检测项目类型
      const typeResult = await this.detectProjectType(normalizedPath);

      // 根据项目类型进行结构验证
      const validation = await this.performStructureValidation(
        normalizedPath,
        typeResult.type
      );

      logger.info(LogCategory.Task, LogAction.Handle, '项目结构验证完成', {
        path: normalizedPath,
        projectType: typeResult.type,
        valid: validation.valid,
        healthScore: validation.healthScore,
      });

      return validation;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '项目结构验证失败', {
        path: projectPath,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        valid: false,
        projectType: ProjectType.Unknown,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        missingRequiredFiles: [],
        suggestions: [],
        healthScore: 0,
      };
    }
  }

  /**
   * 项目健康检查
   */
  async performHealthCheck(
    projectPath: string
  ): Promise<ProjectHealthCheckResult> {
    try {
      const normalizedPath = path.resolve(projectPath);

      // 执行各项健康检查
      const checks: ProjectHealthCheck[] = [];
      let totalScore = 0;
      let maxScore = 0;

      // 1. 基础目录结构检查
      const basicStructureCheck =
        await this.checkBasicStructure(normalizedPath);
      checks.push(basicStructureCheck);
      totalScore += this.getCheckScore(basicStructureCheck);
      maxScore += 20;

      // 2. .wave 目录结构检查
      const waveStructure = await this.checkWaveStructure(normalizedPath);
      const waveCheck = this.createWaveStructureCheck(waveStructure);
      checks.push(waveCheck);
      totalScore += this.getCheckScore(waveCheck);
      maxScore += 25;

      // 3. 项目配置检查
      const projectConfig = await this.checkProjectConfig(normalizedPath);
      const configCheck = this.createProjectConfigCheck(projectConfig);
      checks.push(configCheck);
      totalScore += this.getCheckScore(configCheck);
      maxScore += 20;

      // 4. 权限检查
      const permissionCheck = await this.checkPermissions(normalizedPath);
      checks.push(permissionCheck);
      totalScore += this.getCheckScore(permissionCheck);
      maxScore += 15;

      // 5. 项目类型一致性检查
      const consistencyCheck =
        await this.checkProjectConsistency(normalizedPath);
      checks.push(consistencyCheck);
      totalScore += this.getCheckScore(consistencyCheck);
      maxScore += 20;

      // 计算总体健康度
      const healthScore =
        maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      // 确定整体状态
      let status: 'healthy' | 'warning' | 'error';
      if (healthScore >= 80) {
        status = 'healthy';
      } else if (healthScore >= 60) {
        status = 'warning';
      } else {
        status = 'error';
      }

      // 生成建议
      const recommendations = this.generateRecommendations(
        checks,
        waveStructure,
        projectConfig
      );

      const result: ProjectHealthCheckResult = {
        status,
        score: healthScore,
        checks,
        waveStructure,
        projectConfig,
        recommendations,
      };

      logger.info(LogCategory.Task, LogAction.Handle, '项目健康检查完成', {
        path: normalizedPath,
        status,
        score: healthScore,
        checksCount: checks.length,
      });

      return result;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '项目健康检查失败', {
        path: projectPath,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        status: 'error',
        score: 0,
        checks: [
          {
            name: '健康检查执行',
            status: 'fail',
            message: `健康检查执行失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        waveStructure: {
          exists: false,
          directories: {},
          files: {},
          permissions: { readable: false, writable: false },
          missing: [],
          corrupted: [],
        },
        projectConfig: {
          projectInfo: { exists: false, valid: false },
          globalRegistry: { exists: false, valid: false, registered: false },
          consistency: { valid: false, issues: [] },
        },
        recommendations: ['修复健康检查执行错误后重新检查'],
      };
    }
  }

  // 私有方法实现将在后续步骤中添加...

  /**
   * 执行实际的项目类型检测
   */
  private async performDetection(
    projectPath: string
  ): Promise<ProjectTypeDetectionResult> {
    const detectionResults: Array<{
      type: ProjectType;
      confidence: number;
      evidenceFiles: string[];
      features: ProjectFeature[];
    }> = [];

    // 获取目录中的所有文件
    const files = await this.getDirectoryFiles(projectPath);

    // 应用所有检测规则
    const rules = this.getDetectionRules();

    for (const rule of rules) {
      const result = await this.applyDetectionRule(projectPath, files, rule);
      if (result.confidence > 0) {
        detectionResults.push(result);
      }
    }

    // 如果没有检测到任何类型，尝试通用检测
    if (detectionResults.length === 0) {
      const genericResult = await this.detectGenericProject(projectPath, files);
      if (genericResult.confidence > 0) {
        detectionResults.push(genericResult);
      }
    }

    // 选择置信度最高的结果
    if (detectionResults.length === 0) {
      return {
        type: ProjectType.Unknown,
        confidence: 0,
        evidenceFiles: [],
        features: [],
      };
    }

    // 按置信度排序，选择最高的
    detectionResults.sort((a, b) => b.confidence - a.confidence);
    const bestResult = detectionResults[0];

    // 如果置信度太低，返回未知类型
    if (bestResult.confidence < this.config.minConfidenceThreshold) {
      return {
        type: ProjectType.Unknown,
        confidence: bestResult.confidence,
        evidenceFiles: bestResult.evidenceFiles,
        features: bestResult.features,
      };
    }

    return {
      type: bestResult.type,
      confidence: bestResult.confidence,
      evidenceFiles: bestResult.evidenceFiles,
      features: bestResult.features,
      rootPath: projectPath,
    };
  }

  /**
   * 通过Git仓库检测项目根目录
   */
  private async detectGitRoot(
    startPath: string
  ): Promise<ProjectRootDetectionResult | null> {
    try {
      let currentPath = path.resolve(startPath);
      let searchDepth = 0;

      while (searchDepth <= this.config.maxSearchDepth) {
        const gitDir = path.join(currentPath, '.git');

        try {
          const gitStat = await fs.stat(gitDir);

          if (gitStat.isDirectory()) {
            // 找到 .git 目录
            const configFile = path.join(gitDir, 'config');

            try {
              await fs.access(configFile, fs.constants.R_OK);

              logger.info(
                LogCategory.Task,
                LogAction.Handle,
                'Git根目录检测成功',
                {
                  startPath,
                  rootPath: currentPath,
                  searchDepth,
                }
              );

              return {
                rootPath: currentPath,
                method: 'git_root',
                evidenceFile: '.git/config',
                confidence: 0.95,
                searchDepth,
              };
            } catch {
              // .git/config 不可读，继续向上搜索
            }
          } else if (gitStat.isFile()) {
            // .git 是文件（可能是 Git worktree 或 submodule）
            try {
              const gitContent = await fs.readFile(gitDir, 'utf8');
              const match = gitContent.match(/^gitdir:\s*(.+)$/m);

              if (match) {
                const gitDirPath = path.resolve(currentPath, match[1].trim());

                // 验证实际的 Git 目录
                const configFile = path.join(gitDirPath, 'config');
                await fs.access(configFile, fs.constants.R_OK);

                return {
                  rootPath: currentPath,
                  method: 'git_root',
                  evidenceFile: '.git',
                  confidence: 0.9,
                  searchDepth,
                };
              }
            } catch {
              // 无法读取 .git 文件内容
            }
          }
        } catch {
          // .git 不存在，继续向上搜索
        }

        // 向上一级目录
        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
          // 已到达根目录
          break;
        }

        currentPath = parentPath;
        searchDepth++;
      }

      return null;
    } catch (error) {
      logger.warning(LogCategory.Task, LogAction.Handle, 'Git根目录检测失败', {
        startPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 通过配置文件检测项目根目录
   */
  private async detectByConfigFiles(
    startPath: string
  ): Promise<ProjectRootDetectionResult | null> {
    try {
      // 定义项目配置文件的优先级
      const configFiles = [
        { file: 'package.json', confidence: 0.9 },
        { file: 'Cargo.toml', confidence: 0.9 },
        { file: 'pyproject.toml', confidence: 0.85 },
        { file: 'pom.xml', confidence: 0.85 },
        { file: 'build.gradle', confidence: 0.8 },
        { file: 'go.mod', confidence: 0.9 },
        { file: 'CMakeLists.txt', confidence: 0.75 },
        { file: 'composer.json', confidence: 0.8 },
        { file: 'Gemfile', confidence: 0.8 },
        { file: 'setup.py', confidence: 0.7 },
        { file: 'requirements.txt', confidence: 0.6 },
      ];

      let currentPath = path.resolve(startPath);
      let searchDepth = 0;

      while (searchDepth <= this.config.maxSearchDepth) {
        // 检查每个配置文件
        for (const { file, confidence } of configFiles) {
          const configPath = path.join(currentPath, file);

          try {
            const stat = await fs.stat(configPath);

            if (stat.isFile()) {
              // 验证文件内容是否有效
              const isValid = await this.validateConfigFile(configPath, file);

              if (isValid) {
                logger.info(
                  LogCategory.Task,
                  LogAction.Handle,
                  '配置文件根目录检测成功',
                  {
                    startPath,
                    rootPath: currentPath,
                    evidenceFile: file,
                    searchDepth,
                  }
                );

                return {
                  rootPath: currentPath,
                  method: 'config_file',
                  evidenceFile: file,
                  confidence,
                  searchDepth,
                };
              }
            }
          } catch {
            // 文件不存在或无法访问，继续检查下一个
          }
        }

        // 向上一级目录
        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
          // 已到达根目录
          break;
        }

        currentPath = parentPath;
        searchDepth++;
      }

      return null;
    } catch (error) {
      logger.warning(
        LogCategory.Task,
        LogAction.Handle,
        '配置文件根目录检测失败',
        {
          startPath,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return null;
    }
  }

  /**
   * 通过向上搜索检测项目根目录
   */
  private async detectByParentSearch(
    startPath: string
  ): Promise<ProjectRootDetectionResult | null> {
    try {
      // 定义项目标识文件和目录
      const projectIndicators = [
        'README.md',
        'README.txt',
        'README',
        'LICENSE',
        'CHANGELOG.md',
        'src',
        'lib',
        'docs',
        '.gitignore',
      ];

      let currentPath = path.resolve(startPath);
      let searchDepth = 0;
      let bestCandidate: ProjectRootDetectionResult | null = null;

      while (searchDepth <= this.config.maxSearchDepth) {
        let indicatorCount = 0;
        const foundIndicators: string[] = [];

        // 检查项目标识
        for (const indicator of projectIndicators) {
          const indicatorPath = path.join(currentPath, indicator);

          try {
            await fs.access(indicatorPath);
            indicatorCount++;
            foundIndicators.push(indicator);
          } catch {
            // 标识不存在
          }
        }

        // 如果找到足够的项目标识，认为是项目根目录
        if (indicatorCount >= 2) {
          const confidence = Math.min(0.3 + indicatorCount * 0.1, 0.8);

          const candidate: ProjectRootDetectionResult = {
            rootPath: currentPath,
            method: 'parent_search',
            confidence,
            searchDepth,
          };

          // 保留置信度最高的候选
          if (
            !bestCandidate ||
            candidate.confidence > bestCandidate.confidence
          ) {
            bestCandidate = candidate;
          }
        }

        // 向上一级目录
        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
          // 已到达根目录
          break;
        }

        currentPath = parentPath;
        searchDepth++;
      }

      if (bestCandidate) {
        logger.info(
          LogCategory.Task,
          LogAction.Handle,
          '向上搜索根目录检测成功',
          {
            startPath,
            rootPath: bestCandidate.rootPath,
            confidence: bestCandidate.confidence,
            searchDepth: bestCandidate.searchDepth,
          }
        );
      }

      return bestCandidate;
    } catch (error) {
      logger.warning(
        LogCategory.Task,
        LogAction.Handle,
        '向上搜索根目录检测失败',
        {
          startPath,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return null;
    }
  }

  /**
   * 验证配置文件的有效性
   */
  private async validateConfigFile(
    filePath: string,
    fileName: string
  ): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      switch (fileName) {
        case 'package.json': {
          const packageJson = JSON.parse(content);
          return (
            typeof packageJson.name === 'string' && packageJson.name.length > 0
          );
        }

        case 'Cargo.toml':
          return content.includes('[package]') && content.includes('name =');

        case 'pyproject.toml':
          return (
            content.includes('[project]') || content.includes('[tool.poetry]')
          );

        case 'pom.xml':
          return (
            content.includes('<project') &&
            content.includes('xmlns="http://maven.apache.org/POM/4.0.0"')
          );

        case 'build.gradle':
          return (
            content.includes('plugins') || content.includes('apply plugin')
          );

        case 'go.mod':
          return content.match(/^module\s+/m) !== null;

        case 'CMakeLists.txt':
          return (
            content.includes('cmake_minimum_required') ||
            content.includes('project(')
          );

        case 'composer.json': {
          const composerJson = JSON.parse(content);
          return typeof composerJson.name === 'string';
        }

        case 'Gemfile':
          return content.includes('source ') && content.includes('gem ');

        case 'setup.py':
          return (
            content.includes('setup(') && content.includes('from setuptools')
          );

        case 'requirements.txt':
          // 简单检查是否包含依赖项
          return content.trim().length > 0 && !content.startsWith('#');

        default:
          return true; // 对于未知文件类型，假设有效
      }
    } catch (error) {
      // JSON 解析错误或文件读取错误
      return false;
    }
  }

  /**
   * 执行项目结构验证
   */
  private async performStructureValidation(
    projectPath: string,
    projectType: ProjectType
  ): Promise<ProjectStructureValidationResult> {
    const result: ProjectStructureValidationResult = {
      valid: true,
      projectType,
      errors: [],
      warnings: [],
      missingRequiredFiles: [],
      suggestions: [],
      healthScore: 0,
    };

    try {
      // 获取项目文件列表
      const files = await this.getDirectoryFiles(projectPath);

      // 根据项目类型进行验证
      switch (projectType) {
        case ProjectType.NodeJS:
          await this.validateNodeJSStructure(projectPath, files, result);
          break;
        case ProjectType.Python:
          await this.validatePythonStructure(projectPath, files, result);
          break;
        case ProjectType.Rust:
          await this.validateRustStructure(projectPath, files, result);
          break;
        case ProjectType.Java:
          await this.validateJavaStructure(projectPath, files, result);
          break;
        case ProjectType.Go:
          await this.validateGoStructure(projectPath, files, result);
          break;
        case ProjectType.CPP:
          await this.validateCppStructure(projectPath, files, result);
          break;
        case ProjectType.PHP:
          await this.validatePhpStructure(projectPath, files, result);
          break;
        case ProjectType.Ruby:
          await this.validateRubyStructure(projectPath, files, result);
          break;
        case ProjectType.CSharp:
          await this.validateCSharpStructure(projectPath, files, result);
          break;
        case ProjectType.Git:
          await this.validateGitStructure(projectPath, files, result);
          break;
        case ProjectType.Generic:
          await this.validateGenericStructure(projectPath, files, result);
          break;
        default:
          await this.validateUnknownStructure(projectPath, files, result);
          break;
      }

      // 通用验证
      await this.validateCommonStructure(projectPath, files, result);

      // 计算健康度评分
      result.healthScore = this.calculateHealthScore(result);

      // 确定整体有效性
      result.valid = result.errors.length === 0 && result.healthScore >= 60;

      logger.info(LogCategory.Task, LogAction.Handle, '项目结构验证完成', {
        projectPath,
        projectType,
        valid: result.valid,
        healthScore: result.healthScore,
        errorsCount: result.errors.length,
        warningsCount: result.warnings.length,
      });

      return result;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '项目结构验证失败', {
        projectPath,
        projectType,
        error: error instanceof Error ? error.message : String(error),
      });

      result.valid = false;
      result.errors.push(
        `验证过程出错: ${error instanceof Error ? error.message : String(error)}`
      );
      result.healthScore = 0;

      return result;
    }
  }

  /**
   * 检查基础目录结构
   */
  private async checkBasicStructure(
    projectPath: string
  ): Promise<ProjectHealthCheck> {
    try {
      // 检查目录是否存在且可访问
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        return {
          name: '基础目录结构',
          status: 'fail',
          message: '路径不是目录',
          suggestion: '确保提供的是有效的目录路径',
        };
      }

      // 检查目录是否为空
      const entries = await fs.readdir(projectPath);
      if (entries.length === 0) {
        return {
          name: '基础目录结构',
          status: 'warning',
          message: '目录为空',
          suggestion: '初始化项目结构或添加项目文件',
        };
      }

      // 检查是否有基本的项目文件
      const hasProjectFiles = entries.some((entry) =>
        [
          'package.json',
          'Cargo.toml',
          'pom.xml',
          'go.mod',
          'pyproject.toml',
          'README.md',
        ].includes(entry)
      );

      if (!hasProjectFiles) {
        return {
          name: '基础目录结构',
          status: 'warning',
          message: '未检测到常见的项目配置文件',
          suggestion: '添加项目配置文件（如 package.json、README.md 等）',
        };
      }

      return {
        name: '基础目录结构',
        status: 'pass',
        message: '基础目录结构正常',
      };
    } catch (error) {
      return {
        name: '基础目录结构',
        status: 'fail',
        message: `检查失败: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: '检查目录路径和权限',
      };
    }
  }

  /**
   * 检查.wave目录结构
   */
  private async checkWaveStructure(
    projectPath: string
  ): Promise<WaveStructureStatus> {
    const waveDir = path.join(projectPath, '.wave');
    const result: WaveStructureStatus = {
      exists: false,
      directories: {},
      files: {},
      permissions: { readable: false, writable: false },
      missing: [],
      corrupted: [],
    };

    try {
      // 检查 .wave 目录是否存在
      const waveStats = await fs.stat(waveDir);
      if (!waveStats.isDirectory()) {
        result.missing.push('.wave (不是目录)');
        return result;
      }

      result.exists = true;

      // 检查权限
      try {
        await fs.access(waveDir, fs.constants.R_OK);
        result.permissions.readable = true;
      } catch {
        result.missing.push('.wave (无读取权限)');
      }

      try {
        await fs.access(waveDir, fs.constants.W_OK);
        result.permissions.writable = true;
      } catch {
        result.missing.push('.wave (无写入权限)');
      }

      // 定义必需的目录和文件
      const requiredDirectories = [
        'tasks',
        'tasks/views',
        'tasks/views/by-slug',
        'templates',
      ];

      const requiredFiles = [
        'project.json',
        'tasks/index.json',
        'tasks/_latest.json',
        'current-task.md',
        '.gitignore',
        'templates/devlog-template.md',
      ];

      // 检查必需目录
      for (const dir of requiredDirectories) {
        const dirPath = path.join(waveDir, dir);
        try {
          const stats = await fs.stat(dirPath);
          result.directories[`.wave/${dir}`] = stats.isDirectory();
          if (!stats.isDirectory()) {
            result.missing.push(`.wave/${dir} (不是目录)`);
          }
        } catch {
          result.directories[`.wave/${dir}`] = false;
          result.missing.push(`.wave/${dir}`);
        }
      }

      // 检查必需文件
      for (const file of requiredFiles) {
        const filePath = path.join(waveDir, file);
        try {
          const stats = await fs.stat(filePath);
          result.files[`.wave/${file}`] = stats.isFile();

          if (stats.isFile()) {
            // 检查 JSON 文件的有效性
            if (file.endsWith('.json')) {
              try {
                const content = await fs.readFile(filePath, 'utf8');
                JSON.parse(content);
              } catch {
                result.corrupted.push(`.wave/${file} (JSON格式无效)`);
              }
            }
          } else {
            result.missing.push(`.wave/${file} (不是文件)`);
          }
        } catch {
          result.files[`.wave/${file}`] = false;
          result.missing.push(`.wave/${file}`);
        }
      }

      return result;
    } catch {
      // .wave 目录不存在
      result.missing.push('.wave');
      return result;
    }
  }

  /**
   * 检查项目配置
   */
  private async checkProjectConfig(
    projectPath: string
  ): Promise<ProjectConfigStatus> {
    const result: ProjectConfigStatus = {
      projectInfo: { exists: false, valid: false },
      globalRegistry: { exists: false, valid: false, registered: false },
      consistency: { valid: true, issues: [] },
    };

    // 检查项目信息文件
    const projectInfoPath = path.join(projectPath, '.wave', 'project.json');
    try {
      const stats = await fs.stat(projectInfoPath);
      result.projectInfo.exists = stats.isFile();

      if (result.projectInfo.exists) {
        try {
          const content = await fs.readFile(projectInfoPath, 'utf8');
          const projectInfo = JSON.parse(content);

          // 验证项目信息结构
          if (
            typeof projectInfo.id === 'string' &&
            projectInfo.id.length > 0 &&
            typeof projectInfo.slug === 'string' &&
            projectInfo.slug.length > 0
          ) {
            result.projectInfo.valid = true;
          } else {
            result.projectInfo.valid = false;
            result.projectInfo.error = '项目信息缺少必需字段 (id, slug)';
          }
        } catch (error) {
          result.projectInfo.valid = false;
          result.projectInfo.error = `JSON 格式无效: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    } catch {
      result.projectInfo.exists = false;
    }

    // 检查全局注册表
    const homeDir = require('os').homedir();
    const globalRegistryPath = path.join(homeDir, '.wave', 'projects.json');

    try {
      const stats = await fs.stat(globalRegistryPath);
      result.globalRegistry.exists = stats.isFile();

      if (result.globalRegistry.exists) {
        try {
          const content = await fs.readFile(globalRegistryPath, 'utf8');
          const registry = JSON.parse(content);

          // 验证注册表结构
          if (
            typeof registry.projects === 'object' &&
            typeof registry.version === 'string' &&
            typeof registry.updated_at === 'string'
          ) {
            result.globalRegistry.valid = true;

            // 检查当前项目是否已注册
            if (result.projectInfo.valid) {
              const projectInfoContent = await fs.readFile(
                projectInfoPath,
                'utf8'
              );
              const projectInfo = JSON.parse(projectInfoContent);
              result.globalRegistry.registered =
                projectInfo.id in registry.projects;
            }
          } else {
            result.globalRegistry.valid = false;
            result.globalRegistry.error = '全局注册表结构无效';
          }
        } catch (error) {
          result.globalRegistry.valid = false;
          result.globalRegistry.error = `JSON 格式无效: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    } catch {
      result.globalRegistry.exists = false;
    }

    // 检查配置一致性
    if (
      result.projectInfo.valid &&
      result.globalRegistry.valid &&
      result.globalRegistry.registered
    ) {
      try {
        const projectInfoContent = await fs.readFile(projectInfoPath, 'utf8');
        const projectInfo = JSON.parse(projectInfoContent);

        const registryContent = await fs.readFile(globalRegistryPath, 'utf8');
        const registry = JSON.parse(registryContent);

        const registryRecord = registry.projects[projectInfo.id];

        if (registryRecord) {
          // 检查路径一致性
          if (registryRecord.root !== path.resolve(projectPath)) {
            result.consistency.valid = false;
            result.consistency.issues.push('项目路径与全局注册表不一致');
          }

          // 检查 slug 一致性
          if (registryRecord.slug !== projectInfo.slug) {
            result.consistency.valid = false;
            result.consistency.issues.push('项目 slug 与全局注册表不一致');
          }
        }
      } catch (error) {
        result.consistency.valid = false;
        result.consistency.issues.push(
          `一致性检查失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return result;
  }

  /**
   * 检查权限
   */
  private async checkPermissions(
    projectPath: string
  ): Promise<ProjectHealthCheck> {
    try {
      const issues: string[] = [];

      // 检查项目根目录权限
      try {
        await fs.access(projectPath, fs.constants.R_OK);
      } catch {
        issues.push('项目根目录无读取权限');
      }

      try {
        await fs.access(projectPath, fs.constants.W_OK);
      } catch {
        issues.push('项目根目录无写入权限');
      }

      // 检查 .wave 目录权限（如果存在）
      const waveDir = path.join(projectPath, '.wave');
      try {
        const stats = await fs.stat(waveDir);
        if (stats.isDirectory()) {
          try {
            await fs.access(waveDir, fs.constants.R_OK);
          } catch {
            issues.push('.wave 目录无读取权限');
          }

          try {
            await fs.access(waveDir, fs.constants.W_OK);
          } catch {
            issues.push('.wave 目录无写入权限');
          }
        }
      } catch {
        // .wave 目录不存在，这不是权限问题
      }

      if (issues.length === 0) {
        return {
          name: '权限检查',
          status: 'pass',
          message: '所有必要权限正常',
        };
      } else if (issues.some((issue) => issue.includes('写入权限'))) {
        return {
          name: '权限检查',
          status: 'fail',
          message: `权限不足: ${issues.join(', ')}`,
          suggestion: '检查目录权限设置，确保有读写权限',
        };
      } else {
        return {
          name: '权限检查',
          status: 'warning',
          message: `权限问题: ${issues.join(', ')}`,
          suggestion: '检查目录权限设置',
        };
      }
    } catch (error) {
      return {
        name: '权限检查',
        status: 'fail',
        message: `权限检查失败: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: '检查目录是否存在和权限设置',
      };
    }
  }

  /**
   * 检查项目一致性
   */
  private async checkProjectConsistency(
    projectPath: string
  ): Promise<ProjectHealthCheck> {
    try {
      const issues: string[] = [];

      // 检测项目类型
      const typeResult = await this.detectProjectType(projectPath);

      if (typeResult.type === ProjectType.Unknown) {
        return {
          name: '项目一致性',
          status: 'warning',
          message: '无法识别项目类型',
          suggestion: '添加项目配置文件以明确项目类型',
        };
      }

      // 检查是否有多种项目类型的特征
      const files = await this.getDirectoryFiles(projectPath);
      const projectTypeIndicators = [
        { type: ProjectType.NodeJS, files: ['package.json'] },
        {
          type: ProjectType.Python,
          files: ['pyproject.toml', 'setup.py', 'requirements.txt'],
        },
        { type: ProjectType.Rust, files: ['Cargo.toml'] },
        { type: ProjectType.Java, files: ['pom.xml', 'build.gradle'] },
        { type: ProjectType.Go, files: ['go.mod'] },
        { type: ProjectType.CPP, files: ['CMakeLists.txt'] },
        { type: ProjectType.PHP, files: ['composer.json'] },
        { type: ProjectType.Ruby, files: ['Gemfile'] },
        { type: ProjectType.CSharp, files: ['*.csproj', '*.sln'] },
      ];

      const detectedTypes: ProjectType[] = [];
      for (const indicator of projectTypeIndicators) {
        const hasIndicator = indicator.files.some((file) => {
          if (file.includes('*')) {
            const pattern = file.replace('*', '');
            return files.some((f) => f.includes(pattern));
          }
          return files.includes(file);
        });

        if (hasIndicator) {
          detectedTypes.push(indicator.type);
        }
      }

      if (detectedTypes.length > 1) {
        issues.push(`检测到多种项目类型: ${detectedTypes.join(', ')}`);
      }

      // 检查项目结构一致性
      const structureResult = await this.validateProjectStructure(projectPath);
      if (structureResult.errors.length > 0) {
        issues.push(
          `结构问题: ${structureResult.errors.slice(0, 2).join(', ')}`
        );
      }

      if (issues.length === 0) {
        return {
          name: '项目一致性',
          status: 'pass',
          message: `项目类型: ${typeResult.type}，结构一致`,
        };
      } else if (issues.some((issue) => issue.includes('结构问题'))) {
        return {
          name: '项目一致性',
          status: 'fail',
          message: issues.join('; '),
          suggestion: '修复项目结构问题',
        };
      } else {
        return {
          name: '项目一致性',
          status: 'warning',
          message: issues.join('; '),
          suggestion: '考虑统一项目类型或分离不同类型的代码',
        };
      }
    } catch (error) {
      return {
        name: '项目一致性',
        status: 'fail',
        message: `一致性检查失败: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: '检查项目配置和结构',
      };
    }
  }

  /**
   * 创建.wave结构检查结果
   */
  private createWaveStructureCheck(
    waveStructure: WaveStructureStatus
  ): ProjectHealthCheck {
    if (!waveStructure.exists) {
      return {
        name: '.wave目录结构',
        status: 'warning',
        message: '.wave 目录不存在',
        suggestion: '运行项目初始化创建 .wave 目录结构',
      };
    }

    if (
      !waveStructure.permissions.readable ||
      !waveStructure.permissions.writable
    ) {
      return {
        name: '.wave目录结构',
        status: 'fail',
        message: '.wave 目录权限不足',
        suggestion: '检查 .wave 目录的读写权限',
      };
    }

    if (waveStructure.missing.length > 0) {
      const criticalMissing = waveStructure.missing.filter(
        (item) =>
          item.includes('project.json') || item.includes('tasks/index.json')
      );

      if (criticalMissing.length > 0) {
        return {
          name: '.wave目录结构',
          status: 'fail',
          message: `缺少关键文件: ${criticalMissing.slice(0, 3).join(', ')}`,
          suggestion: '运行项目初始化修复缺失的文件',
        };
      } else {
        return {
          name: '.wave目录结构',
          status: 'warning',
          message: `缺少 ${waveStructure.missing.length} 个文件/目录`,
          suggestion: '运行项目初始化补全目录结构',
        };
      }
    }

    if (waveStructure.corrupted.length > 0) {
      return {
        name: '.wave目录结构',
        status: 'fail',
        message: `${waveStructure.corrupted.length} 个文件损坏`,
        suggestion: '修复损坏的配置文件',
        details: { corrupted: waveStructure.corrupted },
      };
    }

    return {
      name: '.wave目录结构',
      status: 'pass',
      message: '.wave 目录结构完整',
    };
  }

  /**
   * 创建项目配置检查结果
   */
  private createProjectConfigCheck(
    projectConfig: ProjectConfigStatus
  ): ProjectHealthCheck {
    const issues: string[] = [];

    // 检查项目信息
    if (!projectConfig.projectInfo.exists) {
      issues.push('缺少项目信息文件');
    } else if (!projectConfig.projectInfo.valid) {
      issues.push(`项目信息无效: ${projectConfig.projectInfo.error}`);
    }

    // 检查全局注册表
    if (!projectConfig.globalRegistry.exists) {
      issues.push('全局注册表不存在');
    } else if (!projectConfig.globalRegistry.valid) {
      issues.push(`全局注册表无效: ${projectConfig.globalRegistry.error}`);
    } else if (!projectConfig.globalRegistry.registered) {
      issues.push('项目未在全局注册表中注册');
    }

    // 检查一致性
    if (!projectConfig.consistency.valid) {
      issues.push(...projectConfig.consistency.issues);
    }

    if (issues.length === 0) {
      return {
        name: '项目配置',
        status: 'pass',
        message: '项目配置完整且一致',
      };
    }

    const criticalIssues = issues.filter(
      (issue) =>
        issue.includes('项目信息无效') || issue.includes('全局注册表无效')
    );

    if (criticalIssues.length > 0) {
      return {
        name: '项目配置',
        status: 'fail',
        message: `配置错误: ${criticalIssues[0]}`,
        suggestion: '修复项目配置文件',
        details: { allIssues: issues },
      };
    } else {
      return {
        name: '项目配置',
        status: 'warning',
        message: `配置问题: ${issues.slice(0, 2).join(', ')}`,
        suggestion: '完善项目配置',
        details: { allIssues: issues },
      };
    }
  }

  /**
   * 获取检查项得分
   */
  private getCheckScore(check: ProjectHealthCheck): number {
    switch (check.status) {
      case 'pass':
        return 100;
      case 'warning':
        return 60;
      case 'fail':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * 生成修复建议
   */
  private generateRecommendations(
    checks: ProjectHealthCheck[],
    waveStructure: WaveStructureStatus,
    projectConfig: ProjectConfigStatus
  ): string[] {
    const recommendations: string[] = [];

    // 基于检查结果生成建议
    for (const check of checks) {
      if (
        check.suggestion &&
        (check.status === 'fail' || check.status === 'warning')
      ) {
        recommendations.push(check.suggestion);
      }
    }

    // 基于 .wave 结构生成建议
    if (!waveStructure.exists) {
      recommendations.push('初始化 .wave 目录结构');
    } else if (waveStructure.missing.length > 0) {
      recommendations.push('补全缺失的 .wave 目录和文件');
    }

    if (waveStructure.corrupted.length > 0) {
      recommendations.push('修复损坏的配置文件');
    }

    // 基于项目配置生成建议
    if (!projectConfig.projectInfo.exists) {
      recommendations.push('创建项目信息文件 (.wave/project.json)');
    } else if (!projectConfig.projectInfo.valid) {
      recommendations.push('修复项目信息文件格式');
    }

    if (!projectConfig.globalRegistry.exists) {
      recommendations.push('初始化全局项目注册表');
    } else if (
      projectConfig.globalRegistry.valid &&
      !projectConfig.globalRegistry.registered
    ) {
      recommendations.push('将项目注册到全局注册表');
    }

    if (!projectConfig.consistency.valid) {
      recommendations.push('解决项目配置一致性问题');
    }

    // 通用建议
    const hasReadmeCheck = checks.find((check) =>
      check.message.includes('README')
    );
    if (!hasReadmeCheck) {
      recommendations.push('添加 README.md 文件');
    }

    const hasGitCheck = checks.find((check) => check.message.includes('Git'));
    if (!hasGitCheck) {
      recommendations.push('初始化 Git 仓库');
    }

    // 去重并限制数量
    const uniqueRecommendations = [...new Set(recommendations)];
    return uniqueRecommendations.slice(0, 10); // 最多返回10个建议
  }

  /**
   * 获取目录中的所有文件
   */
  private async getDirectoryFiles(projectPath: string): Promise<string[]> {
    try {
      const files: string[] = [];

      const scanDirectory = async (
        dir: string,
        depth: number = 0
      ): Promise<void> => {
        if (depth > this.config.maxSearchDepth) {
          return;
        }

        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(projectPath, fullPath);

          if (entry.isFile()) {
            files.push(relativePath);
          } else if (entry.isDirectory() && entry.name !== 'node_modules') {
            // 递归扫描子目录，但跳过 node_modules
            // 允许扫描 .git 等重要的隐藏目录
            if (entry.name === '.git' || !entry.name.startsWith('.')) {
              await scanDirectory(fullPath, depth + 1);
            }
          }
        }
      };

      await scanDirectory(projectPath);
      return files;
    } catch (error) {
      logger.warning(LogCategory.Task, LogAction.Handle, '获取目录文件失败', {
        path: projectPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 获取所有检测规则
   */
  private getDetectionRules(): ProjectDetectionRule[] {
    const rules: ProjectDetectionRule[] = [
      // Node.js 项目检测规则
      {
        name: 'Node.js Package',
        projectType: ProjectType.NodeJS,
        requiredFiles: ['package.json'],
        optionalFiles: [
          'package-lock.json',
          'yarn.lock',
          'pnpm-lock.yaml',
          'tsconfig.json',
        ],
        directoryPatterns: ['src', 'lib', 'dist', 'build'],
        contentPatterns: [
          {
            file: 'package.json',
            pattern: /"name"\s*:\s*"[^"]+"/,
            weight: 0.8,
          },
        ],
        weight: 1.0,
        minConfidence: 0.7,
      },

      // Python 项目检测规则
      {
        name: 'Python Project',
        projectType: ProjectType.Python,
        requiredFiles: ['pyproject.toml'],
        optionalFiles: ['poetry.lock', 'setup.cfg', 'tox.ini', '__init__.py'],
        directoryPatterns: ['src', 'tests', 'test'],
        contentPatterns: [
          {
            file: 'pyproject.toml',
            pattern: /\[project\]|\[tool\.poetry\]/,
            weight: 0.9,
          },
        ],
        weight: 1.0,
        minConfidence: 0.8,
      },
      {
        name: 'Python Legacy Project',
        projectType: ProjectType.Python,
        requiredFiles: ['setup.py'],
        optionalFiles: ['setup.cfg', 'MANIFEST.in'],
        directoryPatterns: ['src', 'tests', 'test'],
        weight: 0.8,
        minConfidence: 0.7,
      },
      {
        name: 'Python Requirements Project',
        projectType: ProjectType.Python,
        requiredFiles: ['requirements.txt'],
        optionalFiles: ['requirements-dev.txt', 'requirements-test.txt'],
        directoryPatterns: ['src', 'tests', 'test'],
        weight: 1.0, // 提高权重
        minConfidence: 0.8, // 提高最小置信度
      },
      {
        name: 'Python Pipenv Project',
        projectType: ProjectType.Python,
        requiredFiles: ['Pipfile'],
        optionalFiles: ['Pipfile.lock'],
        directoryPatterns: ['src', 'tests', 'test'],
        weight: 0.7,
        minConfidence: 0.6,
      },

      // Rust 项目检测规则
      {
        name: 'Rust Project',
        projectType: ProjectType.Rust,
        requiredFiles: ['Cargo.toml'],
        optionalFiles: ['Cargo.lock', 'rust-toolchain.toml'],
        directoryPatterns: ['src', 'tests', 'benches', 'examples'],
        contentPatterns: [
          {
            file: 'Cargo.toml',
            pattern: /\[package\]/,
            weight: 0.9,
          },
        ],
        weight: 1.0,
        minConfidence: 0.8,
      },

      // Java 项目检测规则
      {
        name: 'Java Maven Project',
        projectType: ProjectType.Java,
        requiredFiles: ['pom.xml'],
        optionalFiles: ['mvnw', 'mvnw.cmd'],
        directoryPatterns: ['src/main/java', 'src/test/java', 'target'],
        contentPatterns: [
          {
            file: 'pom.xml',
            pattern:
              /<project.*xmlns="http:\/\/maven\.apache\.org\/POM\/4\.0\.0"/,
            weight: 0.9,
          },
        ],
        weight: 1.0,
        minConfidence: 0.8,
      },

      {
        name: 'Java Gradle Project',
        projectType: ProjectType.Java,
        requiredFiles: ['build.gradle'],
        optionalFiles: [
          'gradlew',
          'gradlew.bat',
          'gradle.properties',
          'settings.gradle',
        ],
        directoryPatterns: ['src/main/java', 'src/test/java', 'build'],
        contentPatterns: [
          {
            file: 'build.gradle',
            pattern: /plugins\s*\{|apply\s+plugin:/,
            weight: 0.8,
          },
        ],
        weight: 1.0,
        minConfidence: 0.7,
      },
      {
        name: 'Java Gradle Kotlin Project',
        projectType: ProjectType.Java,
        requiredFiles: ['build.gradle.kts'],
        optionalFiles: [
          'gradlew',
          'gradlew.bat',
          'gradle.properties',
          'settings.gradle.kts',
        ],
        directoryPatterns: ['src/main/java', 'src/test/java', 'build'],
        weight: 1.0,
        minConfidence: 0.7,
      },

      // Go 项目检测规则
      {
        name: 'Go Project',
        projectType: ProjectType.Go,
        requiredFiles: ['go.mod'],
        optionalFiles: ['go.sum', 'go.work'],
        directoryPatterns: ['cmd', 'pkg', 'internal'],
        contentPatterns: [
          {
            file: 'go.mod',
            pattern: /^module\s+/m,
            weight: 0.9,
          },
        ],
        weight: 1.0,
        minConfidence: 0.8,
      },

      // C/C++ 项目检测规则
      {
        name: 'C/C++ CMake Project',
        projectType: ProjectType.CPP,
        requiredFiles: ['CMakeLists.txt'],
        optionalFiles: ['cmake', 'conanfile.txt', 'vcpkg.json'],
        directoryPatterns: ['src', 'include', 'build', 'cmake'],
        contentPatterns: [
          {
            file: 'CMakeLists.txt',
            pattern: /cmake_minimum_required|project\s*\(/,
            weight: 0.8,
          },
        ],
        weight: 1.0,
        minConfidence: 0.7,
      },

      // PHP 项目检测规则
      {
        name: 'PHP Project',
        projectType: ProjectType.PHP,
        requiredFiles: ['composer.json'],
        optionalFiles: ['composer.lock', 'phpunit.xml', 'artisan'],
        directoryPatterns: ['src', 'app', 'vendor', 'tests'],
        contentPatterns: [
          {
            file: 'composer.json',
            pattern: /"require"\s*:\s*\{/,
            weight: 0.8,
          },
        ],
        weight: 1.0,
        minConfidence: 0.7,
      },

      // Ruby 项目检测规则
      {
        name: 'Ruby Project',
        projectType: ProjectType.Ruby,
        requiredFiles: ['Gemfile'],
        optionalFiles: ['Gemfile.lock', 'Rakefile', 'config.ru'],
        directoryPatterns: ['lib', 'app', 'spec', 'test'],
        contentPatterns: [
          {
            file: 'Gemfile',
            pattern: /source\s+['"]https:\/\/rubygems\.org['"]/,
            weight: 0.8,
          },
        ],
        weight: 1.0,
        minConfidence: 0.7,
      },

      // C# 项目检测规则
      {
        name: 'C# Project File',
        projectType: ProjectType.CSharp,
        requiredFiles: ['*.csproj'],
        optionalFiles: ['Directory.Build.props', 'nuget.config'],
        directoryPatterns: ['src', 'test', 'bin', 'obj'],
        contentPatterns: [
          {
            file: '*.csproj',
            pattern: /<Project\s+Sdk="Microsoft\.NET\.Sdk/,
            weight: 0.9,
          },
        ],
        weight: 1.0,
        minConfidence: 0.8,
      },
      {
        name: 'C# Solution',
        projectType: ProjectType.CSharp,
        requiredFiles: ['*.sln'],
        optionalFiles: ['Directory.Build.props', 'nuget.config'],
        directoryPatterns: ['src', 'test'],
        weight: 0.9,
        minConfidence: 0.7,
      },

      // Git 仓库检测规则
      {
        name: 'Git Repository',
        projectType: ProjectType.Git,
        requiredFiles: ['.git/config'],
        optionalFiles: ['.gitignore', '.gitattributes', 'README.md'],
        directoryPatterns: ['.git'],
        weight: 1.0, // 提高权重
        minConfidence: 0.7, // 提高最小置信度
      },
    ];

    // 添加自定义规则
    if (this.config.customRules) {
      rules.push(...this.config.customRules);
    }

    return rules;
  }

  /**
   * 应用检测规则
   */
  private async applyDetectionRule(
    projectPath: string,
    files: string[],
    rule: ProjectDetectionRule
  ): Promise<{
    type: ProjectType;
    confidence: number;
    evidenceFiles: string[];
    features: ProjectFeature[];
  }> {
    const evidenceFiles: string[] = [];
    const features: ProjectFeature[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    // 检查必需文件
    const requiredMatches = this.checkFilePatterns(files, rule.requiredFiles);
    if (requiredMatches.length === 0) {
      // 没有必需文件，规则不匹配
      return {
        type: rule.projectType,
        confidence: 0,
        evidenceFiles: [],
        features: [],
      };
    }

    evidenceFiles.push(...requiredMatches);
    for (const file of requiredMatches) {
      // 为 Git 项目类型使用特殊的特征类型
      const featureType =
        rule.projectType === ProjectType.Git ? 'git_repo' : 'config_file';
      features.push({
        type: featureType,
        name: path.basename(file),
        path: file,
        weight: 0.8,
        description: `${rule.projectType} 配置文件`,
      });
    }
    matchedWeight += 0.8 * requiredMatches.length;
    totalWeight += 0.8 * rule.requiredFiles.length;

    // 检查可选文件
    if (rule.optionalFiles) {
      const optionalMatches = this.checkFilePatterns(files, rule.optionalFiles);
      evidenceFiles.push(...optionalMatches);
      for (const file of optionalMatches) {
        features.push({
          type: 'dependency_file',
          name: path.basename(file),
          path: file,
          weight: 0.3,
          description: `${rule.projectType} 依赖文件`,
        });
      }
      // 只有匹配到的可选文件才计入权重
      matchedWeight += 0.3 * optionalMatches.length;
      // 可选文件不应该影响基础置信度，只作为加分项
      if (optionalMatches.length > 0) {
        totalWeight += 0.3 * optionalMatches.length;
      }
    }

    // 检查目录结构
    if (rule.directoryPatterns) {
      const directoryMatches = this.checkDirectoryPatterns(
        projectPath,
        rule.directoryPatterns
      );
      for (const dir of directoryMatches) {
        features.push({
          type: 'directory_structure',
          name: dir,
          path: dir,
          weight: 0.2,
          description: `${rule.projectType} 标准目录结构`,
        });
      }
      // 目录结构作为加分项，不影响基础置信度
      if (directoryMatches.length > 0) {
        matchedWeight += 0.2 * directoryMatches.length;
        totalWeight += 0.2 * directoryMatches.length;
      }
    }

    // 检查文件内容模式
    if (rule.contentPatterns) {
      for (const contentPattern of rule.contentPatterns) {
        const contentMatches = await this.checkContentPattern(
          projectPath,
          files,
          contentPattern
        );
        if (contentMatches.length > 0) {
          evidenceFiles.push(...contentMatches);
          for (const file of contentMatches) {
            features.push({
              type: 'source_file',
              name: path.basename(file),
              path: file,
              weight: contentPattern.weight,
              description: `${rule.projectType} 特征内容`,
            });
          }
          matchedWeight += contentPattern.weight * contentMatches.length;
          totalWeight += contentPattern.weight;
        }
      }
    }

    // 计算置信度
    const baseConfidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    const confidence = Math.min(baseConfidence * rule.weight, 1.0);

    return {
      type: rule.projectType,
      confidence: Math.max(
        confidence,
        rule.minConfidence > confidence ? 0 : confidence
      ),
      evidenceFiles: [...new Set(evidenceFiles)], // 去重
      features,
    };
  }

  /**
   * 检查文件模式匹配
   */
  private checkFilePatterns(files: string[], patterns: string[]): string[] {
    const matches: string[] = [];

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // 通配符模式
        const regex = new RegExp(
          '^' + pattern.replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$'
        );
        const patternMatches = files.filter((file) => {
          // 对于 *.csproj 这样的模式，只匹配文件名部分
          const fileName = file.includes('/') ? file.split('/').pop() : file;
          return regex.test(fileName || file);
        });
        matches.push(...patternMatches);
      } else {
        // 精确匹配
        if (files.includes(pattern)) {
          matches.push(pattern);
        }
      }
    }

    return matches;
  }

  /**
   * 检查目录模式匹配
   */
  private checkDirectoryPatterns(
    projectPath: string,
    patterns: string[]
  ): string[] {
    const matches: string[] = [];

    for (const pattern of patterns) {
      const dirPath = path.join(projectPath, pattern);
      try {
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          matches.push(pattern);
        }
      } catch {
        // 忽略访问错误
      }
    }

    return matches;
  }

  /**
   * 检查文件内容模式
   */
  private async checkContentPattern(
    projectPath: string,
    files: string[],
    contentPattern: { file: string; pattern: RegExp; weight: number }
  ): Promise<string[]> {
    const matches: string[] = [];

    // 找到匹配的文件
    const targetFiles = this.checkFilePatterns(files, [contentPattern.file]);

    for (const file of targetFiles) {
      try {
        const filePath = path.join(projectPath, file);
        const content = await fs.readFile(filePath, 'utf8');

        if (contentPattern.pattern.test(content)) {
          matches.push(file);
        }
      } catch (error) {
        // 忽略读取错误
        logger.warning(LogCategory.Task, LogAction.Handle, '读取文件内容失败', {
          file,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return matches;
  }

  /**
   * 检测通用项目
   */
  private async detectGenericProject(
    projectPath: string,
    files: string[]
  ): Promise<{
    type: ProjectType;
    confidence: number;
    evidenceFiles: string[];
    features: ProjectFeature[];
  }> {
    const evidenceFiles: string[] = [];
    const features: ProjectFeature[] = [];
    let confidence = 0;

    // 检查常见的项目文件
    const commonFiles = [
      'README.md',
      'README.txt',
      'README',
      'LICENSE',
      'CHANGELOG.md',
    ];
    const foundCommonFiles = files.filter((file) =>
      commonFiles.some((common) =>
        file.toLowerCase().includes(common.toLowerCase())
      )
    );

    if (foundCommonFiles.length > 0) {
      evidenceFiles.push(...foundCommonFiles);
      confidence += 0.3 * foundCommonFiles.length;

      for (const file of foundCommonFiles) {
        features.push({
          type: 'config_file',
          name: path.basename(file),
          path: file,
          weight: 0.3,
          description: '项目文档文件',
        });
      }
    }

    // 检查是否有源码文件
    const sourceExtensions = [
      '.js',
      '.ts',
      '.py',
      '.rs',
      '.java',
      '.go',
      '.cpp',
      '.c',
      '.h',
      '.php',
      '.rb',
      '.cs',
    ];
    const sourceFiles = files.filter((file) =>
      sourceExtensions.some((ext) => file.toLowerCase().endsWith(ext))
    );

    if (sourceFiles.length > 0) {
      confidence += Math.min(0.2 * sourceFiles.length, 0.4);
      features.push({
        type: 'source_file',
        name: '源码文件',
        path: `${sourceFiles.length} 个源码文件`,
        weight: 0.2,
        description: '包含源码文件',
      });
    }

    // 如果有足够的证据，认为是通用项目
    if (confidence > 0.3) {
      return {
        type: ProjectType.Generic,
        confidence: Math.min(confidence, 0.7), // 通用项目最高置信度为 0.7
        evidenceFiles,
        features,
      };
    }

    return {
      type: ProjectType.Unknown,
      confidence: 0,
      evidenceFiles: [],
      features: [],
    };
  }

  /**
   * 验证 Node.js 项目结构
   */
  private async validateNodeJSStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    // 检查必需文件
    if (!files.includes('package.json')) {
      result.errors.push('缺少 package.json 文件');
      result.missingRequiredFiles.push('package.json');
      return;
    }

    // 验证 package.json 内容
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      // 检查基本字段
      if (!packageJson.name) {
        result.errors.push('package.json 缺少 name 字段');
      }
      if (!packageJson.version) {
        result.errors.push('package.json 缺少 version 字段');
      }

      // 检查 main 文件是否存在
      if (packageJson.main && !files.includes(packageJson.main)) {
        result.missingRequiredFiles.push(packageJson.main);
        result.warnings.push(
          `package.json 中声明的 main 文件 "${packageJson.main}" 不存在`
        );
      }

      // 检查脚本
      if (!packageJson.scripts) {
        result.warnings.push('建议添加 scripts 字段定义常用命令');
        result.suggestions.push('添加 start、test、build 等脚本');
      }

      // 检查依赖
      if (!packageJson.dependencies && !packageJson.devDependencies) {
        result.warnings.push('项目没有声明任何依赖');
      }
    } catch (error) {
      result.errors.push('package.json 配置文件格式无效');
    }

    // 检查 TypeScript 配置
    if (files.includes('tsconfig.json')) {
      try {
        const tsconfigPath = path.join(projectPath, 'tsconfig.json');
        const tsconfigContent = await fs.readFile(tsconfigPath, 'utf8');
        JSON.parse(tsconfigContent);
      } catch {
        result.errors.push('tsconfig.json 格式无效');
      }
    }

    // 检查常见目录结构
    const commonDirs = ['src', 'lib', 'dist', 'build', 'test', 'tests'];
    const foundDirs = commonDirs.filter((dir) =>
      files.some((file) => file.startsWith(dir + '/'))
    );

    if (foundDirs.length === 0) {
      result.warnings.push('建议创建 src 目录组织源码');
      result.suggestions.push('创建标准的目录结构：src/、test/、dist/');
    }

    // 检查文档文件
    if (!files.some((file) => file.toLowerCase().includes('readme'))) {
      result.warnings.push('缺少 README.md 文件');
      result.suggestions.push('添加 README.md 文件描述项目');
    }

    // 检查 .gitignore
    if (!files.includes('.gitignore')) {
      result.warnings.push('缺少 .gitignore 文件');
      result.suggestions.push('添加 .gitignore 文件，至少包含 node_modules/');
    }
  }

  /**
   * 验证 Python 项目结构
   */
  private async validatePythonStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    // 检查项目配置文件
    const hasModernConfig = files.includes('pyproject.toml');
    const hasLegacyConfig = files.includes('setup.py');
    const hasRequirements = files.includes('requirements.txt');

    if (!hasModernConfig && !hasLegacyConfig && !hasRequirements) {
      result.errors.push(
        '缺少项目配置文件 (pyproject.toml, setup.py, 或 requirements.txt)'
      );
      result.missingRequiredFiles.push('pyproject.toml');
    }

    // 推荐现代配置
    if (!hasModernConfig && hasLegacyConfig) {
      result.suggestions.push('建议迁移到 pyproject.toml 配置');
    }

    // 检查源码目录结构
    const hasSrcLayout = files.some((file) => file.startsWith('src/'));
    const hasPackageLayout = files.some(
      (file) =>
        file.endsWith('/__init__.py') &&
        !file.startsWith('tests/') &&
        !file.startsWith('test/')
    );

    if (!hasSrcLayout && !hasPackageLayout) {
      result.warnings.push('建议使用标准的 Python 包结构');
      result.suggestions.push('创建 src/ 目录或包目录结构');
    }

    // 检查测试目录
    const hasTests = files.some(
      (file) =>
        file.startsWith('tests/') ||
        file.startsWith('test/') ||
        file.includes('test_')
    );

    if (!hasTests) {
      result.warnings.push('缺少测试文件');
      result.suggestions.push('添加 tests/ 目录和测试文件');
    }

    // 检查虚拟环境相关文件
    if (files.includes('Pipfile') && !files.includes('Pipfile.lock')) {
      result.warnings.push('Pipfile 存在但缺少 Pipfile.lock');
    }

    if (files.includes('poetry.lock') && !files.includes('pyproject.toml')) {
      result.errors.push('存在 poetry.lock 但缺少 pyproject.toml');
    }
  }

  /**
   * 验证 Rust 项目结构
   */
  private async validateRustStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    // 检查 Cargo.toml
    if (!files.includes('Cargo.toml')) {
      result.errors.push('缺少 Cargo.toml 文件');
      result.missingRequiredFiles.push('Cargo.toml');
      return;
    }

    // 检查源码文件
    const hasMainRs = files.includes('src/main.rs');
    const hasLibRs = files.includes('src/lib.rs');

    if (!hasMainRs && !hasLibRs) {
      result.errors.push('缺少 src/main.rs 或 src/lib.rs');
      result.missingRequiredFiles.push('src/main.rs');
      result.missingRequiredFiles.push('src/lib.rs');
    }

    // 检查标准目录结构
    const standardDirs = ['src', 'tests', 'benches', 'examples'];
    const foundDirs = standardDirs.filter((dir) =>
      files.some((file) => file.startsWith(dir + '/'))
    );

    if (!foundDirs.includes('src')) {
      result.errors.push('缺少 src/ 目录');
    }

    // 检查测试
    if (
      !foundDirs.includes('tests') &&
      !files.some((file) => file.includes('test'))
    ) {
      result.warnings.push('建议添加测试');
      result.suggestions.push('创建 tests/ 目录或在 src/ 中添加测试模块');
    }

    // 验证 Cargo.toml 内容
    try {
      const cargoTomlPath = path.join(projectPath, 'Cargo.toml');
      const cargoContent = await fs.readFile(cargoTomlPath, 'utf8');

      if (!cargoContent.includes('[package]')) {
        result.errors.push('Cargo.toml 缺少 [package] 部分');
      }
    } catch {
      result.errors.push('无法读取 Cargo.toml 文件');
    }
  }

  /**
   * 验证 Java 项目结构
   */
  private async validateJavaStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    const hasMaven = files.includes('pom.xml');
    const hasGradle =
      files.includes('build.gradle') || files.includes('build.gradle.kts');

    if (!hasMaven && !hasGradle) {
      result.errors.push('缺少构建配置文件 (pom.xml 或 build.gradle)');
      result.missingRequiredFiles.push('pom.xml');
    }

    // 检查标准 Maven/Gradle 目录结构
    const hasStandardStructure = files.some(
      (file) =>
        file.startsWith('src/main/java/') || file.startsWith('src/test/java/')
    );

    if (!hasStandardStructure) {
      result.warnings.push('建议使用标准的 Maven/Gradle 目录结构');
      result.suggestions.push('创建 src/main/java/ 和 src/test/java/ 目录');
    }

    // 检查 Java 源文件
    const hasJavaFiles = files.some((file) => file.endsWith('.java'));
    if (!hasJavaFiles) {
      result.warnings.push('未找到 Java 源文件');
    }

    // Maven 特定检查
    if (hasMaven) {
      try {
        const pomPath = path.join(projectPath, 'pom.xml');
        const pomContent = await fs.readFile(pomPath, 'utf8');

        if (!pomContent.includes('<project')) {
          result.errors.push('pom.xml 格式无效');
        }
      } catch {
        result.errors.push('无法读取 pom.xml 文件');
      }
    }

    // Gradle 特定检查
    if (hasGradle) {
      const hasWrapper =
        files.includes('gradlew') || files.includes('gradlew.bat');
      if (!hasWrapper) {
        result.warnings.push('建议添加 Gradle Wrapper');
        result.suggestions.push('运行 gradle wrapper 生成 gradlew 脚本');
      }
    }
  }

  /**
   * 验证 Go 项目结构
   */
  private async validateGoStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    // 检查 go.mod
    if (!files.includes('go.mod')) {
      result.errors.push('缺少 go.mod 文件');
      result.missingRequiredFiles.push('go.mod');
      return;
    }

    // 检查 Go 源文件
    const hasGoFiles = files.some((file) => file.endsWith('.go'));
    if (!hasGoFiles) {
      result.warnings.push('未找到 Go 源文件');
    }

    // 检查标准目录结构
    const standardDirs = ['cmd', 'pkg', 'internal', 'api', 'web'];
    const foundDirs = standardDirs.filter((dir) =>
      files.some((file) => file.startsWith(dir + '/'))
    );

    if (
      foundDirs.length === 0 &&
      files.filter((f) => f.endsWith('.go')).length > 3
    ) {
      result.suggestions.push(
        '对于大型项目，建议使用标准的 Go 项目布局 (cmd/, pkg/, internal/)'
      );
    }

    // 验证 go.mod 内容
    try {
      const goModPath = path.join(projectPath, 'go.mod');
      const goModContent = await fs.readFile(goModPath, 'utf8');

      if (!goModContent.match(/^module\s+/m)) {
        result.errors.push('go.mod 缺少 module 声明');
      }
    } catch {
      result.errors.push('无法读取 go.mod 文件');
    }
  }

  /**
   * 验证 C++ 项目结构
   */
  private async validateCppStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    const hasCMake = files.includes('CMakeLists.txt');
    const hasMakefile =
      files.includes('Makefile') || files.includes('makefile');

    if (!hasCMake && !hasMakefile) {
      result.warnings.push('缺少构建系统配置 (CMakeLists.txt 或 Makefile)');
      result.suggestions.push('添加 CMakeLists.txt 或 Makefile');
    }

    // 检查源文件
    const hasCppFiles = files.some(
      (file) =>
        file.endsWith('.cpp') ||
        file.endsWith('.cc') ||
        file.endsWith('.cxx') ||
        file.endsWith('.c') ||
        file.endsWith('.h') ||
        file.endsWith('.hpp')
    );

    if (!hasCppFiles) {
      result.warnings.push('未找到 C/C++ 源文件');
    }

    // 检查目录结构
    const commonDirs = ['src', 'include', 'lib', 'test', 'tests'];
    const foundDirs = commonDirs.filter((dir) =>
      files.some((file) => file.startsWith(dir + '/'))
    );

    if (foundDirs.length === 0 && hasCppFiles) {
      result.suggestions.push('建议组织代码到 src/ 和 include/ 目录');
    }
  }

  /**
   * 验证 PHP 项目结构
   */
  private async validatePhpStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    // 检查 composer.json
    if (!files.includes('composer.json')) {
      result.warnings.push('缺少 composer.json 文件');
      result.suggestions.push('运行 composer init 创建 composer.json');
    }

    // 检查 PHP 文件
    const hasPhpFiles = files.some((file) => file.endsWith('.php'));
    if (!hasPhpFiles) {
      result.warnings.push('未找到 PHP 源文件');
    }

    // 检查自动加载
    if (
      files.includes('composer.json') &&
      !files.includes('vendor/autoload.php')
    ) {
      result.warnings.push('建议运行 composer install 安装依赖');
    }
  }

  /**
   * 验证 Ruby 项目结构
   */
  private async validateRubyStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    // 检查 Gemfile
    if (!files.includes('Gemfile')) {
      result.warnings.push('缺少 Gemfile');
      result.suggestions.push('创建 Gemfile 管理依赖');
    }

    // 检查 Ruby 文件
    const hasRubyFiles = files.some((file) => file.endsWith('.rb'));
    if (!hasRubyFiles) {
      result.warnings.push('未找到 Ruby 源文件');
    }

    // 检查 Rails 项目特征
    if (files.includes('config/application.rb')) {
      // Rails 项目特定检查
      const railsDirs = ['app', 'config', 'db', 'lib', 'test', 'spec'];
      const missingRailsDirs = railsDirs.filter(
        (dir) => !files.some((file) => file.startsWith(dir + '/'))
      );

      if (missingRailsDirs.length > 0) {
        result.warnings.push(
          `Rails 项目缺少标准目录: ${missingRailsDirs.join(', ')}`
        );
      }
    }
  }

  /**
   * 验证 C# 项目结构
   */
  private async validateCSharpStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    const hasCsproj = files.some((file) => file.endsWith('.csproj'));
    const hasSln = files.some((file) => file.endsWith('.sln'));

    if (!hasCsproj) {
      result.errors.push('缺少 .csproj 项目文件');
      result.missingRequiredFiles.push('*.csproj');
    }

    if (!hasSln && hasCsproj) {
      result.suggestions.push('建议创建 .sln 解决方案文件');
    }

    // 检查 C# 源文件
    const hasCsFiles = files.some((file) => file.endsWith('.cs'));
    if (!hasCsFiles) {
      result.warnings.push('未找到 C# 源文件');
    }
  }

  /**
   * 验证 Git 仓库结构
   */
  private async validateGitStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    // Git 仓库的基本检查
    if (!files.includes('.gitignore')) {
      result.warnings.push('建议添加 .gitignore 文件');
    }

    // 检查是否有其他项目类型的特征
    const hasOtherProjectFiles = files.some((file) =>
      [
        'package.json',
        'Cargo.toml',
        'pom.xml',
        'go.mod',
        'pyproject.toml',
      ].includes(file)
    );

    if (!hasOtherProjectFiles) {
      result.suggestions.push(
        '考虑初始化特定的项目类型 (如运行 npm init, cargo init 等)'
      );
    }
  }

  /**
   * 验证通用项目结构
   */
  private async validateGenericStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    // 基本文档检查
    const hasReadme = files.some((file) =>
      file.toLowerCase().includes('readme')
    );
    if (!hasReadme) {
      result.warnings.push('缺少 README.md 文件');
      result.suggestions.push('添加 README.md 文件描述项目');
    }

    const hasLicense = files.some((file) =>
      file.toLowerCase().includes('license')
    );
    if (!hasLicense) {
      result.suggestions.push('考虑添加 LICENSE 文件');
    }

    // 检查是否有源码文件
    const sourceExtensions = [
      '.js',
      '.ts',
      '.py',
      '.rs',
      '.java',
      '.go',
      '.cpp',
      '.c',
      '.h',
      '.php',
      '.rb',
      '.cs',
    ];
    const hasSourceFiles = files.some((file) =>
      sourceExtensions.some((ext) => file.toLowerCase().endsWith(ext))
    );

    if (hasSourceFiles) {
      result.suggestions.push('检测到源码文件，建议初始化对应的项目类型');
    }
  }

  /**
   * 验证未知项目结构
   */
  private async validateUnknownStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    if (files.length === 0) {
      result.errors.push('项目目录为空');
      result.suggestions.push('初始化项目结构');
    } else {
      result.suggestions.push('无法识别项目类型，请检查项目配置文件');
    }
  }

  /**
   * 验证通用项目结构
   */
  private async validateCommonStructure(
    projectPath: string,
    files: string[],
    result: ProjectStructureValidationResult
  ): Promise<void> {
    // 检查文档文件
    const hasReadme = files.some((file) =>
      file.toLowerCase().includes('readme')
    );
    if (!hasReadme) {
      result.warnings.push('建议添加 README 文件');
    }

    // 检查版本控制
    const hasGit = files.some((file) => file.startsWith('.git/'));
    if (!hasGit) {
      result.suggestions.push('建议初始化 Git 仓库 (git init)');
    }

    // 检查 .gitignore
    if (hasGit && !files.includes('.gitignore')) {
      result.warnings.push('建议添加 .gitignore 文件');
    }
  }

  /**
   * 计算健康度评分
   */
  private calculateHealthScore(
    result: ProjectStructureValidationResult
  ): number {
    let score = 100;

    // 错误扣分
    score -= result.errors.length * 20;

    // 警告扣分
    score -= result.warnings.length * 5;

    // 缺失文件扣分
    score -= result.missingRequiredFiles.length * 15;

    // 确保分数在 0-100 范围内
    return Math.max(0, Math.min(100, score));
  }
}
