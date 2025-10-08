/**
 * LazySync 单元测试
 * 测试 Lazy 同步引擎的各种功能和边界情况
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LazySync, createLazySync } from './lazy-sync.js';
import { FakeTaskStore, createFakeTaskStore } from './fake-task-store.js';
import {
  TaskStatus,
  SyncConflictType,
  ConflictResolution,
  type TaskData,
  type SyncDiff,
} from '../types/index.js';

describe('LazySync', () => {
  let lazySync: LazySync;
  let fakeStore: FakeTaskStore;
  let sampleTask: TaskData;

  beforeEach(async () => {
    lazySync = createLazySync({
      enableRequestCache: true,
      enableAuditLog: true,
    });

    fakeStore = createFakeTaskStore({
      enableLogging: false,
      simulateDelay: false,
      simulateErrors: false,
    });

    // 创建示例任务数据
    sampleTask = await fakeStore.createSampleTask();
  });

  describe('差异检测', () => {
    it('应该检测到标题变更', () => {
      const panelContent = `# 修改后的任务标题

## 需求

- 支持面板与结构化数据的双向同步
- 实现智能冲突解决策略

## 整体计划

1. [x] 实现基础功能
   - [x] 创建核心类型定义
   - [-] 实现主要逻辑

2. [ ] 编写测试用例
   - [ ] 单元测试
   - [ ] 集成测试`;

      const diff = lazySync.detectDifferences(panelContent, sampleTask);

      expect(diff.hasChanges).toBe(true);

      // 查找标题变更
      const titleChange = diff.contentChanges.find(
        (c) => c.section === 'title' && c.field === 'title'
      );
      expect(titleChange).toMatchObject({
        section: 'title',
        field: 'title',
        oldValue: sampleTask.title,
        newValue: '修改后的任务标题',
        source: 'panel',
      });
    });

    it('应该检测到需求变更', () => {
      const panelContent = `# ${sampleTask.title}

## 需求

- 新增的需求项目
- 支持面板与结构化数据的双向同步

## 整体计划

1. [x] 实现基础功能
   - [x] 创建核心类型定义
   - [-] 实现主要逻辑`;

      const diff = lazySync.detectDifferences(panelContent, sampleTask);

      expect(diff.hasChanges).toBe(true);
      const requirementChange = diff.contentChanges.find(
        (c) => c.field === 'requirements'
      );
      expect(requirementChange).toBeDefined();
      expect(requirementChange?.newValue).toContain('新增的需求项目');
    });

    it('应该检测到计划状态变更（但不回写）', () => {
      const panelContent = `# ${sampleTask.title}

## 需求

- 支持面板与结构化数据的双向同步

## 整体计划

1. [x] 实现基础功能  <!-- 状态从 in_progress 改为 completed -->
   - [x] 创建核心类型定义
   - [-] 实现主要逻辑

2. [-] 编写测试用例  <!-- 状态从 to_do 改为 in_progress -->
   - [ ] 单元测试
   - [ ] 集成测试`;

      const diff = lazySync.detectDifferences(panelContent, sampleTask);

      expect(diff.hasChanges).toBe(true);
      expect(diff.statusChanges).toHaveLength(2);

      const planStatusChange = diff.statusChanges.find(
        (c) => c.target === 'plan' && c.id === 'plan-1'
      );
      expect(planStatusChange).toMatchObject({
        target: 'plan',
        id: 'plan-1',
        oldStatus: TaskStatus.InProgress,
        newStatus: TaskStatus.Completed,
      });

      const plan2StatusChange = diff.statusChanges.find(
        (c) => c.target === 'plan' && c.id === 'plan-2'
      );
      expect(plan2StatusChange).toMatchObject({
        target: 'plan',
        id: 'plan-2',
        oldStatus: TaskStatus.ToDo,
        newStatus: TaskStatus.InProgress,
      });
    });

    it('应该检测到 EVR 内容变更', () => {
      const panelContent = `# ${sampleTask.title}

## 需求

- 支持面板与结构化数据的双向同步

## EVR 预期结果

1. [ ] evr-001: 修改后的功能标题 <!-- evr:evr-001 -->

   - [verify] 运行完整测试套件
   - [expect] 所有测试通过且覆盖率达到90%
   - [status] unknown
   - [class] runtime`;

      const diff = lazySync.detectDifferences(panelContent, sampleTask);

      expect(diff.hasChanges).toBe(true);

      const titleChange = diff.contentChanges.find(
        (c) => c.section === 'evr:evr-001' && c.field === 'title'
      );
      expect(titleChange).toMatchObject({
        section: 'evr:evr-001',
        field: 'title',
        oldValue: '功能正常工作',
        newValue: 'evr-001: 修改后的功能标题',
        source: 'panel',
      });

      const verifyChange = diff.contentChanges.find(
        (c) => c.section === 'evr:evr-001' && c.field === 'verify'
      );
      expect(verifyChange).toMatchObject({
        section: 'evr:evr-001',
        field: 'verify',
        oldValue: '运行测试套件',
        newValue: '运行完整测试套件',
        source: 'panel',
      });
    });

    it('应该正确处理数组字段的变更', () => {
      const panelContent = `# ${sampleTask.title}

## EVR 预期结果

1. [ ] evr-002: 代码质量检查 <!-- evr:evr-002 -->

   - [verify] 运行 ESLint 检查
   - [verify] 运行 TypeScript 类型检查
   - [verify] 运行安全扫描
   - [expect] 无 ESLint 错误
   - [expect] 无类型错误
   - [expect] 无安全漏洞
   - [status] unknown
   - [class] static`;

      const diff = lazySync.detectDifferences(panelContent, sampleTask);

      expect(diff.hasChanges).toBe(true);

      const verifyChange = diff.contentChanges.find(
        (c) => c.section === 'evr:evr-002' && c.field === 'verify'
      );
      expect(verifyChange).toBeDefined();
      expect(Array.isArray(verifyChange?.newValue)).toBe(true);
      expect(verifyChange?.newValue).toHaveLength(3);
      expect(verifyChange?.newValue).toContain('运行安全扫描');

      const expectChange = diff.contentChanges.find(
        (c) => c.section === 'evr:evr-002' && c.field === 'expect'
      );
      expect(expectChange).toBeDefined();
      expect(Array.isArray(expectChange?.newValue)).toBe(true);
      expect(expectChange?.newValue).toHaveLength(3);
      expect(expectChange?.newValue).toContain('无安全漏洞');
    });

    it('应该在没有变更时返回空差异', () => {
      // 创建一个简化的任务数据，确保与面板内容完全一致
      const simpleTask: TaskData = {
        id: 'simple-task',
        title: '简单测试任务',
        goal: '测试目标',
        requirements: ['需求1', '需求2'],
        issues: [],
        hints: [],
        plans: [],
        expectedResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: 'test-project',
      };

      // 使用与结构化数据完全一致的面板内容
      const panelContent = `# 简单测试任务

## 需求

- 需求1
- 需求2`;

      const diff = lazySync.detectDifferences(panelContent, simpleTask);

      expect(diff.hasChanges).toBe(false);
      expect(diff.contentChanges).toHaveLength(0);
      expect(diff.statusChanges).toHaveLength(0);
      expect(diff.conflicts).toHaveLength(0);
    });
  });

  describe('同步变更应用', () => {
    it('应该应用内容变更并生成审计日志', async () => {
      const panelContent = `# 修改后的标题

## 需求

- 新增需求项目
- 支持面板与结构化数据的双向同步`;

      const diff = lazySync.detectDifferences(panelContent, sampleTask);
      const result = await lazySync.applySyncChanges(diff);

      expect(result.applied).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0); // 至少有标题和需求变更
      expect(result.auditEntries).toHaveLength(1);
      expect(result.auditEntries[0].type).toBe('sync');
      expect(result.mdVersion).toBeDefined();

      // 验证包含标题变更
      const titleChange = result.changes.find(
        (c) => c.section === 'title' && c.field === 'title'
      );
      expect(titleChange).toBeDefined();
      expect(titleChange?.newValue).toBe('修改后的标题');
    });

    it('应该不应用状态变更（状态隔离）', async () => {
      const panelContent = `# ${sampleTask.title}

## 需求

- 支持面板与结构化数据的双向同步
- 实现智能冲突解决策略
- 提供请求级缓存机制
- 记录详细的审计日志

## 整体计划

1. [x] 实现基础功能  <!-- 状态变更，不应该被应用 -->
   - [x] 创建核心类型定义
   - [-] 实现主要逻辑`;

      const diff = lazySync.detectDifferences(panelContent, sampleTask);
      const result = await lazySync.applySyncChanges(diff);

      // 可能有一些内容变更（如缺失的字段），但不应该有状态变更被应用
      expect(diff.statusChanges.length).toBeGreaterThan(0); // 状态变更被检测到

      // 检查是否有状态相关的变更被应用（不应该有）
      const statusRelatedChanges = result.changes.filter(
        (c) => c.field === 'status' || c.section.includes('status')
      );
      expect(statusRelatedChanges).toHaveLength(0);
    });

    it('应该解决冲突并记录审计日志', async () => {
      // 模拟一个有冲突的差异
      const diff: SyncDiff = {
        hasChanges: true,
        contentChanges: [],
        statusChanges: [],
        conflicts: [
          {
            region: 'plan:plan-1',
            field: 'description',
            reason: SyncConflictType.EtagMismatch,
            oursTs: '2023-01-01T10:00:00Z',
            theirsTs: '2023-01-01T09:00:00Z',
          },
        ],
        sectionFingerprints: {
          title: 'hash1',
          requirements: 'hash2',
          issues: 'hash3',
          hints: 'hash4',
          plans: { 'plan-1': 'hash5' },
          evrs: {},
          logs: 'hash6',
        },
      };

      const result = await lazySync.applySyncChanges(
        diff,
        'etag_first_then_ts'
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe(ConflictResolution.Ours); // 我们的时间戳更新
      expect(result.auditEntries).toHaveLength(1);
      expect(result.auditEntries[0].type).toBe('conflict');
    });
  });

  describe('区域指纹计算', () => {
    it('应该计算正确的区域指纹', () => {
      const content = `# 测试任务

## 需求

- 需求1
- 需求2

## 整体计划

1. [ ] 计划1
2. [ ] 计划2

## 功能验证

1. [ ] evr-001: 测试EVR

   - [verify] 测试
   - [expect] 通过
   - [status] unknown`;

      const fingerprints = lazySync.computeSectionFingerprints(content);

      expect(fingerprints.title).toBeDefined();
      expect(fingerprints.requirements).toBeDefined();
      expect(fingerprints.plans).toBeDefined();
      expect(fingerprints.evrs).toBeDefined();
      expect(typeof fingerprints.title).toBe('string');
      expect(fingerprints.title.length).toBeGreaterThan(0);
    });

    it('应该为相同内容生成相同指纹', () => {
      const content1 = `# 测试任务\n\n## 需求\n\n- 需求1`;
      const content2 = `# 测试任务\n\n## 需求\n\n- 需求1`;

      const fingerprints1 = lazySync.computeSectionFingerprints(content1);
      const fingerprints2 = lazySync.computeSectionFingerprints(content2);

      expect(fingerprints1.title).toBe(fingerprints2.title);
      expect(fingerprints1.requirements).toBe(fingerprints2.requirements);
    });

    it('应该为不同内容生成不同指纹', () => {
      const content1 = `# 测试任务1

## 需求

- 需求1`;
      const content2 = `# 测试任务2

## 需求

- 需求1`;

      const fingerprints1 = lazySync.computeSectionFingerprints(content1);
      const fingerprints2 = lazySync.computeSectionFingerprints(content2);

      expect(fingerprints1.title).not.toBe(fingerprints2.title);
      expect(fingerprints1.requirements).toBe(fingerprints2.requirements); // 需求部分相同
    });
  });

  describe('请求级缓存', () => {
    it('应该缓存同步结果', async () => {
      const requestId = 'test-request-1';
      const panelContent = `# 测试任务`;

      // 第一次同步
      const diff1 = lazySync.detectDifferences(panelContent, sampleTask);
      const result1 = await lazySync.applySyncChanges(diff1);

      lazySync.setCachedSync(requestId, result1, panelContent, sampleTask);

      // 获取缓存的结果
      const cachedResult = lazySync.getCachedSync(requestId);

      expect(cachedResult).toBeDefined();
      expect(cachedResult?.mdVersion).toBe(result1.mdVersion);
      expect(cachedResult?.applied).toBe(result1.applied);
    });

    it('应该在缓存过期后返回 null', async () => {
      const lazySyncWithShortCache = createLazySync({
        enableRequestCache: true,
        cacheExpiration: 10, // 10ms 过期时间
      });

      const requestId = 'test-request-2';
      const panelContent = `# 测试任务`;

      const diff = lazySyncWithShortCache.detectDifferences(
        panelContent,
        sampleTask
      );
      const result = await lazySyncWithShortCache.applySyncChanges(diff);

      lazySyncWithShortCache.setCachedSync(
        requestId,
        result,
        panelContent,
        sampleTask
      );

      // 等待缓存过期
      await new Promise((resolve) => setTimeout(resolve, 20));

      const cachedResult = lazySyncWithShortCache.getCachedSync(requestId);
      expect(cachedResult).toBeNull();
    });

    it('应该在禁用缓存时不缓存结果', async () => {
      const lazySyncNoCache = createLazySync({
        enableRequestCache: false,
      });

      const requestId = 'test-request-3';
      const panelContent = `# 测试任务`;

      const diff = lazySyncNoCache.detectDifferences(panelContent, sampleTask);
      const result = await lazySyncNoCache.applySyncChanges(diff);

      lazySyncNoCache.setCachedSync(
        requestId,
        result,
        panelContent,
        sampleTask
      );

      const cachedResult = lazySyncNoCache.getCachedSync(requestId);
      expect(cachedResult).toBeNull();
    });
  });

  describe('冲突解决策略', () => {
    it('应该使用 ETag 优先策略正确解决冲突', async () => {
      const diff: SyncDiff = {
        hasChanges: true,
        contentChanges: [],
        statusChanges: [],
        conflicts: [
          {
            region: 'plan:plan-1',
            field: 'description',
            reason: SyncConflictType.EtagMismatch,
            oursTs: '2023-01-01T10:00:00Z',
            theirsTs: '2023-01-01T11:00:00Z', // 他们的时间戳更新
          },
        ],
        sectionFingerprints: {
          title: 'hash1',
          requirements: 'hash2',
          issues: 'hash3',
          hints: 'hash4',
          plans: { 'plan-1': 'hash5' },
          evrs: {},
          logs: 'hash6',
        },
      };

      const result = await lazySync.applySyncChanges(
        diff,
        'etag_first_then_ts'
      );

      expect(result.conflicts[0].resolution).toBe(ConflictResolution.Theirs); // 他们的时间戳更新
    });

    it('应该使用时间戳策略正确解决冲突', async () => {
      const diff: SyncDiff = {
        hasChanges: true,
        contentChanges: [],
        statusChanges: [],
        conflicts: [
          {
            region: 'evr:evr-001',
            field: 'title',
            reason: SyncConflictType.ConcurrentUpdate,
            oursTs: '2023-01-01T12:00:00Z',
            theirsTs: '2023-01-01T11:00:00Z',
          },
        ],
        sectionFingerprints: {
          title: 'hash1',
          requirements: 'hash2',
          issues: 'hash3',
          hints: 'hash4',
          plans: {},
          evrs: { 'evr-001': 'hash5' },
          logs: 'hash6',
        },
      };

      const result = await lazySync.applySyncChanges(diff, 'ts_only');

      expect(result.conflicts[0].resolution).toBe(ConflictResolution.Ours); // 我们的时间戳更新
    });
  });

  describe('错误处理', () => {
    it('应该处理解析错误', () => {
      const invalidPanelContent = `# 测试任务

## 需求

- 需求1
- 需求2

## 整体计划

1. [invalid] 无效的复选框状态
2. [ ] 正常计划`;

      // 应该不抛出错误，而是通过容错解析处理
      expect(() => {
        lazySync.detectDifferences(invalidPanelContent, sampleTask);
      }).not.toThrow();
    });

    it('应该处理空面板内容', () => {
      const emptyContent = '';

      const diff = lazySync.detectDifferences(emptyContent, sampleTask);

      expect(diff.hasChanges).toBe(true); // 因为结构化数据有内容，面板为空
      expect(diff.contentChanges.length).toBeGreaterThan(0);
    });

    it('应该处理空结构化数据', () => {
      const panelContent = `# 测试任务

## 需求

- 需求1`;

      const emptyTask: TaskData = {
        id: 'empty-task',
        title: '',
        goal: '',
        requirements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: 'test-project',
      };

      const diff = lazySync.detectDifferences(panelContent, emptyTask);

      expect(diff.hasChanges).toBe(true);
      expect(diff.contentChanges.length).toBeGreaterThan(0);
    });
  });

  describe('工厂函数', () => {
    it('应该创建默认配置的 LazySync 实例', () => {
      const instance = createLazySync();
      expect(instance).toBeInstanceOf(LazySync);
    });

    it('应该创建自定义配置的 LazySync 实例', () => {
      const options = {
        enableRequestCache: false,
        defaultConflictStrategy: 'ts_only' as const,
        enableAuditLog: false,
      };

      const instance = createLazySync(options);
      expect(instance).toBeInstanceOf(LazySync);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理大型面板内容', () => {
      // 生成大型面板内容
      const largePanelContent = generateLargePanelContent(100, 10); // 100个计划，每个10个步骤

      const startTime = Date.now();
      const diff = lazySync.detectDifferences(largePanelContent, sampleTask);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
      expect(diff).toBeDefined();
    });

    it('应该正确处理复杂的嵌套结构', () => {
      const complexPanelContent = `# 复杂任务

## 需求

- 需求1
- 需求2
- 需求3

## 整体计划

1. [-] 复杂计划1
   - [x] 步骤1.1
     > 提示1.1
   - [-] 步骤1.2
     > 提示1.2
     > 多行提示
   - [ ] 步骤1.3
   > 计划级提示

2. [ ] 复杂计划2
   - [ ] 步骤2.1
   - [ ] 步骤2.2
   - [ ] 步骤2.3

## 功能验证

1. [ ] evr-001: 复杂验证1 <!-- evr:evr-001 -->

   - [verify] 验证项1
   - [verify] 验证项2
   - [verify] 验证项3
   - [expect] 期望结果1
   - [expect] 期望结果2
   - [status] unknown
   - [class] runtime

2. [x] evr-002: 复杂验证2 <!-- evr:evr-002 -->

   - [verify] 单行验证
   - [expect] 单行期望
   - [status] pass
   - [class] static`;

      expect(() => {
        const diff = lazySync.detectDifferences(
          complexPanelContent,
          sampleTask
        );
        expect(diff).toBeDefined();
      }).not.toThrow();
    });
  });
});

/**
 * 生成大型面板内容用于性能测试
 */
function generateLargePanelContent(
  planCount: number,
  stepsPerPlan: number
): string {
  let content = `# 大型测试任务

## 需求

- 需求1
- 需求2

## 整体计划

`;

  for (let i = 1; i <= planCount; i++) {
    content += `${i}. [ ] 计划${i}\n`;

    for (let j = 1; j <= stepsPerPlan; j++) {
      content += `   - [ ] 步骤${i}.${j}\n`;
    }

    content += '\n';
  }

  return content;
}
