# 提示功能使用示例

WaveForge MCP 提供了强大的三层级提示系统，支持在任务、计划和步骤三个层级添加提示信息，实现多Agent协同工作时的智能指导。

## 🎯 提示系统概述

### 三个层级

1. **任务级提示 (Task-level Hints)**: 适用于整个任务的通用指导
2. **计划级提示 (Plan-level Hints)**: 适用于特定计划的专项指导
3. **步骤级提示 (Step-level Hints)**: 适用于具体步骤的精确指导

### 上下文传递

- 执行Agent在操作时会自动收到相关层级的所有提示
- 计划级操作：返回任务级 + 计划级提示
- 步骤级操作：返回任务级 + 计划级 + 步骤级提示

## 📝 使用示例

### 1. 任务级提示管理

```bash
# 添加任务级提示
{
  "tool": "current_task_modify",
  "params": {
    "field": "hints",
    "content": [
      "注意代码质量和可维护性",
      "遵循项目的编码规范",
      "及时更新相关文档",
      "确保测试覆盖率达到80%以上"
    ],
    "reason": "添加项目开发的通用指导原则",
    "change_type": "user_request"
  }
}
```

### 2. 计划级提示管理

```bash
# 为设计阶段添加专项提示
{
  "tool": "current_task_modify",
  "params": {
    "field": "hints",
    "content": [
      "采用SOLID设计原则",
      "考虑系统的扩展性和可配置性",
      "设计时要考虑性能优化",
      "确保接口设计的向后兼容性"
    ],
    "reason": "为设计阶段添加架构指导",
    "change_type": "user_request",
    "plan_id": "plan-design-phase"
  }
}

# 为开发阶段添加不同的提示
{
  "tool": "current_task_modify",
  "params": {
    "field": "hints",
    "content": [
      "优先实现核心功能",
      "注意错误处理和边界条件",
      "编写单元测试验证功能",
      "及时提交代码并写好commit信息"
    ],
    "reason": "为开发阶段添加实现指导",
    "change_type": "user_request",
    "plan_id": "plan-development-phase"
  }
}
```

### 3. 步骤级提示管理

```bash
# 为需求分析步骤添加具体提示
{
  "tool": "current_task_modify",
  "params": {
    "field": "hints",
    "content": [
      "仔细分析用户需求，确保理解准确",
      "识别功能性和非功能性需求",
      "与产品经理确认需求细节",
      "考虑需求的优先级和依赖关系"
    ],
    "reason": "为需求分析步骤添加详细指导",
    "change_type": "user_request",
    "plan_id": "plan-design-phase",
    "step_id": "step-requirement-analysis"
  }
}

# 为代码实现步骤添加技术提示
{
  "tool": "current_task_modify",
  "params": {
    "field": "hints",
    "content": [
      "使用TypeScript严格模式",
      "实现适当的错误处理机制",
      "添加JSDoc注释说明",
      "考虑代码的可测试性"
    ],
    "reason": "为代码实现步骤添加技术指导",
    "change_type": "user_request",
    "plan_id": "plan-development-phase",
    "step_id": "step-code-implementation"
  }
}
```

## 🤝 多Agent协同场景

### 场景1：项目经理 + 开发Agent

```bash
# 项目经理添加任务级提示
{
  "field": "hints",
  "content": ["项目截止日期是下周五，请合理安排开发进度"],
  "reason": "项目经理添加进度提醒",
  "change_type": "user_request"
}

# 架构师为设计计划添加提示
{
  "field": "hints",
  "content": ["采用微服务架构，注意服务间的解耦"],
  "reason": "架构师添加设计指导",
  "change_type": "user_request",
  "plan_id": "plan-architecture-design"
}

# 开发Agent执行步骤时会收到所有相关提示
# current_task_update 响应示例：
{
  "success": true,
  "hints": {
    "task": ["项目截止日期是下周五，请合理安排开发进度"],
    "plan": ["采用微服务架构，注意服务间的解耦"],
    "step": []
  }
}
```

### 场景2：Code Review + 开发指导

```bash
# Code Reviewer添加步骤级提示
{
  "field": "hints",
  "content": [
    "这个函数的复杂度过高，建议拆分",
    "缺少输入参数的验证逻辑",
    "建议添加更多的单元测试用例"
  ],
  "reason": "Code Review反馈",
  "change_type": "user_request",
  "plan_id": "plan-implementation",
  "step_id": "step-user-service"
}
```

## 🔄 提示的动态更新

### 清空提示

```bash
# 清空任务级提示
{
  "field": "hints",
  "content": [],
  "reason": "清空过期的任务提示",
  "change_type": "user_request"
}
```

### 更新提示

```bash
# 更新计划级提示
{
  "field": "hints",
  "content": [
    "更新后的设计指导1",
    "更新后的设计指导2"
  ],
  "reason": "根据最新需求更新设计指导",
  "change_type": "plan_adjustment",
  "plan_id": "plan-design-phase"
}
```

## 📊 提示的自动传递

### 计划级操作

当Agent执行计划级操作时：

```bash
# 输入
{
  "tool": "current_task_update",
  "params": {
    "update_type": "plan",
    "plan_id": "plan-design-phase",
    "status": "in_progress"
  }
}

# 输出（自动包含相关提示）
{
  "success": true,
  "current_plan_id": "plan-design-phase",
  "hints": {
    "task": ["注意代码质量和可维护性", "遵循项目的编码规范"],
    "plan": ["采用SOLID设计原则", "考虑系统的扩展性"],
    "step": []
  }
}
```

### 步骤级操作

当Agent执行步骤级操作时：

```bash
# 输入
{
  "tool": "current_task_update",
  "params": {
    "update_type": "step",
    "step_id": "step-requirement-analysis",
    "status": "completed",
    "notes": "需求分析完成"
  }
}

# 输出（包含所有层级的相关提示）
{
  "success": true,
  "hints": {
    "task": ["注意代码质量和可维护性", "遵循项目的编码规范"],
    "plan": ["采用SOLID设计原则", "考虑系统的扩展性"],
    "step": ["仔细分析用户需求，确保理解准确", "识别功能性和非功能性需求"]
  }
}
```

## 💡 最佳实践

### 1. 提示内容建议

- **任务级**: 通用的开发原则、项目约束、质量标准
- **计划级**: 特定阶段的方法论、技术选型、注意事项
- **步骤级**: 具体的操作指导、技术细节、检查清单

### 2. 提示管理建议

- 保持提示内容简洁明确
- 及时更新过期的提示信息
- 避免提示内容过多造成信息过载
- 根据项目进展动态调整提示内容

### 3. 多Agent协作建议

- 不同角色的Agent负责不同层级的提示
- 项目经理：任务级提示（进度、质量、资源）
- 架构师：计划级提示（设计、技术选型）
- 开发者：步骤级提示（实现细节、技术要点）

### 4. 提示时机建议

- **项目启动时**: 添加任务级的基础提示
- **阶段切换时**: 更新计划级的专项提示
- **遇到问题时**: 添加步骤级的解决指导
- **Code Review后**: 根据反馈更新相关提示

## 🔍 故障排除

### 常见问题

1. **提示没有显示**
   - 检查提示是否添加到正确的层级
   - 确认当前操作的上下文是否匹配

2. **提示内容过多**
   - 定期清理过期的提示
   - 将通用提示上移到更高层级

3. **多Agent冲突**
   - 建立提示管理的责任分工
   - 使用明确的提示更新原因说明

通过合理使用提示系统，可以大大提升多Agent协同开发的效率和质量！
