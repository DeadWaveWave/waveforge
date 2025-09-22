/**
 * DocumentHandler - 文档处理器
 * 负责 .wave 目录初始化、文档生成和模板处理
 */

import fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger.js';
import { LogCategory, LogAction, type CurrentTask } from '../types/index.js';

/**
 * 初始化结果接口
 */
export interface InitializationResult {
  /** 新创建的文件/目录列表 */
  created: string[];
  /** 已存在的文件/目录列表 */
  existing: string[];
  /** 初始化过程中的错误 */
  errors: string[];
  /** 是否为首次运行 */
  isFirstRun: boolean;
}

/**
 * 解析的任务文档接口
 */
export interface ParsedTaskDocument {
  title: string;
  goal: string;
  plans: Array<{
    id: string;
    description: string;
    status: string;
    steps: Array<{
      id: string;
      description: string;
      status: string;
    }>;
  }>;
  hints: {
    task: string[];
    plan: string[];
    step: string[];
  };
}

/**
 * 任务摘要接口
 */
export interface TaskSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
  completed_at?: string;
  goal: string;
}

/**
 * DocumentHandler - 文档处理器核心类
 */
export class DocumentHandler {
  private docsPath: string;

  constructor(docsPath: string) {
    if (!docsPath || docsPath.trim() === '') {
      throw new Error('docsPath 不能为空');
    }
    this.docsPath = docsPath.trim();
  }

  /**
   * 获取文档路径
   */
  getDocsPath(): string {
    return this.docsPath;
  }

