/**
 * 日志高亮系统测试
 */

import { describe, it, expect } from 'vitest';
import { LogHighlightSelector } from './log-highlights.js';
import { LogCategory, LogAction, LogLevel } from '../types/index.js';

describe('LogHighlightSelector', () => {
    describe('TDD: Given 多条不同类别日志，When 生成 highlights', () => {
        it('Then 按优先级与上限聚合，产生诸如 "VERIFIED × 4"', () => {
            // Given: 多条不同类别的日志
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR-001 验证通过',
                },
                {
                    timestamp: '2025-10-01T10:01:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR-002 验证通过',
                },
                {
                    timestamp: '2025-10-01T10:02:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR-003 验证通过',
                },
                {
                    timestamp: '2025-10-01T10:03:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR-004 验证通过',
                },
                {
                    timestamp: '2025-10-01T10:04:00.000Z',
                    level: LogLevel.Error,
                    category: LogCategory.Exception,
                    action: LogAction.Handle,
                    message: '同步冲突',
                },
                {
                    timestamp: '2025-10-01T10:05:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Task,
                    action: LogAction.PanelEdit,
                    message: '面板内容已同步',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: VERIFIED 应该聚合为 "VERIFIED × 4"
            const verifiedHighlight = highlights.find(
                (h) => h.action === LogAction.Verified
            );
            expect(verifiedHighlight).toBeDefined();
            expect(verifiedHighlight?.count).toBe(4);
            expect(verifiedHighlight?.message).toMatch(/VERIFIED.*×.*4/);

            // Then: EXCEPTION 必然入选
            const exceptionHighlight = highlights.find(
                (h) => h.category === LogCategory.Exception
            );
            expect(exceptionHighlight).toBeDefined();
        });

        it('Then EXCEPTION 必然入选且优先级最高', () => {
            // Given: 包含 EXCEPTION 的日志
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Task,
                    action: LogAction.Update,
                    message: '任务更新',
                },
                {
                    timestamp: '2025-10-01T10:01:00.000Z',
                    level: LogLevel.Error,
                    category: LogCategory.Exception,
                    action: LogAction.Handle,
                    message: '致命错误',
                },
                {
                    timestamp: '2025-10-01T10:02:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR 验证通过',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: EXCEPTION 在第一位
            expect(highlights[0].category).toBe(LogCategory.Exception);
        });
    });

    describe('优先级排序测试', () => {
        it('应该按 EXCEPTION > TEST > TASK/MODIFY > DISCUSSION 排序', () => {
            // Given: 各种类别的日志（时间戳相同以测试纯优先级）
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Discussion,
                    action: LogAction.Decision,
                    message: '重大决策',
                },
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Task,
                    action: LogAction.Update,
                    message: '任务更新',
                },
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR 验证',
                },
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Error,
                    category: LogCategory.Exception,
                    action: LogAction.Handle,
                    message: '异常处理',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 按优先级排序
            expect(highlights[0].category).toBe(LogCategory.Exception);
            expect(highlights[1].category).toBe(LogCategory.Test);
            expect(highlights[2].category).toBe(LogCategory.Task);
            expect(highlights[3].category).toBe(LogCategory.Discussion);
        });
    });

    describe('聚合显示测试', () => {
        it('应该聚合同类日志显示为 "ACTION × N"', () => {
            // Given: 多条相同 action 的日志
            const logs = Array.from({ length: 5 }, (_, i) => ({
                timestamp: `2025-10-01T10:0${i}:00.000Z`,
                level: LogLevel.Info,
                category: LogCategory.Test,
                action: LogAction.Failed,
                message: `EVR-00${i} 验证失败`,
            }));

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 聚合为一条记录
            expect(highlights.length).toBe(1);
            expect(highlights[0].count).toBe(5);
            expect(highlights[0].message).toMatch(/FAILED.*×.*5/);
        });

        it('应该为不同 action 分别聚合', () => {
            // Given: 不同 action 的日志
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR-001 验证通过',
                },
                {
                    timestamp: '2025-10-01T10:01:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR-002 验证通过',
                },
                {
                    timestamp: '2025-10-01T10:02:00.000Z',
                    level: LogLevel.Error,
                    category: LogCategory.Test,
                    action: LogAction.Failed,
                    message: 'EVR-003 验证失败',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 分别聚合
            expect(highlights.length).toBe(2);
            const verified = highlights.find((h) => h.action === LogAction.Verified);
            const failed = highlights.find((h) => h.action === LogAction.Failed);
            expect(verified?.count).toBe(2);
            expect(failed?.count).toBe(1);
        });
    });

    describe('高亮上限测试', () => {
        it('应该限制高亮数量不超过上限', () => {
            // Given: 大量不同类别的日志
            const logs = Array.from({ length: 50 }, (_, i) => ({
                timestamp: `2025-10-01T10:${String(i).padStart(2, '0')}:00.000Z`,
                level: LogLevel.Info,
                category: LogCategory.Task,
                action: `ACTION_${i}` as LogAction,
                message: `日志 ${i}`,
            }));

            // When: 生成高亮（默认上限 20）
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 不超过上限
            expect(highlights.length).toBeLessThanOrEqual(20);
        });

        it('应该支持自定义高亮上限', () => {
            // Given: 多条日志
            const logs = Array.from({ length: 30 }, (_, i) => ({
                timestamp: `2025-10-01T10:${String(i).padStart(2, '0')}:00.000Z`,
                level: LogLevel.Info,
                category: LogCategory.Task,
                action: `ACTION_${i}` as LogAction,
                message: `日志 ${i}`,
            }));

            // When: 设置上限为 10
            const selector = new LogHighlightSelector({ maxHighlights: 10 });
            const highlights = selector.selectHighlights(logs);

            // Then: 不超过 10 条
            expect(highlights.length).toBeLessThanOrEqual(10);
        });
    });

    describe('特殊场景测试', () => {
        it('应该处理空日志列表', () => {
            // Given: 空日志列表
            const logs: any[] = [];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 返回空数组
            expect(highlights).toEqual([]);
        });

        it('应该过滤掉无效的日志条目', () => {
            // Given: 包含无效日志的列表
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR 验证通过',
                },
                null,
                undefined,
                {
                    timestamp: '2025-10-01T10:01:00.000Z',
                    // 缺少 category
                    level: LogLevel.Info,
                    action: LogAction.Update,
                    message: '无效日志',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs as any);

            // Then: 只包含有效日志
            expect(highlights.length).toBeGreaterThan(0);
            expect(highlights.every((h) => h.category)).toBe(true);
        });
    });

    describe('EVR 验证高亮测试', () => {
        it('应该高亮 VERIFIED 标记', () => {
            // Given: EVR 验证成功的日志
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Test,
                    action: LogAction.Verified,
                    message: 'EVR-001 验证通过：API 返回 200',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 包含 VERIFIED 高亮
            expect(highlights[0].action).toBe(LogAction.Verified);
            expect(highlights[0].category).toBe(LogCategory.Test);
        });

        it('应该高亮 FAILED 标记', () => {
            // Given: EVR 验证失败的日志
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Error,
                    category: LogCategory.Test,
                    action: LogAction.Failed,
                    message: 'EVR-001 验证失败：预期 200，实际 404',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 包含 FAILED 高亮
            expect(highlights[0].action).toBe(LogAction.Failed);
            expect(highlights[0].category).toBe(LogCategory.Test);
        });
    });

    describe('面板编辑高亮测试', () => {
        it('应该高亮 PANEL_EDIT 标记', () => {
            // Given: 面板编辑同步的日志
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Task,
                    action: LogAction.PanelEdit,
                    message: '面板内容已同步：3 个字段更新',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 包含 PANEL_EDIT 高亮
            expect(highlights[0].action).toBe(LogAction.PanelEdit);
            expect(highlights[0].category).toBe(LogCategory.Task);
        });
    });

    describe('决策和影响高亮测试', () => {
        it('应该高亮 DECISION 标记', () => {
            // Given: 重大决策的日志
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Discussion,
                    action: LogAction.Decision,
                    message: '决定采用 JWT 认证方案',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 包含 DECISION 高亮
            expect(highlights[0].action).toBe(LogAction.Decision);
            expect(highlights[0].category).toBe(LogCategory.Discussion);
        });

        it('应该高亮 IMPACT 标记', () => {
            // Given: 重大影响的日志
            const logs = [
                {
                    timestamp: '2025-10-01T10:00:00.000Z',
                    level: LogLevel.Info,
                    category: LogCategory.Task,
                    action: LogAction.Impact,
                    message: '架构变更影响 5 个模块',
                },
            ];

            // When: 生成高亮
            const selector = new LogHighlightSelector();
            const highlights = selector.selectHighlights(logs);

            // Then: 包含 IMPACT 高亮
            expect(highlights[0].action).toBe(LogAction.Impact);
        });
    });
});

