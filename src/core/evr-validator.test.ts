/**
 * EVRValidator 测试
 * 测试 EVR 验证系统的各项功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EVRValidator, createEVRValidator } from './evr-validator.js';
import {
  type ExpectedResult,
  EVRStatus,
  EVRClass,
  ErrorCode,
} from '../types/index.js';

describe('EVRValidator', () => {
  let validator: EVRValidator;

  beforeEach(() => {
    validator = createEVRValidator();
  });

  describe('4.1 数据模型与类型（TDD）', () => {
    it('应该支持 ExpectedResult 的序列化和反序列化', () => {
      // Given: 一组 EVR 定义（含 string 与 string[] 混合）
      const evrData: ExpectedResult = {
        id: 'evr-001',
        title: '测试 EVR',
        verify: 'npm test',
        expect: ['所有测试通过', '覆盖率 > 80%'],
        status: EVRStatus.Unknown, // 默认状态
        class: EVRClass.Runtime,
        referencedBy: ['plan-1'],
        runs: [],
      };

      // When: 进行序列化/反序列化
      const serialized = JSON.stringify(evrData);
      const deserialized: ExpectedResult = JSON.parse(serialized);

      // Then: 字段类型与默认值正确
      expect(deserialized.id).toBe('evr-001');
      expect(deserialized.title).toBe('测试 EVR');
      expect(deserialized.verify).toBe('npm test');
      expect(Array.isArray(deserialized.expect)).toBe(true);
      expect(deserialized.expect).toEqual(['所有测试通过', '覆盖率 > 80%']);
      expect(deserialized.status).toBe(EVRStatus.Unknown);
      expect(deserialized.class).toBe(EVRClass.Runtime);
      expect(Array.isArray(deserialized.referencedBy)).toBe(true);
      expect(Array.isArray(deserialized.runs)).toBe(true);
    });

    it('应该正确处理 verify/expect 的 string|string[] 类型', () => {
      // Given: 不同类型的 verify/expect 组合
      const evrWithString: ExpectedResult = {
        id: 'evr-002',
        title: '字符串类型 EVR',
        verify: 'single command',
        expect: 'single result',
        status: EVRStatus.Unknown,
        referencedBy: [],
        runs: [],
      };

      const evrWithArray: ExpectedResult = {
        id: 'evr-003',
        title: '数组类型 EVR',
        verify: ['command 1', 'command 2'],
        expect: ['result 1', 'result 2'],
        status: EVRStatus.Unknown,
        referencedBy: [],
        runs: [],
      };

      // When & Then: 类型检查应该通过
      expect(typeof evrWithString.verify).toBe('string');
      expect(typeof evrWithString.expect).toBe('string');
      expect(Array.isArray(evrWithArray.verify)).toBe(true);
      expect(Array.isArray(evrWithArray.expect)).toBe(true);
    });

    it('应该拒绝非法状态', () => {
      // Given: 非法状态值
      const invalidStatuses = ['invalid', 'pending', 'running'];

      // When & Then: 非法状态应该被识别
      for (const status of invalidStatuses) {
        expect(Object.values(EVRStatus)).not.toContain(status);
      }

      // 合法状态应该被接受
      const validStatuses = [
        EVRStatus.Pass,
        EVRStatus.Fail,
        EVRStatus.Skip,
        EVRStatus.Unknown,
      ];
      for (const status of validStatuses) {
        expect(Object.values(EVRStatus)).toContain(status);
      }
    });

    it('应该正确设置默认值', () => {
      // Given: 最小化的 EVR 定义
      const minimalEVR: ExpectedResult = {
        id: 'evr-004',
        title: '最小 EVR',
        verify: 'test',
        expect: 'pass',
        status: EVRStatus.Unknown, // 默认状态
        referencedBy: [],
        runs: [],
      };

      // When & Then: 默认值应该正确
      expect(minimalEVR.status).toBe(EVRStatus.Unknown);
      expect(minimalEVR.referencedBy).toEqual([]);
      expect(minimalEVR.runs).toEqual([]);
      expect(minimalEVR.class).toBeUndefined(); // 可选字段
      expect(minimalEVR.lastRun).toBeUndefined(); // 可选字段
      expect(minimalEVR.notes).toBeUndefined(); // 可选字段
      expect(minimalEVR.proof).toBeUndefined(); // 可选字段
    });
  });

  describe('4.2 EVR 就绪性摘要 evr_summary（TDD）', () => {
    it('应该正确统计各种状态的 EVR', () => {
      // Given: 5 个 EVR 各不同状态 + 1 个未引用
      const evrs: ExpectedResult[] = [
        {
          id: 'evr-pass',
          title: 'Pass EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          referencedBy: ['plan-1'],
          runs: [],
        },
        {
          id: 'evr-fail',
          title: 'Fail EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Fail,
          referencedBy: ['plan-2'],
          runs: [],
        },
        {
          id: 'evr-skip',
          title: 'Skip EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Skip,
          referencedBy: ['plan-3'],
          runs: [],
        },
        {
          id: 'evr-unknown',
          title: 'Unknown EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Unknown,
          referencedBy: ['plan-4'],
          runs: [],
        },
        {
          id: 'evr-unknown2',
          title: 'Another Unknown EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Unknown,
          referencedBy: ['plan-5'],
          runs: [],
        },
        {
          id: 'evr-unreferenced',
          title: 'Unreferenced EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          referencedBy: [], // 未被引用
          runs: [],
        },
      ];

      // When: 生成 summary
      const summary = validator.generateEVRSummary(evrs);

      // Then: 各数组准确且数量一致
      expect(summary.total).toBe(6);
      expect(summary.passed).toEqual(['evr-pass', 'evr-unreferenced']);
      expect(summary.failed).toEqual(['evr-fail']);
      expect(summary.skipped).toEqual(['evr-skip']);
      expect(summary.unknown).toEqual(['evr-unknown', 'evr-unknown2']);
      expect(summary.unreferenced).toEqual(['evr-unreferenced']);

      // 验证数量一致性
      const totalCounted =
        summary.passed.length +
        summary.failed.length +
        summary.skipped.length +
        summary.unknown.length;
      expect(totalCounted).toBe(summary.total);
    });

    it('应该正确识别未引用的 EVR', () => {
      // Given: 包含未引用 EVR 的列表
      const evrs: ExpectedResult[] = [
        {
          id: 'evr-referenced',
          title: 'Referenced EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          referencedBy: ['plan-1', 'plan-2'],
          runs: [],
        },
        {
          id: 'evr-unreferenced',
          title: 'Unreferenced EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          referencedBy: [],
          runs: [],
        },
      ];

      // When: 生成摘要
      const summary = validator.generateEVRSummary(evrs);

      // Then: 未引用的 EVR 应该被正确识别
      expect(summary.unreferenced).toEqual(['evr-unreferenced']);
      expect(summary.unreferenced).not.toContain('evr-referenced');
    });
  });

  describe('4.3 验证运行跟踪 VerificationRun（TDD）', () => {
    it('应该正确记录和排序验证运行', () => {
      // Given: 一个 EVR 和连续三次 update_type='evr'
      const evr: ExpectedResult = {
        id: 'evr-001',
        title: 'Test EVR',
        verify: 'test',
        expect: 'pass',
        status: EVRStatus.Unknown,
        referencedBy: ['plan-1'],
        runs: [],
      };

      const run1 = {
        status: EVRStatus.Fail,
        by: 'ai',
        notes: 'First attempt failed',
      };

      const run2 = {
        status: EVRStatus.Pass,
        by: 'user',
        notes: 'Manual verification passed',
      };

      const run3 = {
        status: EVRStatus.Pass,
        by: 'ci',
        notes: 'CI verification passed',
        proof: 'test-results.xml',
      };

      // When: 连续三次验证运行跟踪
      validator.trackVerificationRun(evr, run1);
      validator.trackVerificationRun(evr, run2);
      validator.trackVerificationRun(evr, run3);

      // Then: 顺序与 last_run 更新正确（按时间倒序）
      expect(evr.runs).toHaveLength(3);
      expect(evr.runs[0].by).toBe('ci'); // 最新的在前
      expect(evr.runs[1].by).toBe('user');
      expect(evr.runs[2].by).toBe('ai'); // 最早的在后

      // 验证 lastRun 更新
      expect(evr.lastRun).toBe(evr.runs[0].at);
      expect(evr.status).toBe(EVRStatus.Pass); // 最新状态

      // 验证运行记录的完整性
      expect(evr.runs[0].notes).toBe('CI verification passed');
      expect(evr.runs[0].proof).toBe('test-results.xml');
      expect(evr.runs[1].notes).toBe('Manual verification passed');
      expect(evr.runs[2].notes).toBe('First attempt failed');
    });

    it('应该正确更新 EVR 的状态和元数据', () => {
      // Given: 一个初始 EVR
      const evr: ExpectedResult = {
        id: 'evr-002',
        title: 'Test EVR',
        verify: 'test',
        expect: 'pass',
        status: EVRStatus.Unknown,
        referencedBy: ['plan-1'],
        runs: [],
      };

      // When: 跟踪验证运行
      const runResult = {
        status: EVRStatus.Pass,
        by: 'ai',
        notes: 'Verification completed',
        proof: 'evidence.log',
      };

      validator.trackVerificationRun(evr, runResult);

      // Then: EVR 状态和元数据应该被更新
      expect(evr.status).toBe(EVRStatus.Pass);
      expect(evr.notes).toBe('Verification completed');
      expect(evr.proof).toBe('evidence.log');
      expect(evr.lastRun).toBeDefined();
      expect(new Date(evr.lastRun!).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('4.4 Plan Gate（计划级门槛）（TDD）', () => {
    it('应该阻止未就绪计划的完成', () => {
      // Given: Plan 绑定两个 EVR（pass、skip 无理由）
      const evrs: ExpectedResult[] = [
        {
          id: 'evr-pass',
          title: 'Pass EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          referencedBy: ['plan-1'],
          runs: [],
        },
        {
          id: 'evr-skip-no-reason',
          title: 'Skip EVR without reason',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Skip,
          notes: '', // 无理由
          referencedBy: ['plan-1'],
          runs: [],
        },
      ];

      // When: 检查计划门槛
      const gateResult = validator.checkPlanGate('plan-1', evrs);

      // Then: 返回 evr_pending 并拒绝
      expect(gateResult.canComplete).toBe(false);
      expect(gateResult.pendingEVRs).toContain('evr-skip-no-reason');
      expect(gateResult.boundEVRs).toEqual(['evr-pass', 'evr-skip-no-reason']);
    });

    it('应该允许就绪计划的完成', () => {
      // Given: Plan 绑定两个就绪的 EVR
      const evrs: ExpectedResult[] = [
        {
          id: 'evr-pass',
          title: 'Pass EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          referencedBy: ['plan-1'],
          runs: [],
        },
        {
          id: 'evr-skip-with-reason',
          title: 'Skip EVR with reason',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Skip,
          notes: '由于环境限制跳过此验证',
          referencedBy: ['plan-1'],
          runs: [],
        },
      ];

      // When: 检查计划门槛
      const gateResult = validator.checkPlanGate('plan-1', evrs);

      // Then: 应该允许完成
      expect(gateResult.canComplete).toBe(true);
      expect(gateResult.pendingEVRs).toEqual([]);
      expect(gateResult.boundEVRs).toEqual([
        'evr-pass',
        'evr-skip-with-reason',
      ]);
    });

    it('应该正确处理未绑定 EVR 的计划', () => {
      // Given: 计划没有绑定任何 EVR
      const evrs: ExpectedResult[] = [
        {
          id: 'evr-other',
          title: 'Other EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          referencedBy: ['plan-2'], // 绑定到其他计划
          runs: [],
        },
      ];

      // When: 检查计划门槛
      const gateResult = validator.checkPlanGate('plan-1', evrs);

      // Then: 应该允许完成（没有绑定的 EVR）
      expect(gateResult.canComplete).toBe(true);
      expect(gateResult.pendingEVRs).toEqual([]);
      expect(gateResult.boundEVRs).toEqual([]);
    });
  });

  describe('4.5 Static EVR 单次验证+diff-clean（TDD）', () => {
    it('应该允许静态 EVR 单次验证通过', () => {
      // Given: static EVR 满足 expect
      const staticEVR: ExpectedResult = {
        id: 'evr-static',
        title: 'Static EVR',
        verify: 'check file exists',
        expect: 'file should exist',
        status: EVRStatus.Pass,
        class: EVRClass.Static,
        proof: 'file-exists.log', // 有证据，表示 diff-clean
        referencedBy: ['plan-1'],
        runs: [
          {
            at: new Date().toISOString(),
            by: 'ai',
            status: EVRStatus.Pass,
            notes: 'Static verification passed',
          },
        ],
      };

      // When: 执行校验
      const validationResult = validator.validateStaticEVR(staticEVR);
      const requiresFinal = validator.requiresFinalVerification(staticEVR);

      // Then: ready=true 且无需二次验证
      expect(validationResult.passed).toBe(true);
      expect(validationResult.meetsExpectation).toBe(true);
      expect(validationResult.isDiffClean).toBe(true);
      expect(requiresFinal).toBe(false);
    });

    it('应该要求运行时 EVR 进行双次验证', () => {
      // Given: runtime EVR
      const runtimeEVR: ExpectedResult = {
        id: 'evr-runtime',
        title: 'Runtime EVR',
        verify: 'run tests',
        expect: 'all tests pass',
        status: EVRStatus.Pass,
        class: EVRClass.Runtime,
        referencedBy: ['plan-1'],
        runs: [
          {
            at: new Date().toISOString(),
            by: 'ai',
            status: EVRStatus.Pass,
            notes: 'First verification passed',
          },
        ],
      };

      // When: 检查是否需要最终验证
      const requiresFinal = validator.requiresFinalVerification(runtimeEVR);

      // Then: 需要双次验证
      expect(requiresFinal).toBe(true);
    });

    it('应该正确识别静态 EVR', () => {
      // Given: 不同类型的 EVR
      const staticEVR: ExpectedResult = {
        id: 'evr-static',
        title: 'Static EVR',
        verify: 'test',
        expect: 'pass',
        status: EVRStatus.Unknown,
        class: EVRClass.Static,
        referencedBy: [],
        runs: [],
      };

      const runtimeEVR: ExpectedResult = {
        id: 'evr-runtime',
        title: 'Runtime EVR',
        verify: 'test',
        expect: 'pass',
        status: EVRStatus.Unknown,
        class: EVRClass.Runtime,
        referencedBy: [],
        runs: [],
      };

      const defaultEVR: ExpectedResult = {
        id: 'evr-default',
        title: 'Default EVR',
        verify: 'test',
        expect: 'pass',
        status: EVRStatus.Unknown,
        // class 未设置，默认为 runtime
        referencedBy: [],
        runs: [],
      };

      // When & Then: 应该正确识别静态 EVR
      expect(validator.isStaticEVR(staticEVR)).toBe(true);
      expect(validator.isStaticEVR(runtimeEVR)).toBe(false);
      expect(validator.isStaticEVR(defaultEVR)).toBe(false);
    });
  });

  describe('4.6 current_task_read 的 EVR 出参（TDD）', () => {
    it('应该返回完整的 EVR 视图', () => {
      // Given: 混合状态 EVR
      const evrs: ExpectedResult[] = [
        {
          id: 'evr-pass',
          title: 'Pass EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          lastRun: '2023-01-01T00:00:00Z',
          referencedBy: ['plan-1'],
          runs: [
            {
              at: '2023-01-01T00:00:00Z',
              by: 'ai',
              status: EVRStatus.Pass,
              notes: 'Passed',
            },
          ],
        },
        {
          id: 'evr-unknown',
          title: 'Unknown EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Unknown,
          referencedBy: ['plan-2'],
          runs: [],
        },
      ];

      // When: 调用验证和转换方法
      const validationResult = validator.validateEVRReadiness(evrs);
      const evrDetails = validator.convertToEVRDetails(evrs);

      // Then: 三个字段均返回且与验证器计算一致
      expect(validationResult.ready).toBe(false); // 有 unknown 状态
      expect(validationResult.summary.total).toBe(2);
      expect(validationResult.summary.passed).toEqual(['evr-pass']);
      expect(validationResult.summary.unknown).toEqual(['evr-unknown']);

      expect(evrDetails).toHaveLength(2);
      expect(evrDetails[0].evrId).toBe('evr-pass');
      expect(evrDetails[0].status).toBe(EVRStatus.Pass);
      expect(evrDetails[0].lastRun).toBe('2023-01-01T00:00:00Z');
      expect(evrDetails[0].runs).toHaveLength(1);

      expect(evrDetails[1].evrId).toBe('evr-unknown');
      expect(evrDetails[1].status).toBe(EVRStatus.Unknown);
      expect(evrDetails[1].runs).toHaveLength(0);
    });
  });

  describe('4.8 完成前 Gate + 未就绪原因（TDD）', () => {
    it('应该返回详细的未就绪原因', () => {
      // Given: 存在 unknown 与 skip 无理由
      const evrs: ExpectedResult[] = [
        {
          id: 'evr-unknown',
          title: 'Unknown EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Unknown,
          referencedBy: ['plan-1'],
          runs: [],
        },
        {
          id: 'evr-skip-no-reason',
          title: 'Skip without reason',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Skip,
          notes: '', // 无理由
          referencedBy: ['plan-2'],
          runs: [],
        },
        {
          id: 'evr-failed',
          title: 'Failed EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Fail,
          referencedBy: ['plan-3'],
          runs: [],
        },
        {
          id: 'evr-unreferenced',
          title: 'Unreferenced EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          referencedBy: [], // 未被引用
          runs: [],
        },
      ];

      // When: 检查任务完成条件
      const completionResult = validator.checkTaskCompletion(evrs);

      // Then: 返回 EVR_NOT_READY 且 reasons 包含具体原因
      expect(completionResult.canComplete).toBe(false);
      expect(completionResult.errorCode).toBe(ErrorCode.EVR_NOT_READY);

      const requiredFinal = completionResult.evrValidation.requiredFinal;
      expect(requiredFinal).toHaveLength(3);

      const reasons = requiredFinal.map((item) => item.reason);
      expect(reasons).toContain('status_unknown');
      expect(reasons).toContain('need_reason_for_skip');
      expect(reasons).toContain('failed');

      // 验证 evr_summary 和 evr_unreferenced
      const summary = completionResult.evrValidation.summary;
      expect(summary.unknown).toEqual(['evr-unknown']);
      expect(summary.skipped).toEqual(['evr-skip-no-reason']);
      expect(summary.failed).toEqual(['evr-failed']);
      expect(summary.unreferenced).toEqual(['evr-unreferenced']);
    });

    it('应该允许完全就绪的任务完成', () => {
      // Given: 所有 EVR 都就绪
      const evrs: ExpectedResult[] = [
        {
          id: 'evr-pass',
          title: 'Pass EVR',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Pass,
          referencedBy: ['plan-1'],
          runs: [],
        },
        {
          id: 'evr-skip-with-reason',
          title: 'Skip with reason',
          verify: 'test',
          expect: 'pass',
          status: EVRStatus.Skip,
          notes: '由于环境限制跳过',
          referencedBy: ['plan-2'],
          runs: [],
        },
      ];

      // When: 检查任务完成条件
      const completionResult = validator.checkTaskCompletion(evrs);

      // Then: 应该允许完成
      expect(completionResult.canComplete).toBe(true);
      expect(completionResult.errorCode).toBeUndefined();
      expect(completionResult.evrValidation.ready).toBe(true);
      expect(completionResult.evrValidation.requiredFinal).toHaveLength(0);
    });
  });
});
