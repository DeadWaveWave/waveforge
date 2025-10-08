/**
 * PanelParser - 面板解析器
 * 负责将 Markdown 格式的任务面板解析为结构化数据
 * 支持容错解析、稳定锚点识别和序号路径回退机制
 */

import { ulid } from 'ulid';
import { logger } from './logger.js';
import { ParseError } from './error-handler.js';
import {
  LogLevel,
  LogCategory,
  LogAction,
  CheckboxState,
  EVRStatus,
  EVRClass,
  PanelSection,
  type ParsedPanel,
  type ParsedPlan,
  type ParsedStep,
  type ParsedEVR,
  type ParsedLog,
  type PanelMetadata,
  type PanelParseError,
  type ToleranceFix,
  type PanelParseOptions,
  type AnchorMatch,
  type NumberPathMatch,
  type ContextTag,
} from '../types/index.js';

/**
 * 默认解析选项
 */
const DEFAULT_PARSE_OPTIONS: PanelParseOptions = {
  enableTolerance: true,
  generateMissingAnchors: true,
  normalizeCheckboxes: true,
  fixIndentation: true,
  maxToleranceFixes: 50,
  parserVersion: '1.0.0',
};

/**
 * 面板解析器类
 */
export class PanelParser {
  private readonly options: PanelParseOptions;
  private parseErrors: PanelParseError[] = [];
  private toleranceFixes: ToleranceFix[] = [];

  constructor(options?: Partial<PanelParseOptions>) {
    this.options = { ...DEFAULT_PARSE_OPTIONS, ...options };
  }

