/**
 * MCP 工具 JSON Schema 定义
 * 集中管理所有工具的输入和输出 Schema
 */

/**
 * Health 工具 Schema
 */
export const HealthToolSchema = {
  name: 'health',
  description:
    '检查服务器健康状态，返回服务器运行时间、内存使用情况、项目根目录等信息',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const },
      status: {
        type: 'string' as const,
        enum: ['healthy', 'unhealthy'],
      },
      timestamp: {
        type: 'string' as const,
        format: 'date-time',
      },
      version: { type: 'string' as const },
      uptime: {
        type: 'number' as const,
        minimum: 0,
        description: '服务器运行时间（秒）',
      },
      data: {
        type: 'object' as const,
        properties: {
          server: { type: 'string' as const },
          capabilities: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          projectRoot: {
            type: 'object' as const,
            properties: {
              root: { type: 'string' as const },
              source: {
                type: 'string' as const,
                enum: ['client_roots', 'cwd_fallback'],
              },
              available: { type: 'boolean' as const },
            },
          },
          environment: {
            type: 'object' as const,
            properties: {
              nodeVersion: { type: 'string' as const },
              platform: { type: 'string' as const },
              arch: { type: 'string' as const },
            },
          },
          memory: {
            type: 'object' as const,
            properties: {
              used: {
                type: 'number' as const,
                minimum: 0,
                description: '已使用内存（MB）',
              },
              total: {
                type: 'number' as const,
                minimum: 0,
                description: '总内存（MB）',
              },
            },
          },
        },
      },
    },
    required: ['success', 'status', 'timestamp', 'version', 'uptime'],
    additionalProperties: false,
  },
};

/**
 * Ping 工具 Schema
 */
export const PingToolSchema = {
  name: 'ping',
  description:
    '测试服务器连接，可选择性地回显消息。用于验证 MCP 连接是否正常工作',
  inputSchema: {
    type: 'object' as const,
    properties: {
      message: {
        type: 'string' as const,
        description: '可选的测试消息，服务器将在响应中回显此消息',
        maxLength: 1000,
        minLength: 0,
        pattern: '^[\\x20-\\x7E\\s]*$', // 只允许可打印字符和空白字符
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const },
      message: {
        type: 'string' as const,
        enum: ['pong'],
      },
      echo: {
        type: ['string', 'null'] as const,
        description: '回显的消息内容',
      },
      timestamp: {
        type: 'string' as const,
        format: 'date-time',
      },
      server: { type: 'string' as const },
      version: { type: 'string' as const },
      data: {
        type: 'object' as const,
        properties: {
          requestId: {
            type: 'string' as const,
            pattern: '^ping_\\d+_[a-z0-9]+$',
            description: '请求唯一标识符',
          },
          latency: {
            type: 'number' as const,
            minimum: 0,
            description: '延迟时间（毫秒）',
          },
        },
        required: ['requestId', 'latency'],
      },
    },
    required: [
      'success',
      'message',
      'echo',
      'timestamp',
      'server',
      'version',
      'data',
    ],
    additionalProperties: false,
  },
};

/**
 * Current Task Init 工具 Schema
 */
export const CurrentTaskInitSchema = {
  name: 'current_task_init',
  description: '初始化具有明确目标和计划的结构化任务，支持任务创建和计划管理',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string' as const,
        description: '任务标题',
        minLength: 1,
        maxLength: 200,
      },
      goal: {
        type: 'string' as const,
        description: '验收标准和成功指标',
        minLength: 1,
        maxLength: 2000,
      },
      story: {
        type: 'string' as const,
        description: 'Story 链接（可选）',
        format: 'uri',
      },
      description: {
        type: 'string' as const,
        description: '任务背景/范围说明（可选）',
        maxLength: 5000,
      },
      knowledge_refs: {
        type: 'array' as const,
        description: '知识引用列表（可选）',
        items: { type: 'string' as const },
        maxItems: 20,
      },
      overall_plan: {
        type: 'array' as const,
        description: '整体计划列表（可选）',
        items: { type: 'string' as const },
        maxItems: 50,
      },
      project_id: {
        type: 'string' as const,
        description: '项目ID（可选，覆盖默认绑定）',
      },
    },
    required: ['title', 'goal'],
    additionalProperties: false,
  },
};

