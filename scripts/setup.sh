#!/bin/bash

# WaveForge 项目设置脚本

set -e

echo "⚙️  设置 WaveForge MCP 开发环境..."

# 检查系统要求
echo "🔍 检查系统要求..."

# 检查 Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
    
    # 检查 Node.js 版本是否满足要求
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "❌ Node.js 版本过低，需要 >= 18.0.0"
        exit 1
    fi
else
    echo "❌ Node.js 未安装，请先安装 Node.js >= 18.0.0"
    exit 1
fi

# 检查 pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo "✅ pnpm: $PNPM_VERSION"
else
    echo "📦 安装 pnpm..."
    npm install -g pnpm
fi

# 安装依赖
echo "📥 安装项目依赖..."
pnpm install

# 设置 Git hooks
echo "🪝 设置 Git hooks..."
pnpm run prepare

# 运行初始检查
echo "🔍 运行初始检查..."
pnpm run type-check
pnpm run lint
pnpm run test

# 创建开发配置文件
echo "📝 创建开发配置文件..."

# 创建 .env.example 文件
cat > .env.example << EOF
# WaveForge MCP 环境变量配置示例

# 日志级别 (INFO, WARNING, ERROR, TEACH)
WF_LOG_LEVEL=INFO

# 调试模式
WF_DEBUG=false

# 文档根目录
WF_DOCS_ROOT=.wave

# 开发日志模板路径
WF_DEVLOG_TEMPLATE=.wave/templates/devlog-template.md

# 开发日志模式 (timeline, narrative, both)
WF_DEVLOG_MODE=both

# 开发日志作者
WF_DEVLOG_AUTHOR="AI: WaveForge"

# Git 集成配置
WF_DEVLOG_GIT_RANGE=auto
WF_DEVLOG_LOGS_LIMIT=200
EOF

# 创建 VS Code 配置
mkdir -p .vscode
cat > .vscode/settings.json << EOF
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.md": "markdown"
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  }
}
EOF

cat > .vscode/launch.json << EOF
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug WaveForge Server",
      "type": "node",
      "request": "launch",
      "program": "\${workspaceFolder}/src/server.ts",
      "runtimeArgs": ["-r", "tsx/cjs"],
      "env": {
        "WF_LOG_LEVEL": "INFO",
        "WF_DEBUG": "true"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
EOF

# 使脚本可执行
chmod +x scripts/*.sh

echo ""
echo "🎉 WaveForge MCP 开发环境设置完成！"
echo ""
echo "📚 可用命令:"
echo "  pnpm run dev          - 启动开发服务器"
echo "  pnpm run test         - 运行测试"
echo "  pnpm run build        - 构建项目"
echo "  ./scripts/dev.sh      - 完整开发环境启动"
echo "  ./scripts/test.sh     - 运行测试套件"
echo "  ./scripts/build.sh    - 构建项目"
echo ""
echo "🔧 开发提示:"
echo "  - 复制 .env.example 到 .env 并根据需要修改配置"
echo "  - 使用 VS Code 获得最佳开发体验"
echo "  - Git hooks 已自动设置，提交时会运行检查"
echo ""
echo "🚀 开始开发: pnpm run dev"