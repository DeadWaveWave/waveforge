#!/bin/bash

# WaveForge 开发环境启动脚本

set -e

echo "🚀 启动 WaveForge MCP 开发环境..."

# 检查 Node.js 版本
NODE_VERSION=$(node --version)
echo "📦 Node.js 版本: $NODE_VERSION"

# 检查 pnpm 版本
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo "📦 pnpm 版本: $PNPM_VERSION"
else
    echo "❌ pnpm 未安装，请先安装 pnpm"
    exit 1
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📥 安装依赖..."
    pnpm install
fi

# 运行类型检查
echo "🔍 运行类型检查..."
pnpm run type-check

# 运行 linting
echo "🧹 运行代码检查..."
pnpm run lint

# 运行测试
echo "🧪 运行测试..."
pnpm run test

# 启动开发服务器
echo "🔥 启动开发服务器..."
echo "💡 提示: 使用 Ctrl+C 停止服务器"
echo "📝 日志级别可通过 WF_LOG_LEVEL 环境变量设置 (INFO, WARNING, ERROR, TEACH)"
echo ""

# 设置开发环境变量
export WF_LOG_LEVEL=${WF_LOG_LEVEL:-INFO}
export WF_DEBUG=${WF_DEBUG:-true}

pnpm run dev