/**
 * Current Task Update 工具 Schema
 */
export const CurrentTaskUpdateSchema = {
  name: 'current_task_update',
  description: '在计划和步骤两个层级更新任务进度，支持状态管理和自动推进。支持通过 plan_no/step_no 序号或 plan_id/step_id UUID 定位节点。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      update_type: {
        type: 'string' as const,
        enum: ['plan', 'step', 'evr'],
        description:
          '更新类型：plan=计划级别，step=步骤级别，evr=EVR运行态更新',
      },
      plan_id: {
        type: 'string' as const,
        description: 'Plan级别更新时使用的计划ID（可用plan_no代替）',
      },
      plan_no: {
        type: 'integer' as const,
        description: 'Plan级别更新时使用的计划序号（从1开始，可替代plan_id）',
        minimum: 1,
      },
      step_id: {
        type: 'string' as const,
        description: 'Step级别更新时使用的步骤ID（可用step_no代替）',
      },
      step_no: {
        type: 'integer' as const,
        description: 'Step级别更新时使用的步骤序号（从1开始，可替代step_id）',
        minimum: 1,
      },
      status: {
        type: 'string' as const,
        enum: ['to_do', 'in_progress', 'completed', 'blocked'],
        description: '新状态',
      },
      evidence: {
        type: 'string' as const,
        description: '完成证据链接（可选）',
        maxLength: 500,
      },
      notes: {
        type: 'string' as const,
        description: '完成情况说明（完成时必填）',
        maxLength: 2000,
      },
      project_id: {
        type: 'string' as const,
        description: '项目ID（可选，覆盖默认绑定）',
      },
      evr: {
        type: 'object' as const,
        description: 'EVR更新专用字段（update_type=evr时使用）',
        properties: {
          items: {
            type: 'array' as const,
            description: 'EVR更新项目列表',
            items: {
              type: 'object' as const,
              properties: {
                evr_id: {
                  type: 'string' as const,
                  description: 'EVR唯一标识',
                },
                status: {
                  type: 'string' as const,
                  enum: ['pass', 'fail', 'skip', 'unknown'],
                  description: 'EVR状态',
                },
                last_run: {
                  type: 'string' as const,
                  description: '最后运行时间（ISO 8601格式）',
                },
                notes: {
                  type: 'string' as const,
                  description: '运行备注',
                  maxLength: 1000,
                },
                proof: {
                  type: 'string' as const,
                  description: '运行证据链接',
                  maxLength: 500,
                },
              },
              required: ['evr_id', 'status', 'last_run'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
    },
    required: ['update_type'],
    additionalProperties: false,
  },
};

/**
 * Current Task Read 工具 Schema
 */
export const CurrentTaskReadSchema = {
  name: 'current_task_read',
  description: '读取当前任务完整状态以恢复上下文，支持 EVR 相关参数和同步预览。返回 task-level hints，不返回 plan/step hints（符合级别隔离原则）。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      evr: {
        type: 'object' as const,
        description: 'EVR 相关参数',
        properties: {
          include: {
            type: 'boolean' as const,
            description: '是否包含 EVR 信息',
            default: true,
          },
          require_skip_reason: {
            type: 'boolean' as const,
            description: '是否要求 skip 状态必须有理由',
            default: true,
          },
        },
        additionalProperties: false,
      },
      include_history_refs: {
        type: 'boolean' as const,
        description: '是否包含历史任务引用',
        default: true,
      },
      include_logs: {
        type: 'boolean' as const,
        description: '是否包含日志',
        default: true,
      },
      logs_limit: {
        type: 'integer' as const,
        description: '日志数量限制',
        minimum: 1,
        maximum: 1000,
        default: 50,
      },
      project_id: {
        type: 'string' as const,
        description: '项目ID（可选，覆盖默认绑定）',
      },
    },
    additionalProperties: false,
  },
};

