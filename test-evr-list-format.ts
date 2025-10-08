/**
 * 快速测试 EVR 列表项格式
 */

import { createPanelRenderer } from './src/core/panel-renderer.js';
import { EVRStatus, EVRClass } from './src/types/index.js';

const renderer = createPanelRenderer({ includeFrontMatter: false });

const testData: any = {
    title: 'EVR 格式测试',
    requirements: [],
    issues: [],
    hints: [],
    plans: [],
    evrs: [
        {
            id: 'evr-001',
            title: 'API 接口正常响应',
            verify: 'curl -X POST /api/upload',
            expect: '返回 200 状态码和上传链接',
            status: EVRStatus.Pass,
            class: EVRClass.Runtime,
            lastRun: '2025-10-07T10:00:00+08:00 by ai',
            notes: '已验证通过',
            runs: [],
            anchor: 'evr-001',
        },
        {
            id: 'evr-002',
            title: '支持多种文件格式',
            verify: ['上传 .jpg 文件', '上传 .pdf 文件', '上传 .docx 文件'],
            expect: ['JPG 上传成功', 'PDF 上传成功', 'DOCX 上传成功'],
            status: EVRStatus.Unknown,
            class: EVRClass.Static,
            runs: [],
            anchor: 'evr-002',
        },
    ],
    logs: [],
    metadata: {
        parsedAt: new Date().toISOString(),
        parserVersion: '1.0.0',
        stats: { totalPlans: 0, totalSteps: 0, totalEVRs: 2, parseErrors: 0, toleranceFixCount: 0 },
        parseErrors: [],
        toleranceFixes: [],
    },
};

const rendered = renderer.renderToMarkdown(testData);
console.log('渲染结果：');
console.log('=====================================');
console.log(rendered);
console.log('=====================================');

// 验证格式
console.log('\n验证结果：');
console.log('✅ 使用列表项格式:', rendered.includes('1. [x] API 接口正常响应'));
console.log('✅ 有复选框状态:', rendered.includes('[x]') || rendered.includes('[ ]'));
console.log('✅ 子项缩进3空格:', rendered.includes('   - [verify]'));
console.log('✅ 支持数组:', rendered.match(/- \[verify\]/g)?.length > 1);
console.log('❌ 不使用标题:', !rendered.includes('### API'));
console.log('❌ 不使用分隔符:', !rendered.includes('---'));