  /**
   * 解析 Markdown 内容为结构化面板数据
   */
  parseMarkdown(content: string): ParsedPanel {
    this.resetParseState();

    try {
      // 提前解析 Front Matter（若存在）
      let fmVersion: string | undefined;
      let fmLastModified: string | undefined;
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
      if (fmMatch) {
        const yaml = fmMatch[1];
        for (const rawLine of yaml.split('\n')) {
          const line = rawLine.trim();
          if (!line) continue;
          const idx = line.indexOf(':');
          if (idx > 0) {
            const key = line.substring(0, idx).trim();
            const val = line.substring(idx + 1).trim();
            if (key === 'md_version' || key === 'version') {
              fmVersion = val;
            } else if (key === 'last_modified') {
              fmLastModified = val;
            }
          }
        }
        // 去除 front matter 内容再进入预处理
        content = content.substring(fmMatch[0].length);
      }

      const lines = this.preprocessContent(content);
      const sections = this.identifySections(lines);

      const panel: ParsedPanel = {
        title: this.extractTitle(sections),
        requirements: this.extractRequirements(sections),
        issues: this.extractIssues(sections),
        hints: this.extractHints(sections),
        plans: this.extractPlans(sections),
        evrs: this.extractEVRs(sections),
        logs: this.extractLogs(sections),
        metadata: this.generateMetadata(),
      };

      // 合并 Front Matter 元数据
      if (fmVersion) {
        panel.metadata.version = fmVersion;
      }
      if ((panel.metadata as any)) {
        (panel.metadata as any).lastModified = fmLastModified;
      }

      // 更新元数据统计
      panel.metadata.stats.totalPlans = panel.plans.length;
      panel.metadata.stats.totalSteps = panel.plans.reduce(
        (sum, plan) => sum + plan.steps.length,
        0
      );
      panel.metadata.stats.totalEVRs = panel.evrs.length;

      logger.info(LogCategory.Task, LogAction.Handle, '面板解析完成', {
        totalPlans: panel.plans.length,
        totalSteps: panel.plans.reduce(
          (sum, plan) => sum + plan.steps.length,
          0
        ),
        totalEVRs: panel.evrs.length,
        parseErrors: this.parseErrors.length,
        toleranceFixes: this.toleranceFixes.length,
      });

      return panel;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '面板解析失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ParseError('面板解析失败', {
        originalError: error,
        parseErrors: this.parseErrors,
      });
    }
  }

  /**
   * 容错解析 - 支持各种格式变体和错误恢复
   */
  parseWithTolerance(content: string): ParsedPanel {
    const tolerantOptions = {
      ...this.options,
      enableTolerance: true,
      generateMissingAnchors: true,
      normalizeCheckboxes: true,
      fixIndentation: true,
    };

    const parser = new PanelParser(tolerantOptions);
    return parser.parseMarkdown(content);
  }

  /**
   * 提取计划列表
   */
  extractPlans(sections: Map<PanelSection, string[]>): ParsedPlan[] {
    const planLines = sections.get(PanelSection.Plans) || [];
    const plans: ParsedPlan[] = [];

    // 预先分析所有锚点和序号路径
    const anchors = this.findAllAnchors(planLines);
    const numberPaths = this.findAllNumberPaths(planLines);

    // 验证锚点唯一性
    this.validateAnchorUniqueness(anchors);

    let currentPlan: ParsedPlan | null = null;
    let currentIndentLevel = 0;

    for (let i = 0; i < planLines.length; i++) {
      const line = planLines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine) continue;

      const indentLevel = this.getIndentLevel(line);
      const checkboxMatch = this.parseCheckboxLine(trimmedLine);

      if (checkboxMatch && (indentLevel === 0 || !currentPlan)) {
        // 这是一个新的计划
        if (currentPlan) {
          plans.push(currentPlan);
        }

        currentPlan = this.createParsedPlanWithStableId(
          checkboxMatch,
          i + 1,
          anchors,
          numberPaths,
          line
        );
        currentIndentLevel = indentLevel;
      } else if (currentPlan && checkboxMatch && indentLevel > 0) {
        // 检查缩进级别限制 - 在容错模式下更宽松
        const hasIndentFixes = this.toleranceFixes.some(
          (fix) => fix.type === 'fix_indentation'
        );
        // 检查是否有深层嵌套转换为注释的修复
        const hasDeepNestingFixes = this.toleranceFixes.some(
          (fix) =>
            fix.type === 'fix_indentation' &&
            fix.description.includes('深层嵌套')
        );

        // 如果有深层嵌套修复，说明原始内容有真正的深层嵌套，应该更严格
        const maxIndentLevel =
          this.options.enableTolerance && hasIndentFixes && !hasDeepNestingFixes
            ? 2
            : 1;

        if (indentLevel > maxIndentLevel) {
          // 超过最大缩进级别，跳过或转换为提示
          continue;
        }

        // 这是当前计划的一个步骤
        const step = this.createParsedStepWithStableId(
          checkboxMatch,
          i + 1,
          anchors,
          numberPaths,
          line
        );
        currentPlan.steps.push(step);
      } else if (currentPlan && trimmedLine.startsWith('>')) {
        // 这是提示信息
        const hint = trimmedLine.substring(1).trim();
        // 判断提示属于计划级还是步骤级
        // 计划级提示：缩进级别 <= 计划缩进级别 + 1
        // 步骤级提示：缩进级别 > 计划缩进级别 + 1
        if (indentLevel <= currentIndentLevel + 1) {
          currentPlan.hints.push(hint);
        } else if (currentPlan.steps.length > 0) {
          const lastStep = currentPlan.steps[currentPlan.steps.length - 1];
          lastStep.hints.push(hint);
        }
      } else if (currentPlan && trimmedLine.startsWith('- [')) {
        // 这是标签化条目
        const tag = this.parseContextTag(trimmedLine);
        if (tag) {
          // 判断标签属于计划级还是步骤级
          // 计划级标签：缩进级别 <= 计划缩进级别 + 1
          // 步骤级标签：缩进级别 > 计划缩进级别 + 1
          if (indentLevel <= currentIndentLevel + 1) {
            currentPlan.contextTags.push(tag);
            if (tag.type === 'evr') {
              currentPlan.evrBindings.push(tag.value);
            }
          } else if (currentPlan.steps.length > 0) {
            const lastStep = currentPlan.steps[currentPlan.steps.length - 1];
            lastStep.contextTags.push(tag);
            if (tag.type === 'uses_evr') {
              lastStep.usesEVR.push(tag.value);
            }
          }
        }
      }
    }

    if (currentPlan) {
      plans.push(currentPlan);
    }

    return plans;
  }

  /**
   * 提取 EVR 列表
   */
  extractEVRs(sections: Map<PanelSection, string[]>): ParsedEVR[] {
    const evrLines = sections.get(PanelSection.EVRs) || [];
    const evrs: ParsedEVR[] = [];

    let currentEVR: ParsedEVR | null = null;
    let currentField: 'verify' | 'expect' | null = null;
    let fieldContent: string[] = [];

    for (let i = 0; i < evrLines.length; i++) {
      const line = evrLines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine) continue;

      // 检查是否是新的 EVR 开始
      // 格式：1. [ ] EVR 标题 <!-- evr:evr-id -->
      const evrMatch = trimmedLine.match(
        /^\d+\.\s*\[([x!\- ])\]\s+(.+?)(?:\s+<!-- evr:(.+?) -->)?$/
      );
      if (evrMatch) {
        // 保存前一个 EVR
        if (currentEVR) {
          this.finalizeEVRField(currentEVR, currentField, fieldContent);
          evrs.push(currentEVR);
        }

        // 创建新的 EVR
        const [, checkboxChar, title, anchor] = evrMatch;
        const evrStatus = this.parseEVRStatusFromCheckbox(checkboxChar);

        currentEVR = {
          id: anchor || `evr-${ulid()}`,
          title,
          verify: '',
          expect: '',
          status: evrStatus,
          runs: [],
          anchor,
        };
        currentField = null;
        fieldContent = [];
        continue;
      }

      if (!currentEVR) continue;

      // 解析 EVR 字段 - 只支持标签化条目格式
      const taggedItemMatch = trimmedLine.match(/^-\s*\[([^\]]+)\]\s*(.*)$/);
      if (taggedItemMatch) {
        const [, tag, content] = taggedItemMatch;
        const tagLower = tag.toLowerCase();

        if (tagLower === 'verify' || tagLower === '验证') {
          // 如果已经在收集 verify 字段，继续累积
          if (currentField === 'verify') {
            if (content) fieldContent.push(content);
          } else {
            // 结束前一个字段，开始新的 verify 字段
            this.finalizeEVRField(currentEVR, currentField, fieldContent);
            currentField = 'verify';
            fieldContent = [];
            if (content) fieldContent.push(content);
          }
        } else if (tagLower === 'expect' || tagLower === '预期') {
          // 如果已经在收集 expect 字段，继续累积
          if (currentField === 'expect') {
            if (content) fieldContent.push(content);
          } else {
            // 结束前一个字段，开始新的 expect 字段
            this.finalizeEVRField(currentEVR, currentField, fieldContent);
            currentField = 'expect';
            fieldContent = [];
            if (content) fieldContent.push(content);
          }
        } else if (tagLower === 'status' || tagLower === '状态') {
          this.finalizeEVRField(currentEVR, currentField, fieldContent);
          currentField = null;
          currentEVR.status = this.parseEVRStatus(content);
        } else if (tagLower === 'class' || tagLower === '类别') {
          currentEVR.class = this.parseEVRClass(content);
        } else if (tagLower === 'last_run' || tagLower === 'lastrun' || tagLower === '最后运行') {
          currentEVR.lastRun = content;
        } else if (tagLower === 'notes' || tagLower === '备注') {
          currentEVR.notes = content;
        } else if (tagLower === 'proof' || tagLower === '证据') {
          currentEVR.proof = content;
        }
        continue;
      }

      // 继续当前字段的多行内容
      if (currentField) {
        fieldContent.push(trimmedLine);
      }
    }

    // 保存最后一个 EVR
    if (currentEVR) {
      this.finalizeEVRField(currentEVR, currentField, fieldContent);
      evrs.push(currentEVR);
    }

    return evrs;
  }

  /**
   * 提取提示列表
   */
  extractHints(sections: Map<PanelSection, string[]>): string[] {
    const hintLines = sections.get(PanelSection.Hints) || [];
    const hints: string[] = [];

    for (const line of hintLines) {
      const trimmedLine = line.trim();

      // 跳过空行和 HTML 注释
      if (!trimmedLine || trimmedLine.startsWith('<!--')) {
        continue;
      }

      if (trimmedLine.startsWith('>')) {
        const content = trimmedLine.substring(1).trim();
        // 再次检查提取的内容不是 HTML 注释
        if (content && !content.startsWith('<!--')) {
          hints.push(content);
        }
      } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        hints.push(trimmedLine.replace(/^[-*]\s*/, ''));
      } else {
        hints.push(trimmedLine);
      }
    }

    return hints;
  }

  /**
   * 提取日志列表
   */
  extractLogs(sections: Map<PanelSection, string[]>): ParsedLog[] {
    const logLines = sections.get(PanelSection.Logs) || [];
    const logs: ParsedLog[] = [];

    for (const line of logLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 解析日志格式：- **时间戳** [级别] 消息
      const logMatch = trimmedLine.match(
        /^-\s*\*\*(.+?)\*\*\s*\[(.+?)\]\s*(.+)$/
      );
      if (logMatch) {
        const [, timestamp, level, message] = logMatch;

        logs.push({
          timestamp: new Date(timestamp).toISOString(),
          level: this.parseLogLevel(level),
          category: LogCategory.Task,
          action: LogAction.Handle,
          message: message.trim(),
        });
      }
    }

    return logs;
  }

  // 私有辅助方法

  /**
   * 重置解析状态
   */
  private resetParseState(): void {
    this.parseErrors = [];
    this.toleranceFixes = [];
  }

  /**
   * 预处理内容 - 应用容错修复
   */
  private preprocessContent(content: string): string[] {
    let lines = content.split('\n');

    if (this.options.enableTolerance) {
      lines = this.applyToleranceFixes(lines);
    }

    return lines;
  }

  /**
   * 应用容错修复
   */
  private applyToleranceFixes(lines: string[]): string[] {
    let fixedLines = [...lines];

    // 1. 修复空行缺失问题
    fixedLines = this.fixMissingBlankLines(fixedLines);

    // 2. 标准化复选框格式
    if (this.options.normalizeCheckboxes) {
      for (let i = 0; i < fixedLines.length; i++) {
        const line = fixedLines[i];
        const normalizedLine = this.normalizeCheckboxes(line);
        if (normalizedLine !== line) {
          fixedLines[i] = normalizedLine;
        }
      }
    }

    // 3. 修复缩进问题
    if (this.options.fixIndentation) {
      fixedLines = this.fixIndentation(fixedLines);
    }

    // 4. 修复格式错误的区域标题
    fixedLines = this.fixMalformedSections(fixedLines);

    // 5. 生成缺失的锚点
    if (this.options.generateMissingAnchors) {
      fixedLines = this.generateMissingAnchors(fixedLines);
    }

    return fixedLines;
  }

  /**
   * 修复空行缺失问题
   */
  private fixMissingBlankLines(lines: string[]): string[] {
    const fixedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      fixedLines.push(line);

      // 在区域标题后添加空行
      if (trimmedLine.startsWith('#') && i < lines.length - 1) {
        const nextLine = lines[i + 1];
        if (nextLine.trim() !== '') {
          fixedLines.push('');
          this.addToleranceFix(
            'add_missing_line',
            '在区域标题后添加空行',
            i + 1,
            '',
            '空行'
          );
        }
      }

      // 在计划之间添加空行
      if (this.isTopLevelPlan(trimmedLine) && i < lines.length - 1) {
        const nextLine = lines[i + 1];
        if (this.isTopLevelPlan(nextLine.trim()) && nextLine.trim() !== '') {
          fixedLines.push('');
          this.addToleranceFix(
            'add_missing_line',
            '在计划之间添加空行',
            i + 1,
            '',
            '空行'
          );
        }
      }
    }

    return fixedLines;
  }

  /**
   * 修复格式错误的区域标题
   */
  private fixMalformedSections(lines: string[]): string[] {
    const fixedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 检测可能的区域标题（缺少 # 符号）
      if (
        this.isPotentialSectionTitle(trimmedLine) &&
        !trimmedLine.startsWith('#')
      ) {
        const fixedLine = `## ${trimmedLine}`;
        fixedLines.push(fixedLine);
        this.addToleranceFix(
          'fix_indentation',
          '修复区域标题格式',
          i + 1,
          line,
          fixedLine
        );
      } else {
        fixedLines.push(line);
      }
    }

    return fixedLines;
  }

  /**
   * 判断是否是顶级计划
   */
  private isTopLevelPlan(line: string): boolean {
    // 匹配 "1. [x] 计划内容" 格式
    return /^\d+\.\s*\[[ x!-]\]/.test(line);
  }

  /**
   * 判断是否是潜在的区域标题
   * 更严格的判断：只有当行内容主要是关键词时才认为是标题
   */
  private isPotentialSectionTitle(line: string): boolean {
    const sectionKeywords = [
      '验收标准',
      'requirements',
      '需求',
      '问题',
      'issues',
      'issue',
      '提示',
      'hints',
      'hint',
      '计划',
      'plans',
      'plan',
      '整体计划',
      'evr',
      '预期结果',
      '预期可见结果',
      '日志',
      'logs',
      'log',
      '关键日志',
    ];

    const trimmedLine = line.trim();
    const lowerLine = trimmedLine.toLowerCase();

    // 排除明显的内容行
    if (
      trimmedLine.startsWith('-') ||
      trimmedLine.startsWith('*') ||
      trimmedLine.startsWith('>') ||
      trimmedLine.startsWith('[') ||
      /^\d+\./.test(trimmedLine) // 排除编号列表
    ) {
      return false;
    }

    // 更严格的判断：
    // 1. 行长度不能太长（标题通常比较短）
    if (trimmedLine.length > 20) {
      return false;
    }

    // 2. 必须完全匹配关键词或者非常接近
    return sectionKeywords.some((keyword) => {
      const lowerKeyword = keyword.toLowerCase();
      return (
        lowerLine === lowerKeyword ||
        (lowerLine.startsWith(lowerKeyword) &&
          trimmedLine.length <= keyword.length + 3)
      );
    });
  }

  /**
   * 标准化复选框格式 - 支持更多变体
   */
  private normalizeCheckboxes(line: string): string {
    let normalizedLine = line;

    // 进行中状态的各种变体
    const inProgressVariants = /\[[-~\\|/]\]/g;
    if (inProgressVariants.test(line)) {
      normalizedLine = normalizedLine.replace(inProgressVariants, '[-]');
      this.addToleranceFix(
        'normalize_checkbox',
        '标准化进行中状态复选框',
        undefined,
        line.match(inProgressVariants)?.[0],
        '[-]'
      );
    }

    // 完成状态的各种变体
    const completedVariants = /\[[xX✓✔√]\]/g;
    if (completedVariants.test(line)) {
      normalizedLine = normalizedLine.replace(completedVariants, '[x]');
      this.addToleranceFix(
        'normalize_checkbox',
        '标准化完成状态复选框',
        undefined,
        line.match(completedVariants)?.[0],
        '[x]'
      );
    }

    // 阻塞状态的各种变体
    const blockedVariants = /\[[!✗✘×]\]/g;
    if (blockedVariants.test(line)) {
      normalizedLine = normalizedLine.replace(blockedVariants, '[!]');
      this.addToleranceFix(
        'normalize_checkbox',
        '标准化阻塞状态复选框',
        undefined,
        line.match(blockedVariants)?.[0],
        '[!]'
      );
    }

    // 待办状态的各种变体（包括全角空格）
    const todoVariants = /\[[\s\u3000]\]/g;
    if (todoVariants.test(line)) {
      normalizedLine = normalizedLine.replace(todoVariants, '[ ]');
      this.addToleranceFix(
        'normalize_checkbox',
        '标准化待办状态复选框',
        undefined,
        line.match(todoVariants)?.[0],
        '[ ]'
      );
    }

    return normalizedLine;
  }

  /**
   * 修复缩进问题 - 支持 2-4 空格和制表符的混合缩进
   */
  private fixIndentation(lines: string[]): string[] {
    const fixedLines: string[] = [];
    const indentPatterns = this.analyzeIndentPatterns(lines);

    // 分析是否存在真正的层级嵌套结构
    const hasHierarchicalNesting = this.detectHierarchicalNesting(lines);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line.trim()) {
        fixedLines.push(line);
        continue;
      }

      // 检测并修复不一致的缩进
      const indentMatch = line.match(/^(\s+)/);
      if (indentMatch) {
        const originalIndent = indentMatch[1];
        const originalIndentLevel = Math.floor(
          originalIndent.replace(/\t/g, '  ').length / 2
        );

        // 检查是否是复选框行且缩进过深
        const trimmedLine = line.trim();
        const isCheckboxLine = trimmedLine.match(
          /^(?:[-*]\s*\[|(?:\d+(?:\.\d+)*\.?\s*\[))/
        );

        // 如果检测到层级嵌套结构，使用更严格的阈值
        const threshold = hasHierarchicalNesting ? 1 : 2;

        if (isCheckboxLine && originalIndentLevel > threshold) {
          // 将深层嵌套的复选框转换为注释
          const commentLine = `<!-- 深层嵌套项目: ${trimmedLine} -->`;
          this.addToleranceFix(
            'fix_indentation',
            `将深层嵌套项目转换为注释: 级别 ${originalIndentLevel}`,
            i + 1,
            line,
            commentLine
          );
          fixedLines.push(commentLine);
        } else {
          const normalizedIndent = this.normalizeIndent(
            originalIndent,
            indentPatterns
          );
          const fixedLine = normalizedIndent + line.trim();

          if (fixedLine !== line) {
            this.addToleranceFix(
              'fix_indentation',
              `修复缩进格式: ${originalIndent.length} 字符 -> ${normalizedIndent.length} 字符`,
              i + 1,
              line,
              fixedLine
            );
            fixedLines.push(fixedLine);
          } else {
            fixedLines.push(line);
          }
        }
      } else {
        fixedLines.push(line);
      }
    }

    return fixedLines;
  }

  /**
   * 检测是否存在层级嵌套结构
   */
  private detectHierarchicalNesting(lines: string[]): boolean {
    const checkboxLines: { line: number; indentLevel: number }[] = [];

    // 收集所有复选框行的缩进级别
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const isCheckboxLine = trimmedLine.match(
        /^(?:[-*]\s*\[|(?:\d+(?:\.\d+)*\.?\s*\[))/
      );

      if (isCheckboxLine) {
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const indentLevel = Math.floor(indent.replace(/\t/g, '  ').length / 2);
        checkboxLines.push({ line: i, indentLevel });
      }
    }

    // 检查是否存在连续递增的层级结构
    for (let i = 1; i < checkboxLines.length; i++) {
      const prev = checkboxLines[i - 1];
      const curr = checkboxLines[i];

      // 如果当前行的缩进级别比前一行高2级或以上，且存在3级或以上的缩进
      if (curr.indentLevel >= prev.indentLevel + 1 && curr.indentLevel >= 2) {
        // 检查是否有更深的层级
        for (let j = i + 1; j < checkboxLines.length; j++) {
          if (checkboxLines[j].indentLevel > curr.indentLevel) {
            return true; // 发现了真正的层级嵌套结构
          }
        }
      }
    }

    return false;
  }

  /**
   * 分析缩进模式
   */
  private analyzeIndentPatterns(lines: string[]): {
    spaceUnit: number;
    hasTab: boolean;
  } {
    const indentSizes: number[] = [];
    let hasTab = false;

    for (const line of lines) {
      const indentMatch = line.match(/^(\s+)/);
      if (indentMatch) {
        const indent = indentMatch[1];
        if (indent.includes('\t')) {
          hasTab = true;
        }
        // 将制表符转换为空格来计算
        const spaceCount = indent.replace(/\t/g, '  ').length;
        if (spaceCount > 0) {
          indentSizes.push(spaceCount);
        }
      }
    }

    // 分析最常见的缩进单位
    const indentCounts = new Map<number, number>();
    for (const size of indentSizes) {
      for (let unit = 2; unit <= 4; unit++) {
        if (size % unit === 0) {
          indentCounts.set(unit, (indentCounts.get(unit) || 0) + 1);
        }
      }
    }

    // 选择最常见的缩进单位，默认为 2
    let spaceUnit = 2;
    let maxCount = 0;
    for (const [unit, count] of indentCounts) {
      if (count > maxCount) {
        maxCount = count;
        spaceUnit = unit;
      }
    }

    return { spaceUnit, hasTab };
  }

  /**
   * 标准化缩进
   */
  private normalizeIndent(
    originalIndent: string,
    patterns: { spaceUnit: number; hasTab: boolean }
  ): string {
    // 将制表符转换为空格
    const spaceIndent = originalIndent.replace(/\t/g, '  ');
    const spaceCount = spaceIndent.length;

    // 计算应该的缩进级别
    const level = Math.floor(spaceCount / patterns.spaceUnit);

    // 使用标准的 2 空格缩进
    return '  '.repeat(level);
  }

  /**
   * 生成缺失的锚点 - 更智能的锚点生成策略
   */
  private generateMissingAnchors(lines: string[]): string[] {
    const fixedLines: string[] = [];
    const existingAnchors = new Set<string>();

    // 首先收集已存在的锚点
    for (const line of lines) {
      const planAnchor = line.match(/<!--\s*plan:(.+?)\s*-->/);
      const stepAnchor = line.match(/<!--\s*step:(.+?)\s*-->/);
      const evrAnchor = line.match(/<!--\s*evr:(.+?)\s*-->/);

      if (planAnchor) existingAnchors.add(planAnchor[1]);
      if (stepAnchor) existingAnchors.add(stepAnchor[1]);
      if (evrAnchor) existingAnchors.add(evrAnchor[1]);
    }

    let planCounter = 1;
    let stepCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      fixedLines.push(line);

      // 检查是否是计划或步骤行，且缺少锚点
      const checkboxMatch = this.parseCheckboxLine(trimmedLine);
      if (checkboxMatch && !line.includes('<!--')) {
        const indentLevel = this.getIndentLevel(line);

        // 检查缩进级别限制
        if (indentLevel > 1) {
          // 超过最大缩进级别，跳过锚点生成
          continue;
        }

        const numberPath = this.extractNumberPath(trimmedLine);

        let anchorType: string;
        let anchorId: string;

        if (indentLevel === 0) {
          // 这是计划
          anchorType = 'plan';
          if (numberPath) {
            anchorId = `plan-${numberPath}`;
          } else {
            anchorId = `plan-${planCounter}`;
            planCounter++;
          }
        } else {
          // 这是步骤
          anchorType = 'step';
          if (numberPath) {
            anchorId = `step-${numberPath}`;
          } else {
            anchorId = `step-${stepCounter}`;
            stepCounter++;
          }
        }

        // 确保 ID 唯一
        let finalId = anchorId;
        let suffix = 1;
        while (existingAnchors.has(finalId)) {
          finalId = `${anchorId}-${suffix}`;
          suffix++;
        }

        existingAnchors.add(finalId);

        const anchorComment = `<!-- ${anchorType}:${finalId} -->`;
        const indentStr = ' '.repeat(this.getIndentLevel(line));

        fixedLines.push(indentStr + anchorComment);
        this.addToleranceFix(
          'generate_anchor',
          `生成缺失的${anchorType}锚点: ${finalId}`,
          i + 1,
          '',
          anchorComment
        );
      }

      // EVR 现在使用列表项格式，不再需要为 ### 标题生成锚点
    }

    return fixedLines;
  }

  /**
   * 识别文档区域
   */
  private identifySections(lines: string[]): Map<PanelSection, string[]> {
    const sections = new Map<PanelSection, string[]>();
    let currentSection: PanelSection | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 识别区域标题
      if (trimmedLine.startsWith('#')) {
        const sectionTitle = trimmedLine.replace(/^#+\s*/, '').toLowerCase();

        if (trimmedLine.startsWith('# ')) {
          // 这是一级标题，去掉 "Task: " 前缀（如果有）
          let title = trimmedLine.substring(2);
          if (title.startsWith('Task: ')) {
            title = title.substring(6);
          }
          sections.set(PanelSection.Title, [title]);
          currentSection = null;
        } else if (
          sectionTitle.includes('验收标准') ||
          sectionTitle.includes('requirements') ||
          sectionTitle.includes('需求')
        ) {
          currentSection = PanelSection.Requirements;
        } else if (
          sectionTitle.includes('问题') ||
          sectionTitle.includes('issues')
        ) {
          currentSection = PanelSection.Issues;
        } else if (
          sectionTitle.includes('提示') ||
          sectionTitle.includes('hints')
        ) {
          currentSection = PanelSection.Hints;
        } else if (
          sectionTitle.includes('计划') ||
          sectionTitle.includes('plans') ||
          sectionTitle.includes('整体计划') ||
          sectionTitle.includes('plans & steps')
        ) {
          currentSection = PanelSection.Plans;
        } else if (
          sectionTitle.includes('evr') ||
          sectionTitle.includes('预期结果') ||
          sectionTitle.includes('expected visible results')
        ) {
          currentSection = PanelSection.EVRs;
        } else if (
          sectionTitle.includes('日志') ||
          sectionTitle.includes('logs')
        ) {
          currentSection = PanelSection.Logs;
        } else {
          // 其他标题，不改变当前区域
        }

        // 如果识别到新区域，确保区域存在
        if (currentSection && !sections.has(currentSection)) {
          sections.set(currentSection, []);
        }

        // 跳过一级和二级标题（区域标题）
        // EVR 现在使用列表项格式，不再使用 ### 标题
        if (
          trimmedLine.startsWith('# ') ||
          trimmedLine.startsWith('## ')
        ) {
          continue;
        }
      }

      // 将行添加到当前区域
      if (currentSection) {
        sections.get(currentSection)!.push(line);
      }
    }

    return sections;
  }

  /**
   * 提取标题
   */
  private extractTitle(sections: Map<PanelSection, string[]>): string {
    const titleLines = sections.get(PanelSection.Title);
    return titleLines && titleLines.length > 0 ? titleLines[0] : '未命名任务';
  }

  /**
   * 提取需求列表
   */
  private extractRequirements(sections: Map<PanelSection, string[]>): string[] {
    const reqLines = sections.get(PanelSection.Requirements) || [];
    const requirements: string[] = [];

    for (const line of reqLines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          requirements.push(trimmedLine.replace(/^[-*]\s*/, ''));
        } else {
          requirements.push(trimmedLine);
        }
      }
    }

    return requirements;
  }

  /**
   * 提取问题列表
   */
  private extractIssues(sections: Map<PanelSection, string[]>): string[] {
    const issueLines = sections.get(PanelSection.Issues) || [];
    const issues: string[] = [];

    for (const line of issueLines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          issues.push(trimmedLine.replace(/^[-*]\s*/, ''));
        } else {
          issues.push(trimmedLine);
        }
      }
    }

    return issues;
  }

  /**
   * 解析复选框行
   */
  private parseCheckboxLine(
    line: string
  ): { status: CheckboxState; text: string } | null {
    // 匹配各种复选框格式：1. [x] 文本 或 1.1. [x] 文本 或 - [x] 文本 或 [x] 文本
    const checkboxMatch = line.match(
      /^(?:(?:\d+(?:\.\d+)*\.?\s*)|(?:[-*]\s*))?(\[[ x!~\\|X✓✔√✗✘×/-]\])\s*(.+)$/
    );
    if (!checkboxMatch) return null;

    const [, checkbox, text] = checkboxMatch;
    const status = this.parseCheckboxState(checkbox);

    return { status, text: text.trim() };
  }

  /**
   * 解析复选框状态
   */
  private parseCheckboxState(checkbox: string): CheckboxState {
    const inner = checkbox.slice(1, -1); // 去掉 [ 和 ]

    // 完成状态
    if (['x', 'X', '✓', '✔', '√'].includes(inner)) {
      return CheckboxState.Completed;
    }

    // 进行中状态
    if (['-', '~', '/', '\\', '|'].includes(inner)) {
      return CheckboxState.InProgress;
    }

    // 阻塞状态
    if (['!', '✗', '✘', '×'].includes(inner)) {
      return CheckboxState.Blocked;
    }

    // 待办状态（包括空格和全角空格）
    return CheckboxState.ToDo;
  }

  /**
   * 创建解析的计划对象
   */
  private createParsedPlan(
    checkboxMatch: { status: CheckboxState; text: string },
    lineNumber: number
  ): ParsedPlan {
    const anchorMatch = checkboxMatch.text.match(/<!--\s*plan:(.+?)\s*-->/);
    const numberPath = this.extractNumberPath(checkboxMatch.text);

    // 稳定锚点优先，序号路径回退
    const id = this.generateStableId(
      'plan',
      anchorMatch?.[1],
      numberPath,
      lineNumber
    );
    const text = checkboxMatch.text.replace(/<!--.*?-->/, '').trim();

    return {
      id,
      text,
      status: checkboxMatch.status,
      hints: [],
      contextTags: [],
      evrBindings: [],
      steps: [],
      anchor: anchorMatch ? anchorMatch[1] : undefined,
      numberPath,
    };
  }

  /**
   * 使用稳定 ID 创建解析的计划对象
   */
  private createParsedPlanWithStableId(
    checkboxMatch: { status: CheckboxState; text: string },
    lineNumber: number,
    anchors: AnchorMatch[],
    numberPaths: NumberPathMatch[],
    originalLine?: string
  ): ParsedPlan {
    const anchorMatch = checkboxMatch.text.match(/<!--\s*plan:(.+?)\s*-->/);
    // 从原始行提取序号路径，如果没有原始行则从checkboxMatch.text提取
    const numberPath = originalLine
      ? this.extractNumberPath(originalLine.trim())
      : this.extractNumberPath(checkboxMatch.text);

    // 查找最佳匹配
    const bestMatch = this.findBestMatch(
      'plan',
      lineNumber,
      anchors,
      numberPaths
    );

    // 确定最终 ID
    let id: string;
    let finalAnchor: string | undefined;
    let finalNumberPath: string | undefined;

    // 总是尝试保留序号路径
    if (numberPath) {
      finalNumberPath = numberPath;
    } else if (bestMatch.numberPath) {
      finalNumberPath = bestMatch.numberPath.path;
    }

    // Debug: 记录 ID 生成过程
    if (process.env.NODE_ENV !== 'production') {
      logger.info(LogCategory.Task, LogAction.Handle, 'Plan ID生成调试', {
        line: checkboxMatch.text.substring(0, 50),
        anchorMatch: anchorMatch ? anchorMatch[1] : null,
        bestMatchAnchor: bestMatch.anchor?.id,
        numberPath,
        bestMatchNumberPath: bestMatch.numberPath?.path,
      });
    }

    if (anchorMatch) {
      // 直接使用行内锚点
      id = anchorMatch[1];
      finalAnchor = anchorMatch[1];
      logger.info(LogCategory.Task, LogAction.Handle, 'Plan ID: 使用行内锚点', {
        id,
        line: checkboxMatch.text.substring(0, 50),
      });
    } else if (bestMatch.anchor) {
      // 使用最佳匹配的锚点
      id = bestMatch.anchor.id;
      finalAnchor = bestMatch.anchor.id;
      logger.info(LogCategory.Task, LogAction.Handle, 'Plan ID: 使用最佳匹配锚点', {
        id,
        line: checkboxMatch.text.substring(0, 50),
      });
    } else if (numberPath) {
      // 使用行内序号路径
      id = `plan-${numberPath}`;
      logger.info(LogCategory.Task, LogAction.Handle, 'Plan ID: 使用行内序号路径', {
        id,
        numberPath,
        line: checkboxMatch.text.substring(0, 50),
      });
    } else if (bestMatch.numberPath) {
      // 使用最佳匹配的序号路径
      id = `plan-${bestMatch.numberPath.path}`;
      logger.info(LogCategory.Task, LogAction.Handle, 'Plan ID: 使用最佳匹配序号路径', {
        id,
        path: bestMatch.numberPath.path,
        line: checkboxMatch.text.substring(0, 50),
      });
    } else {
      // 最后回退到生成 ID
      id = this.generateStableId('plan', undefined, undefined, lineNumber);
      logger.info(LogCategory.Task, LogAction.Handle, 'Plan ID: 生成新ID', {
        id,
        line: checkboxMatch.text.substring(0, 50),
      });
    }

    const text = checkboxMatch.text.replace(/<!--.*?-->/g, '').trim();

    return {
      id,
      text,
      status: checkboxMatch.status,
      hints: [],
      contextTags: [],
      evrBindings: [],
      steps: [],
      anchor: finalAnchor,
      numberPath: finalNumberPath,
    };
  }

  /**
   * 创建解析的步骤对象
   */
  private createParsedStep(
    checkboxMatch: { status: CheckboxState; text: string },
    lineNumber: number
  ): ParsedStep {
    const anchorMatch = checkboxMatch.text.match(/<!--\s*step:(.+?)\s*-->/);
    const numberPath = this.extractNumberPath(checkboxMatch.text);

    // 稳定锚点优先，序号路径回退
    const id = this.generateStableId(
      'step',
      anchorMatch?.[1],
      numberPath,
      lineNumber
    );
    const text = checkboxMatch.text.replace(/<!--.*?-->/, '').trim();

    return {
      id,
      text,
      status: checkboxMatch.status,
      hints: [],
      contextTags: [],
      usesEVR: [],
      anchor: anchorMatch ? anchorMatch[1] : undefined,
      numberPath,
    };
  }

  /**
   * 使用稳定 ID 创建解析的步骤对象
   */
  private createParsedStepWithStableId(
    checkboxMatch: { status: CheckboxState; text: string },
    lineNumber: number,
    anchors: AnchorMatch[],
    numberPaths: NumberPathMatch[],
    originalLine?: string
  ): ParsedStep {
    const anchorMatch = checkboxMatch.text.match(/<!--\s*step:(.+?)\s*-->/);
    // 从原始行提取序号路径，如果没有原始行则从checkboxMatch.text提取
    const numberPath = originalLine
      ? this.extractNumberPath(originalLine.trim())
      : this.extractNumberPath(checkboxMatch.text);

    // 查找最佳匹配
    const bestMatch = this.findBestMatch(
      'step',
      lineNumber,
      anchors,
      numberPaths
    );

    // 确定最终 ID
    let id: string;
    let finalAnchor: string | undefined;
    let finalNumberPath: string | undefined;

    // 总是尝试保留序号路径
    if (numberPath) {
      finalNumberPath = numberPath;
    } else if (bestMatch.numberPath) {
      finalNumberPath = bestMatch.numberPath.path;
    }

    if (anchorMatch) {
      // 直接使用行内锚点
      id = anchorMatch[1];
      finalAnchor = anchorMatch[1];
    } else if (bestMatch.anchor) {
      // 使用最佳匹配的锚点
      id = bestMatch.anchor.id;
      finalAnchor = bestMatch.anchor.id;
    } else if (numberPath) {
      // 使用行内序号路径
      id = `step-${numberPath}`;
    } else if (bestMatch.numberPath) {
      // 使用最佳匹配的序号路径
      id = `step-${bestMatch.numberPath.path}`;
    } else {
      // 最后回退到生成 ID
      id = this.generateStableId('step', undefined, undefined, lineNumber);
    }

    const text = checkboxMatch.text.replace(/<!--.*?-->/g, '').trim();

    return {
      id,
      text,
      status: checkboxMatch.status,
      hints: [],
      contextTags: [],
      usesEVR: [],
      anchor: finalAnchor,
      numberPath: finalNumberPath,
    };
  }

  /**
   * 解析上下文标签
   */
  private parseContextTag(line: string): ContextTag | null {
    const tagMatch = line.match(/^-\s*\[(.+?)\]\s*(.+)$/);
    if (!tagMatch) return null;

    const [, tag, value] = tagMatch;
    const type = this.determineTagType(tag);

    return { tag, value: value.trim(), type };
  }

  /**
   * 确定标签类型
   */
  private determineTagType(tag: string): ContextTag['type'] {
    const lowerTag = tag.toLowerCase();

    if (lowerTag === 'evr') return 'evr';
    if (lowerTag === 'uses_evr') return 'uses_evr';
    if (lowerTag === 'ref' || lowerTag === 'reference') return 'ref';
    if (lowerTag === 'decision') return 'decision';
    if (lowerTag === 'discuss' || lowerTag === 'discussion') return 'discuss';
    if (lowerTag === 'inputs' || lowerTag === 'input') return 'inputs';
    if (lowerTag === 'constraints' || lowerTag === 'constraint')
      return 'constraints';

    return 'ref'; // 默认类型
  }

  /**
   * 完成 EVR 字段解析
   */
  private finalizeEVRField(
    evr: ParsedEVR,
    field: 'verify' | 'expect' | null,
    content: string[]
  ): void {
    if (!field || content.length === 0) return;

    if (content.length === 1) {
      evr[field] = content[0];
    } else {
      evr[field] = content;
    }
  }

  /**
   * 解析 EVR 状态
   */
  private parseEVRStatus(statusText: string): EVRStatus {
    const lowerStatus = statusText.toLowerCase().trim();

    if (lowerStatus === 'pass' || lowerStatus === '通过') return EVRStatus.Pass;
    if (lowerStatus === 'fail' || lowerStatus === '失败') return EVRStatus.Fail;
    if (lowerStatus === 'skip' || lowerStatus === '跳过') return EVRStatus.Skip;

    return EVRStatus.Unknown;
  }

  /**
   * 从复选框字符解析 EVR 状态
   * [ ] → unknown, [x] → pass, [!] → fail, [-] → skip
   */
  private parseEVRStatusFromCheckbox(checkboxChar: string): EVRStatus {
    switch (checkboxChar) {
      case 'x':
      case 'X':
        return EVRStatus.Pass;
      case '!':
        return EVRStatus.Fail;
      case '-':
      case '~':
        return EVRStatus.Skip;
      case ' ':
      default:
        return EVRStatus.Unknown;
    }
  }

  /**
   * 解析 EVR 类别
   */
  private parseEVRClass(classText: string): EVRClass {
    const lowerClass = classText.toLowerCase().trim();

    if (lowerClass === 'static' || lowerClass === '静态')
      return EVRClass.Static;

    return EVRClass.Runtime;
  }

  /**
   * 解析日志级别
   */
  private parseLogLevel(levelText: string): LogLevel {
    const upperLevel = levelText.toUpperCase().trim();

    switch (upperLevel) {
      case 'ERROR':
      case '错误':
        return LogLevel.Error;
      case 'WARNING':
      case 'WARN':
      case '警告':
        return LogLevel.Warning;
      case 'TEACH':
      case '教学':
        return LogLevel.Teach;
      case 'SILENT':
      case '静默':
        return LogLevel.Silent;
      case 'INFO':
      case '信息':
      default:
        return LogLevel.Info;
    }
  }

  /**
   * 获取缩进级别
   */
  private getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;

    const indent = match[1];
    return Math.floor(indent.replace(/\t/g, '  ').length / 2);
  }

  /**
   * 提取序号路径
   */
  private extractNumberPath(text: string): string | undefined {
    const numberMatch = text.match(/^\s*(\d+(?:\.\d+)*)\./);
    return numberMatch ? numberMatch[1] : undefined;
  }

  /**
   * 添加容错修复记录
   */
  private addToleranceFix(
    type: ToleranceFix['type'],
    description: string,
    line?: number,
    original?: string,
    fixed?: string
  ): void {
    if (this.toleranceFixes.length >= this.options.maxToleranceFixes) {
      return;
    }

    this.toleranceFixes.push({
      type,
      description,
      line,
      original,
      fixed,
    });
  }

  /**
   * 添加解析错误
   */
  private addParseError(
    type: PanelParseError['type'],
    message: string,
    line?: number,
    context?: string,
    suggestion?: string
  ): void {
    this.parseErrors.push({
      type,
      message,
      line,
      context,
      suggestion,
    });
  }

  /**
   * 生成稳定 ID - 稳定锚点优先，序号路径回退
   */
  private generateStableId(
    type: 'plan' | 'step' | 'evr',
    anchor?: string,
    numberPath?: string,
    lineNumber?: number
  ): string {
    // 1. 优先使用稳定锚点
    if (anchor) {
      return anchor;
    }

    // 2. 回退到序号路径
    if (numberPath) {
      return `${type}-${numberPath}`;
    }

    // 3. 最后使用行号 + ULID
    const fallbackId = lineNumber
      ? `${type}-line${lineNumber}-${ulid()}`
      : `${type}-${ulid()}`;

    // 记录回退情况
    this.addParseError(
      'missing_anchor',
      `${type} 缺少稳定锚点，使用回退 ID: ${fallbackId}`,
      lineNumber,
      undefined,
      `添加 HTML 注释锚点: <!-- ${type}:${type}-${ulid()} -->`
    );

    return fallbackId;
  }

  /**
   * 查找所有锚点
   */
  private findAllAnchors(lines: string[]): AnchorMatch[] {
    const anchors: AnchorMatch[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 匹配计划锚点
      const planAnchorMatch = line.match(/<!--\s*plan:(.+?)\s*-->/);
      if (planAnchorMatch) {
        anchors.push({
          id: planAnchorMatch[1],
          type: 'plan',
          line: i + 1,
          raw: planAnchorMatch[0],
        });
      }

      // 匹配步骤锚点
      const stepAnchorMatch = line.match(/<!--\s*step:(.+?)\s*-->/);
      if (stepAnchorMatch) {
        anchors.push({
          id: stepAnchorMatch[1],
          type: 'step',
          line: i + 1,
          raw: stepAnchorMatch[0],
        });
      }

      // 匹配 EVR 锚点
      const evrAnchorMatch = line.match(/<!--\s*evr:(.+?)\s*-->/);
      if (evrAnchorMatch) {
        anchors.push({
          id: evrAnchorMatch[1],
          type: 'evr',
          line: i + 1,
          raw: evrAnchorMatch[0],
        });
      }
    }

    return anchors;
  }

  /**
   * 查找所有序号路径
   */
  private findAllNumberPaths(lines: string[]): NumberPathMatch[] {
    const numberPaths: NumberPathMatch[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 匹配序号路径：1. 或 1.1. 或 2.3.1. 等
      const numberMatch = trimmedLine.match(/^(\d+(?:\.\d+)*)\.\s*\[/);
      if (numberMatch) {
        const path = numberMatch[1];
        const depth = path.split('.').length;

        numberPaths.push({
          path,
          line: i + 1,
          depth,
          isPlan: depth === 1,
          isStep: depth > 1,
        });
      }
    }

    return numberPaths;
  }

  /**
   * 验证锚点唯一性
   */
  private validateAnchorUniqueness(anchors: AnchorMatch[]): void {
    const anchorCounts = new Map<string, AnchorMatch[]>();

    for (const anchor of anchors) {
      if (!anchorCounts.has(anchor.id)) {
        anchorCounts.set(anchor.id, []);
      }
      anchorCounts.get(anchor.id)!.push(anchor);
    }

    for (const [id, matches] of anchorCounts) {
      if (matches.length > 1) {
        this.addParseError(
          'duplicate_id',
          `重复的锚点 ID: ${id}`,
          matches[0].line,
          matches.map((m) => `行 ${m.line}: ${m.raw}`).join(', '),
          `为重复的锚点生成唯一 ID`
        );
      }
    }
  }

  /**
   * 构建序号路径映射
   */
  private buildNumberPathMapping(
    numberPaths: NumberPathMatch[]
  ): Map<string, NumberPathMatch> {
    const mapping = new Map<string, NumberPathMatch>();

    for (const numberPath of numberPaths) {
      mapping.set(numberPath.path, numberPath);
    }

    return mapping;
  }

  /**
   * 查找最佳匹配的锚点或序号路径
   */
  private findBestMatch(
    type: 'plan' | 'step',
    lineNumber: number,
    anchors: AnchorMatch[],
    numberPaths: NumberPathMatch[]
  ): { anchor?: AnchorMatch; numberPath?: NumberPathMatch } {
    // 1. 查找同行或邻近行的锚点
    const nearbyAnchors = anchors.filter(
      (a) => a.type === type && Math.abs(a.line - lineNumber) <= 2
    );

    if (nearbyAnchors.length > 0) {
      // 选择最近的锚点，优先选择后面的锚点（因为锚点在对应行后面生成）
      const closestAnchor = nearbyAnchors.reduce((closest, current) => {
        const closestDistance = Math.abs(closest.line - lineNumber);
        const currentDistance = Math.abs(current.line - lineNumber);

        if (currentDistance < closestDistance) {
          return current;
        } else if (currentDistance === closestDistance) {
          // 距离相同时，优先选择后面的锚点
          return current.line > closest.line ? current : closest;
        } else {
          return closest;
        }
      });
      return { anchor: closestAnchor };
    }

    // 2. 查找同行或邻近行的序号路径
    const nearbyNumberPaths = numberPaths.filter(
      (np) =>
        (type === 'plan' ? np.isPlan : np.isStep) &&
        Math.abs(np.line - lineNumber) <= 2
    );

    if (nearbyNumberPaths.length > 0) {
      // 选择最近的序号路径
      const closestNumberPath = nearbyNumberPaths.reduce((closest, current) =>
        Math.abs(current.line - lineNumber) <
          Math.abs(closest.line - lineNumber)
          ? current
          : closest
      );
      return { numberPath: closestNumberPath };
    }

    return {};
  }

  /**
   * 生成元数据
   */
  private generateMetadata(): PanelMetadata {
    return {
      parsedAt: new Date().toISOString(),
      parserVersion: this.options.parserVersion,
      stats: {
        totalPlans: 0, // 将在解析完成后更新
        totalSteps: 0,
        totalEVRs: 0,
        parseErrors: this.parseErrors.length,
        toleranceFixCount: this.toleranceFixes.length,
      },
      parseErrors: [...this.parseErrors],
      toleranceFixes: [...this.toleranceFixes],
    };
  }
}

/**
 * 创建面板解析器实例
 */
export function createPanelParser(
  options?: Partial<PanelParseOptions>
): PanelParser {
  return new PanelParser(options);
}