/**
 * Current Task Modify 工具 Schema
 */
export const CurrentTaskModifySchema = {
  name: 'current_task_modify',
  description: '动态修改任务结构，包括计划、步骤、目标和EVR内容，支持提示管理。支持 replace/append/insert/remove/update/add 操作，支持 plan_no/step_no 序号定位。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      field: {
        type: 'string' as const,
        enum: ['goal', 'plan', 'steps', 'hints', 'evr'],
        description:
          '修改字段：goal=验收标准，plan=整体计划，steps=计划步骤，hints=用户提示，evr=EVR内容',
      },
      content: {
        // 移除 oneOf 以兼容 Cursor/Kiro
        // 可以是 string 或 string[]，在代码中验证
        description: '修改内容（字符串或字符串数组，EVR字段时可选）',
      },
      reason: {
        type: 'string' as const,
        description: '修改原因',
        minLength: 1,
        maxLength: 500,
      },
      plan_id: {
        type: 'string' as const,
        description: '针对特定计划修改时需要的计划ID',
      },
      plan_no: {
        type: 'number' as const,
        description: '计划序号（从1开始，可替代plan_id使用）',
        minimum: 1,
      },
      step_id: {
        type: 'string' as const,
        description: '针对特定步骤修改时需要的步骤ID',
      },
      change_type: {
        type: 'string' as const,
        enum: [
          'generate_steps',
          'plan_adjustment',
          'steps_adjustment',
          'refine_goal',
          'bug_fix_replan',
          'user_request',
          'scope_change',
        ],
        description: '变更类别',
      },
      project_id: {
        type: 'string' as const,
        description: '项目ID（可选，覆盖默认绑定）',
      },
      // EVR 专用参数
      evr: {
        type: 'object' as const,
        description: 'EVR修改专用参数',
        properties: {
          items: {
            type: 'array' as const,
            description: 'EVR内容修改项列表',
            items: {
              type: 'object' as const,
              properties: {
                evrId: {
                  type: 'string' as const,
                  description: 'EVR ID（用于更新现有EVR）',
                },
                title: {
                  type: 'string' as const,
                  description: 'EVR标题',
                },
                verify: {
                  description: '验证方法（字符串或字符串数组）',
                },
                expect: {
                  description: '预期结果（字符串或字符串数组）',
                },
                class: {
                  type: 'string' as const,
                  enum: ['runtime', 'static'],
                  description: 'EVR类别',
                },
              },
              additionalProperties: false,
            },
          },
          evrIds: {
            type: 'array' as const,
            description: 'EVR ID列表（用于删除或重新绑定操作）',
            items: {
              type: 'string' as const,
            },
          },
        },
        additionalProperties: false,
      },
      // 通用参数
      op: {
        type: 'string' as const,
        enum: ['replace', 'append', 'insert', 'remove', 'update', 'add'],
        description: '操作类型',
      },
      hints: {
        type: 'array' as const,
        description: '提示列表',
        items: {
          type: 'string' as const,
        },
      },
      tags: {
        type: 'array' as const,
        description: '上下文标签列表',
        items: {
          type: 'object' as const,
          properties: {
            tag: {
              type: 'string' as const,
              description: '标签类型',
            },
            value: {
              type: 'string' as const,
              description: '标签值',
            },
            type: {
              type: 'string' as const,
              enum: ['ref', 'decision', 'discuss', 'inputs', 'constraints', 'evr', 'uses_evr'],
              description: '标签类型分类',
            },
          },
          required: ['tag', 'value', 'type'],
          additionalProperties: false,
        },
      },
    },
    required: ['field', 'reason', 'change_type'],
    additionalProperties: false,
  },
};

/**
 * Current Task Complete 工具 Schema
 */
