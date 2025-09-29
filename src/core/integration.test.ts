/**
 * 核心类型定义和基础架构集成测试
 * 验证字段转换、错误处理、Schema 校验等功能的集成
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  convertResponseToSnakeCase,
  convertRequestToCamelCase,
  validateFieldConversion,
  FIELD_MAPPING,
} from './field-converter.js';
import {
  ErrorHandler,
  createErrorFromCode,
  isErrorCode,
  getErrorCode,
  ProjectError,
  EVRError,
  SyncError,
} from './error-handler.js';
import {
  ErrorCode,
  EVRStatus,
  EVRClass,
  SyncConflictType,
  ConflictResolution,
} from '../types/index.js';

describe('核心类型定义和基础架构集成测试', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    ErrorHandler.resetInstance();
    errorHandler = ErrorHandler.getInstance();
  });

  describe('四个接口的完整数据流测试', () => {
    it('应该正确处理 current_task_read 响应的完整数据流', () => {
      // 模拟内部 camelCase 数据
      const internalData = {
        task: {
          id: '01K69TQVX749GS4GHVPJPEXBDK',
          title: '建立核心类型定义和基础架构',
          mdVersion: 'v1.0.0',
          currentPlanId: 'plan-5',
          expectedResults: [
            {
              id: 'evr-001',
              title: '字段风格转换正确',
              lastRun: '2025-09-29T04:20:00.000Z',
              referencedBy: ['plan-3'],
            },
          ],
          sectionFingerprints: {
            title: 'abc123',
            evrs: {
              'evr-001': 'def456',
            },
          },
        },
        evrReady: false,
        evrSummary: {
          total: 1,
          passed: [],
          unknown: ['evr-001'],
          unreferenced: [],
        },
        evrDetails: [
          {
            evrId: 'evr-001',
            lastRun: '2025-09-29T04:20:00.000Z',
            referencedBy: ['plan-3'],
          },
        ],
        panelPending: false,
        logsHighlights: [],
        logsFullCount: 10,
        mdVersion: 'v1.0.0',
      };

      // 转换为 snake_case（MCP 响应格式）
      const mcpResponse = convertResponseToSnakeCase(internalData);

      // 验证关键字段转换
      expect(mcpResponse.task.md_version).toBe('v1.0.0');
      expect(mcpResponse.task.current_plan_id).toBe('plan-5');
      expect(mcpResponse.task.expected_results[0].last_run).toBe(
        '2025-09-29T04:20:00.000Z'
      );
      expect(mcpResponse.task.expected_results[0].referenced_by).toEqual([
        'plan-3',
      ]);
      expect(mcpResponse.task.section_fingerprints.evrs['evr-001']).toBe(
        'def456'
      );
      expect(mcpResponse.evr_ready).toBe(false);
      expect(mcpResponse.evr_summary.total).toBe(1);
      expect(mcpResponse.evr_details).toHaveLength(1);
      expect(mcpResponse.evr_details[0].evr_id).toBe('evr-001');
      expect(mcpResponse.evr_details[0].last_run).toBe(
        '2025-09-29T04:20:00.000Z'
      );
      expect(mcpResponse.evr_details[0].referenced_by).toEqual(['plan-3']);
      expect(mcpResponse.panel_pending).toBe(false);
      expect(mcpResponse.logs_highlights).toEqual([]);
      expect(mcpResponse.logs_full_count).toBe(10);
      expect(mcpResponse.md_version).toBe('v1.0.0');

      // 验证没有 camelCase 字段泄露
      expect(mcpResponse.task.mdVersion).toBeUndefined();
      expect(mcpResponse.task.currentPlanId).toBeUndefined();
      expect(mcpResponse.task.expected_results[0].lastRun).toBeUndefined();
      expect(mcpResponse.task.expected_results[0].referencedBy).toBeUndefined();
      expect(mcpResponse.evrReady).toBeUndefined();
      expect(mcpResponse.evrSummary).toBeUndefined();
      expect(mcpResponse.evr_details[0].evrId).toBeUndefined();
      expect(mcpResponse.panelPending).toBeUndefined();
      expect(mcpResponse.logsHighlights).toBeUndefined();
      expect(mcpResponse.logsFullCount).toBeUndefined();
    });

    it('应该正确处理 current_task_update 请求的完整数据流', () => {
      // 模拟 MCP 请求（snake_case）
      const mcpRequest = {
        update_type: 'evr',
        status: 'completed',
        evr: {
          items: [
            {
              evr_id: 'evr-001',
              status: 'pass',
              last_run: '2025-09-29T04:20:00.000Z',
              notes: '字段转换测试通过',
              proof: 'src/core/field-converter.test.ts',
            },
          ],
        },
        project_id: '01K5XNPG6BCJ71GMD9816XCPSF',
      };

      // 转换为内部 camelCase 格式
      const internalRequest = convertRequestToCamelCase(mcpRequest);

      // 验证关键字段转换
      expect(internalRequest.updateType).toBe('evr');
      expect(internalRequest.evr.items[0].evrId).toBe('evr-001');
      expect(internalRequest.evr.items[0].lastRun).toBe(
        '2025-09-29T04:20:00.000Z'
      );
      expect(internalRequest.projectId).toBe('01K5XNPG6BCJ71GMD9816XCPSF');

      // 验证没有 snake_case 字段残留
      expect(internalRequest.update_type).toBeUndefined();
      expect(internalRequest.evr.items[0].evr_id).toBeUndefined();
      expect(internalRequest.evr.items[0].last_run).toBeUndefined();
      expect(internalRequest.project_id).toBeUndefined();
    });

    it('应该正确处理 current_task_modify 请求的 EVR 内容', () => {
      const mcpRequest = {
        field: 'evr',
        content: {
          items: [
            {
              evr_id: 'evr-002',
              title: 'Schema 校验通过',
              verify: [
                '运行 pnpm run validate:schemas',
                '检查所有 JSON 示例文件',
              ],
              expect: [
                '所有正例通过验证',
                '所有反例被正确拒绝',
                '字段命名风格检查通过',
              ],
              class: 'runtime',
            },
          ],
        },
        reason: '添加 Schema 校验的 EVR',
        change_type: 'plan_adjustment',
        project_id: '01K5XNPG6BCJ71GMD9816XCPSF',
      };

      const internalRequest = convertRequestToCamelCase(mcpRequest);

      expect(internalRequest.content.items[0].evrId).toBe('evr-002');
      expect(internalRequest.content.items[0].verify).toEqual([
        '运行 pnpm run validate:schemas',
        '检查所有 JSON 示例文件',
      ]);
      expect(internalRequest.content.items[0].expect).toEqual([
        '所有正例通过验证',
        '所有反例被正确拒绝',
        '字段命名风格检查通过',
      ]);
      expect(internalRequest.changeType).toBe('plan_adjustment');
      expect(internalRequest.projectId).toBe('01K5XNPG6BCJ71GMD9816XCPSF');
    });

    it('应该正确处理 current_task_complete 响应的 EVR 摘要', () => {
      const internalData = {
        completed: true,
        evrSummary: {
          total: 3,
          passed: ['evr-001', 'evr-002'],
          skipped: ['evr-003'],
          failed: [],
          unknown: [],
          unreferenced: [],
        },
        evrRequiredFinal: [],
        evrUnreferenced: [],
        taskCompletedAt: '2025-09-29T04:21:00.789Z',
        generatedDocs: [
          'docs/tasks/task-20250929-01K69TQVX749GS4GHVPJPEXBDK.md',
        ],
        logsHighlights: [
          {
            ts: '2025-09-29T04:21:00.789Z',
            level: 'INFO',
            category: 'TASK',
            action: 'COMPLETE',
            message: '任务已成功完成',
          },
        ],
      };

      const mcpResponse = convertResponseToSnakeCase(internalData);

      expect(mcpResponse.evr_summary.total).toBe(3);
      expect(mcpResponse.evr_summary.passed).toEqual(['evr-001', 'evr-002']);
      expect(mcpResponse.evr_summary.skipped).toEqual(['evr-003']);
      expect(mcpResponse.evr_required_final).toEqual([]);
      expect(mcpResponse.evr_unreferenced).toEqual([]);
      expect(mcpResponse.task_completed_at).toBe('2025-09-29T04:21:00.789Z');
      expect(mcpResponse.generated_docs).toEqual([
        'docs/tasks/task-20250929-01K69TQVX749GS4GHVPJPEXBDK.md',
      ]);
      expect(mcpResponse.logs_highlights[0].ts).toBe(
        '2025-09-29T04:21:00.789Z'
      );
    });
  });

  describe('错误处理集成测试', () => {
    it('应该正确处理各种错误码并转换字段名', () => {
      // 测试项目错误
      const projectError = createErrorFromCode(ErrorCode.NO_PROJECT_BOUND);
      expect(projectError).toBeInstanceOf(ProjectError);
      expect(isErrorCode(projectError, ErrorCode.NO_PROJECT_BOUND)).toBe(true);
      expect(getErrorCode(projectError)).toBe(ErrorCode.NO_PROJECT_BOUND);

      const projectErrorResponse = errorHandler.handleError(projectError);
      const mcpErrorResponse = convertResponseToSnakeCase(projectErrorResponse);

      expect(mcpErrorResponse.success).toBe(false);
      expect(mcpErrorResponse.error).toBe(
        '当前连接没有绑定活跃项目，请先调用 project_bind'
      );

      // 测试 EVR 错误
      const evrError = createErrorFromCode(
        ErrorCode.EVR_NOT_READY,
        '存在未就绪的 EVR',
        {
          evrIds: ['evr-001', 'evr-002'],
          evrSummary: {
            total: 2,
            unknown: ['evr-001', 'evr-002'],
          },
        }
      );
      expect(evrError).toBeInstanceOf(EVRError);
      expect(evrError.context?.evrIds).toEqual(['evr-001', 'evr-002']);

      const evrErrorResponse = errorHandler.handleError(evrError);
      const mcpEvrErrorResponse = convertResponseToSnakeCase(evrErrorResponse);

      expect(mcpEvrErrorResponse.context?.evr_ids).toEqual([
        'evr-001',
        'evr-002',
      ]);
      expect(mcpEvrErrorResponse.context?.evr_summary?.total).toBe(2);

      // 测试同步错误
      const syncError = createErrorFromCode(
        ErrorCode.SYNC_CONFLICT,
        '面板与结构化数据冲突',
        {
          conflictType: SyncConflictType.EtagMismatch,
          conflictResolution: ConflictResolution.Ours,
          affectedSections: ['plan-1', 'evr-001'],
        }
      );
      expect(syncError).toBeInstanceOf(SyncError);

      const syncErrorResponse = errorHandler.handleError(syncError);
      const mcpSyncErrorResponse =
        convertResponseToSnakeCase(syncErrorResponse);

      expect(mcpSyncErrorResponse.context?.conflict_type).toBe('etag_mismatch');
      expect(mcpSyncErrorResponse.context?.conflict_resolution).toBe('ours');
      expect(mcpSyncErrorResponse.context?.affected_sections).toEqual([
        'plan-1',
        'evr-001',
      ]);
    });

    it('应该正确处理错误响应中的嵌套对象字段转换', () => {
      const complexError = createErrorFromCode(
        ErrorCode.PARSE_ERROR,
        '面板解析失败',
        {
          parseDetails: {
            lineNumber: 42,
            columnNumber: 15,
            expectedFormat: 'markdown',
            actualContent: '无效的复选框格式',
            suggestionList: [
              '使用 [ ] 表示 to_do',
              '使用 [-] 表示 in_progress',
              '使用 [x] 表示 completed',
            ],
            contextInfo: {
              planId: 'plan-3',
              stepId: 'step-2',
              evrBindings: ['evr-001'],
            },
          },
        }
      );

      const errorResponse = errorHandler.handleError(complexError);
      const mcpErrorResponse = convertResponseToSnakeCase(errorResponse);

      expect(mcpErrorResponse.context?.parse_details?.line_number).toBe(42);
      expect(mcpErrorResponse.context?.parse_details?.column_number).toBe(15);
      expect(mcpErrorResponse.context?.parse_details?.expected_format).toBe(
        'markdown'
      );
      expect(mcpErrorResponse.context?.parse_details?.actual_content).toBe(
        '无效的复选框格式'
      );
      expect(mcpErrorResponse.context?.parse_details?.suggestion_list).toEqual([
        '使用 [ ] 表示 to_do',
        '使用 [-] 表示 in_progress',
        '使用 [x] 表示 completed',
      ]);
      expect(
        mcpErrorResponse.context?.parse_details?.context_info?.plan_id
      ).toBe('plan-3');
      expect(
        mcpErrorResponse.context?.parse_details?.context_info?.step_id
      ).toBe('step-2');
      expect(
        mcpErrorResponse.context?.parse_details?.context_info?.evr_bindings
      ).toEqual(['evr-001']);
    });
  });

  describe('类型枚举集成测试', () => {
    it('应该正确使用所有新增的枚举类型', () => {
      // EVR 状态枚举
      expect(EVRStatus.Pass).toBe('pass');
      expect(EVRStatus.Fail).toBe('fail');
      expect(EVRStatus.Skip).toBe('skip');
      expect(EVRStatus.Unknown).toBe('unknown');

      // EVR 类别枚举
      expect(EVRClass.Runtime).toBe('runtime');
      expect(EVRClass.Static).toBe('static');

      // 同步冲突类型枚举
      expect(SyncConflictType.EtagMismatch).toBe('etag_mismatch');
      expect(SyncConflictType.ConcurrentUpdate).toBe('concurrent_update');
      expect(SyncConflictType.ParseError).toBe('parse_error');

      // 冲突解决策略枚举
      expect(ConflictResolution.Ours).toBe('ours');
      expect(ConflictResolution.Theirs).toBe('theirs');
      expect(ConflictResolution.Merged).toBe('merged');

      // 错误码枚举
      expect(ErrorCode.NO_PROJECT_BOUND).toBe('NO_PROJECT_BOUND');
      expect(ErrorCode.EVR_NOT_READY).toBe('EVR_NOT_READY');
      expect(ErrorCode.SYNC_CONFLICT).toBe('SYNC_CONFLICT');
      expect(ErrorCode.PARSE_ERROR).toBe('PARSE_ERROR');
    });

    it('应该在数据转换中正确处理枚举值', () => {
      const dataWithEnums = {
        evrStatus: EVRStatus.Pass,
        evrClass: EVRClass.Static,
        conflictType: SyncConflictType.EtagMismatch,
        resolution: ConflictResolution.Merged,
        errorCode: ErrorCode.EVR_NOT_READY,
      };

      const converted = convertResponseToSnakeCase(dataWithEnums);

      expect(converted.evr_status).toBe('pass');
      expect(converted.evr_class).toBe('static');
      expect(converted.conflict_type).toBe('etag_mismatch');
      expect(converted.resolution).toBe('merged');
      expect(converted.error_code).toBe('EVR_NOT_READY');
    });
  });

  describe('字段映射完整性测试', () => {
    it('应该包含所有必要的字段映射', () => {
      const requiredMappings = [
        'mdVersion',
        'syncPreview',
        'evrForNode',
        'evrSummary',
        'evrDetails',
        'evrReady',
        'panelPending',
        'logsHighlights',
        'logsFullCount',
        'evrId',
        'referencedBy',
        'evrForPlan',
        'evrPending',
        'evrRequiredFinal',
        'evrUnreferenced',
        'taskId',
        'planId',
        'stepId',
        'currentPlanId',
        'updateType',
        'changeType',
        'projectId',
        'createdAt',
        'updatedAt',
        'completedAt',
        'affectedSections',
        'knowledgeRefs',
        'overallPlan',
        'taskHints',
        'aiNotes',
      ];

      requiredMappings.forEach((field) => {
        expect(FIELD_MAPPING).toHaveProperty(field);
        expect(typeof FIELD_MAPPING[field]).toBe('string');
        expect(FIELD_MAPPING[field]).toMatch(/_/); // 应该包含下划线
      });
    });

    it('应该正确处理往返转换', () => {
      const originalData = {
        mdVersion: 'v1.0.0',
        evrSummary: {
          totalCount: 5,
          passedItems: ['evr-001', 'evr-002'],
        },
        syncPreview: {
          appliedChanges: true,
          conflictList: [],
        },
        logsHighlights: [
          {
            timestamp: '2025-09-29T04:20:00.000Z',
            logLevel: 'INFO',
          },
        ],
      };

      // camelCase -> snake_case -> camelCase
      const snakeCase = convertResponseToSnakeCase(originalData);
      const backToCamelCase = convertRequestToCamelCase(snakeCase);

      expect(validateFieldConversion(originalData, snakeCase)).toBe(true);
      expect(backToCamelCase.mdVersion).toBe('v1.0.0');
      expect(backToCamelCase.evrSummary.totalCount).toBe(5);
      expect(backToCamelCase.syncPreview.appliedChanges).toBe(true);
      expect(backToCamelCase.logsHighlights[0].timestamp).toBe(
        '2025-09-29T04:20:00.000Z'
      );
    });
  });

  describe('TDD 要求验证', () => {
    it('应该满足 TDD 要求：字段风格转换正确', () => {
      const testData = {
        mdVersion: '1.0',
        evrSummary: { total: 5 },
        evrDetails: [],
        panelPending: false,
        syncPreview: { applied: true },
        logsHighlights: [],
        logsFullCount: 10,
      };

      const converted = convertResponseToSnakeCase(testData);

      // 验证所有字段都转换为 snake_case
      expect(converted).toHaveProperty('md_version');
      expect(converted).toHaveProperty('evr_summary');
      expect(converted).toHaveProperty('evr_details');
      expect(converted).toHaveProperty('panel_pending');
      expect(converted).toHaveProperty('sync_preview');
      expect(converted).toHaveProperty('logs_highlights');
      expect(converted).toHaveProperty('logs_full_count');

      // 验证没有 camelCase 字段残留
      expect(converted).not.toHaveProperty('mdVersion');
      expect(converted).not.toHaveProperty('evrSummary');
      expect(converted).not.toHaveProperty('evrDetails');
      expect(converted).not.toHaveProperty('panelPending');
      expect(converted).not.toHaveProperty('syncPreview');
      expect(converted).not.toHaveProperty('logsHighlights');
      expect(converted).not.toHaveProperty('logsFullCount');
    });

    it('应该满足 TDD 要求：必填/类型/枚举均通过', () => {
      // 测试必填字段验证
      expect(() => {
        errorHandler.validateRequired({}, ['mdVersion', 'evrSummary']);
      }).toThrow('缺少必需参数: mdVersion, evrSummary');

      // 测试类型验证
      expect(() => {
        errorHandler.validateTypes(
          { mdVersion: 123, evrReady: 'true' },
          { mdVersion: 'string', evrReady: 'boolean' }
        );
      }).toThrow('参数类型错误');

      // 测试枚举验证
      expect(() => {
        errorHandler.validateEnum('invalid_status', 'status', [
          'pass',
          'fail',
          'skip',
          'unknown',
        ]);
      }).toThrow('status 必须是以下值之一: pass, fail, skip, unknown');

      // 正确的情况不应该抛出错误
      expect(() => {
        errorHandler.validateRequired({ mdVersion: 'v1.0', evrSummary: {} }, [
          'mdVersion',
          'evrSummary',
        ]);
        errorHandler.validateTypes(
          { mdVersion: 'v1.0', evrReady: true },
          { mdVersion: 'string', evrReady: 'boolean' }
        );
        errorHandler.validateEnum('pass', 'status', [
          'pass',
          'fail',
          'skip',
          'unknown',
        ]);
      }).not.toThrow();
    });

    it('应该满足 TDD 要求：反例能产出明确错误码与定位', () => {
      // 测试项目错误的明确定位
      const projectError = createErrorFromCode(ErrorCode.NO_PROJECT_BOUND);
      expect(getErrorCode(projectError)).toBe(ErrorCode.NO_PROJECT_BOUND);
      expect(errorHandler.formatUserMessage(projectError)).toBe(
        '当前连接没有绑定活跃项目，请先调用 project_bind'
      );

      // 测试 EVR 错误的明确定位
      const evrError = createErrorFromCode(ErrorCode.EVR_NOT_READY, undefined, {
        evrIds: ['evr-001', 'evr-002'],
        reasons: ['status_unknown', 'need_reason_for_skip'],
      });
      expect(getErrorCode(evrError)).toBe(ErrorCode.EVR_NOT_READY);
      expect(evrError.context?.evrIds).toEqual(['evr-001', 'evr-002']);
      expect(evrError.context?.reasons).toEqual([
        'status_unknown',
        'need_reason_for_skip',
      ]);

      // 测试同步冲突的明确定位
      const syncError = createErrorFromCode(
        ErrorCode.SYNC_CONFLICT,
        undefined,
        {
          region: 'plan-1',
          field: 'status',
          reason: SyncConflictType.EtagMismatch,
          oursTs: '2025-09-29T04:20:00.000Z',
          theirsTs: '2025-09-29T04:19:00.000Z',
        }
      );
      expect(getErrorCode(syncError)).toBe(ErrorCode.SYNC_CONFLICT);
      expect(syncError.context?.region).toBe('plan-1');
      expect(syncError.context?.field).toBe('status');
      expect(syncError.context?.reason).toBe('etag_mismatch');

      // 测试解析错误的明确定位
      const parseError = createErrorFromCode(ErrorCode.PARSE_ERROR, undefined, {
        line: 42,
        column: 15,
        section: 'plans',
        expectedFormat: '[ ] for to_do',
        actualContent: '[/] invalid checkbox',
      });
      expect(getErrorCode(parseError)).toBe(ErrorCode.PARSE_ERROR);
      expect(parseError.context?.line).toBe(42);
      expect(parseError.context?.column).toBe(15);
      expect(parseError.context?.section).toBe('plans');
    });
  });
});
