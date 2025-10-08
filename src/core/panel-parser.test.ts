/**
 * PanelParser 单元测试
 * 测试面板解析器的各种功能和边界情况
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PanelParser, createPanelParser } from './panel-parser.js';
import {
  InMemoryPanelFS,
  createInMemoryPanelFS,
} from './in-memory-panel-fs.js';
import {
  CheckboxState,
  EVRStatus,
  EVRClass,
  type PanelParseOptions,
} from '../types/index.js';

describe('PanelParser', () => {
  let parser: PanelParser;
  let fs: InMemoryPanelFS;

  beforeEach(() => {
    parser = createPanelParser();
    fs = createInMemoryPanelFS();
  });

  describe('基础解析功能', () => {
    it('应该正确解析标准格式的面板', () => {
      const content = `# 测试任务

## 验收标准

这是测试任务的验收标准。

## 整体计划

1. [x] 完成第一个计划 <!-- plan:plan-1 -->
   > 这是第一个计划的提示
   - [ref] docs/api.md
   - [evr] evr-001

   - [x] 完成第一个步骤 <!-- step:step-1-1 -->
   - [-] 进行第二个步骤 <!-- step:step-1-2 -->

2. [-] 进行第二个计划 <!-- plan:plan-2 -->
   - [ ] 待办第一个步骤
   - [ ] 待办第二个步骤

## EVR 预期结果

1. [x] EVR-001 基础功能验证 <!-- evr:evr-001 -->

   - [verify] 运行测试套件
   - [expect] 所有测试通过
   - [status] pass
   - [class] runtime
`;

      const result = parser.parseMarkdown(content);

      expect(result.title).toBe('测试任务');
      expect(result.requirements).toContain('这是测试任务的验收标准。');
      expect(result.plans).toHaveLength(2);
      expect(result.evrs).toHaveLength(1);

      // 验证第一个计划
      const plan1 = result.plans[0];
      expect(plan1.id).toBe('plan-1');
      expect(plan1.text).toBe('完成第一个计划');
      expect(plan1.status).toBe(CheckboxState.Completed);
      expect(plan1.hints).toContain('这是第一个计划的提示');
      expect(plan1.contextTags).toHaveLength(2);
      expect(plan1.evrBindings).toContain('evr-001');
      expect(plan1.steps).toHaveLength(2);

      // 验证步骤
      const step1 = plan1.steps[0];
      expect(step1.id).toBe('step-1-1');
      expect(step1.status).toBe(CheckboxState.Completed);

      const step2 = plan1.steps[1];
      expect(step2.id).toBe('step-1-2');
      expect(step2.status).toBe(CheckboxState.InProgress);

      // 验证 EVR
      const evr1 = result.evrs[0];
      expect(evr1.id).toBe('evr-001');
      expect(evr1.title).toBe('EVR-001 基础功能验证');
      expect(evr1.verify).toBe('运行测试套件');
      expect(evr1.expect).toBe('所有测试通过');
      expect(evr1.status).toBe(EVRStatus.Pass);
      expect(evr1.class).toBe(EVRClass.Runtime);
    });

    it('应该正确解析复选框状态', () => {
      const content = `# 测试任务

## 整体计划

1. [ ] 待办任务
2. [-] 进行中任务
3. [x] 已完成任务
4. [!] 阻塞任务
`;

      const result = parser.parseMarkdown(content);

      expect(result.plans).toHaveLength(4);
      expect(result.plans[0].status).toBe(CheckboxState.ToDo);
      expect(result.plans[1].status).toBe(CheckboxState.InProgress);
      expect(result.plans[2].status).toBe(CheckboxState.Completed);
      expect(result.plans[3].status).toBe(CheckboxState.Blocked);
    });

    it('应该正确解析多行 EVR 字段', () => {
      const content = `# 测试任务

## EVR 预期结果

1. [ ] 多行验证 <!-- evr:evr-multi -->

   - [verify] 运行单元测试
   - [verify] 运行集成测试
   - [verify] 检查代码覆盖率
   - [expect] 所有测试通过
   - [expect] 覆盖率达到 80%
   - [expect] 没有 lint 错误
   - [status] unknown
`;

      const result = parser.parseMarkdown(content);

      expect(result.evrs).toHaveLength(1);
      const evr = result.evrs[0];
      expect(Array.isArray(evr.verify)).toBe(true);
      expect(Array.isArray(evr.expect)).toBe(true);
      expect((evr.verify as string[]).length).toBe(3);
      expect((evr.expect as string[]).length).toBe(3);
    });
  });

  describe('稳定锚点识别', () => {
    it('应该优先使用稳定锚点', () => {
      const content = `# 测试任务

## 整体计划

1. [x] 第一个计划 <!-- plan:stable-plan-1 -->
   - [x] 第一个步骤 <!-- step:stable-step-1 -->

2. [x] 第二个计划
   - [x] 没有锚点的步骤
`;

      const result = parser.parseMarkdown(content);

      expect(result.plans[0].id).toBe('stable-plan-1');
      expect(result.plans[0].anchor).toBe('stable-plan-1');
      expect(result.plans[0].steps[0].id).toBe('stable-step-1');
      expect(result.plans[0].steps[0].anchor).toBe('stable-step-1');

      // 第二个计划应该使用序号路径回退
      expect(result.plans[1].id).toBe('plan-2');
      expect(result.plans[1].numberPath).toBe('2');
    });

    it('应该在缺少锚点时使用序号路径回退', () => {
      const content = `# 测试任务

## 整体计划

1. [x] 第一个计划
   1.1. [x] 第一个步骤
   1.2. [-] 第二个步骤

2. [-] 第二个计划
   2.1. [ ] 第一个步骤
`;

      const result = parser.parseMarkdown(content);

      expect(result.plans[0].id).toBe('plan-1');
      expect(result.plans[0].numberPath).toBe('1');
      expect(result.plans[0].steps[0].id).toBe('step-1.1');
      expect(result.plans[0].steps[0].numberPath).toBe('1.1');
      expect(result.plans[0].steps[1].id).toBe('step-1.2');
      expect(result.plans[0].steps[1].numberPath).toBe('1.2');

      expect(result.plans[1].id).toBe('plan-2');
      expect(result.plans[1].numberPath).toBe('2');
    });

    it('应该检测重复的锚点 ID', () => {
      const content = `# 测试任务

## 整体计划

1. [x] 第一个计划 <!-- plan:duplicate-id -->
2. [x] 第二个计划 <!-- plan:duplicate-id -->
`;

      const result = parser.parseMarkdown(content);

      // 应该有解析错误记录
      expect(result.metadata.parseErrors.length).toBeGreaterThan(0);
      const duplicateError = result.metadata.parseErrors.find(
        (error) => error.type === 'duplicate_id'
      );
      expect(duplicateError).toBeDefined();
      expect(duplicateError?.message).toContain('duplicate-id');
    });
  });

  describe('容错解析', () => {
    it('应该标准化不同的复选框变体', () => {
      const content = `# 测试任务

## 整体计划

1. [~] 进行中任务（波浪号）
2. [/] 进行中任务（斜杠）
3. [X] 完成任务（大写X）
4. [✓] 完成任务（勾号）
5. [✗] 阻塞任务（叉号）
`;

      const result = parser.parseWithTolerance(content);

      expect(result.plans[0].status).toBe(CheckboxState.InProgress);
      expect(result.plans[1].status).toBe(CheckboxState.InProgress);
      expect(result.plans[2].status).toBe(CheckboxState.Completed);
      expect(result.plans[3].status).toBe(CheckboxState.Completed);
      expect(result.plans[4].status).toBe(CheckboxState.Blocked);

      // 应该有容错修复记录
      expect(result.metadata.toleranceFixes.length).toBeGreaterThan(0);
    });

    it('应该修复不一致的缩进', () => {
      const content = `# 测试任务

## 整体计划

1. [x] 第一个计划
    - [x] 4空格缩进的步骤
	- [x] 制表符缩进的步骤
   - [x] 3空格缩进的步骤
  - [x] 2空格缩进的步骤
`;

      const result = parser.parseWithTolerance(content);

      expect(result.plans[0].steps).toHaveLength(4);

      // 应该有缩进修复记录
      const indentFixes = result.metadata.toleranceFixes.filter(
        (fix) => fix.type === 'fix_indentation'
      );
      expect(indentFixes.length).toBeGreaterThan(0);
    });

    it('应该自动生成缺失的锚点', () => {
      const content = `# 测试任务

## 整体计划

1. [x] 没有锚点的计划
   - [x] 没有锚点的步骤

## EVR 预期结果

1. [ ] 没有锚点的 EVR

   - [verify] 测试
   - [expect] 通过
   - [status] unknown
`;

      const result = parser.parseWithTolerance(content);

      // 应该生成锚点
      expect(result.plans[0].id).toMatch(/^plan-/);
      expect(result.plans[0].steps[0].id).toMatch(/^step-/);
      expect(result.evrs[0].id).toMatch(/^evr-/);

      // 应该有锚点生成记录
      const anchorFixes = result.metadata.toleranceFixes.filter(
        (fix) => fix.type === 'generate_anchor'
      );
      expect(anchorFixes.length).toBeGreaterThan(0);
    });

    it('应该修复空行缺失问题', () => {
      const content = `# 测试任务
## 验收标准
这里缺少空行
## 整体计划
1. [x] 第一个计划
2. [x] 第二个计划
## EVR 预期结果
1. [ ] EVR-001

   - [verify] 测试
   - [status] unknown`;

      const result = parser.parseWithTolerance(content);

      // 应该有空行修复记录
      const blankLineFixes = result.metadata.toleranceFixes.filter(
        (fix) => fix.type === 'add_missing_line'
      );
      expect(blankLineFixes.length).toBeGreaterThan(0);
    });
  });

  describe('边界情况处理', () => {
    it('应该处理空内容', () => {
      const result = parser.parseMarkdown('');

      expect(result.title).toBe('未命名任务');
      expect(result.plans).toHaveLength(0);
      expect(result.evrs).toHaveLength(0);
      expect(result.metadata.parseErrors.length).toBe(0);
    });

    it('应该处理只有标题的内容', () => {
      const content = '# 只有标题的任务';

      const result = parser.parseMarkdown(content);

      expect(result.title).toBe('只有标题的任务');
      expect(result.plans).toHaveLength(0);
      expect(result.evrs).toHaveLength(0);
    });

    it('应该处理格式错误的复选框', () => {
      const content = `# 测试任务

## 整体计划

1. 没有复选框的行
2. [错误格式] 错误的复选框
3. [x] 正确的复选框
`;

      const result = parser.parseMarkdown(content);

      // 只有正确格式的复选框应该被解析为计划
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].text).toBe('正确的复选框');
    });

    it('应该处理嵌套层级过深的情况', () => {
      const content = `# 测试任务

## 整体计划

1. [x] 第一级计划
   - [x] 第二级步骤
     - [x] 第三级（应该被忽略或处理为提示）
       - [x] 第四级（应该被忽略或处理为提示）
`;

      const result = parser.parseMarkdown(content);

      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].steps).toHaveLength(1);
      // 深层嵌套应该被处理为提示或忽略
    });

    it('应该处理特殊字符和 Unicode', () => {
      const content = `# 测试任务 🚀

## 整体计划

1. [x] 包含特殊字符的计划 @#$%^&*()
2. [x] 包含中文的计划：测试中文解析
3. [x] 包含 emoji 的计划 ✅ 🎯 📝
`;

      const result = parser.parseMarkdown(content);

      expect(result.title).toBe('测试任务 🚀');
      expect(result.plans).toHaveLength(3);
      expect(result.plans[0].text).toBe('包含特殊字符的计划 @#$%^&*()');
      expect(result.plans[1].text).toBe('包含中文的计划：测试中文解析');
      expect(result.plans[2].text).toBe('包含 emoji 的计划 ✅ 🎯 📝');
    });

    it('应该处理超长内容', () => {
      const longText = 'A'.repeat(10000);
      const content = `# ${longText}

## 整体计划

1. [x] ${longText}
`;

      const result = parser.parseMarkdown(content);

      expect(result.title).toBe(longText);
      expect(result.plans[0].text).toBe(longText);
    });
  });

  describe('解析选项配置', () => {
    it('应该支持禁用容错解析', () => {
      const options: Partial<PanelParseOptions> = {
        enableTolerance: false,
        normalizeCheckboxes: false,
        generateMissingAnchors: false,
      };

      const parser = createPanelParser(options);
      const content = `# 测试任务

## 整体计划

1. [~] 不标准的复选框
`;

      const result = parser.parseMarkdown(content);

      // 不应该标准化复选框
      expect(result.metadata.toleranceFixes.length).toBe(0);
    });

    it('应该支持限制容错修复次数', () => {
      const options: Partial<PanelParseOptions> = {
        maxToleranceFixes: 2,
      };

      const parser = createPanelParser(options);
      const content = `# 测试任务

## 整体计划

1. [~] 第一个
2. [/] 第二个
3. [X] 第三个
4. [✓] 第四个
5. [✗] 第五个
`;

      const result = parser.parseWithTolerance(content);

      // 应该限制修复次数
      expect(result.metadata.toleranceFixes.length).toBeLessThanOrEqual(2);
    });
  });

  describe('与 InMemoryPanelFS 集成', () => {
    it('应该能够从内存文件系统读取和解析面板', async () => {
      // 设置测试数据
      await fs.setupTestData();

      // 读取面板内容
      const content = await fs.readFile('/.wave/current-task.md');

      // 解析面板
      const result = parser.parseMarkdown(content);

      expect(result.title).toBe('测试任务');
      expect(result.plans.length).toBeGreaterThan(0);
      expect(result.evrs.length).toBeGreaterThan(0);
    });

    it('应该能够处理文件不存在的情况', async () => {
      await expect(fs.readFile('/nonexistent.md')).rejects.toThrow(
        '文件不存在'
      );
    });
  });

  describe('性能测试', () => {
    it('应该能够处理大型面板文件', () => {
      // 生成大型面板内容
      const plans = Array.from({ length: 100 }, (_, i) => {
        const steps = Array.from(
          { length: 10 },
          (_, j) => `   - [x] 步骤 ${i + 1}.${j + 1}`
        ).join('\n');

        return `${i + 1}. [x] 计划 ${i + 1}\n${steps}`;
      }).join('\n\n');

      const content = `# 大型测试任务

## 整体计划

${plans}
`;

      const startTime = Date.now();
      const result = parser.parseMarkdown(content);
      const endTime = Date.now();

      expect(result.plans).toHaveLength(100);
      expect(result.plans[0].steps).toHaveLength(10);

      // 解析时间应该在合理范围内（< 1秒）
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});

describe('PanelParser 工厂函数', () => {
  it('应该创建默认配置的解析器', () => {
    const parser = createPanelParser();
    expect(parser).toBeInstanceOf(PanelParser);
  });

  it('应该创建自定义配置的解析器', () => {
    const options: Partial<PanelParseOptions> = {
      enableTolerance: false,
      parserVersion: '2.0.0',
    };

    const parser = createPanelParser(options);
    expect(parser).toBeInstanceOf(PanelParser);
  });
});