export const CurrentTaskCompleteSchema = {
  name: 'current_task_complete',
  description: '完成当前任务并生成文档，支持开发日志生成建议',
  inputSchema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string' as const,
        description: '任务总结',
        minLength: 1,
        maxLength: 2000,
      },
      generate_docs: {
        type: 'boolean' as const,
        description: '是否生成文档',
        default: true,
      },
      project_id: {
        type: 'string' as const,
        description: '项目ID（可选，覆盖默认绑定）',
      },
    },
    required: ['summary'],
    additionalProperties: false,
  },
};

/**
 * Current Task Log 工具 Schema
 */
export const CurrentTaskLogSchema = {
  name: 'current_task_log',
  description: '记录非任务状态变更的重要事件，支持分类日志记录',
  inputSchema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string' as const,
        enum: ['discussion', 'exception', 'test', 'health', 'knowledge'],
        description: '日志类别',
      },
      action: {
        type: 'string' as const,
        enum: ['update', 'create', 'modify', 'switch', 'handle'],
        description: '操作类别',
      },
      message: {
        type: 'string' as const,
        description: '日志消息',
        minLength: 1,
        maxLength: 1000,
      },
      notes: {
        type: 'string' as const,
        description: 'AI 的详细说明',
        maxLength: 2000,
      },
      project_id: {
        type: 'string' as const,
        description: '项目ID（可选，覆盖默认绑定）',
      },
    },
    required: ['category', 'action', 'message', 'notes'],
    additionalProperties: false,
  },
};

// ProjectBindSchema 已被移除，使用 connect_project 工具代替

/**
 * Project Info 工具 Schema
 */
export const ProjectInfoSchema = {
  name: 'project_info',
  description: '获取当前连接的活跃项目信息',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    additionalProperties: false,
  },
};

/**
 * Task List 工具 Schema
 */
export const TaskListSchema = {
  name: 'task_list',
  description: '列出任务，支持状态过滤、搜索和分页',
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string' as const,
        enum: ['active', 'completed', 'archived', 'all'],
        description: '状态过滤',
        default: 'all',
      },
      limit: {
        type: 'number' as const,
        minimum: 1,
        maximum: 100,
        description: '限制返回数量',
        default: 20,
      },
      offset: {
        type: 'number' as const,
        minimum: 0,
        description: '偏移量',
        default: 0,
      },
      sort: {
        type: 'string' as const,
        enum: ['created_at', 'updated_at', 'title'],
        description: '排序方式',
        default: 'updated_at',
      },
      order: {
        type: 'string' as const,
        enum: ['asc', 'desc'],
        description: '排序方向',
        default: 'desc',
      },
      search: {
        type: 'string' as const,
        maxLength: 200,
        description: '搜索关键词',
      },
      project_id: {
        type: 'string' as const,
        description: '项目ID（可选，覆盖默认绑定）',
      },
    },
    additionalProperties: false,
  },
};

/**
 * Task Switch 工具 Schema
 */
export const TaskSwitchSchema = {
  name: 'task_switch',
  description: '切换到指定任务，将其设为当前活跃任务',
  inputSchema: {
    type: 'object' as const,
    properties: {
      task_id: {
        type: 'string' as const,
        minLength: 1,
        description: '目标任务ID',
      },
      project_id: {
        type: 'string' as const,
        description: '项目ID（可选，覆盖默认绑定）',
      },
    },
    required: ['task_id'],
    additionalProperties: false,
  },
};

/**
 * 所有工具的 Schema 定义
 */
export const ToolSchemas = {
  health: HealthToolSchema,
  ping: PingToolSchema,
  current_task_init: CurrentTaskInitSchema,
  current_task_update: CurrentTaskUpdateSchema,
  current_task_read: CurrentTaskReadSchema,
  current_task_modify: CurrentTaskModifySchema,
  current_task_complete: CurrentTaskCompleteSchema,
  current_task_log: CurrentTaskLogSchema,
  // project_bind: ProjectBindSchema, // 已移除，使用 connect_project 代替
  project_info: ProjectInfoSchema,
  task_list: TaskListSchema,
  task_switch: TaskSwitchSchema,
} as const;

