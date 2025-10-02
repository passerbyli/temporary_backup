@echo off
setlocal

echo [🔧] 修复 Electron 安装失败问题...

:: 项目根目录（假设当前脚本在 scripts 目录下）
cd /d %~dp0..
set ROOT_DIR=%cd%

:: 删除 node_modules 和 lock 文件
echo [🧹] 删除 node_modules 和 pnpm-lock.yaml...
rmdir /s /q node_modules
del /f /q pnpm-lock.yaml

:: 删除 Electron 缓存目录
echo [🧹] 删除 Electron 缓存...
rmdir /s /q %USERPROFILE%\AppData\Local\electron
rmdir /s /q %USERPROFILE%\AppData\Local\electron-builder

:: 清理 pnpm 缓存（忽略错误）
echo [🧹] 清理 pnpm 本地缓存...
pnpm store prune || echo [!] 跳过 pnpm store prune

:: 重新安装依赖，使用淘宝镜像
echo [🌐] 使用淘宝镜像重新安装 Electron...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
pnpm install

echo [✅] Electron 安装修复完成！
pnpm exec electron -v || echo [⚠️] 请检查 Electron 是否成功安装

endlocal
pause