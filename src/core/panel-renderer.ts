/**
 * PanelRenderer - 面板渲染器
 * 负责将结构化任务数据渲染为统一格式的 Markdown 面板
 * 确保与面板解析器的 round-trip 兼容性
 */

import { logger } from './logger.js';
import { createHash } from 'crypto';
import {
  LogCategory,
  LogAction,
  TaskStatus,
  CheckboxState,
  type ParsedPanel,
  type ParsedPlan,
  type ParsedEVR,
  type ParsedLog,
  type ContextTag,
} from '../types/index.js';

/**
 * 面板渲染选项
 */
export interface PanelRenderOptions {
  /** 是否注入稳定锚点 */
  injectAnchors: boolean;
  /** 是否折叠数组显示 */
  collapseArrays: boolean;
  /** 缩进字符串 */
  indentString: string;
  /** 渲染器版本 */
  rendererVersion: string;
  /** 是否在文档头部注入 Front Matter（md_version/last_modified） */
  includeFrontMatter: boolean;
}

/**
 * 默认渲染选项
 */
const DEFAULT_RENDER_OPTIONS: PanelRenderOptions = {
  injectAnchors: true,
  collapseArrays: true,
  indentString: '  ',
  rendererVersion: '1.0.0',
  includeFrontMatter: false,
};

/**
 * 面板渲染器类
 */
export class PanelRenderer {
  private readonly options: PanelRenderOptions;

  constructor(options?: Partial<PanelRenderOptions>) {
    this.options = { ...DEFAULT_RENDER_OPTIONS, ...options };
  }

  /**
   * 将结构化数据渲染为 Markdown 面板
   */
  renderToMarkdown(data: ParsedPanel): string {
    const sections: string[] = [];

    // 渲染标题（设计文档格式：# Task: xxx）
    if (data.title) {
      sections.push(`# Task: ${data.title}`);
      sections.push('');
    }

    // 渲染元数据
    if (data.taskId) {
      sections.push(`Task ID: ${data.taskId}`);
    }
    if (data.references && data.references.length > 0) {
      sections.push(`References: ${data.references.join(', ')}`);
    }
    if (data.taskId || (data.references && data.references.length > 0)) {
      sections.push('');
    }

    // 渲染需求
    if (data.requirements.length > 0) {
      sections.push('## Requirements');
      sections.push('');
      data.requirements.forEach((req) => {
        sections.push(`- ${req}`);
      });
      sections.push('');
    }

    // 渲染问题
    if (data.issues.length > 0) {
      sections.push('## Issues');
      sections.push('');
      data.issues.forEach((issue) => {
        sections.push(`- ${issue}`);
      });
      sections.push('');
    }

    // 渲染提示
    if (data.hints.length > 0) {
      sections.push('## Task Hints');
      sections.push('');
      data.hints.forEach((hint) => {
        sections.push(this.formatQuoteBlock(hint));
      });
      sections.push('');
    }

    // 渲染 EVR
    if (data.evrs.length > 0) {
      sections.push('## Expected Visible Results');
      sections.push('');
      sections.push(this.renderEVRs(data.evrs));
      sections.push('');
    }

    // 渲染计划
    if (data.plans.length > 0) {
      sections.push('## Plans & Steps');
      sections.push('');
      sections.push(this.renderPlans(data.plans));
      sections.push('');
    }

    // 渲染日志
    if (data.logs.length > 0) {
      sections.push('## Logs');
      sections.push('');
      sections.push(this.renderLogs(data.logs));
    }

    let body = sections.join('\n');

    // 注入稳定锚点
    if (this.options.injectAnchors) {
      body = this.injectStableAnchors(body);
    }

    // 可选：注入 Front Matter（md_version / last_modified）
    let result = body;
    if (this.options.includeFrontMatter) {
      const mdVersion = this.computeMdVersion(body);
      const lastModified = new Date().toISOString();
      const fm = [
        '---',
        `md_version: ${mdVersion}`,
        `last_modified: ${lastModified}`,
        '---',
        '',
      ].join('\n');
      result = fm + body;
    }

    logger.info(LogCategory.Task, LogAction.Create, '面板渲染完成', {
      totalPlans: data.plans.length,
      totalSteps: data.plans.reduce((sum, plan) => sum + plan.steps.length, 0),
      totalEVRs: data.evrs.length,
      rendererVersion: this.options.rendererVersion,
    });

    return result;
  }

