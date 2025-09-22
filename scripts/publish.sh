#!/bin/bash

# WaveForge 发布到 npm 脚本

set -e

echo "📦 发布 WaveForge MCP 到 npm..."

# 解析命令行参数
DRY_RUN=false
TAG="latest"
ACCESS="public"

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --access)
            ACCESS="$2"
            shift 2
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [--dry-run] [--tag <tag>] [--access <public|restricted>]"
            exit 1
            ;;
    esac
done

# 检查是否已登录 npm
if ! npm whoami &> /dev/null; then
    echo "❌ 未登录 npm，请先运行 'npm login'"
    exit 1
fi

NPM_USER=$(npm whoami)
echo "👤 npm 用户: $NPM_USER"

# 获取包信息
PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

echo "📦 包名: $PACKAGE_NAME"
echo "📈 版本: $PACKAGE_VERSION"
echo "🏷️  标签: $TAG"
echo "🔒 访问权限: $ACCESS"

# 检查版本是否已存在
if npm view "$PACKAGE_NAME@$PACKAGE_VERSION" version &> /dev/null; then
    echo "❌ 版本 $PACKAGE_VERSION 已存在于 npm"
    exit 1
fi

# 检查构建文件是否存在
if [ ! -d "dist" ]; then
    echo "❌ 构建目录不存在，请先运行构建"
    exit 1
fi

# 检查必要文件
REQUIRED_FILES=("dist/esm/server.js" "dist/cjs/server.cjs" "dist/esm/server.d.ts")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ 缺少必要文件: $file"
        exit 1
    fi
done

# 运行发布前检查
echo "🔍 运行发布前检查..."
pnpm run prepublishOnly

# 显示将要发布的文件
echo "📋 将要发布的文件:"
npm pack --dry-run | grep -E "^\s*[0-9]" | head -20

# 确认发布
if [ "$DRY_RUN" = false ]; then
    echo ""
    echo "🤔 确定要发布到 npm 吗？ (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ 发布已取消"
        exit 1
    fi
    
    # 执行发布
    echo "🚀 发布中..."
    npm publish --access "$ACCESS" --tag "$TAG"
    
    echo "✅ 发布成功！"
    echo ""
    echo "📦 包地址: https://www.npmjs.com/package/$PACKAGE_NAME"
    echo "📥 安装命令: npm install $PACKAGE_NAME"
    echo "📥 pnpm 安装: pnpm add $PACKAGE_NAME"
    
else
    echo "🔍 DRY RUN - 将执行以下发布命令:"
    echo "  npm publish --access $ACCESS --tag $TAG"
fi