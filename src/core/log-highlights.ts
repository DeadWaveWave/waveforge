/**
 * 日志高亮系统
 * 实现日志聚合、优先级排序和高亮选择
 */

/**
 * 高亮日志条目接口
 */
export interface HighlightedLog {
    /** 时间戳（最新一条的时间） */
    ts: string;
    /** 日志级别 */
    level: 'INFO' | 'WARN' | 'ERROR';
    /** 日志分类 */
    category: 'TEST' | 'TASK' | 'EXCEPTION' | 'DISCUSSION' | 'PLAN' | 'SYSTEM';
    /** 操作类型 */
    action?: string;
    /** 日志消息（聚合后的消息） */
    message: string;
    /** 聚合计数 */
    count: number;
    /** 原始日志条目（仅保留第一条用于追溯） */
    firstLog?: any;
}

/**
 * 日志高亮选择器配置
 */
export interface LogHighlightConfig {
    /** 最大高亮数量 */
    maxHighlights?: number;
    /** 是否启用聚合 */
    enableAggregation?: boolean;
}

/**
 * 日志分组键
 */
interface LogGroupKey {
    category: string;
    action: string;
}

/**
 * 日志分组
 */
interface LogGroup {
    key: LogGroupKey;
    logs: any[];
    latestTimestamp: string;
    priority: number;
}

/**
 * 日志高亮选择器
 * 负责筛选、聚合和排序日志，生成高亮显示的日志列表
 */
export class LogHighlightSelector {
    private readonly config: Required<LogHighlightConfig>;

    // 优先级映射：数值越小优先级越高
    private readonly categoryPriority: Record<string, number> = {
        EXCEPTION: 1,
        TEST: 2,
        TASK: 3,
        MODIFY: 3, // TASK 和 MODIFY 同级
        DISCUSSION: 4,
        PLAN: 5,
        SYSTEM: 6,
        KNOWLEDGE: 7,
        STEP: 8,
        HEALTH: 9,
    };

    constructor(config: LogHighlightConfig = {}) {
        this.config = {
            maxHighlights: config.maxHighlights ?? 20,
            enableAggregation: config.enableAggregation ?? true,
        };
    }

    /**
     * 选择高亮日志
     * @param logs 原始日志列表
     * @returns 高亮日志列表
     */
    selectHighlights(logs: any[]): HighlightedLog[] {
        // 过滤无效日志
        const validLogs = this.filterValidLogs(logs);

        if (validLogs.length === 0) {
            return [];
        }

        // 如果启用聚合，先聚合同类日志
        const groups = this.config.enableAggregation
            ? this.aggregateLogs(validLogs)
            : this.noAggregation(validLogs);

        // 按优先级和时间排序
        const sortedGroups = this.sortByPriority(groups);

        // 转换为 HighlightedLog 格式并限制数量
        return this.convertToHighlightedLogs(sortedGroups).slice(
            0,
            this.config.maxHighlights
        );
    }

    /**
     * 过滤有效的日志条目
     */
    private filterValidLogs(logs: any[]): any[] {
        return logs.filter(
            (log) =>
                log &&
                typeof log === 'object' &&
                log.timestamp &&
                log.category &&
                log.message
        );
    }

    /**
     * 聚合同类日志
     * 将相同 category + action 的日志合并为一组
     */
    private aggregateLogs(logs: any[]): LogGroup[] {
        const groupMap = new Map<string, LogGroup>();

        for (const log of logs) {
            const key: LogGroupKey = {
                category: log.category,
                action: log.action || 'UNKNOWN',
            };
            const keyStr = `${key.category}:${key.action}`;

            let group = groupMap.get(keyStr);
            if (!group) {
                group = {
                    key,
                    logs: [],
                    latestTimestamp: log.timestamp,
                    priority: this.getPriority(log.category),
                };
                groupMap.set(keyStr, group);
            }

            group.logs.push(log);

            // 更新最新时间戳
            if (new Date(log.timestamp) > new Date(group.latestTimestamp)) {
                group.latestTimestamp = log.timestamp;
            }
        }

        return Array.from(groupMap.values());
    }

