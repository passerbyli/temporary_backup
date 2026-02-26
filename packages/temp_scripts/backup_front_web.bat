@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ===== 配置区 =====
set SOURCE=D:\work\front_web
set DEST_ROOT=D:\backup

REM ===== 生成时间戳 YYYYMMDDHHmm =====
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMddHHmm"') do set TS=%%i

set DEST=%DEST_ROOT%\front_web_%TS%
set LOG=%DEST_ROOT%\backup_log_%TS%.txt

echo.
echo ===== 开始备份 =====
echo 源: %SOURCE%
echo 目标: %DEST%
echo 日志: %LOG%
echo.

REM ===== 执行复制 =====
robocopy "%SOURCE%" "%DEST%" ^
/E ^
/R:2 ^
/W:2 ^
/MT:16 ^
/XD node_modules .git dist build coverage .next .nuxt ^
/XF npm-debug.log yarn-error.log pnpm-lock.yaml ^
/COPY:DAT ^
/DCOPY:DAT ^
/NP ^
/NFL ^
/NDL ^
/LOG:%LOG%

REM ===== 结果判断 =====
set RC=%ERRORLEVEL%

echo.
if %RC% LEQ 3 (
    echo 备份完成 (robocopy code=%RC%)
) else (
    echo 备份可能失败 (robocopy code=%RC%)
)

pause