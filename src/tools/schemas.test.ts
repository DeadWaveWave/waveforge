/**
 * JSON Schema 验证测试
 */

import { describe, it, expect } from 'vitest';
import {
  ToolSchemas,
  getToolDefinitions,
  getTaskToolDefinitions,
  getToolInputSchema,
  isTaskManagementTool,
  validateToolInput,
  validateParametersAgainstSchema,
  getRequiredFields,
  getOptionalFields,
  getFieldDefault,
  generateExampleParams,
  getToolsStatistics,
} from './schemas.js';

describe('Schema 定义验证', () => {
  describe('基础工具 Schema', () => {
    it('应该包含所有必需的工具', () => {
      const expectedTools = [
        'health',
        'ping',
        'current_task_init',
        'current_task_update',
        'current_task_read',
        'current_task_modify',
        'current_task_complete',
        'current_task_log',
      ];

      expectedTools.forEach((toolName) => {
        expect(ToolSchemas).toHaveProperty(toolName);
        expect(ToolSchemas[toolName as keyof typeof ToolSchemas]).toBeDefined();
      });
    });

    it('每个工具都应该有完整的定义', () => {
      Object.values(ToolSchemas).forEach((schema) => {
        expect(schema).toHaveProperty('name');
        expect(schema).toHaveProperty('description');
        expect(schema).toHaveProperty('inputSchema');

        expect(typeof schema.name).toBe('string');
        expect(typeof schema.description).toBe('string');
        expect(schema.inputSchema).toHaveProperty('type', 'object');
        expect(schema.inputSchema).toHaveProperty(
          'additionalProperties',
          false
        );
      });
    });

    it('任务管理工具应该有正确的命名规范', () => {
      const taskTools = Object.keys(ToolSchemas).filter((name) =>
        name.startsWith('current_task_')
      );

      expect(taskTools).toHaveLength(6);

      const expectedTaskTools = [
        'current_task_init',
        'current_task_update',
        'current_task_read',
        'current_task_modify',
        'current_task_complete',
        'current_task_log',
      ];

      expectedTaskTools.forEach((toolName) => {
        expect(taskTools).toContain(toolName);
      });
    });
  });

  describe('Schema 结构验证', () => {
    it('current_task_init Schema 应该有正确的必填字段', () => {
      const schema = ToolSchemas.current_task_init;

      expect(schema.inputSchema.required).toEqual(['title', 'goal']);
      expect(schema.inputSchema.properties).toHaveProperty('title');
      expect(schema.inputSchema.properties).toHaveProperty('goal');
      expect(schema.inputSchema.properties.title).toHaveProperty(
        'minLength',
        1
      );
      expect(schema.inputSchema.properties.title).toHaveProperty(
        'maxLength',
        200
      );
      expect(schema.inputSchema.properties.goal).toHaveProperty('minLength', 1);
      expect(schema.inputSchema.properties.goal).toHaveProperty(
        'maxLength',
        2000
      );
    });

    it('current_task_update Schema 应该有正确的枚举值', () => {
      const schema = ToolSchemas.current_task_update;

      expect(schema.inputSchema.properties.update_type.enum).toEqual([
        'plan',
        'step',
      ]);
      expect(schema.inputSchema.properties.status.enum).toEqual([
        'to_do',
        'in_progress',
        'completed',
        'blocked',
      ]);
    });

    it('current_task_modify Schema 应该支持 oneOf 内容类型', () => {
      const schema = ToolSchemas.current_task_modify;

      expect(schema.inputSchema.properties.content).toHaveProperty('oneOf');
      expect(schema.inputSchema.properties.content.oneOf).toHaveLength(2);
      expect(schema.inputSchema.properties.content.oneOf[0]).toEqual({
        type: 'string',
      });
      expect(schema.inputSchema.properties.content.oneOf[1]).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });

    it('current_task_read Schema 应该有正确的默认值', () => {
      const schema = ToolSchemas.current_task_read;

      expect(schema.inputSchema.properties.include_health.default).toBe(true);
      expect(schema.inputSchema.properties.include_history_refs.default).toBe(
        true
      );
      expect(schema.inputSchema.properties.include_logs.default).toBe(true);
      expect(schema.inputSchema.properties.logs_limit.default).toBe(50);
      expect(schema.inputSchema.properties.logs_limit.minimum).toBe(1);
      expect(schema.inputSchema.properties.logs_limit.maximum).toBe(1000);
    });

    it('current_task_log Schema 应该有正确的枚举值', () => {
      const schema = ToolSchemas.current_task_log;

      expect(schema.inputSchema.properties.category.enum).toEqual([
        'discussion',
        'exception',
        'test',
        'health',
        'knowledge',
      ]);
      expect(schema.inputSchema.properties.action.enum).toEqual([
        'update',
        'create',
        'modify',
        'switch',
        'handle',
      ]);
    });
  });

  describe('工具定义函数', () => {
    it('getToolDefinitions 应该返回所有工具定义', () => {
      const definitions = getToolDefinitions();

      expect(definitions).toHaveLength(10);
      definitions.forEach((def) => {
        expect(def).toHaveProperty('name');
        expect(def).toHaveProperty('description');
        expect(def).toHaveProperty('inputSchema');
      });
    });

    it('getTaskToolDefinitions 应该只返回任务管理工具', () => {
      const taskDefinitions = getTaskToolDefinitions();

      expect(taskDefinitions).toHaveLength(6);
      taskDefinitions.forEach((def) => {
        expect(def.name).toMatch(/^current_task_/);
      });
    });

    it('getToolInputSchema 应该返回正确的输入Schema', () => {
      const initSchema = getToolInputSchema('current_task_init');

      expect(initSchema).toEqual(ToolSchemas.current_task_init.inputSchema);
    });

    it('getToolInputSchema 应该抛出未知工具错误', () => {
      expect(() => getToolInputSchema('unknown_tool')).toThrow(
        '未知工具: unknown_tool'
      );
    });

    it('isTaskManagementTool 应该正确识别任务管理工具', () => {
      expect(isTaskManagementTool('current_task_init')).toBe(true);
      expect(isTaskManagementTool('current_task_update')).toBe(true);
      expect(isTaskManagementTool('health')).toBe(false);
      expect(isTaskManagementTool('ping')).toBe(false);
    });

    it('validateToolInput 应该验证工具存在性', () => {
      expect(validateToolInput('current_task_init')).toBe(true);
      expect(validateToolInput('health')).toBe(true);
      expect(() => validateToolInput('unknown_tool')).toThrow(
        '未知工具: unknown_tool'
      );
    });
  });

  describe('Schema 数据类型验证', () => {
    it('字符串字段应该有正确的长度限制', () => {
      const schemas = [
        { name: 'current_task_init', field: 'title', min: 1, max: 200 },
        { name: 'current_task_init', field: 'goal', min: 1, max: 2000 },
        { name: 'current_task_modify', field: 'reason', min: 1, max: 500 },
        { name: 'current_task_complete', field: 'summary', min: 1, max: 2000 },
        { name: 'current_task_log', field: 'message', min: 1, max: 1000 },
      ];

      schemas.forEach(({ name, field, min, max }) => {
        const schema = ToolSchemas[name as keyof typeof ToolSchemas];
        const fieldSchema = (schema.inputSchema.properties as any)[field];

        expect(fieldSchema.minLength).toBe(min);
        expect(fieldSchema.maxLength).toBe(max);
      });
    });

    it('数组字段应该有正确的项目限制', () => {
      const initSchema = ToolSchemas.current_task_init;

      expect(initSchema.inputSchema.properties.knowledge_refs.maxItems).toBe(
        20
      );
      expect(initSchema.inputSchema.properties.overall_plan.maxItems).toBe(50);
    });

    it('整数字段应该有正确的范围限制', () => {
      const readSchema = ToolSchemas.current_task_read;
      const logsLimit = readSchema.inputSchema.properties.logs_limit;

      expect(logsLimit.type).toBe('integer');
      expect(logsLimit.minimum).toBe(1);
      expect(logsLimit.maximum).toBe(1000);
    });
  });

  describe('Schema 一致性验证', () => {
    it('所有工具名称应该与Schema中的name字段一致', () => {
      Object.entries(ToolSchemas).forEach(([key, schema]) => {
        expect(schema.name).toBe(key);
      });
    });

    it('所有必填字段都应该在properties中定义', () => {
      Object.values(ToolSchemas).forEach((schema) => {
        if ((schema.inputSchema as any).required) {
          (schema.inputSchema as any).required.forEach(
            (requiredField: string) => {
              expect(schema.inputSchema.properties).toHaveProperty(
                requiredField
              );
            }
          );
        }
      });
    });

    it('所有枚举值应该是字符串数组', () => {
      const enumFields = [
        { schema: 'current_task_update', field: 'update_type' },
        { schema: 'current_task_update', field: 'status' },
        { schema: 'current_task_modify', field: 'field' },
        { schema: 'current_task_modify', field: 'change_type' },
        { schema: 'current_task_log', field: 'category' },
        { schema: 'current_task_log', field: 'action' },
      ];

      enumFields.forEach(({ schema, field }) => {
        const schemaObj = ToolSchemas[schema as keyof typeof ToolSchemas];
        const fieldSchema = (schemaObj.inputSchema.properties as any)[field];

        expect(fieldSchema).toHaveProperty('enum');
        expect(Array.isArray(fieldSchema.enum)).toBe(true);
        fieldSchema.enum.forEach((value: any) => {
          expect(typeof value).toBe('string');
        });
      });
    });
  });

  describe('Schema 完整性检查', () => {
    it('所有Schema都应该禁用额外属性', () => {
      Object.values(ToolSchemas).forEach((schema) => {
        expect(schema.inputSchema.additionalProperties).toBe(false);
      });
    });

    it('所有Schema都应该有描述信息', () => {
      Object.values(ToolSchemas).forEach((schema) => {
        expect(schema.description).toBeTruthy();
        expect(schema.description.length).toBeGreaterThan(10);
      });
    });

    it('所有字段都应该有描述信息', () => {
      Object.values(ToolSchemas).forEach((schema) => {
        Object.values(schema.inputSchema.properties).forEach(
          (property: any) => {
            if (property.description) {
              expect(typeof property.description).toBe('string');
              expect(property.description.length).toBeGreaterThan(0);
            }
          }
        );
      });
    });
  });
});