/**
 * 获取工具定义列表（用于 MCP ListTools 响应）
 */
export function getToolDefinitions() {
  return Object.values(ToolSchemas).map((schema) => ({
    name: schema.name,
    description: schema.description,
    inputSchema: schema.inputSchema,
  }));
}

/**
 * 获取任务管理工具定义列表
 */
export function getTaskToolDefinitions() {
  const taskTools = [
    'current_task_init',
    'current_task_update',
    'current_task_read',
    'current_task_modify',
    'current_task_complete',
    'current_task_log',
  ] as const;

  return taskTools.map((toolName) => {
    const schema = ToolSchemas[toolName];
    return {
      name: schema.name,
      description: schema.description,
      inputSchema: schema.inputSchema,
    };
  });
}

/**
 * 获取项目管理工具定义列表
 */
export function getProjectToolDefinitions() {
  // 移除 project_bind，仅保留 project_info
  const projectTools = ['project_info'] as const;

  return projectTools.map((toolName) => {
    const schema = ToolSchemas[toolName];
    return {
      name: schema.name,
      description: schema.description,
      inputSchema: schema.inputSchema,
    };
  });
}

/**
 * 验证工具输入参数
 */
export function validateToolInput(toolName: string): boolean {
  const schema = ToolSchemas[toolName as keyof typeof ToolSchemas];
  if (!schema) {
    throw new Error(`未知工具: ${toolName}`);
  }

  // 这里可以集成 JSON Schema 验证库，如 ajv
  // 目前返回 true，实际验证在工具处理器中进行
  return true;
}

/**
 * 获取工具的输入Schema
 */
export function getToolInputSchema(toolName: string) {
  const schema = ToolSchemas[toolName as keyof typeof ToolSchemas];
  if (!schema) {
    throw new Error(`未知工具: ${toolName}`);
  }
  return schema.inputSchema;
}

/**
 * 检查工具是否为任务管理工具
 */
export function isTaskManagementTool(toolName: string): boolean {
  return toolName.startsWith('current_task_');
}

/**
 * 检查工具是否为项目管理工具
 */
export function isProjectManagementTool(toolName: string): boolean {
  return toolName.startsWith('project_');
}

/**
 * 验证参数是否符合指定工具的Schema
 */
