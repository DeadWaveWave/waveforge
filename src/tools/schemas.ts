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
 * 所有工具的 Schema 定义
 */
export const ToolSchemas = {
  health: HealthToolSchema,
  ping: PingToolSchema,
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
