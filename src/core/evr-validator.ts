/**
 * EVRValidator - EVR 验证系统
 * 负责预期可见结果（EVR）的验证、门槛检查和质量保证
 * 支持双次验证规则、计划级门槛和任务完成前的质量门槛
 */

// import { ulid } from 'ulid'; // 暂时不需要
import { logger } from './logger.js';
import {
  LogCategory,
  LogAction,
  ErrorCode,
  type ExpectedResult,
  type EVRDetail,
  type VerificationRun,
  type EVRSummary,
  type EVRValidationResult,
  type PlanGateResult,
  type TaskCompletionResult,
  type StaticValidationResult,
  EVRStatus,
  EVRClass,
} from '../types/index.js';

/**
 * EVR 验证器配置选项
 */
export interface EVRValidatorOptions {
  /** 是否要求 skip 状态必须有理由 */
  requireSkipReason: boolean;
  /** 静态 EVR 是否允许单次验证 */
  allowStaticSingleVerification: boolean;
  /** 验证器版本 */
  version: string;
}

/**
 * 默认验证器选项
 */
const DEFAULT_VALIDATOR_OPTIONS: EVRValidatorOptions = {
  requireSkipReason: true,
  allowStaticSingleVerification: true,
  version: '1.0.0',
};

/**
 * EVR 验证器类
 */
export class EVRValidator {
  private readonly options: EVRValidatorOptions;

  constructor(options?: Partial<EVRValidatorOptions>) {
    this.options = { ...DEFAULT_VALIDATOR_OPTIONS, ...options };
  }

  /**
   * 验证 EVR 就绪性
   */
  validateEVRReadiness(
    evrs: ExpectedResult[],
    options?: { requireSkipReason?: boolean }
  ): EVRValidationResult {
    const summary = this.generateEVRSummary(evrs);
    const requiredFinal: Array<{
      evr_id: string;
      reason: 'need_reason_for_skip' | 'status_unknown' | 'failed';
    }> = [];

    // 检查每个 EVR 的就绪状态
    for (const evr of evrs) {
      if (evr.status === EVRStatus.Unknown) {
        requiredFinal.push({
          evr_id: evr.id,
          reason: 'status_unknown',
        });
      } else if (evr.status === EVRStatus.Fail) {
        requiredFinal.push({
          evr_id: evr.id,
          reason: 'failed',
        });
      } else if (
        evr.status === EVRStatus.Skip &&
        (options?.requireSkipReason ?? this.options.requireSkipReason) &&
        (!evr.notes || evr.notes.trim() === '')
      ) {
        requiredFinal.push({
          evr_id: evr.id,
          reason: 'need_reason_for_skip',
        });
      }
    }

    const ready = requiredFinal.length === 0;

    logger.info(LogCategory.Test, LogAction.Handle, 'EVR 就绪性验证完成', {
      totalEVRs: evrs.length,
      ready,
      requiredFinalCount: requiredFinal.length,
      summary,
    });

    return {
      ready,
      summary,
      requiredFinal,
    };
  }

  /**
   * 生成 EVR 摘要
   */
  generateEVRSummary(evrs: ExpectedResult[]): EVRSummary {
    const summary: EVRSummary = {
      total: evrs.length,
      passed: [],
      skipped: [],
      failed: [],
      unknown: [],
      unreferenced: [],
    };

    for (const evr of evrs) {
      switch (evr.status) {
        case EVRStatus.Pass:
          summary.passed.push(evr.id);
          break;
        case EVRStatus.Skip:
          summary.skipped.push(evr.id);
          break;
        case EVRStatus.Fail:
          summary.failed.push(evr.id);
          break;
        case EVRStatus.Unknown:
        default:
          summary.unknown.push(evr.id);
          break;
      }

      // 检查是否被引用
      if (evr.referencedBy.length === 0) {
        summary.unreferenced.push(evr.id);
      }
    }

    return summary;
  }

  /**
   * 检查计划级门槛
   */
  checkPlanGate(planId: string, evrs: ExpectedResult[]): PlanGateResult {
    // 找到绑定到该计划的 EVR
    const boundEVRs = evrs.filter((evr) => evr.referencedBy.includes(planId));
    const pendingEVRs: string[] = [];

    for (const evr of boundEVRs) {
      if (evr.status === EVRStatus.Unknown || evr.status === EVRStatus.Fail) {
        pendingEVRs.push(evr.id);
      } else if (
        evr.status === EVRStatus.Skip &&
        this.options.requireSkipReason &&
        (!evr.notes || evr.notes.trim() === '')
      ) {
        pendingEVRs.push(evr.id);
      }
    }

    const canComplete = pendingEVRs.length === 0;

    logger.info(LogCategory.Test, LogAction.Handle, '计划级门槛检查完成', {
      planId,
      boundEVRsCount: boundEVRs.length,
      pendingEVRsCount: pendingEVRs.length,
      canComplete,
    });

    return {
      canComplete,
      pendingEVRs,
      boundEVRs: boundEVRs.map((evr) => evr.id),
    };
  }