export function validateParametersAgainstSchema(
  toolName: string,
  params: any
): { valid: boolean; errors: string[] } {
  const schema = ToolSchemas[toolName as keyof typeof ToolSchemas];
  if (!schema) {
    return { valid: false, errors: [`未知工具: ${toolName}`] };
  }

  const errors: string[] = [];
  const inputSchema = schema.inputSchema;

  // 验证必填字段
  if ('required' in inputSchema && inputSchema.required) {
    inputSchema.required.forEach((field: string) => {
      if (params[field] === undefined || params[field] === null) {
        errors.push(`缺少必填字段: ${field}`);
      }
    });
  }

  // 验证字段类型和约束
  if ('properties' in inputSchema) {
    Object.entries(inputSchema.properties).forEach(
      ([fieldName, fieldSchema]: [string, any]) => {
        const value = params[fieldName];

        if (value !== undefined) {
          // 类型验证
          if (fieldSchema.type === 'string' && typeof value !== 'string') {
            errors.push(`字段 ${fieldName} 应为字符串类型`);
          } else if (
            fieldSchema.type === 'integer' &&
            !Number.isInteger(value)
          ) {
            errors.push(`字段 ${fieldName} 应为整数类型`);
          } else if (
            fieldSchema.type === 'boolean' &&
            typeof value !== 'boolean'
          ) {
            errors.push(`字段 ${fieldName} 应为布尔类型`);
          } else if (fieldSchema.type === 'array' && !Array.isArray(value)) {
            errors.push(`字段 ${fieldName} 应为数组类型`);
          }

          // 字符串长度验证
          if (fieldSchema.type === 'string' && typeof value === 'string') {
            if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
              errors.push(
                `字段 ${fieldName} 长度不能少于 ${fieldSchema.minLength} 个字符`
              );
            }
            if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
              errors.push(
                `字段 ${fieldName} 长度不能超过 ${fieldSchema.maxLength} 个字符`
              );
            }
            if (
              fieldSchema.pattern &&
              !new RegExp(fieldSchema.pattern).test(value)
            ) {
              errors.push(`字段 ${fieldName} 格式不正确`);
            }
            // URL格式验证
            if (fieldSchema.format === 'uri') {
              try {
                new URL(value);
              } catch {
                errors.push(`字段 ${fieldName} 必须是有效的URL格式`);
              }
            }
          }

          // 数组长度验证
          if (fieldSchema.type === 'array' && Array.isArray(value)) {
            if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
              errors.push(
                `字段 ${fieldName} 数组长度不能超过 ${fieldSchema.maxItems} 个元素`
              );
            }
            if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
              errors.push(
                `字段 ${fieldName} 数组长度不能少于 ${fieldSchema.minItems} 个元素`
              );
            }
          }

          // 数值范围验证
          if (fieldSchema.type === 'integer' && typeof value === 'number') {
            if (
              fieldSchema.minimum !== undefined &&
              value < fieldSchema.minimum
            ) {
              errors.push(
                `字段 ${fieldName} 值不能小于 ${fieldSchema.minimum}`
              );
            }
            if (
              fieldSchema.maximum !== undefined &&
              value > fieldSchema.maximum
            ) {
              errors.push(
                `字段 ${fieldName} 值不能大于 ${fieldSchema.maximum}`
              );
            }
          }

          // 枚举值验证
          if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
            errors.push(
              `字段 ${fieldName} 值必须是以下之一: ${fieldSchema.enum.join(', ')}`
            );
          }

          // oneOf 验证（用于 current_task_modify 的 content 字段）
          if (fieldSchema.oneOf) {
            const matchesAny = fieldSchema.oneOf.some((option: any) => {
              if (option.type === 'string') {
                return typeof value === 'string';
              } else if (option.type === 'array') {
                return Array.isArray(value);
              }
              return false;
            });

            if (!matchesAny) {
              errors.push(`字段 ${fieldName} 类型不匹配任何允许的类型`);
            }
          }
        }
      }
    );
  }

  // 验证额外属性
  if (
    'additionalProperties' in inputSchema &&
    inputSchema.additionalProperties === false &&
    'properties' in inputSchema
  ) {
    const allowedFields = Object.keys(inputSchema.properties);
    Object.keys(params).forEach((field) => {
      if (!allowedFields.includes(field)) {
        errors.push(`不允许的字段: ${field}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 获取工具的必填字段列表
 */
export function getRequiredFields(toolName: string): string[] {
  const schema = ToolSchemas[toolName as keyof typeof ToolSchemas];
  if (!schema) {
    throw new Error(`未知工具: ${toolName}`);
  }
  return 'required' in schema.inputSchema && schema.inputSchema.required
    ? schema.inputSchema.required
    : [];
}

/**
 * 获取工具的可选字段列表
 */
export function getOptionalFields(toolName: string): string[] {
  const schema = ToolSchemas[toolName as keyof typeof ToolSchemas];
  if (!schema) {
    throw new Error(`未知工具: ${toolName}`);
  }

  const allFields =
    'properties' in schema.inputSchema
      ? Object.keys(schema.inputSchema.properties)
      : [];
  const requiredFields =
    'required' in schema.inputSchema && schema.inputSchema.required
      ? schema.inputSchema.required
      : [];

  return allFields.filter((field) => !requiredFields.includes(field));
}

/**
 * 获取字段的默认值
 */
export function getFieldDefault(toolName: string, fieldName: string): any {
  const schema = ToolSchemas[toolName as keyof typeof ToolSchemas];
  if (!schema) {
    throw new Error(`未知工具: ${toolName}`);
  }

  if (!('properties' in schema.inputSchema)) {
    throw new Error(`工具 ${toolName} 没有属性定义`);
  }

  const fieldSchema = (schema.inputSchema.properties as any)[fieldName];
  if (!fieldSchema) {
    throw new Error(`工具 ${toolName} 中不存在字段: ${fieldName}`);
  }

  return fieldSchema.default;
}

/**
 * 生成工具参数的示例数据
 */
export function generateExampleParams(toolName: string): any {
  const schema = ToolSchemas[toolName as keyof typeof ToolSchemas];
  if (!schema) {
    throw new Error(`未知工具: ${toolName}`);
  }

  const example: any = {};

  if ('properties' in schema.inputSchema) {
    Object.entries(schema.inputSchema.properties).forEach(
      ([fieldName, fieldSchema]: [string, any]) => {
        const t = fieldSchema.type;
        const isString = t === 'string' || (Array.isArray(t) && t.includes('string'));
        const isNumber = t === 'number' || t === 'integer';
        const isBoolean = t === 'boolean';
        const isArray = t === 'array' || (Array.isArray(t) && t.includes('array'));

        if (isString) {
          if (fieldSchema.enum) {
            example[fieldName] = fieldSchema.enum[0];
          } else if (fieldName === 'title') {
            example[fieldName] = '示例任务标题';
          } else if (fieldName === 'goal') {
            example[fieldName] = '示例验收标准和成功指标';
          } else if (fieldName === 'message') {
            example[fieldName] = '示例消息内容';
          } else if (fieldName === 'reason') {
            example[fieldName] = '示例修改原因';
          } else if (fieldName === 'summary') {
            example[fieldName] = '示例任务总结';
          } else if (fieldName === 'notes') {
            example[fieldName] = '示例备注信息';
          } else {
            example[fieldName] = '示例文本';
          }
        } else if (isNumber) {
          if (fieldSchema.default !== undefined) {
            example[fieldName] = fieldSchema.default;
          } else if (fieldSchema.minimum !== undefined) {
            example[fieldName] = fieldSchema.minimum;
          } else {
            example[fieldName] = 1;
          }
        } else if (isBoolean) {
          example[fieldName] =
            fieldSchema.default !== undefined ? fieldSchema.default : true;
        } else if (isArray) {
          if (fieldName === 'knowledge_refs') {
            example[fieldName] = ['参考资料1', '参考资料2'];
          } else if (fieldName === 'overall_plan') {
            example[fieldName] = ['计划1', '计划2', '计划3'];
          } else {
            example[fieldName] = ['示例项目1', '示例项目2'];
          }
        } else if (fieldSchema.oneOf) {
          // 对于 oneOf 类型，选择第一个选项
          if (fieldSchema.oneOf[0].type === 'string') {
            example[fieldName] = '示例内容';
          } else if (fieldSchema.oneOf[0].type === 'array') {
            example[fieldName] = ['示例项目1', '示例项目2'];
          }
        } else if (Array.isArray(t)) {
          // 简单处理联合类型（如 ['string','array']）
          if (t.includes('string')) {
            example[fieldName] = '示例内容';
          } else if (t.includes('array')) {
            example[fieldName] = ['示例项目1', '示例项目2'];
          }
        }
      }
    );
  }

  return example;
}

/**
 * 获取所有工具的统计信息
 */
export function getToolsStatistics() {
  const allTools = Object.keys(ToolSchemas);
  const taskTools = allTools.filter(isTaskManagementTool);
  const projectTools = allTools.filter(isProjectManagementTool);
  const systemTools = allTools.filter(
    (name) => !isTaskManagementTool(name) && !isProjectManagementTool(name)
  );

  return {
    total: allTools.length,
    taskManagement: taskTools.length,
    projectManagement: projectTools.length,
    system: systemTools.length,
    tools: {
      all: allTools,
      taskManagement: taskTools,
      projectManagement: projectTools,
      system: systemTools,
    },
  };
}