  /**
   * 初始化 .wave 目录结构（对应需求10）
   */
  async initializeWaveDirectory(): Promise<InitializationResult> {
    const result: InitializationResult = {
      created: [],
      existing: [],
      errors: [],
      isFirstRun: false,
    };

    try {
      logger.info(
        LogCategory.Task,
        LogAction.Create,
        '开始初始化 .wave 目录结构'
      );

      // 1. 检查并创建目录结构
      await this.ensureDirectoryStructure(result);

      // 2. 检查并创建索引文件
      await this.ensureIndexFiles(result);

      // 3. 检查并创建当前任务面板
      await this.ensureCurrentTaskFile(result);

      // 4. 检查并配置 .gitignore
      await this.ensureGitignore(result);

      // 5. 检查并复制模板文件
      await this.ensureTemplates(result);

      logger.info(LogCategory.Task, LogAction.Create, '.wave 目录初始化完成', {
        created: result.created.length,
        existing: result.existing.length,
        errors: result.errors.length,
        isFirstRun: result.isFirstRun,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);

      logger.error(LogCategory.Task, LogAction.Create, '.wave 目录初始化失败', {
        error: errorMessage,
      });

      return result;
    }
  }

  // 私有工具方法

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查目录是否存在
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 创建目录
   */
  private async createDirectory(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  /**
   * 写入文件
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * 读取文件
   */
  private async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf8');
  }

  /**
   * 复制文件
   */
  private async copyFile(
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    await fs.copy(sourcePath, targetPath);
  }

  /**
   * 追加文件内容
   */
  private async appendFile(filePath: string, content: string): Promise<void> {
    await fs.appendFile(filePath, content, 'utf8');
  }

  /**
   * 检查 JSON 文件是否有效
   */
  private async isValidJson(filePath: string): Promise<boolean> {
    try {
      const content = await this.readFile(filePath);
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 确保目录结构存在
   */
  async ensureDirectoryStructure(result?: InitializationResult): Promise<void> {
    const requiredDirs = [
      this.docsPath,
      path.join(this.docsPath, 'tasks'),
      path.join(this.docsPath, 'tasks', 'views'),
      path.join(this.docsPath, 'tasks', 'views', 'by-slug'),
      path.join(this.docsPath, 'templates'),
    ];

    for (const dir of requiredDirs) {
      if (!(await this.directoryExists(dir))) {
        await this.createDirectory(dir);
        if (result) {
          result.created.push(dir);
          result.isFirstRun = true;
        }
      } else {
        if (result) {
          result.existing.push(dir);
        }
      }
    }
  }

  /**
   * 确保索引文件存在
   */
  async ensureIndexFiles(result?: InitializationResult): Promise<void> {
    const indexFiles = [
      { path: path.join(this.docsPath, 'tasks', 'index.json'), content: '[]' },
      {
        path: path.join(this.docsPath, 'tasks', '_latest.json'),
        content: '{}',
      },
    ];

    for (const file of indexFiles) {
      if (!(await this.fileExists(file.path))) {
        await this.writeFile(file.path, file.content);
        if (result) {
          result.created.push(file.path);
        }
      } else {
        // 验证文件是否为有效JSON
        if (!(await this.isValidJson(file.path))) {
          await this.writeFile(file.path, file.content);
          if (result) {
            result.created.push(`${file.path} (repaired)`);
          }
        } else {
          if (result) {
            result.existing.push(file.path);
          }
        }
      }
    }
  }

  /**
   * 确保当前任务面板文件存在
   */
  async ensureCurrentTaskFile(result?: InitializationResult): Promise<void> {
    const panelPath = path.join(this.docsPath, 'current-task.md');

    if (!(await this.fileExists(panelPath))) {
      const initialContent = this.generateInitialPanelContent();
      await this.writeFile(panelPath, initialContent);
      if (result) {
        result.created.push(panelPath);
      }
    } else {
      if (result) {
        result.existing.push(panelPath);
      }
    }
  }

  /**
   * 确保 .gitignore 配置正确
   */
  async ensureGitignore(result?: InitializationResult): Promise<void> {
    const gitignorePath = path.join(this.docsPath, '.gitignore');
    const requiredEntry = 'current-task.md';

    if (!(await this.fileExists(gitignorePath))) {
      await this.writeFile(gitignorePath, requiredEntry + '\n');
      if (result) {
        result.created.push(gitignorePath);
      }
    } else {
      const content = await this.readFile(gitignorePath);
      if (!content.includes(requiredEntry)) {
        await this.appendFile(gitignorePath, '\n' + requiredEntry + '\n');
        if (result) {
          result.created.push(`${gitignorePath} (updated)`);
        }
      } else {
        if (result) {
          result.existing.push(gitignorePath);
        }
      }
    }
  }

  /**
   * 确保模板文件存在
   */
  async ensureTemplates(result?: InitializationResult): Promise<void> {
    const templatePath = this.getTemplateFilePath();

    if (!(await this.fileExists(templatePath))) {
      // 确保模板目录存在
      await this.createDirectory(path.dirname(templatePath));

      // 尝试从项目内置模板复制
      const sourceTemplate = await this.findBuiltinTemplate();
      if (sourceTemplate) {
        await this.copyFile(sourceTemplate, templatePath);
        if (result) {
          result.created.push(templatePath);
        }
      } else {
        // 使用内置默认模板
        const defaultTemplate = this.getDefaultTemplateContent();
        await this.writeFile(templatePath, defaultTemplate);
        if (result) {
          result.created.push(`${templatePath} (default)`);
        }
      }
    } else {
      if (result) {
        result.existing.push(templatePath);
      }
    }
  }

  /**
   * 获取模板文件路径（支持环境变量覆盖）
   */
  private getTemplateFilePath(): string {
    const envTemplate = process.env.WF_DEVLOG_TEMPLATE;
    if (envTemplate) {
      // 如果是相对路径，相对于项目根目录解析
      if (!path.isAbsolute(envTemplate)) {
        return path.resolve(envTemplate);
      }
      return envTemplate;
    }

    // 默认路径
    return path.join(this.docsPath, 'templates', 'devlog-template.md');
  }

  /**
   * 查找内置模板文件
   */
  private async findBuiltinTemplate(): Promise<string | null> {
    // 按优先级顺序查找模板文件
    const templatePaths = [
      'docs/template/devlog-template.md', // 最高优先级
      'docs/templates/devlog-template.md', // 备选路径
      'templates/devlog-template.md', // 最后选择
    ];

    for (const templatePath of templatePaths) {
      if (await this.fileExists(templatePath)) {
        logger.info(LogCategory.Task, LogAction.Handle, '找到内置模板文件', {
          templatePath,
        });
        return templatePath;
      }
    }

    logger.info(
      LogCategory.Task,
      LogAction.Handle,
      '未找到内置模板文件，将使用默认模板'
    );
    return null;
  }

  /**
   * 获取默认模板内容
   */
  private getDefaultTemplateContent(): string {
    return `# 开发日志

## 任务信息

**任务标题**: {{title}}
**任务目标**: {{goal}}
**创建时间**: {{created_at}}
**完成时间**: {{completed_at}}

## 执行摘要

{{summary}}

## 主要变更

{{changes}}

## 遇到的问题

{{issues}}

## 解决方案

{{solutions}}

## 经验总结

{{lessons}}

## 后续计划

{{next_steps}}

---

*由 WaveForge MCP 任务管理系统自动生成*
`;
  }

  /**
   * 填充模板内容
   */
  fillTemplate(template: string, context: Record<string, any>): string {
    let filledTemplate = template;

    // 替换所有 {{key}} 格式的占位符
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{{${key}}}`;
      const replacement =
        value !== undefined && value !== null ? String(value) : '';
      filledTemplate = filledTemplate.replace(
        new RegExp(placeholder, 'g'),
        replacement
      );
    }

    // 处理未替换的占位符（设为空或默认值）
    filledTemplate = filledTemplate.replace(/\{\{[^}]+\}\}/g, '');

    return filledTemplate;
  }

  /**
   * 加载模板文件
   */
  async loadTemplate(templatePath?: string): Promise<string> {
    const actualTemplatePath = templatePath || this.getTemplateFilePath();

    try {
      if (await this.fileExists(actualTemplatePath)) {
        const content = await this.readFile(actualTemplatePath);
        logger.info(LogCategory.Task, LogAction.Handle, '模板文件加载成功', {
          templatePath: actualTemplatePath,
          contentLength: content.length,
        });
        return content;
      } else {
        logger.warning(
          LogCategory.Task,
          LogAction.Handle,
          '模板文件不存在，使用默认模板',
          {
            templatePath: actualTemplatePath,
          }
        );
        return this.getDefaultTemplateContent();
      }
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '模板文件加载失败', {
        templatePath: actualTemplatePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getDefaultTemplateContent();
    }
  }

  /**
   * 生成当前任务文档
   */
  async generateCurrentTaskDocument(task: CurrentTask): Promise<void> {
    const documentPath = path.join(this.docsPath, 'current-task.md');
    const content = this.renderTaskDocument(task);

    try {
      await this.writeFile(documentPath, content);
      logger.info(LogCategory.Task, LogAction.Create, '当前任务文档生成成功', {
        taskId: task.id,
        documentPath,
        contentLength: content.length,
      });
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Create, '当前任务文档生成失败', {
        taskId: task.id,
        documentPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新任务文档
   */
  async updateTaskDocument(task: CurrentTask): Promise<void> {
    await this.generateCurrentTaskDocument(task);
  }

  /**
   * 渲染任务文档内容
   */
  private renderTaskDocument(task: CurrentTask): string {
    const lines = [
      `# ${task.title}`,
      '',
      `> **任务ID**: ${task.id}`,
      `> **创建时间**: ${task.created_at}`,
      `> **更新时间**: ${task.updated_at}`,
      task.completed_at ? `> **完成时间**: ${task.completed_at}` : '',
      '',
      '## 验收标准',
      '',
      task.goal,
      '',
    ];

    // 添加任务级提示
    if (task.task_hints && task.task_hints.length > 0) {
      lines.push('## 任务提示');
      lines.push('');
      task.task_hints.forEach((hint) => {
        lines.push(`- ${hint}`);
      });
      lines.push('');
    }

    // 添加整体计划
    lines.push('## 整体计划');
    lines.push('');

    if (task.overall_plan && task.overall_plan.length > 0) {
      task.overall_plan.forEach((plan, index) => {
        const status = this.getStatusIcon(plan.status);
        const isCurrentPlan = plan.id === task.current_plan_id;
        const planTitle = isCurrentPlan
          ? `**${plan.description}** (当前)`
          : plan.description;

        lines.push(`${index + 1}. ${status} ${planTitle}`);

        // 添加计划级提示
        if (plan.hints && plan.hints.length > 0) {
          lines.push('   > 提示:');
          plan.hints.forEach((hint) => {
            lines.push(`   > - ${hint}`);
          });
        }

        // 添加步骤
        if (plan.steps && plan.steps.length > 0) {
          plan.steps.forEach((step) => {
            const stepStatus = this.getStatusIcon(step.status);
            lines.push(`   - ${stepStatus} ${step.description}`);

            // 添加步骤级提示
            if (step.hints && step.hints.length > 0) {
              lines.push('     > 提示:');
              step.hints.forEach((hint) => {
                lines.push(`     > - ${hint}`);
              });
            }

            // 添加证据和备注
            if (step.evidence) {
              lines.push(`     > 证据: ${step.evidence}`);
            }
            if (step.notes) {
              lines.push(`     > 备注: ${step.notes}`);
            }
          });
        }
        lines.push('');
      });
    } else {
      lines.push('暂无计划');
      lines.push('');
    }

    // 添加当前步骤详情
    if (task.current_step_details) {
      lines.push('## 当前步骤详情');
      lines.push('');
      lines.push(task.current_step_details);
      lines.push('');
    }

    // 添加关键日志（最近5条）
    if (task.logs && task.logs.length > 0) {
      lines.push('## 关键日志');
      lines.push('');
      const recentLogs = task.logs.slice(-5);
      recentLogs.forEach((log) => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        lines.push(`- **${timestamp}** [${log.level}] ${log.message}`);
        if (log.ai_notes) {
          lines.push(`  > ${log.ai_notes}`);
        }
      });
      lines.push('');
    }

    // 添加知识引用
    if (task.knowledge_refs && task.knowledge_refs.length > 0) {
      lines.push('## 知识引用');
      lines.push('');
      task.knowledge_refs.forEach((ref) => {
        lines.push(`- ${ref}`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*由 WaveForge MCP 任务管理系统自动生成*');

    return lines.filter((line) => line !== null).join('\n');
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔄';
      case 'blocked':
        return '🚫';
      case 'to_do':
      default:
        return '⏳';
    }
  }

  /**
   * 解析任务文档
   */
  parseTaskDocument(content: string): ParsedTaskDocument {
    const lines = content.split('\n');
    const result: ParsedTaskDocument = {
      title: '',
      goal: '',
      plans: [],
      hints: {
        task: [],
        plan: [],
        step: [],
      },
    };

    let currentSection = '';
    let currentPlan: any = null;
    let goalLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 解析标题
      if (line.startsWith('# ') && !result.title) {
        result.title = line.substring(2).trim();
        continue;
      }

      // 解析章节
      if (line.startsWith('## ')) {
        currentSection = line.substring(3).trim();

        // 保存之前收集的目标内容
        if (currentSection !== '验收标准' && goalLines.length > 0) {
          result.goal = goalLines.join('\n').trim();
          goalLines = [];
        }
        continue;
      }

      // 根据当前章节处理内容
      switch (currentSection) {
        case '验收标准':
          if (line && !line.startsWith('#') && !line.startsWith('>')) {
            goalLines.push(line);
          }
          break;

        case '任务提示':
          if (line.startsWith('- ')) {
            result.hints.task.push(line.substring(2).trim());
          }
          break;

        case '整体计划': {
          // 解析计划项 (格式: "1. 状态 计划描述")
          const planMatch = line.match(/^(\d+)\.\s*([✅🔄🚫⏳])\s*(.+)$/u);
          if (planMatch) {
            if (currentPlan) {
              result.plans.push(currentPlan);
            }

            const [, , statusIcon, description] = planMatch;
            currentPlan = {
              id: `plan-${result.plans.length + 1}`,
              description: description
                .replace(/\*\*(.*?)\*\*/, '$1')
                .replace(' (当前)', '')
                .trim(),
              status: this.parseStatusFromIcon(statusIcon),
              steps: [],
            };
          }

          // 解析步骤项 (格式: "   - 状态 步骤描述")
          const stepMatch = line.match(/^\s{3}-\s*([✅🔄🚫⏳])\s*(.+)$/u);
          if (stepMatch && currentPlan) {
            const [, statusIcon, description] = stepMatch;
            currentPlan.steps.push({
              id: `step-${currentPlan.steps.length + 1}`,
              description: description.trim(),
              status: this.parseStatusFromIcon(statusIcon),
            });
          }
          break;
        }
      }
    }

    // 保存最后的计划
    if (currentPlan) {
      result.plans.push(currentPlan);
    }

    // 保存最后的目标内容
    if (goalLines.length > 0) {
      result.goal = goalLines.join('\n').trim();
    }

    return result;
  }

  /**
   * 从状态图标解析状态
   */
  private parseStatusFromIcon(icon: string): string {
    switch (icon) {
      case '✅':
        return 'completed';
      case '🔄':
        return 'in_progress';
      case '🚫':
        return 'blocked';
      case '⏳':
      default:
        return 'to_do';
    }
  }

  /**
   * 解析提示信息
   */
  parseHints(line: string): string[] {
    const hints: string[] = [];

    // 解析单行提示 (格式: "- 提示内容")
    if (line.trim().startsWith('- ')) {
      hints.push(line.trim().substring(2).trim());
      return hints;
    }

    // 解析引用格式的提示 (格式: "> - 提示内容")
    if (line.trim().startsWith('> - ')) {
      hints.push(line.trim().substring(4).trim());
      return hints;
    }

    // 解析多级引用格式的提示 (格式: "     > - 提示内容")
    const deepHintMatch = line.match(/^\s*>\s*-\s*(.+)$/);
    if (deepHintMatch) {
      hints.push(deepHintMatch[1].trim());
      return hints;
    }

    // 解析逗号分隔的提示
    if (line.includes(',')) {
      const parts = line.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
          hints.push(trimmed);
        }
      }
      return hints;
    }

    // 如果不匹配任何格式，但内容不为空，则作为单个提示
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('>')) {
      hints.push(trimmed);
    }

    return hints;
  }

