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

**Successful Response:**

```json
{
  "success": true,
  "message": "项目连接成功",
  "data": {
    "project": {
      "id": "project-1758555879023",
      "root": "/Users/username/my-project",
      "slug": "my-project"
    },
    "validation": {
      "path_exists": true,
      "is_directory": true,
      "has_permissions": true,
      "project_type": "nodejs",
      "project_root": "/Users/username/my-project"
    }
  }
}
```

**Error Responses:**

```json
// 路径不存在
{
  "success": false,
  "error": "PATH_NOT_FOUND",
  "message": "指定的路径不存在",
  "details": {
    "path": "/nonexistent/path",
    "suggestion": "请检查路径是否正确"
  }
}

// 安全违规
{
  "success": false,
  "error": "SECURITY_VIOLATION",
  "message": "拒绝连接到系统关键目录",
  "details": {
    "path": "/etc",
    "reason": "系统配置目录，存在安全风险",
    "suggestion": "请选择一个开发项目目录"
  }
}

// 权限不足
{
  "success": false,
  "error": "PERMISSION_DENIED",
  "message": "目录权限不足",
  "details": {
    "path": "/protected/directory",
    "missing_permissions": ["write"],
    "suggestion": "请检查目录权限或选择其他目录"
  }
}

// 不是有效的项目目录
{
  "success": false,
  "error": "INVALID_PROJECT",
  "message": "目录不包含有效的项目结构",
  "details": {
    "path": "/some/empty/directory",
    "reason": "未找到项目标识文件",
    "suggestion": "请选择包含 package.json、Cargo.toml 等项目文件的目录"
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

**Successful Response:**

```json
{
  "success": true,
  "message": "获取项目信息成功",
  "data": {
    "project": {
      "id": "project-1758555879023",
      "root": "/Users/username/my-project",
      "slug": "my-project"
    },
    "health": {
      "status": "healthy",
      "checks": {
        "directory_structure": "ok",
        "file_permissions": "ok",
        "data_integrity": "ok",
        "template_files": "ok"
      },
      "wave_directory": {
        "exists": true,
        "size": "2.3MB",
        "tasks_count": 15,
        "last_activity": "2025-09-24T11:30:00.000Z"
      }
    }
  }
}
```

**Response with Issues:**

```json
{
  "success": true,
  "message": "获取项目信息成功（发现问题）",
  "data": {
    "project": {
      "id": "project-1758555879023",
      "root": "/Users/username/my-project",
      "slug": "my-project"
    },
    "health": {
      "status": "warning",
      "checks": {
        "directory_structure": "missing_directories",
        "file_permissions": "ok",
        "data_integrity": "corrupted_index",
        "template_files": "missing"
      },
      "issues": [
        {
          "type": "missing_directory",
          "path": ".wave/templates",
          "severity": "warning",
          "auto_fix": true,
          "description": "模板目录缺失"
        },
        {
          "type": "corrupted_file",
          "path": ".wave/tasks/index.json",
          "severity": "error",
          "auto_fix": true,
          "description": "任务索引文件损坏"
        }
      ],
      "recommendations": [
        "运行自动修复以解决发现的问题",
        "建议备份当前数据后重新初始化"
      ]
    }
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "NO_ACTIVE_PROJECT",
  "message": "当前会话没有连接的项目",
  "details": {
    "suggestion": "请先使用 connect_project 工具连接一个项目"
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

**Successful Response:**

```json
{
  "success": true,
  "message": "任务初始化成功",
  "data": {
    "task_id": "01K5XQWG08W3QKABF3MP9Q3HE6",
    "slug": "实现用户认证功能",
    "current_plan_id": "plan-1",
    "plan_required": false,
    "plan_ids": ["plan-1", "plan-2", "plan-3", "plan-4", "plan-5"]
  }
}
```

**Error Responses:**

```json
// 参数验证失败
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "参数验证失败",
  "details": {
    "field": "title",
    "reason": "标题不能为空",
    "provided": ""
  }
}

// 已存在活跃任务
{
  "success": false,
  "error": "ACTIVE_TASK_EXISTS",
  "message": "已存在活跃任务",
  "details": {
    "current_task_id": "01K5XQWG08W3QKABF3MP9Q3HE6",
    "current_task_title": "修复登录bug",
    "suggestion": "请先完成当前任务或切换任务"
  }
}

// 项目未连接
{
  "success": false,
  "error": "NO_ACTIVE_PROJECT",
  "message": "当前会话没有连接的项目",
  "details": {
    "suggestion": "请先使用 connect_project 工具连接一个项目"
  }
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

## 🏥 Project Health Monitoring

### Using project_info for Health Checks

The `project_info` tool provides comprehensive health monitoring for your project:

#### Health Check Categories

1. **Directory Structure**: Validates .wave directory structure
2. **File Permissions**: Checks read/write access to critical files
3. **Data Integrity**: Verifies JSON files and data consistency
4. **Template Files**: Ensures required templates are available

#### Health Status Levels

- **healthy**: All checks passed, no issues found
- **warning**: Minor issues found, auto-fixable
- **error**: Critical issues requiring attention
- **critical**: Severe problems, manual intervention needed

#### Regular Health Check Workflow

```bash
# Daily health check routine
1. Run project_info to check overall health
2. Review any warnings or errors
3. Apply auto-fixes if available
4. Backup data before major repairs
```

#### Health Check Response Analysis

**Healthy Project:**

```json
{
  "health": {
    "status": "healthy",
    "checks": {
      "directory_structure": "ok",
      "file_permissions": "ok",
      "data_integrity": "ok",
      "template_files": "ok"
    },
    "wave_directory": {
      "exists": true,
      "size": "2.3MB",
      "tasks_count": 15,
      "last_activity": "2025-09-24T11:30:00.000Z"
    }
  }
}
```

**Project with Issues:**

```json
{
  "health": {
    "status": "warning",
    "issues": [
      {
        "type": "missing_directory",
        "path": ".wave/templates",
        "severity": "warning",
        "auto_fix": true,
        "description": "模板目录缺失，将自动创建"
      },
      {
        "type": "corrupted_file",
        "path": ".wave/tasks/index.json",
        "severity": "error",
        "auto_fix": true,
        "description": "任务索引文件损坏，将重建"
      }
    ],
    "recommendations": [
      "运行自动修复以解决发现的问题",
      "建议在修复前备份当前数据"
    ]
  }
}
```

#### Common Health Issues and Solutions

| Issue Type           | Description                   | Auto-Fix | Manual Steps                  |
| -------------------- | ----------------------------- | -------- | ----------------------------- |
| `missing_directory`  | Required directories missing  | ✅ Yes   | Re-run connect_project        |
| `corrupted_file`     | JSON files damaged            | ✅ Yes   | Restore from backup if needed |
| `permission_denied`  | Insufficient file permissions | ❌ No    | Fix directory permissions     |
| `template_missing`   | Template files not found      | ✅ Yes   | Will copy from defaults       |
| `index_inconsistent` | Task index out of sync        | ✅ Yes   | Will rebuild automatically    |

#### Preventive Health Measures

1. **Regular Backups**:

   ```bash
   # Create timestamped backup
   cp -r .wave .wave.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Version Control**:

   ```bash
   # Add .wave to git (excluding current-task.md)
   git add .wave/
   git commit -m "Update task data"
   ```

3. **Monitoring Schedule**:
   - **Daily**: Quick health check with project_info
   - **Weekly**: Full backup and integrity verification
   - **Monthly**: Clean up old task archives

#### Troubleshooting Health Issues

**Step 1: Identify the Problem**

```json
{
  "tool": "project_info"
}
```

**Step 2: Backup Current State**

```bash
cp -r .wave .wave.backup.emergency
```

**Step 3: Apply Auto-Fixes**
Most issues can be resolved by reconnecting the project:

```json
{
  "tool": "connect_project",
  "project_path": "/path/to/your/project"
}
```

**Step 4: Verify Resolution**

```json
{
  "tool": "project_info"
}
```

**Step 5: Manual Recovery (if needed)**
For issues that can't be auto-fixed:

1. Check file system permissions
2. Restore from backup if necessary
3. Manually recreate missing files
4. Contact support for complex data corruption

### Health Tool (Disabled by default)

Checks the server's health status, returning uptime, memory usage, etc.

### Ping Tool (Disabled by default)

Tests the server connection and can optionally echo a message.

## 🔍 Error Handling and Validation

### Common Error Types

All WaveForge MCP tools implement comprehensive error handling and validation:

#### 1. Validation Errors

**Parameter Validation:**

- Required fields missing
- Invalid data types
- Value out of range
- Invalid format

**Example:**

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "参数验证失败",
  "details": {
    "field": "overall_plan",
    "reason": "计划项目数量超过限制",
    "max_allowed": 50,
    "provided": 75
  }
}
```

#### 2. Security Errors

**Path Security:**

- System directory access blocked
- Insufficient permissions
- Invalid path format

**Example:**

```json
{
  "success": false,
  "error": "SECURITY_VIOLATION",
  "message": "拒绝访问系统关键目录",
  "details": {
    "path": "/etc/passwd",
    "violation_type": "system_directory",
    "suggestion": "请选择用户目录下的项目路径"
  }
}
```

#### 3. State Errors

**Task State Issues:**

- No active task
- Invalid state transition
- Concurrent modification

**Example:**

```json
{
  "success": false,
  "error": "INVALID_STATE_TRANSITION",
  "message": "无效的状态转换",
  "details": {
    "current_status": "completed",
    "requested_status": "in_progress",
    "reason": "已完成的任务不能回退到进行中状态"
  }
}
```

#### 4. File System Errors

**I/O Operations:**

- File not found
- Permission denied
- Disk space insufficient

**Example:**

```json
{
  "success": false,
  "error": "FILE_SYSTEM_ERROR",
  "message": "文件系统操作失败",
  "details": {
    "operation": "write",
    "path": ".wave/tasks/index.json",
    "system_error": "ENOSPC: no space left on device"
  }
}
```

### Validation Logic Examples

#### Project Path Validation

```typescript
// 路径验证流程
const validateProjectPath = (path: string) => {
  // 1. 基本格式检查
  if (!path || typeof path !== 'string') {
    throw new ValidationError('路径不能为空');
  }

  // 2. 路径存在性检查
  if (!fs.existsSync(path)) {
    throw new ValidationError('路径不存在');
  }

  // 3. 目录类型检查
  if (!fs.statSync(path).isDirectory()) {
    throw new ValidationError('路径必须是目录');
  }

  // 4. 安全检查
  if (isSystemDirectory(path)) {
    throw new SecurityError('拒绝访问系统目录');
  }

  // 5. 权限检查
  if (!hasRequiredPermissions(path)) {
    throw new PermissionError('目录权限不足');
  }
};
```

#### Task Parameter Validation

```typescript
// 任务参数验证
const validateTaskInit = (params: TaskInitParams) => {
  // 标题验证
  if (!params.title || params.title.length > 200) {
    throw new ValidationError('标题长度必须在1-200字符之间');
  }

  // 目标验证
  if (!params.goal || params.goal.length > 2000) {
    throw new ValidationError('目标描述长度必须在1-2000字符之间');
  }

  // 计划数量验证
  if (params.overall_plan && params.overall_plan.length > 50) {
    throw new ValidationError('计划项目数量不能超过50个');
  }
};
```

### Error Recovery Strategies

#### 1. Automatic Recovery

Some errors can be automatically resolved:

- **Missing directories**: Auto-create required structure
- **Corrupted JSON files**: Rebuild with valid empty structure
- **Missing templates**: Copy from defaults
- **Stale locks**: Clean up expired locks

#### 2. User-Guided Recovery

For complex issues, provide clear guidance:

```json
{
  "success": false,
  "error": "DATA_CORRUPTION",
  "message": "任务数据损坏",
  "details": {
    "corrupted_files": [".wave/tasks/index.json"],
    "recovery_steps": [
      "1. 备份当前 .wave 目录",
      "2. 运行 connect_project 重新初始化",
      "3. 从备份中恢复重要任务数据"
    ],
    "backup_command": "cp -r .wave .wave.backup.$(date +%Y%m%d_%H%M%S)"
  }
}
```

#### 3. Graceful Degradation

When possible, continue operation with reduced functionality:

- **Git integration unavailable**: Use file-based evidence only
- **Template missing**: Use built-in default template
- **Partial data corruption**: Recover what's possible, mark rest as unknown

### Best Practices for Error Handling

1. **Always check tool responses**: Don't assume success
2. **Handle specific error types**: Different errors need different responses
3. **Provide user feedback**: Show clear error messages and suggestions
4. **Implement retry logic**: For transient errors like file locks
5. **Log errors appropriately**: Help with debugging without exposing sensitive info

## 📝 Configuration

### Environment Variables

| Variable             | Description                                               | Default                              |
| -------------------- | --------------------------------------------------------- | ------------------------------------ |
| `WF_LOG_LEVEL`       | Log level (`INFO`, `WARNING`, `ERROR`, `TEACH`, `SILENT`) | `INFO`                               |
| `WF_DOCS_ROOT`       | Documentation root directory                              | `.wave`                              |
| `WF_DEVLOG_TEMPLATE` | Path to the Devlog template                               | `.wave/templates/devlog-template.md` |
| `WF_DEBUG`           | Debug mode (`true` or `false`)                            | `false`                              |

### MCP Client Configuration

#### Basic Configuration

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

#### Security-Enhanced Configuration

For environments requiring higher security:

```json
{
  "mcpServers": {
    "waveforge": {
      "command": "node",
      "args": ["path/to/waveforge/dist/esm/server.js"],
      "env": {
        "WF_LOG_LEVEL": "SILENT",
        "WF_DEBUG": "false",
        "WF_SECURITY_MODE": "strict",
        "WF_ALLOWED_PATHS": "/Users/username/Development,/Users/username/Projects"
      },
      "disabled": false,
      "autoApprove": ["project_info", "current_task_read"],
      "disabledTools": ["health", "ping", "connect_project"]
    }
  }
}
```

#### Development Configuration

For development and debugging:

```json
{
  "mcpServers": {
    "waveforge": {
      "command": "node",
      "args": ["path/to/waveforge/dist/esm/server.js"],
      "env": {
        "WF_LOG_LEVEL": "DEBUG",
        "WF_DEBUG": "true",
        "WF_AUDIT_LOG": "true"
      },
      "disabled": false,
      "autoApprove": [],
      "disabledTools": []
    }
  }
}
```

#### Configuration Options Explained

**Environment Variables:**

| Variable           | Values                                        | Description                   | Security Impact                       |
| ------------------ | --------------------------------------------- | ----------------------------- | ------------------------------------- |
| `WF_LOG_LEVEL`     | `SILENT`, `ERROR`, `WARNING`, `INFO`, `DEBUG` | Controls logging verbosity    | Low - affects debugging only          |
| `WF_DEBUG`         | `true`, `false`                               | Enables debug mode            | Medium - may expose internal state    |
| `WF_SECURITY_MODE` | `normal`, `strict`                            | Security enforcement level    | High - affects path validation        |
| `WF_ALLOWED_PATHS` | Comma-separated paths                         | Restricts project connections | High - limits file system access      |
| `WF_AUDIT_LOG`     | `true`, `false`                               | Enables audit logging         | Low - improves traceability           |
| `WF_MAX_TASK_SIZE` | Number (bytes)                                | Limits task data size         | Medium - prevents resource exhaustion |

**Auto-Approve Settings:**

- **Full Trust**: Auto-approve all core tools for seamless workflow
- **Selective Trust**: Only approve read-only operations
- **No Trust**: Require manual approval for all operations

**Disabled Tools:**

- `health`, `ping`: Disabled by default to reduce attack surface
- `connect_project`: Can be disabled in high-security environments
- Custom tools: Disable any tools not needed for your workflow

#### Security Best Practices

1. **Principle of Least Privilege**:

   ```json
   "autoApprove": ["current_task_read", "project_info"]
   ```

2. **Path Restrictions**:

   ```json
   "env": {
     "WF_ALLOWED_PATHS": "/home/user/projects,/opt/development"
   }
   ```

3. **Audit Logging**:

   ```json
   "env": {
     "WF_AUDIT_LOG": "true",
     "WF_AUDIT_PATH": "/var/log/waveforge"
   }
   ```

4. **Resource Limits**:
   ```json
   "env": {
     "WF_MAX_TASK_SIZE": "10485760",
     "WF_MAX_LOG_ENTRIES": "1000"
   }
   ```

#### Configuration Validation

After updating your configuration, validate it works correctly:

1. **Test Connection**:

   ```json
   {
     "tool": "project_info"
   }
   ```

2. **Verify Security Settings**:

   ```json
   {
     "tool": "connect_project",
     "project_path": "/etc"
   }
   ```

   Should return a security violation error.

3. **Check Tool Availability**:
   Ensure only intended tools are available and auto-approved.

#### Troubleshooting Configuration Issues

**Common Problems:**

- **Tools not responding**: Check `disabledTools` list
- **Security violations**: Verify `WF_ALLOWED_PATHS` settings
- **Performance issues**: Adjust `WF_LOG_LEVEL` to `SILENT`
- **Permission errors**: Check file system permissions

**Important Notes:**

- Set `WF_LOG_LEVEL` to `SILENT` to prevent log output from interfering with MCP communication
- Use `connect_project` instead of `project_bind` (the latter may conflict with some IDE implementations)
- The `health` and `ping` tools are disabled by default to reduce noise
- Always test configuration changes in a safe environment first
- Keep sensitive environment variables in separate config files
