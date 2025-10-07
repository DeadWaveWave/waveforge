/**
 * PanelRenderer 单元测试
 * 测试面板渲染器的各种功能和格式一致性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PanelRenderer, createPanelRenderer } from './panel-renderer.js';
import {
  CheckboxState,
  TaskStatus,
  EVRStatus,
  EVRClass,
  LogLevel,
  LogCategory,
  LogAction,
  type ParsedPanel,
  type ParsedPlan,
  type ParsedEVR,
  type ContextTag,
} from '../types/index.js';

describe('PanelRenderer', () => {
  let renderer: PanelRenderer;

  beforeEach(() => {
    renderer = createPanelRenderer();
  });

  describe('复选框状态映射', () => {
    it('应该正确映射 CheckboxState 枚举', () => {
      expect(renderer.formatCheckboxState(CheckboxState.ToDo)).toBe('[ ]');
      expect(renderer.formatCheckboxState(CheckboxState.InProgress)).toBe(
        '[-]'
      );
      expect(renderer.formatCheckboxState(CheckboxState.Completed)).toBe('[x]');
      expect(renderer.formatCheckboxState(CheckboxState.Blocked)).toBe('[!]');
    });

    it('应该正确映射 TaskStatus 枚举', () => {
      expect(renderer.formatCheckboxState(TaskStatus.ToDo)).toBe('[ ]');
      expect(renderer.formatCheckboxState(TaskStatus.InProgress)).toBe('[-]');
      expect(renderer.formatCheckboxState(TaskStatus.Completed)).toBe('[x]');
      expect(renderer.formatCheckboxState(TaskStatus.Blocked)).toBe('[!]');
    });

    it('应该正确映射字符串状态', () => {
      expect(renderer.formatCheckboxState('to_do' as any)).toBe('[ ]');
      expect(renderer.formatCheckboxState('in_progress' as any)).toBe('[-]');
      expect(renderer.formatCheckboxState('completed' as any)).toBe('[x]');
      expect(renderer.formatCheckboxState('blocked' as any)).toBe('[!]');
    });

    it('应该为未知状态返回默认值', () => {
      expect(renderer.formatCheckboxState('unknown' as any)).toBe('[ ]');
      expect(renderer.formatCheckboxState(null as any)).toBe('[ ]');
      expect(renderer.formatCheckboxState(undefined as any)).toBe('[ ]');
    });
  });

  describe('引用块格式化', () => {
    it('应该正确格式化单行引用块', () => {
      expect(renderer.formatQuoteBlock('这是一个提示')).toBe('> 这是一个提示');
    });

    it('应该正确格式化多行引用块', () => {
      expect(renderer.formatQuoteBlock('第一行\n第二行\n第三行')).toBe(
        '> 第一行\n> 第二行\n> 第三行'
      );
    });

    it('应该处理空内容', () => {
      expect(renderer.formatQuoteBlock('')).toBe('> ');
    });

    it('应该处理包含特殊字符的内容', () => {
      expect(renderer.formatQuoteBlock('包含 **粗体** 和 `代码` 的内容')).toBe(
        '> 包含 **粗体** 和 `代码` 的内容'
      );
    });
  });

  describe('上下文标签格式化', () => {
    it('应该正确格式化单个标签', () => {
      const tags: ContextTag[] = [
        { tag: 'ref', value: 'docs/api.md', type: 'ref' },
      ];
      expect(renderer.formatContextTags(tags)).toBe('- [ref] docs/api.md');
    });

    it('应该正确格式化多个标签', () => {
      const tags: ContextTag[] = [
        { tag: 'ref', value: 'docs/api.md', type: 'ref' },
        { tag: 'decision', value: 'adopt JWT', type: 'decision' },
        { tag: 'evr', value: 'evr-001', type: 'evr' },
      ];
      const expected =
        '- [ref] docs/api.md\n- [decision] adopt JWT\n- [evr] evr-001';
      expect(renderer.formatContextTags(tags)).toBe(expected);
    });

    it('应该处理空标签数组', () => {
      expect(renderer.formatContextTags([])).toBe('');
    });

    it('应该过滤无效标签', () => {
      const tags: ContextTag[] = [
        { tag: 'ref', value: 'docs/api.md', type: 'ref' },
        { tag: '', value: 'invalid', type: 'ref' }, // 空标签名
        { tag: 'decision', value: '', type: 'decision' }, // 空值
        { tag: 'evr', value: 'evr-001', type: 'evr' },
      ];
      const expected = '- [ref] docs/api.md\n- [evr] evr-001';
      expect(renderer.formatContextTags(tags)).toBe(expected);
    });

    it('应该处理 null 或 undefined 输入', () => {
      expect(renderer.formatContextTags(null as any)).toBe('');
      expect(renderer.formatContextTags(undefined as any)).toBe('');
    });

    it('应该正确格式化各种标签类型', () => {
      const tags: ContextTag[] = [
        { tag: 'ref', value: 'docs/api.md', type: 'ref' },
        { tag: 'decision', value: 'use TypeScript', type: 'decision' },
        { tag: 'discuss', value: 'performance concerns', type: 'discuss' },
        { tag: 'inputs', value: 'user requirements', type: 'inputs' },
        { tag: 'constraints', value: 'memory limit 1GB', type: 'constraints' },
        { tag: 'evr', value: 'evr-001', type: 'evr' },
        { tag: 'uses_evr', value: 'evr-002', type: 'uses_evr' },
      ];

      const result = renderer.formatContextTags(tags);
      expect(result).toContain('- [ref] docs/api.md');
      expect(result).toContain('- [decision] use TypeScript');
      expect(result).toContain('- [discuss] performance concerns');
      expect(result).toContain('- [inputs] user requirements');
      expect(result).toContain('- [constraints] memory limit 1GB');
      expect(result).toContain('- [evr] evr-001');
      expect(result).toContain('- [uses_evr] evr-002');
    });
  });

  describe('数组字段渲染', () => {
    it('应该渲染单个项目', () => {
      const renderer = createPanelRenderer({ collapseArrays: true });
      const result = (renderer as any).renderArrayField(['单个项目']);
      expect(result).toBe('单个项目');
    });

    it('应该折叠多个项目', () => {
      const renderer = createPanelRenderer({ collapseArrays: true });
      const result = (renderer as any).renderArrayField([
        '第一项',
        '第二项',
        '第三项',
      ]);
      const expected =
        '第一项\n<details>\n<summary>More items...</summary>\n\n第二项\n第三项\n</details>';
      expect(result).toBe(expected);
    });

    it('应该在禁用折叠时显示所有项目', () => {
      const renderer = createPanelRenderer({ collapseArrays: false });
      const result = (renderer as any).renderArrayField([
        '第一项',
        '第二项',
        '第三项',
      ]);
      expect(result).toBe('第一项\n第二项\n第三项');
    });

    it('应该处理空数组', () => {
      const renderer = createPanelRenderer();
      const result = (renderer as any).renderArrayField([]);
      expect(result).toBe('');
    });
  });

  describe('计划渲染', () => {
    it('应该渲染基本计划', () => {
      const plans: ParsedPlan[] = [
        {
          id: 'plan-1',
          text: '实现基础功能',
          status: CheckboxState.InProgress,
          hints: [],
          contextTags: [],
          evrBindings: [],
          steps: [],
        },
      ];

      const result = renderer.renderPlans(plans);
      expect(result).toContain('1. [-] 实现基础功能');
    });

    it('应该渲染带步骤的计划', () => {
      const plans: ParsedPlan[] = [
        {
          id: 'plan-1',
          text: '实现基础功能',
          status: CheckboxState.InProgress,
          hints: [],
          contextTags: [],
          evrBindings: [],
          steps: [
            {
              id: 'step-1',
              text: '创建接口',
              status: CheckboxState.Completed,
              hints: [],
              contextTags: [],
              usesEVR: [],
            },
            {
              id: 'step-2',
              text: '实现逻辑',
              status: CheckboxState.ToDo,
              hints: [],
              contextTags: [],
              usesEVR: [],
            },
          ],
        },
      ];

      const result = renderer.renderPlans(plans);
      expect(result).toContain('1. [-] 实现基础功能');
      expect(result).toContain('  1.1 [x] 创建接口');
      expect(result).toContain('  1.2 [ ] 实现逻辑');
    });

    it('应该渲染计划级提示', () => {
      const plans: ParsedPlan[] = [
        {
          id: 'plan-1',
          text: '实现基础功能',
          status: CheckboxState.ToDo,
          hints: ['这是一个重要提示', '注意性能优化'],
          contextTags: [],
          evrBindings: [],
          steps: [],
        },
      ];

      const result = renderer.renderPlans(plans);
      expect(result).toContain('> 这是一个重要提示');
      expect(result).toContain('> 注意性能优化');
    });

    it('应该渲染上下文标签', () => {
      const plans: ParsedPlan[] = [
        {
          id: 'plan-1',
          text: '实现基础功能',
          status: CheckboxState.ToDo,
          hints: [],
          contextTags: [
            { tag: 'ref', value: 'docs/api.md', type: 'ref' },
            { tag: 'evr', value: 'evr-001', type: 'evr' },
          ],
          evrBindings: ['evr-001'],
          steps: [],
        },
      ];

      const result = renderer.renderPlans(plans);
      expect(result).toContain('- [ref] docs/api.md');
      expect(result).toContain('- [evr] evr-001');
    });
  });

  describe('EVR 渲染', () => {
    it('应该渲染基本 EVR', () => {
      const evrs: ParsedEVR[] = [
        {
          id: 'evr-001',
          title: '测试 EVR',
          verify: '运行测试命令',
          expect: '所有测试通过',
          status: EVRStatus.Unknown,
          runs: [],
        },
      ];

      const result = renderer.renderEVRs(evrs);
      expect(result).toContain('### 测试 EVR');
      expect(result).toContain('- [verify] 运行测试命令');
      expect(result).toContain('- [expect] 所有测试通过');
      expect(result).toContain('- [status] unknown');
    });

    it('应该渲染数组形式的 verify 和 expect', () => {
      const evrs: ParsedEVR[] = [
        {
          id: 'evr-001',
          title: '复杂 EVR',
          verify: ['步骤1', '步骤2', '步骤3'],
          expect: ['结果1', '结果2'],
          status: EVRStatus.Pass,
          runs: [],
        },
      ];

      const result = renderer.renderEVRs(evrs);
      expect(result).toContain('- [verify] 步骤1');
      expect(result).toContain('- [verify] 步骤2');
      expect(result).toContain('- [verify] 步骤3');
      expect(result).toContain('- [expect] 结果1');
    });

    it('应该正确处理单个项目的数组', () => {
      const evrs: ParsedEVR[] = [
        {
          id: 'evr-001',
          title: '单项 EVR',
          verify: ['单个验证步骤'],
          expect: ['单个预期结果'],
          status: EVRStatus.Unknown,
          runs: [],
        },
      ];

      const result = renderer.renderEVRs(evrs);
      expect(result).toContain('单个验证步骤');
      expect(result).toContain('单个预期结果');
      expect(result).not.toContain('<details>');
      expect(result).not.toContain('<summary>');
    });

    it('应该在禁用折叠时显示所有数组项目', () => {
      const renderer = createPanelRenderer({ collapseArrays: false });
      const evrs: ParsedEVR[] = [
        {
          id: 'evr-001',
          title: '展开 EVR',
          verify: ['步骤1', '步骤2', '步骤3'],
          expect: ['结果1', '结果2', '结果3'],
          status: EVRStatus.Unknown,
          runs: [],
        },
      ];

      const result = renderer.renderEVRs(evrs);
      expect(result).toContain('- [verify] 步骤1');
      expect(result).toContain('- [verify] 步骤2');
      expect(result).toContain('- [verify] 步骤3');
      expect(result).toContain('- [expect] 结果1');
      expect(result).not.toContain('<details>');
    });

    it('应该渲染 EVR 元数据', () => {
      const evrs: ParsedEVR[] = [
        {
          id: 'evr-001',
          title: '完整 EVR',
          verify: '验证方法',
          expect: '预期结果',
          status: EVRStatus.Pass,
          class: EVRClass.Static,
          lastRun: '2023-12-01T10:00:00Z',
          notes: '重要备注',
          proof: 'https://example.com/proof',
          runs: [],
        },
      ];

      const result = renderer.renderEVRs(evrs);
      expect(result).toContain('- [status] pass');
      expect(result).toContain('- [class] static');
      expect(result).toContain('- [last_run] 2023-12-01T10:00:00Z');
      expect(result).toContain('- [notes] 重要备注');
      expect(result).toContain('- [proof] https://example.com/proof');
    });

    it('应该渲染验证运行记录', () => {
      const evrs: ParsedEVR[] = [
        {
          id: 'evr-001',
          title: '带运行记录的 EVR',
          verify: '验证方法',
          expect: '预期结果',
          status: EVRStatus.Pass,
          runs: [
            {
              at: '2023-12-01T10:00:00Z',
              by: 'ai',
              status: EVRStatus.Pass,
              notes: '验证通过',
              proof: 'test-output.log',
            },
            {
              at: '2023-12-01T09:00:00Z',
              by: 'user',
              status: EVRStatus.Fail,
              notes: '初次验证失败',
            },
          ],
        },
      ];

      const result = renderer.renderEVRs(evrs);
      expect(result).toContain('**Verification Runs:**');
      expect(result).toContain('- 2023-12-01T10:00:00Z by ai: pass');
      expect(result).toContain('  Notes: 验证通过');
      expect(result).toContain('  Proof: test-output.log');
      expect(result).toContain('- 2023-12-01T09:00:00Z by user: fail');
      expect(result).toContain('  Notes: 初次验证失败');
    });
  });

  describe('完整面板渲染', () => {
    it('应该渲染完整的面板结构', () => {
      const panel: ParsedPanel = {
        title: '测试任务',
        requirements: ['需求1', '需求2'],
        issues: ['问题1'],
        hints: ['任务提示'],
        plans: [
          {
            id: 'plan-1',
            text: '实现功能',
            status: CheckboxState.InProgress,
            hints: ['计划提示'],
            contextTags: [{ tag: 'ref', value: 'docs/api.md', type: 'ref' }],
            evrBindings: ['evr-001'],
            steps: [
              {
                id: 'step-1',
                text: '创建接口',
                status: CheckboxState.Completed,
                hints: [],
                contextTags: [],
                usesEVR: [],
              },
            ],
          },
        ],
        evrs: [
          {
            id: 'evr-001',
            title: '功能验证',
            verify: '运行测试',
            expect: '测试通过',
            status: EVRStatus.Unknown,
            runs: [],
          },
        ],
        logs: [
          {
            timestamp: '2023-12-01T10:00:00Z',
            level: LogLevel.Info,
            category: LogCategory.Task,
            action: LogAction.Create,
            message: '任务创建',
            aiNotes: 'AI 备注',
          },
        ],
        metadata: {
          parsedAt: '2023-12-01T10:00:00Z',
          parserVersion: '1.0.0',
          stats: {
            totalPlans: 1,
            totalSteps: 1,
            totalEVRs: 1,
            parseErrors: 0,
            toleranceFixCount: 0,
          },
          parseErrors: [],
          toleranceFixes: [],
        },
      };

      const result = renderer.renderToMarkdown(panel);

      // 验证各个部分都存在（新格式）
      expect(result).toContain('# Task: 测试任务');
      expect(result).toContain('## Requirements');
      expect(result).toContain('- 需求1');
      expect(result).toContain('- 需求2');
      expect(result).toContain('## Issues');
      expect(result).toContain('- 问题1');
      expect(result).toContain('## Task Hints');
      expect(result).toContain('> 任务提示');
      expect(result).toContain('## Plans & Steps');
      expect(result).toContain('1. [-] 实现功能');
      expect(result).toContain('  > 计划提示');
      expect(result).toContain('  - [ref] docs/api.md');
      expect(result).toContain('  1.1 [x] 创建接口');
      expect(result).toContain('## Expected Visible Results');
      expect(result).toContain('### 功能验证');
      expect(result).toContain('## Logs');
      expect(result).toContain(
        '[2023-12-01T10:00:00.000Z] INFO TASK/CREATE: 任务创建'
      );
    });
  });

  describe('稳定锚点注入', () => {
    it('应该为计划注入锚点', () => {
      const content = '1. [ ] 实现基础功能\n2. [x] 完成测试';
      const result = renderer.injectStableAnchors(content);

      expect(result).toMatch(
        /1\. \[ \] 实现基础功能 <!-- plan:p-[a-z0-9]{8} -->/
      );
      expect(result).toMatch(/2\. \[x\] 完成测试 <!-- plan:p-[a-z0-9]{8} -->/);
    });

    it('应该为步骤注入锚点', () => {
      const content = '  1.1 [-] 创建接口\n  1.2 [ ] 实现逻辑';
      const result = renderer.injectStableAnchors(content);

      expect(result).toMatch(/1\.1 \[-\] 创建接口 <!-- step:s-[a-z0-9]{8} -->/);
      expect(result).toMatch(/1\.2 \[ \] 实现逻辑 <!-- step:s-[a-z0-9]{8} -->/);
    });

    it('应该为 EVR 标题注入锚点', () => {
      const content = '### 功能验证\n### 性能测试';
      const result = renderer.injectStableAnchors(content);

      expect(result).toMatch(/### 功能验证 <!-- evr:evr-[a-z0-9]{8} -->/);
      expect(result).toMatch(/### 性能测试 <!-- evr:evr-[a-z0-9]{8} -->/);
    });

    it('应该跳过已有锚点的行', () => {
      const content =
        '1. [ ] 实现基础功能 <!-- plan:existing -->\n2. [x] 完成测试';
      const result = renderer.injectStableAnchors(content);

      expect(result).toContain('1. [ ] 实现基础功能 <!-- plan:existing -->');
      expect(result).toMatch(/2\. \[x\] 完成测试 <!-- plan:p-[a-z0-9]{8} -->/);
    });

    it('应该在禁用锚点注入时返回原内容', () => {
      const renderer = createPanelRenderer({ injectAnchors: false });
      const content = '1. [ ] 实现基础功能\n### 功能验证';
      const result = renderer.injectStableAnchors(content);

      expect(result).toBe(content);
    });

    it('应该处理复杂的混合内容', () => {
      const content = `1. [-] 实现功能
  > 这是提示
  - [ref] docs/api.md
  1.1 [x] 创建接口
  1.2 [ ] 实现逻辑

### 功能验证

2. [ ] 完成测试`;

      const result = renderer.injectStableAnchors(content);

      expect(result).toMatch(/1\. \[-\] 实现功能 <!-- plan:p-[a-z0-9]{8} -->/);
      expect(result).toMatch(/1\.1 \[x\] 创建接口 <!-- step:s-[a-z0-9]{8} -->/);
      expect(result).toMatch(/1\.2 \[ \] 实现逻辑 <!-- step:s-[a-z0-9]{8} -->/);
      expect(result).toMatch(/### 功能验证 <!-- evr:evr-[a-z0-9]{8} -->/);
      expect(result).toMatch(/2\. \[ \] 完成测试 <!-- plan:p-[a-z0-9]{8} -->/);

      // 确保提示和标签没有被修改
      expect(result).toContain('> 这是提示');
      expect(result).toContain('- [ref] docs/api.md');
    });
  });

  describe('输出格式统一性验证', () => {
    it('应该使用统一的复选框格式', () => {
      const plans: ParsedPlan[] = [
        {
          id: 'plan-1',
          text: '待办任务',
          status: CheckboxState.ToDo,
          hints: [],
          contextTags: [],
          evrBindings: [],
          steps: [],
        },
        {
          id: 'plan-2',
          text: '进行中任务',
          status: CheckboxState.InProgress,
          hints: [],
          contextTags: [],
          evrBindings: [],
          steps: [],
        },
        {
          id: 'plan-3',
          text: '已完成任务',
          status: CheckboxState.Completed,
          hints: [],
          contextTags: [],
          evrBindings: [],
          steps: [],
        },
        {
          id: 'plan-4',
          text: '阻塞任务',
          status: CheckboxState.Blocked,
          hints: [],
          contextTags: [],
          evrBindings: [],
          steps: [],
        },
      ];

      const result = renderer.renderPlans(plans);
      expect(result).toContain('1. [ ] 待办任务');
      expect(result).toContain('2. [-] 进行中任务');
      expect(result).toContain('3. [x] 已完成任务');
      expect(result).toContain('4. [!] 阻塞任务');
    });

    it('应该使用统一的缩进格式', () => {
      const plans: ParsedPlan[] = [
        {
          id: 'plan-1',
          text: '主计划',
          status: CheckboxState.InProgress,
          hints: ['计划提示'],
          contextTags: [{ tag: 'ref', value: 'docs/api.md', type: 'ref' }],
          evrBindings: [],
          steps: [
            {
              id: 'step-1',
              text: '子步骤',
              status: CheckboxState.Completed,
              hints: ['步骤提示'],
              contextTags: [
                { tag: 'decision', value: 'use TypeScript', type: 'decision' },
              ],
              usesEVR: [],
            },
          ],
        },
      ];

      const result = renderer.renderPlans(plans);

      // 验证计划级缩进
      expect(result).toContain('1. [-] 主计划');
      expect(result).toContain('  > 计划提示');
      expect(result).toContain('  - [ref] docs/api.md');

      // 验证步骤级缩进
      expect(result).toContain('  1.1 [x] 子步骤');
      expect(result).toContain('    > 步骤提示');
      expect(result).toContain('    - [decision] use TypeScript');
    });

    it('应该使用统一的引用块格式', () => {
      const hints = ['单行提示', '多行\n提示内容', '包含**格式**的提示'];

      hints.forEach((hint) => {
        const result = renderer.formatQuoteBlock(hint);
        expect(result).toMatch(/^> /);

        if (hint.includes('\n')) {
          const lines = result.split('\n');
          lines.forEach((line) => {
            expect(line).toMatch(/^> /);
          });
        }
      });
    });

    it('应该使用统一的标签格式', () => {
      const tags: ContextTag[] = [
        { tag: 'ref', value: 'file.md', type: 'ref' },
        { tag: 'decision', value: 'choice made', type: 'decision' },
        { tag: 'evr', value: 'evr-001', type: 'evr' },
      ];

      const result = renderer.formatContextTags(tags);
      const lines = result.split('\n');

      lines.forEach((line) => {
        expect(line).toMatch(/^- \[[^\]]+\] .+$/);
      });
    });

    it('应该使用统一的 EVR 格式', () => {
      const evrs: ParsedEVR[] = [
        {
          id: 'evr-001',
          title: '标准 EVR',
          verify: 'verify content',
          expect: 'expect content',
          status: EVRStatus.Pass,
          class: EVRClass.Runtime,
          lastRun: '2023-12-01T10:00:00Z',
          notes: 'test notes',
          proof: 'proof link',
          runs: [
            {
              at: '2023-12-01T10:00:00Z',
              by: 'ai',
              status: EVRStatus.Pass,
              notes: 'run notes',
              proof: 'run proof',
            },
          ],
        },
      ];

      const result = renderer.renderEVRs(evrs);

      // 验证标题格式
      expect(result).toContain('### 标准 EVR');

      // 验证字段格式 - 使用标签化条目格式
      expect(result).toContain('- [verify] verify content');
      expect(result).toContain('- [expect] expect content');

      // 验证元数据格式 - 使用标签化条目格式
      expect(result).toContain('- [status] pass');
      expect(result).toContain('- [class] runtime');
      expect(result).toContain('- [last_run] 2023-12-01T10:00:00Z');
      expect(result).toContain('- [notes] test notes');
      expect(result).toContain('- [proof] proof link');

      // 验证运行记录格式
      expect(result).toContain('**Verification Runs:**');
      expect(result).toContain('- 2023-12-01T10:00:00Z by ai: pass');
      expect(result).toContain('  Notes: run notes');
      expect(result).toContain('  Proof: run proof');
    });

    it('应该在多个 EVR 之间使用统一的分隔符', () => {
      const evrs: ParsedEVR[] = [
        {
          id: 'evr-001',
          title: 'EVR 1',
          verify: 'verify 1',
          expect: 'expect 1',
          status: EVRStatus.Pass,
          runs: [],
        },
        {
          id: 'evr-002',
          title: 'EVR 2',
          verify: 'verify 2',
          expect: 'expect 2',
          status: EVRStatus.Fail,
          runs: [],
        },
      ];

      const result = renderer.renderEVRs(evrs);
      expect(result).toContain('---');

      // 确保分隔符在正确位置
      const sections = result.split('---');
      expect(sections).toHaveLength(2);
      expect(sections[0]).toContain('EVR 1');
      expect(sections[1]).toContain('EVR 2');
    });
  });

  describe('Round-trip 测试', () => {
    let parser: any;

    beforeEach(async () => {
      // 动态导入面板解析器
      const { createPanelParser } = await import('./panel-parser.js');
      parser = createPanelParser();
    });

    it('应该保持基本面板结构的往返一致性', async () => {
      const originalData: ParsedPanel = {
        title: '测试任务',
        requirements: ['需求1', '需求2'],
        issues: ['问题1'],
        hints: ['任务提示'],
        plans: [
          {
            id: 'plan-1',
            text: '实现功能',
            status: CheckboxState.InProgress,
            hints: [],
            contextTags: [],
            evrBindings: [],
            steps: [],
            anchor: 'plan:p-12345678',
          },
        ],
        evrs: [],
        logs: [],
        metadata: {
          parsedAt: '2023-12-01T10:00:00Z',
          parserVersion: '1.0.0',
          stats: {
            totalPlans: 1,
            totalSteps: 0,
            totalEVRs: 0,
            parseErrors: 0,
            toleranceFixCount: 0,
          },
          parseErrors: [],
          toleranceFixes: [],
        },
      };

      // 渲染为 Markdown
      const markdown = renderer.renderToMarkdown(originalData);

      // 解析回结构化数据
      const parsedData = parser.parseMarkdown(markdown);

      // 验证关键字段等价
      expect(parsedData.title).toBe(originalData.title);
      expect(parsedData.requirements).toEqual(originalData.requirements);
      expect(parsedData.issues).toEqual(originalData.issues);
      expect(parsedData.hints).toEqual(originalData.hints);
      expect(parsedData.plans).toHaveLength(originalData.plans.length);
      expect(parsedData.plans[0].text).toBe(originalData.plans[0].text);
      expect(parsedData.plans[0].status).toBe(originalData.plans[0].status);
    });

    it('应该保持计划和步骤状态的往返一致性', async () => {
      const originalData: ParsedPanel = {
        title: '状态测试',
        requirements: [],
        issues: [],
        hints: [],
        plans: [
          {
            id: 'plan-1',
            text: '待办计划',
            status: CheckboxState.ToDo,
            hints: [],
            contextTags: [],
            evrBindings: [],
            steps: [
              {
                id: 'step-1',
                text: '进行中步骤',
                status: CheckboxState.InProgress,
                hints: [],
                contextTags: [],
                usesEVR: [],
              },
              {
                id: 'step-2',
                text: '已完成步骤',
                status: CheckboxState.Completed,
                hints: [],
                contextTags: [],
                usesEVR: [],
              },
            ],
          },
          {
            id: 'plan-2',
            text: '阻塞计划',
            status: CheckboxState.Blocked,
            hints: [],
            contextTags: [],
            evrBindings: [],
            steps: [],
          },
        ],
        evrs: [],
        logs: [],
        metadata: {
          parsedAt: '2023-12-01T10:00:00Z',
          parserVersion: '1.0.0',
          stats: {
            totalPlans: 2,
            totalSteps: 2,
            totalEVRs: 0,
            parseErrors: 0,
            toleranceFixCount: 0,
          },
          parseErrors: [],
          toleranceFixes: [],
        },
      };

      const markdown = renderer.renderToMarkdown(originalData);
      const parsedData = parser.parseMarkdown(markdown);

      // 验证计划状态
      expect(parsedData.plans[0].status).toBe(CheckboxState.ToDo);
      expect(parsedData.plans[1].status).toBe(CheckboxState.Blocked);

      // 验证步骤状态
      expect(parsedData.plans[0].steps[0].status).toBe(
        CheckboxState.InProgress
      );
      expect(parsedData.plans[0].steps[1].status).toBe(CheckboxState.Completed);
    });

    it('应该保持 EVR 关键字段的往返一致性', async () => {
      const originalData: ParsedPanel = {
        title: 'EVR 测试',
        requirements: [],
        issues: [],
        hints: [],
        plans: [],
        evrs: [
          {
            id: 'evr-001',
            title: '功能验证',
            verify: '运行测试命令',
            expect: '所有测试通过',
            status: EVRStatus.Pass,
            class: EVRClass.Runtime,
            lastRun: '2023-12-01T10:00:00Z',
            notes: '验证备注',
            proof: 'test-output.log',
            runs: [
              {
                at: '2023-12-01T10:00:00Z',
                by: 'ai',
                status: EVRStatus.Pass,
                notes: '运行成功',
                proof: 'proof-link',
              },
            ],
          },
          {
            id: 'evr-002',
            title: '数组 EVR',
            verify: ['步骤1', '步骤2', '步骤3'],
            expect: ['结果1', '结果2'],
            status: EVRStatus.Unknown,
            runs: [],
          },
        ],
        logs: [],
        metadata: {
          parsedAt: '2023-12-01T10:00:00Z',
          parserVersion: '1.0.0',
          stats: {
            totalPlans: 0,
            totalSteps: 0,
            totalEVRs: 2,
            parseErrors: 0,
            toleranceFixCount: 0,
          },
          parseErrors: [],
          toleranceFixes: [],
        },
      };

      const markdown = renderer.renderToMarkdown(originalData);
      const parsedData = parser.parseMarkdown(markdown);

      // 验证第一个 EVR
      const evr1 = parsedData.evrs[0];
      expect(evr1.title).toBe('功能验证');
      expect(evr1.verify).toBe('运行测试命令');
      expect(evr1.expect).toBe('所有测试通过');
      expect(evr1.status).toBe(EVRStatus.Pass);

      // 验证第二个 EVR（数组类型）
      const evr2 = parsedData.evrs[1];
      expect(evr2.title).toBe('数组 EVR');
      expect(evr2.status).toBe(EVRStatus.Unknown);

      // 注意：数组字段在渲染时可能被折叠，解析时需要正确恢复
      // 这里我们主要验证核心字段能够正确往返
      expect(evr2.verify).toBeDefined();
      expect(evr2.expect).toBeDefined();
    });

    it('应该保持上下文标签的往返一致性', async () => {
      const originalData: ParsedPanel = {
        title: '标签测试',
        requirements: [],
        issues: [],
        hints: [],
        plans: [
          {
            id: 'plan-1',
            text: '带标签的计划',
            status: CheckboxState.ToDo,
            hints: [],
            contextTags: [
              { tag: 'ref', value: 'docs/api.md', type: 'ref' },
              { tag: 'decision', value: 'use TypeScript', type: 'decision' },
              { tag: 'evr', value: 'evr-001', type: 'evr' },
            ],
            evrBindings: ['evr-001'],
            steps: [
              {
                id: 'step-1',
                text: '带标签的步骤',
                status: CheckboxState.ToDo,
                hints: [],
                contextTags: [
                  { tag: 'uses_evr', value: 'evr-002', type: 'uses_evr' },
                ],
                usesEVR: ['evr-002'],
              },
            ],
          },
        ],
        evrs: [],
        logs: [],
        metadata: {
          parsedAt: '2023-12-01T10:00:00Z',
          parserVersion: '1.0.0',
          stats: {
            totalPlans: 1,
            totalSteps: 1,
            totalEVRs: 0,
            parseErrors: 0,
            toleranceFixCount: 0,
          },
          parseErrors: [],
          toleranceFixes: [],
        },
      };

      const markdown = renderer.renderToMarkdown(originalData);
      const parsedData = parser.parseMarkdown(markdown);

      // 验证计划级标签
      const plan = parsedData.plans[0];
      expect(plan.contextTags).toHaveLength(3);
      expect(plan.contextTags.find((tag) => tag.tag === 'ref')).toBeDefined();
      expect(
        plan.contextTags.find((tag) => tag.tag === 'decision')
      ).toBeDefined();
      expect(plan.contextTags.find((tag) => tag.tag === 'evr')).toBeDefined();

      // 验证步骤级标签
      const step = plan.steps[0];
      expect(step.contextTags).toHaveLength(1);
      expect(step.contextTags[0].tag).toBe('uses_evr');
      expect(step.contextTags[0].value).toBe('evr-002');
    });

    it('应该保持提示信息的往返一致性', async () => {
      const originalData: ParsedPanel = {
        title: '提示测试',
        requirements: [],
        issues: [],
        hints: ['任务级提示1', '任务级提示2'],
        plans: [
          {
            id: 'plan-1',
            text: '带提示的计划',
            status: CheckboxState.ToDo,
            hints: ['计划提示1', '计划提示2'],
            contextTags: [],
            evrBindings: [],
            steps: [
              {
                id: 'step-1',
                text: '带提示的步骤',
                status: CheckboxState.ToDo,
                hints: ['步骤提示'],
                contextTags: [],
                usesEVR: [],
              },
            ],
          },
        ],
        evrs: [],
        logs: [],
        metadata: {
          parsedAt: '2023-12-01T10:00:00Z',
          parserVersion: '1.0.0',
          stats: {
            totalPlans: 1,
            totalSteps: 1,
            totalEVRs: 0,
            parseErrors: 0,
            toleranceFixCount: 0,
          },
          parseErrors: [],
          toleranceFixes: [],
        },
      };

      const markdown = renderer.renderToMarkdown(originalData);
      const parsedData = parser.parseMarkdown(markdown);

      // 验证任务级提示
      expect(parsedData.hints).toEqual(['任务级提示1', '任务级提示2']);

      // 验证计划级提示
      expect(parsedData.plans[0].hints).toEqual(['计划提示1', '计划提示2']);

      // 验证步骤级提示
      expect(parsedData.plans[0].steps[0].hints).toEqual(['步骤提示']);
    });
  });

  describe('工厂函数', () => {
    it('应该创建默认配置的渲染器', () => {
      const renderer = createPanelRenderer();
      expect(renderer).toBeInstanceOf(PanelRenderer);
    });

    it('应该创建自定义配置的渲染器', () => {
      const options = {
        injectAnchors: false,
        collapseArrays: false,
        indentString: '    ',
      };

      const renderer = createPanelRenderer(options);
      expect(renderer).toBeInstanceOf(PanelRenderer);
    });
  });
});