  /**
   * 检查任务完成条件
   */
  checkTaskCompletion(evrs: ExpectedResult[]): TaskCompletionResult {
    const evrValidation = this.validateEVRReadiness(evrs);

    const result: TaskCompletionResult = {
      canComplete: evrValidation.ready,
      evrValidation,
    };

    if (!evrValidation.ready) {
      result.errorCode = ErrorCode.EVR_NOT_READY;
    }

    logger.info(LogCategory.Test, LogAction.Handle, '任务完成条件检查完成', {
      canComplete: result.canComplete,
      errorCode: result.errorCode,
      requiredFinalCount: evrValidation.requiredFinal.length,
    });

    return result;
  }

  /**
   * 跟踪验证运行
   */
  trackVerificationRun(
    evr: ExpectedResult,
    result: {
      status: EVRStatus;
      by: string;
      notes?: string;
      proof?: string;
    }
  ): void {
    const run: VerificationRun = {
      at: new Date().toISOString(),
      by: result.by,
      status: result.status,
      notes: result.notes,
      proof: result.proof,
    };

    // 添加到运行记录（按时间倒序）
    evr.runs.unshift(run);

    // 更新 EVR 状态和最后运行时间
    evr.status = result.status;
    evr.lastRun = run.at;
    if (result.notes) {
      evr.notes = result.notes;
    }
    if (result.proof) {
      evr.proof = result.proof;
    }

    logger.info(LogCategory.Test, LogAction.Update, 'EVR 验证运行记录更新', {
      evrId: evr.id,
      status: result.status,
      by: result.by,
      totalRuns: evr.runs.length,
    });
  }

  /**
   * 检查是否需要最终验证
   */
  requiresFinalVerification(evr: ExpectedResult): boolean {
    // 静态 EVR 如果已经通过，不需要最终验证
    if (
      evr.class === EVRClass.Static &&
      evr.status === EVRStatus.Pass &&
      this.options.allowStaticSingleVerification
    ) {
      return false;
    }

    // 其他情况需要双次验证
    return evr.runs.length < 2;
  }

  /**
   * 检查是否是静态 EVR
   */
  isStaticEVR(evr: ExpectedResult): boolean {
    return evr.class === EVRClass.Static;
  }

  /**
   * 验证静态 EVR
   */
  validateStaticEVR(evr: ExpectedResult): StaticValidationResult {
    // 简化的静态验证逻辑
    // 实际实现中应该根据 verify 和 expect 字段进行具体验证
    const meetsExpectation = this.checkExpectation(evr);
    const isDiffClean = this.checkDiffClean(evr);

    const passed = meetsExpectation && isDiffClean;

    logger.info(LogCategory.Test, LogAction.Handle, '静态 EVR 验证完成', {
      evrId: evr.id,
      passed,
      meetsExpectation,
      isDiffClean,
    });

    return {
      passed,
      meetsExpectation,
      isDiffClean,
      message: passed
        ? '静态验证通过'
        : `验证失败: 预期满足=${meetsExpectation}, 差异清洁=${isDiffClean}`,
    };
  }

  /**
   * 将 EVR 转换为详情格式（用于 API 响应）
   */
  convertToEVRDetails(evrs: ExpectedResult[]): EVRDetail[] {
    return evrs.map((evr) => ({
      evrId: evr.id,
      title: evr.title,
      status: evr.status,
      lastRun: evr.lastRun,
      referencedBy: [...evr.referencedBy],
      runs: [...evr.runs],
    }));
  }

  // 私有辅助方法

  /**
   * 检查预期结果是否满足
   */
  private checkExpectation(evr: ExpectedResult): boolean {
    // 简化实现：如果有 expect 字段就认为满足
    // 实际实现中应该根据具体的验证逻辑
    return Boolean(evr.expect);
  }

  /**
   * 检查是否无差异（diff-clean）
   */
  private checkDiffClean(evr: ExpectedResult): boolean {
    // 简化实现：如果有 proof 字段就认为无差异
    // 实际实现中应该检查实际的差异状态
    return Boolean(evr.proof);
  }
}

/**
 * 创建 EVR 验证器实例
 */
export function createEVRValidator(
  options?: Partial<EVRValidatorOptions>
): EVRValidator {
  return new EVRValidator(options);
}
