#!/bin/bash

# WaveForge 发布脚本

set -e

echo "🚀 准备发布 WaveForge MCP..."

# 解析命令行参数
DRY_RUN=false
SKIP_TESTS=false
SKIP_BUILD=false
VERSION_TYPE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
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
        --patch|--minor|--major)
            VERSION_TYPE=$1
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [--dry-run] [--skip-tests] [--skip-build] [--patch|--minor|--major]"
            exit 1
            ;;
    esac
done

# 检查工作目录是否干净
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 工作目录不干净，请先提交或暂存更改"
    git status --short
    exit 1
fi

# 检查是否在主分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo "⚠️  当前不在主分支 ($CURRENT_BRANCH)，确定要继续吗？ (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ 发布已取消"
        exit 1
    fi
fi

# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 当前版本: $CURRENT_VERSION"

# 确定新版本
if [ -n "$VERSION_TYPE" ]; then
    NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version --dry-run | sed 's/v//')
    echo "📈 新版本: $NEW_VERSION ($VERSION_TYPE)"
else
    echo "📝 请输入新版本号 (当前: $CURRENT_VERSION):"
    read -r NEW_VERSION
    if [ -z "$NEW_VERSION" ]; then
        echo "❌ 版本号不能为空"
        exit 1
    fi
fi

# 确认发布
if [ "$DRY_RUN" = false ]; then
    echo "🤔 确定要发布版本 $NEW_VERSION 吗？ (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ 发布已取消"
        exit 1
    fi
fi

# 运行测试
if [ "$SKIP_TESTS" = false ]; then
    echo "🧪 运行完整测试套件..."
    pnpm run ci:full
else
    echo "⚠️  跳过测试"
fi

# 构建项目
if [ "$SKIP_BUILD" = false ]; then
    echo "🏗️  构建项目..."
    pnpm run build:clean
else
    echo "⚠️  跳过构建"
fi

# 更新版本号
if [ "$DRY_RUN" = false ]; then
    echo "📝 更新版本号到 $NEW_VERSION..."
    if [ -n "$VERSION_TYPE" ]; then
        npm version $VERSION_TYPE --no-git-tag-version
    else
        npm version $NEW_VERSION --no-git-tag-version
    fi
fi

# 生成变更日志
echo "📋 生成变更日志..."
if [ -f "CHANGELOG.md" ]; then
    # 这里可以集成自动变更日志生成工具
    echo "  变更日志已存在，请手动更新"
else
    echo "  创建初始变更日志"
    cat > CHANGELOG.md << EOF
# 变更日志

## [$NEW_VERSION] - $(date +%Y-%m-%d)

### 新增
- 初始版本发布

### 变更
- 无

### 修复
- 无

### 移除
- 无
EOF
fi

# 提交更改
if [ "$DRY_RUN" = false ]; then
    echo "📝 提交发布更改..."
    git add package.json CHANGELOG.md
    git commit -m "chore: release v$NEW_VERSION"
    
    # 创建标签
    echo "🏷️  创建发布标签..."
    git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
    
    # 推送到远程
    echo "📤 推送到远程仓库..."
    git push origin $CURRENT_BRANCH
    git push origin "v$NEW_VERSION"
    
    # 发布到 npm (如果需要)
    echo "🤔 是否发布到 npm？ (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "📦 发布到 npm..."
        npm publish --access public
        echo "✅ 已发布到 npm"
    fi
else
    echo "🔍 DRY RUN - 以下操作将被执行:"
    echo "  - 更新版本号到 $NEW_VERSION"
    echo "  - 提交更改"
    echo "  - 创建标签 v$NEW_VERSION"
    echo "  - 推送到远程仓库"
fi

echo ""
echo "🎉 发布完成！"
echo "📦 版本: $NEW_VERSION"
echo "🏷️  标签: v$NEW_VERSION"
echo ""
echo "📚 后续步骤:"
echo "  - 检查 GitHub Releases 页面"
echo "  - 更新文档"
echo "  - 通知用户"