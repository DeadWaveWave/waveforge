# WaveForge MCP 快速开始指南（中文版）

本指南将带你快速体验 WaveForge MCP 任务管理系统的完整工作流程。

> **注意**：详细的英文版快速开始指南请参考 [quick-start.md](./quick-start.md)

## 🚀 前置条件

1. 已安装并构建 WaveForge MCP 服务器
2. 已配置 MCP 客户端（如 Kiro IDE）
3. 服务器正常运行

## 📋 核心工具概览

### 项目管理工具

- `connect_project`: 连接项目到 MCP 会话
- `project_info`: 获取当前项目信息

### 任务管理工具

- `current_task_init`: 初始化新任务
- `current_task_read`: 读取任务状态
- `current_task_modify`: 修改任务结构
- `current_task_update`: 更新执行进度
- `current_task_log`: 记录重要事件
- `current_task_complete`: 完成任务

## 🔄 基本工作流程

### 1. 连接项目

```json
// 调用 connect_project
{
  "project_path": "/path/to/your/project"
}
```

### 2. 初始化任务

```json
// 调用 current_task_init
{
  "title": "实现用户认证功能",
  "goal": "完成用户登录、注册和密码重置功能",
  "overall_plan": [
    "分析需求和设计认证流程",
    "实现后端认证API",
    "开发前端登录界面",
    "编写测试用例"
  ]
}
```

### 3. 生成执行步骤

```json
// 调用 current_task_modify
{
  "field": "steps",
  "content": ["研究现有认证方案", "设计用户数据模型", "绘制认证流程图"],
  "reason": "为当前计划生成具体步骤",
  "change_type": "generate_steps",
  "plan_id": "plan-xxx"
}
```

### 4. 更新进度

```json
// 调用 current_task_update
{
  "update_type": "step",
  "step_id": "step-xxx",
  "status": "completed",
  "notes": "已完成认证方案研究",
  "evidence": "docs/auth-design.md"
}
```

### 5. 记录重要事件

```json
// 调用 current_task_log
{
  "category": "discussion",
  "action": "create",
  "message": "团队讨论认证安全策略",
  "notes": "决定使用JWT token，有效期24小时"
}
```

### 6. 完成任务

```json
// 调用 current_task_complete
{
  "summary": "用户认证功能开发完成，实现了完整的登录、注册、密码重置功能",
  "generate_docs": true
}
```

## 🎯 核心特性

### 自动化推进

- 完成步骤时自动推进到下一步
- 完成计划时自动推进到下一个计划
- 智能提示生成步骤

### 健康检查

- 自动检查任务数据完整性
- 验证文件系统状态
- 提供修复建议

### 多 Agent 协作

- 通过 `current_task_read` 同步任务状态
- 支持多个 AI Agent 并行工作
- 确保数据一致性

## 💡 最佳实践

1. **清晰的任务规划**：使用可测量的验收标准
2. **及时更新状态**：完成步骤时立即更新
3. **记录重要决策**：使用 `current_task_log` 记录关键讨论
4. **提供具体证据**：在更新状态时附上完成证据

## 🛠️ 故障排除

如果遇到问题：

1. 检查工具名称是否正确（使用 `connect_project` 而不是 `project_bind`）
2. 确认 MCP 配置中的日志级别设置为 `SILENT`
3. 验证项目是否已正确连接
4. 查看任务健康检查信息

## 📚 更多资源

- [完整使用指南](../USAGE.md)
- [故障排除指南](./troubleshooting.md)
- [英文版快速开始](./quick-start.md)

---

**开始你的 WaveForge 之旅吧！** 🚀
