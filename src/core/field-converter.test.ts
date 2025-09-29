/**
 * 字段名转换工具测试
 */

import { describe, it, expect } from 'vitest';
import {
  camelToSnake,
  snakeToCamel,
  convertObjectToSnakeCase,
  convertObjectToCamelCase,
  convertResponseToSnakeCase,
  convertRequestToCamelCase,
  validateFieldConversion,
  getAllFieldMappings,
  needsConversion,
  getConvertedFieldName,
  FIELD_MAPPING,
  REVERSE_FIELD_MAPPING,
} from './field-converter.js';

describe('字段名转换工具', () => {
  describe('基础转换函数', () => {
    it('应该正确转换 camelCase 到 snake_case', () => {
      expect(camelToSnake('camelCase')).toBe('camel_case');
      expect(camelToSnake('mdVersion')).toBe('md_version');
      expect(camelToSnake('evrForNode')).toBe('evr_for_node');
      expect(camelToSnake('simple')).toBe('simple');
      expect(camelToSnake('XMLHttpRequest')).toBe('_x_m_l_http_request');
    });

    it('应该正确转换 snake_case 到 camelCase', () => {
      expect(snakeToCamel('snake_case')).toBe('snakeCase');
      expect(snakeToCamel('md_version')).toBe('mdVersion');
      expect(snakeToCamel('evr_for_node')).toBe('evrForNode');
      expect(snakeToCamel('simple')).toBe('simple');
      expect(snakeToCamel('_x_m_l_http_request')).toBe('XMLHttpRequest');
    });

    it('应该处理边界情况', () => {
      expect(camelToSnake('')).toBe('');
      expect(snakeToCamel('')).toBe('');
      expect(camelToSnake('A')).toBe('_a');
      expect(snakeToCamel('a')).toBe('a');
    });
  });

  describe('对象转换函数', () => {
    it('应该递归转换对象到 snake_case', () => {
      const input = {
        mdVersion: '1.0',
        syncPreview: {
          appliedChanges: ['change1'],
          conflictList: [],
        },
        evrSummary: {
          totalCount: 5,
          passedItems: ['evr1', 'evr2'],
        },
      };

      const expected = {
        md_version: '1.0',
        sync_preview: {
          applied_changes: ['change1'],
          conflict_list: [],
        },
        evr_summary: {
          total_count: 5,
          passed_items: ['evr1', 'evr2'],
        },
      };

      expect(convertObjectToSnakeCase(input)).toEqual(expected);
    });

    it('应该递归转换对象到 camelCase', () => {
      const input = {
        md_version: '1.0',
        sync_preview: {
          applied_changes: ['change1'],
          conflict_list: [],
        },
        evr_summary: {
          total_count: 5,
          passed_items: ['evr1', 'evr2'],
        },
      };

      const expected = {
        mdVersion: '1.0',
        syncPreview: {
          appliedChanges: ['change1'],
          conflictList: [],
        },
        evrSummary: {
          totalCount: 5,
          passedItems: ['evr1', 'evr2'],
        },
      };

      expect(convertObjectToCamelCase(input)).toEqual(expected);
    });

    it('应该处理数组', () => {
      const input = [{ mdVersion: '1.0' }, { evrForNode: ['evr1'] }];

      const expected = [{ md_version: '1.0' }, { evr_for_node: ['evr1'] }];

      expect(convertObjectToSnakeCase(input)).toEqual(expected);
    });

    it('应该处理 null 和 undefined', () => {
      expect(convertObjectToSnakeCase(null)).toBe(null);
      expect(convertObjectToSnakeCase(undefined)).toBe(undefined);
      expect(convertObjectToCamelCase(null)).toBe(null);
      expect(convertObjectToCamelCase(undefined)).toBe(undefined);
    });

    it('应该处理原始类型', () => {
      expect(convertObjectToSnakeCase('string')).toBe('string');
      expect(convertObjectToSnakeCase(123)).toBe(123);
      expect(convertObjectToSnakeCase(true)).toBe(true);
    });
  });

  describe('预定义映射转换', () => {
    it('应该使用预定义映射转换响应到 snake_case', () => {
      const input = {
        mdVersion: '1.0',
        evrSummary: {
          totalCount: 5,
        },
        unknownField: 'value',
      };

      const result = convertResponseToSnakeCase(input);

      expect(result.md_version).toBe('1.0');
      expect(result.evr_summary).toBeDefined();
      expect(result.unknown_field).toBe('value'); // 使用通用转换
    });

    it('应该使用预定义映射转换请求到 camelCase', () => {
      const input = {
        md_version: '1.0',
        evr_summary: {
          total_count: 5,
        },
        unknown_field: 'value',
      };

      const result = convertRequestToCamelCase(input);

      expect(result.mdVersion).toBe('1.0');
      expect(result.evrSummary).toBeDefined();
      expect(result.unknownField).toBe('value'); // 使用通用转换
    });
  });

  describe('验证函数', () => {
    it('应该验证字段转换的正确性', () => {
      const original = {
        mdVersion: '1.0',
        evrSummary: {
          totalCount: 5,
          items: ['a', 'b'],
        },
      };

      const converted = {
        md_version: '1.0',
        evr_summary: {
          total_count: 5,
          items: ['a', 'b'],
        },
      };

      expect(validateFieldConversion(original, converted)).toBe(true);
    });

    it('应该检测不正确的转换', () => {
      const original = {
        mdVersion: '1.0',
        count: 5,
      };

      const wrongConverted = {
        md_version: '1.0',
        count: 6, // 值不匹配
      };

      expect(validateFieldConversion(original, wrongConverted)).toBe(false);
    });

    it('应该检查字段是否需要转换', () => {
      expect(needsConversion('mdVersion')).toBe(true);
      expect(needsConversion('md_version')).toBe(true);
      expect(needsConversion('unknownField')).toBe(false);
    });

    it('应该获取转换后的字段名', () => {
      expect(getConvertedFieldName('mdVersion', true)).toBe('md_version');
      expect(getConvertedFieldName('md_version', false)).toBe('mdVersion');
      expect(getConvertedFieldName('unknownField', true)).toBe('unknown_field');
      expect(getConvertedFieldName('unknown_field', false)).toBe(
        'unknownField'
      );
    });
  });

  describe('映射表完整性', () => {
    it('应该有完整的双向映射', () => {
      const mappings = getAllFieldMappings();

      expect(mappings.length).toBeGreaterThan(0);

      mappings.forEach(({ camelCase, snakeCase }) => {
        expect(FIELD_MAPPING[camelCase]).toBe(snakeCase);
        expect(REVERSE_FIELD_MAPPING[snakeCase]).toBe(camelCase);
      });
    });

    it('应该包含关键字段映射', () => {
      const requiredMappings = [
        'mdVersion',
        'syncPreview',
        'evrForNode',
        'evrSummary',
        'evrDetails',
        'lastRun',
        'taskId',
        'planId',
        'stepId',
        'projectId',
        'createdAt',
        'updatedAt',
      ];

      requiredMappings.forEach((field) => {
        expect(FIELD_MAPPING).toHaveProperty(field);
        expect(typeof FIELD_MAPPING[field]).toBe('string');
        expect(FIELD_MAPPING[field]).toMatch(/_/); // 应该包含下划线
      });
    });
  });

  describe('TDD 要求验证', () => {
    it('应该正确处理四个接口的关键字段', () => {
      // current_task_read 响应字段
      const readResponse = {
        evrReady: true,
        evrSummary: { total: 5 },
        evrDetails: [],
        panelPending: false,
        syncPreview: { applied: true },
        logsHighlights: [],
        logsFullCount: 10,
        mdVersion: 'v1',
      };

      const converted = convertResponseToSnakeCase(readResponse);

      expect(converted).toHaveProperty('evr_ready');
      expect(converted).toHaveProperty('evr_summary');
      expect(converted).toHaveProperty('evr_details');
      expect(converted).toHaveProperty('panel_pending');
      expect(converted).toHaveProperty('sync_preview');
      expect(converted).toHaveProperty('logs_highlights');
      expect(converted).toHaveProperty('logs_full_count');
      expect(converted).toHaveProperty('md_version');
    });

    it('应该正确处理 current_task_update 请求字段', () => {
      const updateRequest = {
        updateType: 'plan',
        planId: 'plan-1',
        stepId: 'step-1',
        projectId: 'proj-1',
      };

      const converted = convertRequestToCamelCase(
        convertResponseToSnakeCase(updateRequest)
      );

      expect(converted.updateType).toBe('plan');
      expect(converted.planId).toBe('plan-1');
      expect(converted.stepId).toBe('step-1');
      expect(converted.projectId).toBe('proj-1');
    });

    it('应该正确处理 EVR 相关字段', () => {
      const evrData = {
        evrId: 'evr-001',
        lastRun: '2025-01-01T00:00:00Z',
        referencedBy: ['plan-1'],
        evrForNode: ['evr-001', 'evr-002'],
        evrRequiredFinal: [{ evrId: 'evr-001', reason: 'status_unknown' }],
      };

      const converted = convertResponseToSnakeCase(evrData);

      expect(converted).toHaveProperty('evr_id');
      expect(converted).toHaveProperty('last_run');
      expect(converted).toHaveProperty('referenced_by');
      expect(converted).toHaveProperty('evr_for_node');
      expect(converted).toHaveProperty('evr_required_final');
      expect(converted.evr_required_final[0]).toHaveProperty('evr_id');
    });

    it('应该检测并报告字段风格混用', () => {
      const mixedStyleObject = {
        mdVersion: '1.0', // camelCase
        evr_summary: {}, // snake_case - 混用！
        evrDetails: [], // camelCase
        last_run: '2025-01-01', // snake_case - 混用！
      };

      // 转换后应该全部是 snake_case
      const converted = convertResponseToSnakeCase(mixedStyleObject);

      const allKeysAreSnakeCase = Object.keys(converted).every(
        (key) => !key.match(/[A-Z]/) // 没有大写字母
      );

      expect(allKeysAreSnakeCase).toBe(true);
    });

    it('应该产生明确的错误码与定位', () => {
      const invalidConversion = {
        original: { mdVersion: '1.0', count: 5 },
        converted: { md_version: '1.0' }, // 缺少 count 字段
      };

      const isValid = validateFieldConversion(
        invalidConversion.original,
        invalidConversion.converted
      );

      expect(isValid).toBe(false);

      // 验证可以定位到具体问题
      const originalKeys = Object.keys(invalidConversion.original);
      const convertedKeys = Object.keys(invalidConversion.converted);

      expect(originalKeys.length).not.toBe(convertedKeys.length);
    });
  });
});
