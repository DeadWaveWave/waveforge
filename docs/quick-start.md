# WaveForge MCP 快速开始指南

本指南将带你快速体验 WaveForge MCP 任务管理系统的完整工作流程。

## 🚀 前置条件

1. 已安装并构建 WaveForge MCP 服务器
2. 已配置 MCP 客户端（如 Kiro IDE）
3. 服务器正常运行

## 📋 完整工作流程示例

### 1. 连接项目

首先连接你的项目到 MCP 会话：

```json
// 调用 connect_project
{
  "project_path": "/path/to/your/project"
}
```

### 2. 初始化任务

创建一个新的开发任务：

```json
// 调用 current_task_init
{
  "title": "实现用户认证功能",
  "goal": "完成用户登录、注册和密码重置功能，包括前端界面和后端API，确保安全性和用户体验",
  "description": "为应用添加完整的用户认证系统，支持邮箱验证和密码强度检查",
  "overall_plan": [
    "分析需求和设计认证流程",
    "实现后端认证API",
    "开发前端登录界面",
    "添加密码重置功能",
    "编写测试用例",
    "部署和安全验证"
  ]
}
```

**响应示例：**

```json
{
  "success": true,
  "task_id": "01K5S2QMV4YH1B6MY5JR7V589X",
  "slug": "实现-用户认证功能",
  "current_plan_id": "plan-01K5S2QMV54EMR6RYFHTK8VK77",
  "plan_ids": ["plan-01K5S2QMV54EMR6RYFHTK8VK77", "..."]
}
```

### 3. 读取任务状态

随时查看当前任务的完整状态：

```json
// 调用 current_task_read
{}
```

这将返回包含任务详情、计划列表、执行日志和健康检查的完整信息。

### 4. 生成执行步骤

为当前计划生成具体的执行步骤：

```json
// 调用 current_task_modify
{
  "field": "steps",
  "content": [
    "研究现有认证方案和最佳实践",
    "设计用户数据模型和数据库结构",
    "绘制认证流程图和用户界面原型",
    "确定安全策略和加密方案"
  ],
  "reason": "为第一个计划生成具体的执行步骤",
  "change_type": "generate_steps",
  "plan_id": "plan-01K5S2QMV54EMR6RYFHTK8VK77"
}
```

### 5. 更新执行进度

完成步骤时更新状态：

```json
// 调用 current_task_update
{
  "update_type": "step",
  "step_id": "step-01K5S2R3K21WWZXE9RTSE33J08",
  "status": "completed",
  "notes": "已完成认证方案研究，选择JWT + bcrypt方案，支持邮箱验证",
  "evidence": "docs/auth-design.md, 技术选型文档已更新"
}
```

系统会自动推进到下一个步骤。

### 6. 记录重要事件

记录开发过程中的重要讨论或决策：

```json
// 调用 current_task_log
{
  "category": "discussion",
  "action": "create",
  "message": "团队讨论认证安全策略",
  "notes": "决定使用JWT token，有效期24小时，支持refresh token机制。密码使用bcrypt加密，最小长度8位，必须包含数字和字母。"
}
```

### 7. 修改任务结构

如果需要调整计划或目标：

```json
// 调用 current_task_modify
{
  "field": "plan",
  "content": [
    "分析需求和设计认证流程",
    "实现后端认证API",
    "开发前端登录界面",
    "添加密码重置功能",
    "实现邮箱验证功能", // 新增
    "编写测试用例",
    "部署和安全验证"
  ],
  "reason": "根据安全要求，新增邮箱验证功能",
  "change_type": "plan_adjustment"
}
```

### 8. 完成任务

当所有工作完成时：

```json
// 调用 current_task_complete
{
  "summary": "用户认证功能开发完成。实现了完整的登录、注册、密码重置和邮箱验证功能。后端API使用JWT认证，前端提供友好的用户界面。所有功能都通过了单元测试和集成测试，安全性验证通过。",
  "generate_docs": true
}
```

## 🔄 自动化特性

WaveForge MCP 提供了多种自动化特性来提升开发效率：

### 自动推进

- 完成步骤时自动推进到下一步
- 完成计划时自动推进到下一个计划
- 提示生成步骤当计划没有具体步骤时

### 健康检查

- 自动检查任务数据完整性
- 验证文件系统状态
- 提供修复建议

### 智能提示

- 根据任务状态提供下一步行动建议
- 检测潜在问题并给出解决方案
- 自动生成开发日志建议

## 📊 任务状态管理

### 状态类型

- `to_do`: 待开始
- `in_progress`: 进行中
- `completed`: 已完成
- `blocked`: 被阻塞

### 状态转换

```
to_do → in_progress → completed
       ↓
    blocked (临时状态)
```

## 💡 最佳实践

### 1. 任务规划

- 使用清晰、可测量的验收标准
- 将复杂任务分解为6-8个主要计划
- 每个计划包含3-5个具体步骤

### 2. 进度跟踪

- 及时更新步骤状态
- 提供具体的完成证据
- 记录重要的技术决策

### 3. 协作沟通

- 使用 `current_task_log` 记录团队讨论
- 在任务修改时说明原因
- 保持任务状态的实时同步

### 4. 文档管理

- 完成任务时生成开发日志
- 链接相关的代码提交和文档
- 为后续任务提供参考

## 🛠️ 故障排除

如果遇到问题，请参考：

- [故障排除指南](./troubleshooting.md)
- [完整使用文档](../USAGE.md)

## 📞 获取帮助

- 检查工具是否在 MCP 配置中正确启用
- 确认项目已正确连接
- 查看任务健康检查信息
- 参考完整的 API 文档