    /**
     * 不聚合模式：每条日志单独成组
     */
    private noAggregation(logs: any[]): LogGroup[] {
        return logs.map((log) => ({
            key: {
                category: log.category,
                action: log.action || 'UNKNOWN',
            },
            logs: [log],
            latestTimestamp: log.timestamp,
            priority: this.getPriority(log.category),
        }));
    }

    /**
     * 获取类别的优先级
     */
    private getPriority(category: string): number {
        return this.categoryPriority[category] || 999;
    }

    /**
     * 按优先级和时间排序
     */
    private sortByPriority(groups: LogGroup[]): LogGroup[] {
        return groups.sort((a, b) => {
            // 首先按优先级排序（数值小的在前）
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }

            // 优先级相同时，按时间排序（新的在前）
            return (
                new Date(b.latestTimestamp).getTime() -
                new Date(a.latestTimestamp).getTime()
            );
        });
    }

    /**
     * 转换为 HighlightedLog 格式
     */
    private convertToHighlightedLogs(groups: LogGroup[]): HighlightedLog[] {
        return groups.map((group) => {
            const firstLog = group.logs[0];
            const count = group.logs.length;

            // 生成聚合消息
            const message = this.generateAggregatedMessage(group, firstLog, count);

            return {
                ts: group.latestTimestamp,
                level: this.mapLogLevel(firstLog.level),
                category: this.mapLogCategory(group.key.category),
                action: group.key.action,
                message,
                count,
                firstLog,
            };
        });
    }

    /**
     * 生成聚合消息
     */
    private generateAggregatedMessage(
        group: LogGroup,
        firstLog: any,
        count: number
    ): string {
        if (count === 1) {
            // 单条日志，直接返回原消息
            return firstLog.message;
        }

        // 多条日志，生成聚合消息
        const action = group.key.action;
        const actionDisplay = this.getActionDisplay(action);

        // 格式：ACTION × N (最新消息)
        const latestLog = group.logs[group.logs.length - 1];
        return `${actionDisplay} × ${count} (最新: ${latestLog.message})`;
    }

    /**
     * 获取 Action 的显示名称
     */
    private getActionDisplay(action: string): string {
        const displayMap: Record<string, string> = {
            VERIFIED: 'VERIFIED',
            FAILED: 'FAILED',
            PANEL_EDIT: 'PANEL_EDIT',
            DECISION: 'DECISION',
            IMPACT: 'IMPACT',
            UPDATE: 'UPDATE',
            CREATE: 'CREATE',
            MODIFY: 'MODIFY',
        };

        return displayMap[action] || action;
    }

    /**
     * 映射日志级别
     */
    private mapLogLevel(level: any): 'INFO' | 'WARN' | 'ERROR' {
        if (!level) return 'INFO';

        const levelStr = String(level).toUpperCase();
        if (levelStr === 'ERROR' || levelStr === 'FATAL') return 'ERROR';
        if (levelStr === 'WARN' || levelStr === 'WARNING') return 'WARN';
        return 'INFO';
    }

    /**
     * 映射日志类别
     */
    private mapLogCategory(
        category: string
    ): 'TEST' | 'TASK' | 'EXCEPTION' | 'DISCUSSION' | 'PLAN' | 'SYSTEM' {
        const categoryMap: Record<
            string,
            'TEST' | 'TASK' | 'EXCEPTION' | 'DISCUSSION' | 'PLAN' | 'SYSTEM'
        > = {
            TEST: 'TEST',
            TASK: 'TASK',
            EXCEPTION: 'EXCEPTION',
            DISCUSSION: 'DISCUSSION',
            PLAN: 'PLAN',
            SYSTEM: 'SYSTEM',
            MODIFY: 'TASK', // MODIFY 映射到 TASK
            KNOWLEDGE: 'SYSTEM',
            STEP: 'SYSTEM',
            HEALTH: 'SYSTEM',
        };

        return categoryMap[category] || 'SYSTEM';
    }
}

