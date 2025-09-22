#!/bin/bash

# WaveForge CI/CD 脚本

set -e

echo "🔄 运行 WaveForge MCP CI/CD 流水线..."

# 解析命令行参数
FULL_CI=false
SKIP_TESTS=false
SKIP_BUILD=false
GENERATE_REPORTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            FULL_CI=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --reports)
            GENERATE_REPORTS=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [--full] [--skip-tests] [--skip-build] [--reports]"
            exit 1
            ;;
    esac
done

# 显示环境信息
echo "🔍 环境信息:"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  pnpm: $(pnpm --version)"
echo "  Platform: $(uname -s)"
echo "  Architecture: $(uname -m)"
echo ""

# 安装依赖
echo "📥 安装依赖..."
pnpm install --frozen-lockfile

# 运行类型检查
echo "🔍 类型检查..."
pnpm run type-check

# 运行代码检查
echo "🧹 代码检查..."
pnpm run lint

# 运行代码格式检查
echo "💅 格式检查..."
pnpm run format:check

# 运行测试
if [ "$SKIP_TESTS" = false ]; then
    if [ "$FULL_CI" = true ] || [ "$GENERATE_REPORTS" = true ]; then
        echo "🧪 运行测试 (包含覆盖率)..."
        pnpm run test:coverage
    else
        echo "🧪 运行测试..."
        pnpm run test
    fi
else
    echo "⚠️  跳过测试"
fi

# 构建项目
if [ "$SKIP_BUILD" = false ]; then
    echo "🏗️  构建项目..."
    if [ "$FULL_CI" = true ]; then
        pnpm run build:clean
    else
        pnpm run build
    fi
    
    # 验证构建结果
    echo "✅ 验证构建结果..."
    REQUIRED_FILES=("dist/server.js" "dist/esm/server.js" "dist/cjs/server.cjs")
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            echo "❌ 构建失败: 缺少文件 $file"
            exit 1
        fi
    done
    
    echo "📊 构建统计:"
    echo "  文件数量: $(find dist -type f | wc -l)"
    echo "  总大小: $(du -sh dist | cut -f1)"
else
    echo "⚠️  跳过构建"
fi

# 生成报告
if [ "$GENERATE_REPORTS" = true ]; then
    echo "📊 生成报告..."
    
    # 创建报告目录
    mkdir -p reports
    
    # 生成依赖报告
    echo "📦 依赖报告..."
    pnpm list --depth=0 --json > reports/dependencies.json
    
    # 生成安全审计报告
    echo "🔒 安全审计..."
    pnpm audit --json > reports/security-audit.json || true
    
    # 生成包大小报告
    if [ -d "dist" ]; then
        echo "📏 包大小报告..."
        find dist -name "*.js" -o -name "*.cjs" -o -name "*.d.ts" | \
        xargs ls -la > reports/bundle-sizes.txt
    fi
    
    echo "📋 报告已生成到 reports/ 目录"
fi

# 运行健康检查
echo "🏥 健康检查..."
pnpm run health

# 显示最终状态
echo ""
echo "✅ CI/CD 流水线完成！"
echo ""
echo "📊 摘要:"
echo "  ✅ 类型检查通过"
echo "  ✅ 代码检查通过"
echo "  ✅ 格式检查通过"
if [ "$SKIP_TESTS" = false ]; then
    echo "  ✅ 测试通过"
fi
if [ "$SKIP_BUILD" = false ]; then
    echo "  ✅ 构建成功"
fi
if [ "$GENERATE_REPORTS" = true ]; then
    echo "  ✅ 报告已生成"
fi

echo ""
echo "🚀 项目已准备就绪！"