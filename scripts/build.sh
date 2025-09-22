#!/bin/bash

# WaveForge 构建脚本

set -e

echo "🏗️  构建 WaveForge MCP..."

# 解析命令行参数
CLEAN=false
ESM_ONLY=false
CJS_ONLY=false
WATCH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        --esm)
            ESM_ONLY=true
            shift
            ;;
        --cjs)
            CJS_ONLY=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [--clean] [--esm] [--cjs] [--watch]"
            exit 1
            ;;
    esac
done

# 清理构建目录
if [ "$CLEAN" = true ]; then
    echo "🧹 清理构建目录..."
    pnpm run clean
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

# 选择构建命令
if [ "$WATCH" = true ]; then
    echo "👀 启动监听模式构建..."
    pnpm run build:watch
elif [ "$ESM_ONLY" = true ]; then
    echo "📦 构建 ESM 格式..."
    pnpm run build:esm
elif [ "$CJS_ONLY" = true ]; then
    echo "📦 构建 CJS 格式..."
    pnpm run build:cjs
else
    echo "📦 构建所有格式..."
    pnpm run build
fi

# 显示构建结果
echo ""
echo "📊 构建结果:"
if [ -d "dist" ]; then
    echo "📁 dist/"
    find dist -type f -name "*.js" -o -name "*.cjs" -o -name "*.d.ts" | head -10 | sed 's/^/  /'
    
    TOTAL_FILES=$(find dist -type f | wc -l)
    echo "  ... 总共 $TOTAL_FILES 个文件"
    
    DIST_SIZE=$(du -sh dist | cut -f1)
    echo "  📏 总大小: $DIST_SIZE"
fi

echo "✅ 构建完成！"