# Flaky Tests 处理指南

## 问题描述

### 当前 Flaky Tests

**文件**: `src/core/concurrency-manager.test.ts`  
**失败率**: 约 10-30% (随机)  
**失败测试**: 7/51 个测试  
**失败类型**: Timing assertions, 超时

### 根本原因

1. **Timing 敏感**: 测试依赖精确的重试间隔和超时时间
2. **资源竞争**: 并行运行时文件锁竞争
3. **系统负载**: 在高负载或慢系统上更容易失败
4. **全局状态**: 测试间共享 `~/.wave/projects.json` 文件

## 解决方案

### 1. 测试策略分层

```bash
# 稳定测试 (用于 CI/CD)
pnpm run test:stable

# 完整测试 (串行运行)
pnpm run test

# Flaky tests (单独运行)
pnpm run test:flaky
```

### 2. CI/CD 配置

**package.json**:

```json
{
  "scripts": {
    "test:stable": "vitest --run --no-file-parallelism --exclude=src/core/concurrency-manager.test.ts",
    "test:flaky": "vitest --run src/core/concurrency-manager.test.ts",
    "ci": "pnpm run type-check && pnpm run lint && pnpm run test:stable && pnpm run validate:schemas"
  }
}
```

**pre-commit**:

```bash
# 运行稳定测试（排除 flaky tests）
pnpm run test:stable
```

### 3. 开发工作流

#### 日常开发

```bash
# 快速验证
pnpm run test:stable

# 完整测试 (需要时间)
pnpm run test
```

#### 修复 Flaky Tests

```bash
# 单独运行 flaky tests
pnpm run test:flaky

# 如果失败，分析具体原因
pnpm run test:flaky --reporter=verbose
```

## 修复建议

### 短期方案 (当前实施)

1. **排除策略**: CI/CD 使用 `test:stable`
2. **串行运行**: 避免并行竞争
3. **分离测试**: flaky tests 单独运行

### 长期方案 (未来修复)

1. **增加容差**: 放宽 timing assertions
2. **Mock 时间**: 使用 fake timer
3. **隔离测试**: 避免全局状态污染
4. **重试机制**: 自动重试失败的测试

## 验证方法

### 检查修复效果

```bash
# 1. 运行稳定测试
pnpm run test:stable
# 应该: 29/29 test files passed

# 2. 运行 flaky tests
pnpm run test:flaky
# 可能: 7/51 失败 (这是预期的)

# 3. 运行完整测试
pnpm run test
# 应该: 30/30 test files passed (串行运行)
```

### CI/CD 验证

```bash
# 运行 CI
pnpm run ci
# 应该: 使用 test:stable，不会因为 flaky tests 失败

# 运行完整 CI
pnpm run ci:full
# 应该: 包含所有测试，但使用串行模式
```

## 监控和维护

### 定期检查

1. **每周运行**: `pnpm run test:flaky`
2. **记录失败率**: 跟踪改善趋势
3. **性能监控**: 关注测试执行时间

### 修复优先级

1. **高优先级**: 影响 CI/CD 的 flaky tests
2. **中优先级**: 影响开发体验的 flaky tests
3. **低优先级**: 不影响核心功能的 flaky tests

## 相关文件

- `package.json`: 测试脚本配置
- `.husky/pre-commit`: Git hooks 配置
- `scripts/ci.sh`: CI/CD 脚本
- `scripts/fix-flaky-tests.sh`: 修复脚本
- `src/core/concurrency-manager.test.ts`: Flaky tests 文件

## 最佳实践

1. **开发时**: 使用 `test:stable` 快速验证
2. **提交前**: pre-commit 自动运行 `test:stable`
3. **CI/CD**: 使用 `test:stable` 避免失败
4. **发布前**: 运行完整测试 `test` 确保质量
5. **定期**: 运行 `test:flaky` 监控问题
