# Usage

This document provides detailed instructions for setting up, configuring, and using the WaveForge MCP server.

## 🚀 Quick Start

### Environment Requirements

- Node.js >= 18.0.0
- pnpm (recommended) or npm

### Installation

```bash
pnpm install
```

### Development Mode

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Testing

```bash
pnpm test
```

### Start Server

```bash
# Development mode
pnpm dev

# Production mode
pnpm start
```

## 🔧 MCP Tools

### connect_project

Connects a project to the current MCP session, providing stable project identification.

**Schema:**

```json
{
  "name": "connect_project",
  "description": "连接项目到当前会话",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_path": {
        "type": "string",
        "description": "项目路径"
      }
    },
    "additionalProperties": false
  }
}
```

**Example Usage:**

```json
{
  "project_path": "/Users/username/my-project"
}
```

**Response:**

```json
{
  "success": true,
  "message": "项目连接成功",
  "data": {
    "project": {
      "id": "project-1758555879023",
      "root": "/Users/username/my-project",
      "slug": "waveforge"
    }
  }
}
```

### project_info

Gets information about the currently connected project.

**Schema:**

```json
{
  "name": "project_info",
  "description": "获取当前连接的项目信息",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "获取项目信息成功",
  "data": {
    "project": {
      "id": "project-1758555879023",
      "root": "/Users/username/my-project",
      "slug": "waveforge"
    }
  }
}
```

### current_task_init

Initialize a new development task with goals and overall plan.

**Schema:**

```json
{
  "name": "current_task_init",
  "description": "初始化新的开发任务",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "任务标题",
        "maxLength": 200
      },
      "goal": {
        "type": "string",
        "description": "验收标准和成功指标",
        "maxLength": 2000
      },
      "description": {
        "type": "string",
        "description": "任务背景/范围说明（可选）",
        "maxLength": 5000
      },
      "overall_plan": {
        "type": "array",
        "description": "整体计划列表（可选）",
        "items": {
          "type": "string"
        },
        "maxItems": 50
      }
    },
    "required": ["title", "goal"],
    "additionalProperties": false
  }
}
```

**Example Usage:**

```json
{
  "title": "实现用户认证功能",
  "goal": "完成用户登录、注册和密码重置功能，包括前端界面和后端API",
  "description": "为应用添加完整的用户认证系统",
  "overall_plan": [
    "设计用户认证流程",
    "实现后端API",
    "开发前端界面",
    "编写测试用例",
    "部署和验证"
  ]
}
```

### current_task_read

Read the complete state of the current task to restore context.

**Schema:**

```json
{
  "name": "current_task_read",
  "description": "读取当前任务完整状态以恢复上下文",
  "inputSchema": {
    "type": "object",
    "properties": {
      "include_health": {
        "type": "boolean",
        "description": "是否包含健康度信息",
        "default": true
      },
      "include_logs": {
        "type": "boolean",
        "description": "是否包含日志",
        "default": true
      },
      "logs_limit": {
        "type": "integer",
        "description": "日志数量限制",
        "minimum": 1,
        "maximum": 1000,
        "default": 50
      }
    },
    "additionalProperties": false
  }
}
```

### current_task_update

Update the status of a plan or step.

**Schema:**

```json
{
  "name": "current_task_update",
  "description": "更新任务状态和进度",
  "inputSchema": {
    "type": "object",
    "properties": {
      "update_type": {
        "type": "string",
        "enum": ["plan", "step"],
        "description": "更新类型：plan=计划级别，step=步骤级别"
      },
      "status": {
        "type": "string",
        "enum": ["to_do", "in_progress", "completed", "blocked"],
        "description": "新状态"
      },
      "plan_id": {
        "type": "string",
        "description": "Plan级别更新时使用的计划ID"
      },
      "step_id": {
        "type": "string",
        "description": "Step级别更新时使用的步骤ID"
      },
      "notes": {
        "type": "string",
        "description": "完成情况说明（完成时必填）",
        "maxLength": 2000
      },
      "evidence": {
        "type": "string",
        "description": "完成证据链接（可选）",
        "maxLength": 500
      }
    },
    "required": ["update_type", "status"],
    "additionalProperties": false
  }
}
```

### current_task_modify

Modify task structure including plans, steps, and goals, including the powerful three-level hint system.

**Schema:**

