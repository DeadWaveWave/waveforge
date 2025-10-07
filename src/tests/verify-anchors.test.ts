import { describe, it, expect } from 'vitest';
import { PanelRenderer } from '../core/panel-renderer.js';

describe('验证单一锚点', () => {
  it('应该只为每个计划生成一个锚点', () => {
    const renderer = new PanelRenderer({ injectAnchors: true });

    const testData = {
      title: '测试任务',
      requirements: [],
      issues: [],
      hints: [],
      plans: [
        {
          id: 'plan-1',
          text: '第一个计划',
          status: 'to_do',
          hints: [],
          contextTags: [],
          evrBindings: [],
          steps: [],
        },
        {
          id: 'plan-2',
          text: '第二个计划',
          status: 'to_do',
          hints: [],
          contextTags: [],
          evrBindings: [],
          steps: [],
        },
      ],
      evrs: [],
      logs: [],
    };

    const markdown = renderer.renderToMarkdown(testData);

    // 检查第一个计划
    const plan1Match = markdown.match(/1\.\s+\[.\]\s+第一个计划[^\n]*/);
    expect(plan1Match).toBeTruthy();
    const plan1Line = plan1Match[0];

    // 计算锚点数量
    const anchorCount1 = (plan1Line.match(/<!--/g) || []).length;
    console.log('计划1内容:', plan1Line);
    console.log('计划1锚点数量:', anchorCount1);
    expect(anchorCount1).toBe(1); // 应该只有一个锚点

    // 检查第二个计划
    const plan2Match = markdown.match(/2\.\s+\[.\]\s+第二个计划[^\n]*/);
    expect(plan2Match).toBeTruthy();
    const plan2Line = plan2Match[0];

    const anchorCount2 = (plan2Line.match(/<!--/g) || []).length;
    console.log('计划2内容:', plan2Line);
    console.log('计划2锚点数量:', anchorCount2);
    expect(anchorCount2).toBe(1); // 应该只有一个锚点

    // 验证锚点格式正确
    expect(plan1Line).toContain('<!-- plan:plan-1 -->');
    expect(plan2Line).toContain('<!-- plan:plan-2 -->');

    // 验证没有随机生成的锚点
    expect(plan1Line).not.toMatch(/<!-- plan:p-[a-z0-9]+ -->/);
    expect(plan2Line).not.toMatch(/<!-- plan:p-[a-z0-9]+ -->/);
  });
});
