#!/bin/bash

set -e

echo "🔧 修复 Electron 安装失败问题..."

# 项目根路径
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

# 1. 删除 node_modules 和 lock 文件
echo "🧹 清理 node_modules 和 pnpm-lock.yaml..."
rm -rf "$ROOT_DIR/node_modules"
rm -f "$ROOT_DIR/pnpm-lock.yaml"

# 2. 清理 Electron 缓存（macOS 下的默认路径）
echo "🧹 清理 Electron 缓存目录..."
rm -rf ~/Library/Caches/electron
rm -rf ~/Library/Caches/electron-builder

# 3. 清理 pnpm 缓存
echo "🧹 清理 pnpm 本地缓存..."
pnpm store prune || true

# 4. 使用国内镜像重新安装
echo "🌐 使用淘宝镜像重新安装 Electron..."
cd "$ROOT_DIR"
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm install

echo "✅ Electron 安装修复完成！"
npx electron -v || echo "⚠️ 请手动检查 Electron 是否安装成功"