@echo off
setlocal enabledelayedexpansion

:: 设置 cards 目录路径（相对路径）
set cards_dir=src\cards

:: 判断目录是否存在
if not exist %cards_dir% (
    echo Error: %cards_dir% directory not found!
    pause
    exit /b
)

:: 获取 cards 目录下的所有子文件夹
for /d %%i in (%cards_dir%\*) do (
    set "card=%%~nxi"
    echo ================================
    echo Building for card: !card!
    npm run build:beta -- -- !card!
    echo ================================
)

echo All builds finished.
pause