describe('Schema 验证工具函数', () => {
  describe('validateParametersAgainstSchema', () => {
    it('应该验证有效的参数', () => {
      const params = {
        title: '测试任务',
        goal: '完成测试功能',
      };

      const result = validateParametersAgainstSchema(
        'current_task_init',
        params
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺少必填字段', () => {
      const params = {
        title: '测试任务',
        // 缺少 goal 字段
      };

      const result = validateParametersAgainstSchema(
        'current_task_init',
        params
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: goal');
    });

    it('应该验证字符串长度限制', () => {
      const params = {
        title: 'a'.repeat(201), // 超过200字符限制
        goal: '测试目标',
      };

      const result = validateParametersAgainstSchema(
        'current_task_init',
        params
      );
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('长度不能超过 200'))
      ).toBe(true);
    });

    it('应该验证枚举值', () => {
      const params = {
        update_type: 'invalid_type',
        status: 'in_progress',
      };

      const result = validateParametersAgainstSchema(
        'current_task_update',
        params
      );
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('必须是以下之一'))
      ).toBe(true);
    });

    it('应该验证数组长度限制', () => {
      const params = {
        title: '测试任务',
        goal: '测试目标',
        knowledge_refs: Array(21).fill('ref'), // 超过20个限制
      };

      const result = validateParametersAgainstSchema(
        'current_task_init',
        params
      );
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('数组长度不能超过 20'))
      ).toBe(true);
    });

    it('应该验证整数范围', () => {
      const params = {
        logs_limit: 0, // 小于最小值1
      };

      const result = validateParametersAgainstSchema(
        'current_task_read',
        params
      );
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('值不能小于 1'))
      ).toBe(true);
    });

    it('应该检测额外属性', () => {
      const params = {
        title: '测试任务',
        goal: '测试目标',
        extra_field: '不允许的字段',
      };

      const result = validateParametersAgainstSchema(
        'current_task_init',
        params
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('不允许的字段: extra_field');
    });

    it('应该验证 oneOf 类型', () => {
      const validStringParams = {
        field: 'goal',
        content: '字符串内容',
        reason: '测试原因',
        change_type: 'refine_goal',
      };

      const validArrayParams = {
        field: 'plan',
        content: ['计划1', '计划2'],
        reason: '测试原因',
        change_type: 'plan_adjustment',
      };

      const invalidParams = {
        field: 'goal',
        content: 123, // 无效类型
        reason: '测试原因',
        change_type: 'refine_goal',
      };

      expect(
        validateParametersAgainstSchema(
          'current_task_modify',
          validStringParams
        ).valid
      ).toBe(true);
      expect(
        validateParametersAgainstSchema('current_task_modify', validArrayParams)
          .valid
      ).toBe(true);
      expect(
        validateParametersAgainstSchema('current_task_modify', invalidParams)
          .valid
      ).toBe(false);
    });
  });

  describe('getRequiredFields', () => {
    it('应该返回正确的必填字段', () => {
      const required = getRequiredFields('current_task_init');
      expect(required).toEqual(['title', 'goal']);
    });

    it('应该处理没有必填字段的工具', () => {
      const required = getRequiredFields('health');
      expect(required).toEqual([]);
    });
  });

  describe('getOptionalFields', () => {
    it('应该返回正确的可选字段', () => {
      const optional = getOptionalFields('current_task_init');
      expect(optional).toContain('story');
      expect(optional).toContain('description');
      expect(optional).toContain('knowledge_refs');
      expect(optional).toContain('overall_plan');
      expect(optional).not.toContain('title');
      expect(optional).not.toContain('goal');
    });
  });

  describe('getFieldDefault', () => {
    it('应该返回字段的默认值', () => {
      const defaultValue = getFieldDefault(
        'current_task_read',
        'include_health'
      );
      expect(defaultValue).toBe(true);
    });

    it('应该处理没有默认值的字段', () => {
      const defaultValue = getFieldDefault('current_task_init', 'title');
      expect(defaultValue).toBeUndefined();
    });

    it('应该抛出未知字段错误', () => {
      expect(() =>
        getFieldDefault('current_task_init', 'unknown_field')
      ).toThrow('工具 current_task_init 中不存在字段: unknown_field');
    });
  });

  describe('generateExampleParams', () => {
    it('应该为 current_task_init 生成示例参数', () => {
      const example = generateExampleParams('current_task_init');

      expect(example).toHaveProperty('title');
      expect(example).toHaveProperty('goal');
      expect(example.title).toBe('示例任务标题');
      expect(example.goal).toBe('示例验收标准和成功指标');
      expect(Array.isArray(example.knowledge_refs)).toBe(true);
      expect(Array.isArray(example.overall_plan)).toBe(true);
    });

    it('应该为 current_task_update 生成示例参数', () => {
      const example = generateExampleParams('current_task_update');

      expect(example.update_type).toBe('plan');
      expect(example.status).toBe('to_do');
    });

    it('应该为 current_task_read 生成示例参数', () => {
      const example = generateExampleParams('current_task_read');

      expect(example.include_health).toBe(true);
      expect(example.logs_limit).toBe(50);
    });

    it('应该处理 oneOf 类型字段', () => {
      const example = generateExampleParams('current_task_modify');

      expect(example.content).toBe('示例内容');
      expect(example.field).toBe('goal');
      expect(example.change_type).toBe('generate_steps');
    });
  });

  describe('getToolsStatistics', () => {
    it('应该返回正确的工具统计信息', () => {
      const stats = getToolsStatistics();

      expect(stats.total).toBe(10);
      expect(stats.taskManagement).toBe(6);
      expect(stats.system).toBe(2);
      expect(stats.projectManagement).toBe(2);
      expect(stats.tools.all).toHaveLength(10);
      expect(stats.tools.taskManagement).toHaveLength(6);
      expect(stats.tools.system).toHaveLength(2);
      expect(stats.tools.projectManagement).toHaveLength(2);
      expect(stats.tools.system).toContain('health');
      expect(stats.tools.system).toContain('ping');
    });
  });
});