```json
{
  "name": "current_task_modify",
  "description": "修改任务目标、计划或步骤",
  "inputSchema": {
    "type": "object",
    "properties": {
      "field": {
        "type": "string",
        "enum": ["goal", "plan", "steps", "hints"],
        "description": "修改字段：goal=验收标准，plan=整体计划，steps=计划步骤，hints=用户提示"
      },
      "content": {
        "oneOf": [
          { "type": "string" },
          { "type": "array", "items": { "type": "string" } }
        ],
        "description": "修改内容（字符串或字符串数组）"
      },
      "reason": {
        "type": "string",
        "description": "修改原因",
        "maxLength": 500
      },
      "change_type": {
        "type": "string",
        "enum": [
          "generate_steps",
          "plan_adjustment",
          "steps_adjustment",
          "refine_goal",
          "bug_fix_replan",
          "user_request",
          "scope_change"
        ],
        "description": "变更类别"
      },
      "plan_id": {
        "type": "string",
        "description": "针对特定计划修改时需要的计划ID"
      },
      "step_id": {
        "type": "string",
        "description": "针对特定步骤修改时需要的步骤ID（修改步骤级提示时必须同时提供plan_id）"
      }
    },
    "required": ["field", "content", "reason", "change_type"],
    "additionalProperties": false
  }
}
```

**Hint System Examples:**

```bash
# Add task-level hints (applies to all operations)
{
  "field": "hints",
  "content": ["注意代码质量", "遵循安全规范", "及时更新文档"],
  "reason": "添加任务级开发指导",
  "change_type": "user_request"
}

# Add plan-level hints (applies to specific plan operations)
{
  "field": "hints",
  "content": ["注意设计模式", "考虑扩展性"],
  "reason": "添加设计阶段提示",
  "change_type": "user_request",
  "plan_id": "plan-001"
}

# Add step-level hints (applies to specific step operations)
{
  "field": "hints",
  "content": ["仔细分析需求", "与用户确认细节"],
  "reason": "添加需求分析提示",
  "change_type": "user_request",
  "plan_id": "plan-001",
  "step_id": "step-001"
}
```

**How Hints Work:**

- **Task-level hints**: Always returned in `current_task_update` responses
- **Plan-level hints**: Returned when updating plans or steps within that plan
- **Step-level hints**: Returned when updating that specific step
- **Multi-Agent Collaboration**: Different agents can add hints at different levels, and executing agents receive all relevant hints based on their current operation context

### current_task_complete

Complete the current task and generate documentation.

**Schema:**

```json
{
  "name": "current_task_complete",
  "description": "完成当前任务并生成文档",
  "inputSchema": {
    "type": "object",
    "properties": {
      "summary": {
        "type": "string",
        "description": "任务总结",
        "maxLength": 2000
      },
      "generate_docs": {
        "type": "boolean",
        "description": "是否生成文档",
        "default": true
      }
    },
    "required": ["summary"],
    "additionalProperties": false
  }
}
```

### current_task_log

Record important events that are not task status changes.

**Schema:**

```json
{
  "name": "current_task_log",
  "description": "记录非任务状态变更的重要事件",
  "inputSchema": {
    "type": "object",
    "properties": {
      "category": {
        "type": "string",
        "enum": ["discussion", "exception", "test", "health", "knowledge"],
        "description": "日志类别"
      },
      "action": {
        "type": "string",
        "enum": ["update", "create", "modify", "switch", "handle"],
        "description": "操作类别"
      },
      "message": {
        "type": "string",
        "description": "日志消息",
        "maxLength": 1000
      },
      "notes": {
        "type": "string",
        "description": "AI 的详细说明",
        "maxLength": 2000
      }
    },
    "required": ["category", "action", "message", "notes"],
    "additionalProperties": false
  }
}
```

### Health Tool (Disabled by default)

Checks the server's health status, returning uptime, memory usage, etc.

### Ping Tool (Disabled by default)

Tests the server connection and can optionally echo a message.

## 📝 Configuration

### Environment Variables

| Variable             | Description                                               | Default                              |
| -------------------- | --------------------------------------------------------- | ------------------------------------ |
| `WF_LOG_LEVEL`       | Log level (`INFO`, `WARNING`, `ERROR`, `TEACH`, `SILENT`) | `INFO`                               |
| `WF_DOCS_ROOT`       | Documentation root directory                              | `.wave`                              |
| `WF_DEVLOG_TEMPLATE` | Path to the Devlog template                               | `.wave/templates/devlog-template.md` |
| `WF_DEBUG`           | Debug mode (`true` or `false`)                            | `false`                              |

### MCP Client Configuration

Add the following to your MCP client configuration:

```json
{
  "mcpServers": {
    "waveforge": {
      "command": "node",
      "args": ["path/to/waveforge/dist/esm/server.js"],
      "env": {
        "WF_LOG_LEVEL": "SILENT",
        "WF_DEBUG": "false"
      },
      "disabled": false,
      "autoApprove": [
        "connect_project",
        "project_info",
        "current_task_init",
        "current_task_update",
        "current_task_read",
        "current_task_modify",
        "current_task_complete",
        "current_task_log"
      ],
      "disabledTools": ["health", "ping"]
    }
  }
}
```

**Important Notes:**

- Set `WF_LOG_LEVEL` to `SILENT` to prevent log output from interfering with MCP communication
- Use `connect_project` instead of `project_bind` (the latter may conflict with some IDE implementations)
- The `health` and `ping` tools are disabled by default to reduce noise
