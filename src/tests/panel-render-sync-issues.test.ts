/**
 * Panel Render & Sync Issues 测试
 * 验证深度 E2E 分析报告中发现的问题
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PanelRenderer, createPanelRenderer } from '../core/panel-renderer.js';
import { PanelParser, createPanelParser } from '../core/panel-parser.js';
import { LazySync, createLazySync } from '../core/lazy-sync.js';
import { EVRStatus, EVRClass, TaskStatus } from '../types/index.js';
import type { ParsedPanel, TaskData } from '../types/index.js';

describe('Panel Render & Sync Issues (深度 E2E 分析报告)', () => {
    let renderer: PanelRenderer;
    let parser: PanelParser;
    let lazySync: LazySync;

    beforeEach(() => {
        renderer = createPanelRenderer({ includeFrontMatter: false });
        parser = createPanelParser({ enableTolerance: true });
        lazySync = createLazySync();
    });

    describe('问题 1: EVR 格式 - 使用列表项格式 ✅', () => {
        it('应该使用列表项格式渲染 EVR（带复选框和编号）', () => {
            const parsedPanel: ParsedPanel = {
                title: '测试任务',
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
                        status: EVRStatus.Unknown,
                        class: EVRClass.Runtime,
                        runs: [],
                        anchor: 'evr-001',
                    },
                ],
                logs: [],
                metadata: {
                    parsedAt: new Date().toISOString(),
                    parserVersion: '1.0.0',
                    stats: { totalPlans: 0, totalSteps: 0, totalEVRs: 1, parseErrors: 0, toleranceFixCount: 0 },
                    parseErrors: [],
                    toleranceFixes: [],
                },
            };

            const rendered = renderer.renderToMarkdown(parsedPanel);

            // 应该使用列表项格式（带编号和复选框）
            expect(rendered).toContain('1. [ ] API 接口正常响应 <!-- evr:evr-001 -->');

            // 标签化条目应该缩进3空格
            expect(rendered).toContain('   - [verify] curl -X POST /api/upload');
            expect(rendered).toContain('   - [expect] 返回 200 状态码和上传链接');
            expect(rendered).toContain('   - [status] unknown');
            expect(rendered).toContain('   - [class] runtime');

            // 不应该包含旧的标题格式
            expect(rendered).not.toContain('### API 接口');
            expect(rendered).not.toContain('**Verify:**');
        });

        it('数组类型的 verify 和 expect 应该正确渲染为多个标签行', () => {
            const parsedPanel: ParsedPanel = {
                title: '测试任务',
                requirements: [],
                issues: [],
                hints: [],
                plans: [],
                evrs: [
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
                    stats: { totalPlans: 0, totalSteps: 0, totalEVRs: 1, parseErrors: 0, toleranceFixCount: 0 },
                    parseErrors: [],
                    toleranceFixes: [],
                },
            };

            const rendered = renderer.renderToMarkdown(parsedPanel);

            // 应该使用列表项格式
            expect(rendered).toContain('1. [ ] 支持多种文件格式');

            // 应该有多个缩进的标签行
            expect(rendered).toContain('   - [verify] 上传 .jpg 文件');
            expect(rendered).toContain('   - [verify] 上传 .pdf 文件');
            expect(rendered).toContain('   - [expect] JPG 上传成功');

            // 不应该使用折叠或旧标题格式
            expect(rendered).not.toContain('<details>');
            expect(rendered).not.toContain('###');
        });
    });

    describe('问题 2: 状态隔离 - 正常工作 ✅', () => {
        it('应该识别手动修改的复选框状态为 pending', async () => {
            const initialData: TaskData = {
                id: 'task-001',
                title: '测试任务',
                requirements: [],
                hints: [],
                plans: [
                    {
                        id: 'plan-1',
                        description: '计划 1',
                        text: '计划 1',
                        status: TaskStatus.ToDo,
                        hints: [],
                        steps: [],
                        evr_bindings: [],
                        context_tags: [],
                        created_at: new Date().toISOString(),
                    },
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const initialPanel = `# Task: 测试任务

## Plans & Steps

1. [ ] 计划 1 <!-- plan:plan-1 -->
`;

            // 用户手动修改
            const modifiedPanel = initialPanel.replace('1. [ ] 计划 1', '1. [x] 计划 1');

            // 检测差异
            const diff = lazySync.detectDifferences(modifiedPanel, initialData);

            // 应该有状态变更
            expect(diff.statusChanges).toHaveLength(1);
            expect(diff.statusChanges[0].target).toBe('plan');

            // 应用变更 - 状态不应该被应用
            const syncResult = await lazySync.applySyncChanges(diff);
            const statusApplied = syncResult.changes.some((c) => c.field === 'status');
            expect(statusApplied).toBe(false);
        });
    });

    describe('问题 3: 步骤同步 - 已修复 ✅', () => {
        it('应该正确检测新增的步骤', () => {
            const initialData: TaskData = {
                id: 'task-002',
                title: '测试任务',
                requirements: [],
                hints: [],
                plans: [
                    {
                        id: 'plan-1',
                        description: '计划 1',
                        text: '计划 1',
                        status: TaskStatus.InProgress,
                        hints: [],
                        steps: [],
                        evr_bindings: [],
                        context_tags: [],
                        created_at: new Date().toISOString(),
                    },
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const panelWithSteps = `# Task: 测试任务

## Plans & Steps

1. [-] 计划 1 <!-- plan:plan-1 -->

   1.1. [ ] 新增步骤 1 <!-- step:step-1 -->
   1.2. [ ] 新增步骤 2 <!-- step:step-2 -->
`;

            const parsed = parser.parseMarkdown(panelWithSteps);
            expect(parsed.plans[0].steps).toHaveLength(2);

            const diff = lazySync.detectDifferences(panelWithSteps, initialData);
            const newStepChanges = diff.contentChanges.filter((c) => c.field === 'new_step');
            expect(newStepChanges.length).toBe(2);
        });
    });

    describe('问题 4: EVR ID 稳定性 - 已修复 ✅', () => {
        it('EVR ID 在重新渲染后应该保持稳定', () => {
            const panel = `# Task: 测试任务

## Expected Visible Results

1. [ ] 测试结果 1 <!-- evr:evr-stable-001 -->

   - [verify] 测试
   - [expect] 通过
   - [status] unknown
`;

            const parsed1 = parser.parseMarkdown(panel);
            expect(parsed1.evrs[0].id).toBe('evr-stable-001');

            const rendered = renderer.renderToMarkdown(parsed1);
            const parsed2 = parser.parseMarkdown(rendered);
            expect(parsed2.evrs[0].id).toBe('evr-stable-001');
            expect(parsed2.evrs[0].anchor).toBe('evr-stable-001');
        });
    });

    describe('问题 5: Plan Hints - 正常工作 ✅', () => {
        it('Plan Hints 应该正确渲染和同步', () => {
            const parsedPanel: ParsedPanel = {
                title: '测试任务',
                requirements: [],
                issues: [],
                hints: [],
                plans: [
                    {
                        id: 'plan-1',
                        text: '计划 1',
                        status: 'to_do' as any,
                        hints: ['提示 1', '提示 2'],
                        contextTags: [],
                        evrBindings: [],
                        steps: [],
                    },
                ],
                evrs: [],
                logs: [],
                metadata: {
                    parsedAt: new Date().toISOString(),
                    parserVersion: '1.0.0',
                    stats: { totalPlans: 1, totalSteps: 0, totalEVRs: 0, parseErrors: 0, toleranceFixCount: 0 },
                    parseErrors: [],
                    toleranceFixes: [],
                },
            };

            const rendered = renderer.renderToMarkdown(parsedPanel);
            expect(rendered).toContain('> 提示 1');
            expect(rendered).toContain('> 提示 2');
        });
    });

    describe('EVR 复选框状态映射', () => {
        it('应该正确映射 EVR 状态到复选框', () => {
            const evrs = [
                { id: 'evr-1', title: 'Pass EVR', verify: 'test', expect: 'ok', status: EVRStatus.Pass, runs: [], anchor: 'evr-1' },
                { id: 'evr-2', title: 'Fail EVR', verify: 'test', expect: 'ok', status: EVRStatus.Fail, runs: [], anchor: 'evr-2' },
                { id: 'evr-3', title: 'Skip EVR', verify: 'test', expect: 'ok', status: EVRStatus.Skip, runs: [], anchor: 'evr-3' },
                { id: 'evr-4', title: 'Unknown EVR', verify: 'test', expect: 'ok', status: EVRStatus.Unknown, runs: [], anchor: 'evr-4' },
            ];

            const rendered = renderer.renderToMarkdown({
                title: '状态测试',
                requirements: [],
                issues: [],
                hints: [],
                plans: [],
                evrs,
                logs: [],
                metadata: { parsedAt: new Date().toISOString(), parserVersion: '1.0.0', stats: { totalPlans: 0, totalSteps: 0, totalEVRs: 4, parseErrors: 0, toleranceFixCount: 0 }, parseErrors: [], toleranceFixes: [] },
            });

            // 验证状态映射
            expect(rendered).toContain('1. [x] Pass EVR'); // pass → [x]
            expect(rendered).toContain('2. [!] Fail EVR'); // fail → [!]
            expect(rendered).toContain('3. [-] Skip EVR'); // skip → [-]
            expect(rendered).toContain('4. [ ] Unknown EVR'); // unknown → [ ]
        });
    });

    describe('锚点稳定性 - 单锚点验证 ✅', () => {
        it('应该只生成单个锚点，不应该有双重锚点', () => {
            const parsedPanel: ParsedPanel = {
                title: '测试任务',
                requirements: [],
                issues: [],
                hints: [],
                plans: [
                    {
                        id: 'plan-1',
                        text: '计划 1',
                        status: 'to_do' as any,
                        hints: [],
                        contextTags: [],
                        evrBindings: [],
                        steps: [],
                    },
                ],
                evrs: [
                    {
                        id: 'evr-001',
                        title: '测试 EVR',
                        verify: '测试',
                        expect: '通过',
                        status: EVRStatus.Unknown,
                        runs: [],
                        anchor: 'evr-001',
                    },
                ],
                logs: [],
                metadata: {
                    parsedAt: new Date().toISOString(),
                    parserVersion: '1.0.0',
                    stats: { totalPlans: 1, totalSteps: 0, totalEVRs: 1, parseErrors: 0, toleranceFixCount: 0 },
                    parseErrors: [],
                    toleranceFixes: [],
                },
            };

            const rendered = renderer.renderToMarkdown(parsedPanel);

            // 验证：计划只有一个锚点
            const planAnchors = rendered.match(/1\. \[ \] 计划 1.*?<!--.*?-->/)?.[0];
            const planAnchorCount = (planAnchors?.match(/<!--/g) || []).length;
            expect(planAnchorCount).toBe(1);

            // 验证：EVR 只有一个锚点（使用列表项格式）
            const evrAnchors = rendered.match(/1\. \[ \] 测试 EVR.*?<!--.*?-->/)?.[0];
            const evrAnchorCount = (evrAnchors?.match(/<!--/g) || []).length;
            expect(evrAnchorCount).toBe(1);
        });
    });
});

