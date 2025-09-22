#!/bin/bash

# WaveForge 测试脚本

set -e

echo "🧪 运行 WaveForge MCP 测试套件..."

# 解析命令行参数
COVERAGE=false
WATCH=false
UI=false
UNIT_ONLY=false
INTEGRATION_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --ui)
            UI=true
            shift
            ;;
        --unit)
            UNIT_ONLY=true
            shift
            ;;
        --integration)
            INTEGRATION_ONLY=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [--coverage] [--watch] [--ui] [--unit] [--integration]"
            exit 1
            ;;
    esac
done

# 运行类型检查
echo "🔍 运行类型检查..."
pnpm run type-check

# 运行 linting
echo "🧹 运行代码检查..."
pnpm run lint

# 选择测试命令
if [ "$UI" = true ]; then
    echo "🎨 启动测试 UI..."
    pnpm run test:ui
elif [ "$WATCH" = true ]; then
    echo "👀 启动监听模式测试..."
    pnpm run test:watch
elif [ "$COVERAGE" = true ]; then
    echo "📊 运行覆盖率测试..."
    pnpm run test:coverage
elif [ "$UNIT_ONLY" = true ]; then
    echo "🔬 运行单元测试..."
    pnpm run test:unit
elif [ "$INTEGRATION_ONLY" = true ]; then
    echo "🔗 运行集成测试..."
    pnpm run test:integration
else
    echo "🚀 运行所有测试..."
    pnpm run test
fi

echo "✅ 测试完成！"