  /**
   * 基于内容计算 md_version（ETag）
   */
  private computeMdVersion(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * 渲染计划列表
   */
  renderPlans(plans: ParsedPlan[]): string {
    const lines: string[] = [];

    plans.forEach((plan, index) => {
      const planNumber = index + 1;
      const checkbox = this.formatCheckboxState(plan.status);

      // 渲染计划主行
      let planLine = `${planNumber}. ${checkbox} ${plan.text}`;
      if (this.options.injectAnchors && plan.anchor) {
        planLine += ` <!-- plan:${plan.anchor} -->`;
      }
      lines.push(planLine);

      // 渲染计划级提示
      if (plan.hints.length > 0) {
        plan.hints.forEach((hint) => {
          lines.push(
            `${this.options.indentString}${this.formatQuoteBlock(hint)}`
          );
        });
      }

      // 渲染上下文标签
      if (plan.contextTags.length > 0) {
        const tagLines = this.formatContextTags(plan.contextTags);
        tagLines.split('\n').forEach((tagLine) => {
          if (tagLine.trim()) {
            lines.push(`${this.options.indentString}${tagLine}`);
          }
        });
      }

      // 渲染步骤
      if (plan.steps.length > 0) {
        plan.steps.forEach((step, stepIndex) => {
          const stepNumber = stepIndex + 1;
          const stepCheckbox = this.formatCheckboxState(step.status);

          let stepLine = `${this.options.indentString}${planNumber}.${stepNumber} ${stepCheckbox} ${step.text}`;
          if (this.options.injectAnchors && step.anchor) {
            stepLine += ` <!-- step:${step.anchor} -->`;
          }
          lines.push(stepLine);

          // 渲染步骤级提示
          if (step.hints.length > 0) {
            step.hints.forEach((hint) => {
              lines.push(
                `${this.options.indentString}${this.options.indentString}${this.formatQuoteBlock(hint)}`
              );
            });
          }

          // 渲染步骤级上下文标签
          if (step.contextTags.length > 0) {
            const stepTagLines = this.formatContextTags(step.contextTags);
            stepTagLines.split('\n').forEach((tagLine) => {
              if (tagLine.trim()) {
                lines.push(
                  `${this.options.indentString}${this.options.indentString}${tagLine}`
                );
              }
            });
          }
        });
      }

      // 在计划之间添加空行
      if (index < plans.length - 1) {
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  /**
   * 渲染 EVR 列表
   */
  renderEVRs(evrs: ParsedEVR[]): string {
    const lines: string[] = [];

    evrs.forEach((evr, index) => {
      // 渲染 EVR 标题行
      let evrLine = `### ${evr.title}`;
      if (this.options.injectAnchors && evr.anchor) {
        evrLine += ` <!-- ${evr.anchor} -->`;
      }
      lines.push(evrLine);
      lines.push('');

      // 渲染 verify 字段
      if (evr.verify) {
        lines.push('**Verify:**');
        if (Array.isArray(evr.verify)) {
          lines.push(this.renderArrayField(evr.verify));
        } else {
          lines.push(evr.verify);
        }
        lines.push('');
      }

      // 渲染 expect 字段
      if (evr.expect) {
        lines.push('**Expect:**');
        if (Array.isArray(evr.expect)) {
          lines.push(this.renderArrayField(evr.expect));
        } else {
          lines.push(evr.expect);
        }
        lines.push('');
      }

      // 渲染状态和元数据
      lines.push(`- Status: ${evr.status}`);

      if (evr.class) {
        lines.push(`- Class: ${evr.class}`);
      }

      if (evr.lastRun) {
        lines.push(`- Last Run: ${evr.lastRun}`);
      }

      if (evr.notes) {
        lines.push(`- Notes: ${evr.notes}`);
      }

      if (evr.proof) {
        lines.push(`- Proof: ${evr.proof}`);
      }

      lines.push('');

      // 渲染验证运行记录
      if (evr.runs && evr.runs.length > 0) {
        lines.push('**Verification Runs:**');
        evr.runs.forEach((run) => {
          lines.push(`- ${run.at} by ${run.by}: ${run.status}`);
          if (run.notes) {
            lines.push(`  Notes: ${run.notes}`);
          }
          if (run.proof) {
            lines.push(`  Proof: ${run.proof}`);
          }
        });
        lines.push('');
      }

      // 在 EVR 之间添加分隔线
      if (index < evrs.length - 1) {
        lines.push('---');
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  /**
   * 渲染日志列表
   */
  renderLogs(logs: ParsedLog[]): string {
    const lines: string[] = [];

    logs.forEach((log) => {
      const timestamp = new Date(log.timestamp).toISOString();
      const logLine = `[${timestamp}] ${log.level} ${log.category}/${log.action}: ${log.message}`;
      lines.push(logLine);

      if (log.aiNotes) {
        lines.push(`  AI Notes: ${log.aiNotes}`);
      }

      if (log.details && Object.keys(log.details).length > 0) {
        lines.push(`  Details: ${JSON.stringify(log.details, null, 2)}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * 格式化复选框状态
   * 实现统一的状态映射：to_do → [ ], in_progress → [-], completed → [x], blocked → [!]
   */
  formatCheckboxState(status: CheckboxState | TaskStatus): string {
    // 处理 null/undefined 情况
    if (status === null || status === undefined) {
      logger.warning(LogCategory.Task, LogAction.Handle, '复选框状态为空', {
        status,
      });
      return '[ ]';
    }

    // 标准化状态值
    const normalizedStatus =
      typeof status === 'string' ? status : String(status);

    switch (normalizedStatus) {
      case 'to_do':
      case CheckboxState.ToDo:
      case TaskStatus.ToDo:
        return '[ ]';
      case 'in_progress':
      case CheckboxState.InProgress:
      case TaskStatus.InProgress:
        return '[-]';
      case 'completed':
      case CheckboxState.Completed:
      case TaskStatus.Completed:
        return '[x]';
      case 'blocked':
      case CheckboxState.Blocked:
      case TaskStatus.Blocked:
        return '[!]';
      default:
        logger.warning(LogCategory.Task, LogAction.Handle, '未知的复选框状态', {
          status: normalizedStatus,
        });
        return '[ ]';
    }
  }

  /**
   * 格式化引用块
   * 实现统一的引用块格式：> content
   */
  formatQuoteBlock(content: string): string {
    if (!content) {
      return '> ';
    }

    // 处理多行内容
    const lines = content.split('\n');
    return lines.map((line) => `> ${line}`).join('\n');
  }

  /**
   * 格式化上下文标签
   * 实现标签化条目的标准化渲染：- [tag] value
   */
  formatContextTags(tags: ContextTag[]): string {
    if (!tags || tags.length === 0) {
      return '';
    }

    return tags
      .filter((tag) => tag && tag.tag && tag.value) // 过滤无效标签
      .map((tag) => `- [${tag.tag}] ${tag.value}`)
      .join('\n');
  }

  /**
   * 渲染数组字段（首行为主，其余折叠显示）
   */
  private renderArrayField(items: string[]): string {
    if (items.length === 0) {
      return '';
    }

    if (items.length === 1) {
      return items[0];
    }

    if (!this.options.collapseArrays) {
      return items.join('\n');
    }

    // 首行为主，其余折叠显示
    const lines: string[] = [items[0]];

    if (items.length > 1) {
      lines.push('<details>');
      lines.push('<summary>More items...</summary>');
      lines.push('');
      items.slice(1).forEach((item) => {
        lines.push(item);
      });
      lines.push('</details>');
    }

    return lines.join('\n');
  }

  /**
   * 注入稳定锚点
   * 为计划、步骤和 EVR 自动注入 HTML 注释锚点：<!-- plan:uuid -->、<!-- step:uuid -->、<!-- evr:uuid -->
   */
  injectStableAnchors(content: string): string {
    if (!this.options.injectAnchors) {
      return content;
    }

    let result = content;

    // 为没有锚点的计划行注入锚点
    result = result.replace(
      /^(\d+\.\s+\[[\s\-x!]\]\s+[^\n]+)(?!\s*<!--)/gm,
      (match) => {
        const planId = this.generatePlanId();
        return `${match} <!-- plan:${planId} -->`;
      }
    );

    // 为没有锚点的步骤行注入锚点
    result = result.replace(
      /^(\s+\d+\.\d+\s+\[[\s\-x!]\]\s+[^\n]+)(?!\s*<!--)/gm,
      (match) => {
        const stepId = this.generateStepId();
        return `${match} <!-- step:${stepId} -->`;
      }
    );

    // 为没有锚点的 EVR 标题注入锚点
    result = result.replace(/^(###\s+[^\n]+)(?!\s*<!--)/gm, (match) => {
      const evrId = this.generateEVRId();
      return `${match} <!-- evr:${evrId} -->`;
    });

    return result;
  }

  /**
   * 生成计划 ID
   */
  private generatePlanId(): string {
    return `p-${this.generateShortId()}`;
  }

  /**
   * 生成步骤 ID
   */
  private generateStepId(): string {
    return `s-${this.generateShortId()}`;
  }

  /**
   * 生成 EVR ID
   */
  private generateEVRId(): string {
    return `evr-${this.generateShortId()}`;
  }

  /**
   * 生成短 ID（8位随机字符）
   */
  private generateShortId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

/**
 * 创建面板渲染器实例
 */
export function createPanelRenderer(
  options?: Partial<PanelRenderOptions>
): PanelRenderer {
  return new PanelRenderer(options);
}