  /**
   * 从文档内容中提取所有提示信息
   */
  extractAllHints(content: string): {
    task: string[];
    plan: string[];
    step: string[];
  } {
    const lines = content.split('\n');
    const hints = {
      task: [] as string[],
      plan: [] as string[],
      step: [] as string[],
    };

    let currentContext = 'task';
    let inPlanSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // 检测章节
      if (trimmed.startsWith('## 任务提示')) {
        currentContext = 'task';
        inPlanSection = false;
        continue;
      }

      if (trimmed.startsWith('## 整体计划')) {
        inPlanSection = true;
        continue;
      }

      // 检测计划项
      if (inPlanSection && trimmed.match(/^\d+\.\s*[✅🔄🚫⏳]/u)) {
        currentContext = 'plan';
        continue;
      }

      // 检测步骤项
      if (inPlanSection && trimmed.match(/^\s*-\s*[✅🔄🚫⏳]/u)) {
        currentContext = 'step';
        continue;
      }

      // 解析提示
      if (
        trimmed.startsWith('> 提示:') ||
        trimmed.startsWith('   > 提示:') ||
        trimmed.startsWith('     > 提示:')
      ) {
        continue; // 跳过提示标题行
      }

      // 提取提示内容
      if (
        trimmed.startsWith('> - ') ||
        trimmed.startsWith('   > - ') ||
        trimmed.startsWith('     > - ')
      ) {
        const lineHints = this.parseHints(line);
        if (lineHints.length > 0) {
          const contextKey = currentContext as keyof typeof hints;
          hints[contextKey].push(...lineHints);
        }
      } else if (currentContext === 'task' && trimmed.startsWith('- ')) {
        // 任务级提示
        const lineHints = this.parseHints(line);
        if (lineHints.length > 0) {
          const contextKey = currentContext as keyof typeof hints;
          hints[contextKey].push(...lineHints);
        }
      }
    }

    return hints;
  }

  /**
   * 生成初始面板内容
   */
  private generateInitialPanelContent(): string {
    return `# 当前任务

> 这是 WaveForge 任务管理系统的当前任务面板
> 此文件会自动更新，您可以手动编辑添加备注

## 状态

暂无活跃任务

## 说明

- 此文件位于 \`.wave/current-task.md\`
- 默认被 \`.wave/.gitignore\` 忽略，不会提交到版本控制
- 当有活跃任务时，此文件会自动更新显示任务状态
- 您可以手动编辑此文件添加个人备注

---

*由 WaveForge MCP 任务管理系统自动生成*
`;
  }
}
