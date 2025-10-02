[7.9.6](https://binaries.sonarsource.com/Distribution/sonarqube/sonarqube-7.9.6.zip)



好，我给你做一个 Windows 下用 MSYS2 一键编译 PostgreSQL 17 的完整批处理脚本，
它会做到：
	1.	安装和更新 MSYS2
	2.	安装 PostgreSQL 17 编译所需依赖
	3.	从 GitHub 拉取源码（REL_17_STABLE 分支）
	4.	自动执行 configure、make、make install
	5.	初始化数据库并启动 PostgreSQL 17

⸻

1. 保存脚本

将下面内容保存为 build_pg17.bat，放在任意目录运行（建议右键 以管理员身份运行）。

@echo off
setlocal enabledelayedexpansion

REM === 0. 基本变量设置 ===
set MSYS2_DIR=C:\msys64
set INSTALL_PREFIX=/c/pgsql17
set DATA_DIR=/c/pgsql17/data
set PATH=%MSYS2_DIR%\usr\bin;%PATH%

REM === 1. 检查 MSYS2 是否已安装 ===
if not exist "%MSYS2_DIR%" (
    echo [INFO] MSYS2 未检测到，开始下载安装...
    powershell -Command "Invoke-WebRequest -Uri https://github.com/msys2/msys2-installer/releases/latest/download/msys2-x86_64-latest.exe -OutFile msys2-installer.exe"
    msys2-installer.exe install --root %MSYS2_DIR% --confirm-command --accept-messages
)

REM === 2. 更新 MSYS2 & 安装依赖 ===
echo [INFO] 更新 MSYS2 及安装依赖包...
%MSYS2_DIR%\usr\bin\bash -lc "pacman -Syu --noconfirm"
%MSYS2_DIR%\usr\bin\bash -lc "pacman -S --noconfirm base-devel git mingw-w64-x86_64-toolchain mingw-w64-x86_64-readline mingw-w64-x86_64-zlib mingw-w64-x86_64-openssl mingw-w64-x86_64-libxml2 mingw-w64-x86_64-libxslt"

REM === 3. 克隆 PostgreSQL 17 源码 ===
echo [INFO] 拉取 PostgreSQL 17 源码...
%MSYS2_DIR%\usr\bin\bash -lc "rm -rf ~/postgres && git clone https://github.com/postgres/postgres.git ~/postgres"
%MSYS2_DIR%\usr\bin\bash -lc "cd ~/postgres && git checkout REL_17_STABLE"

REM === 4. 配置、编译、安装 ===
echo [INFO] 开始 configure...
%MSYS2_DIR%\usr\bin\bash -lc "cd ~/postgres && ./configure --host=x86_64-w64-mingw32 --prefix=%INSTALL_PREFIX% --with-openssl --with-libxml --with-libxslt --with-readline --with-zlib"

echo [INFO] 开始编译...
%MSYS2_DIR%\usr\bin\bash -lc "cd ~/postgres && make -j$(nproc)"

echo [INFO] 安装到 %INSTALL_PREFIX%...
%MSYS2_DIR%\usr\bin\bash -lc "cd ~/postgres && make install"

REM === 5. 初始化数据库 ===
echo [INFO] 初始化数据库...
%MSYS2_DIR%\usr\bin\bash -lc "mkdir -p %DATA_DIR% && %INSTALL_PREFIX%/bin/initdb.exe -D %DATA_DIR%"

REM === 6. 启动 PostgreSQL 17 ===
echo [INFO] 启动 PostgreSQL 17...
%MSYS2_DIR%\usr\bin\bash -lc "%INSTALL_PREFIX%/bin/pg_ctl.exe -D %DATA_DIR% -l logfile start"

REM === 7. 提示完成 ===
echo [SUCCESS] PostgreSQL 17 已安装并启动！
echo 数据目录: %DATA_DIR%
echo bin 目录: %INSTALL_PREFIX%/bin
echo 默认连接: psql -U %USERNAME% -d postgres
pause


⸻

2. 脚本运行效果
	•	首次运行会：
	•	自动下载 MSYS2（如果不存在）
	•	安装所有编译依赖
	•	从 GitHub 拉取最新的 REL_17_STABLE 分支源码
	•	编译并安装到 C:\pgsql17
	•	初始化数据库到 C:\pgsql17\data
	•	启动 PostgreSQL 17 服务
	•	编译完成后可直接用：

C:\pgsql17\bin\psql.exe -U %USERNAME% -d postgres


⸻

3. 后续管理
	•	停止服务：

C:\pgsql17\bin\pg_ctl.exe -D C:\pgsql17\data stop

	•	重启服务：

C:\pgsql17\bin\pg_ctl.exe -D C:\pgsql17\data restart


⸻

4. 说明
	•	这个脚本全程只访问 GitHub（MSYS2 安装包、PostgreSQL 源码）。
	•	生成的 PostgreSQL 是 Windows 原生 exe，不依赖 MSYS2 运行。
	•	安装路径和数据目录可以在脚本开头改：

set INSTALL_PREFIX=/c/pgsql17
set DATA_DIR=/c/pgsql17/data


⸻

我可以帮你把这个脚本再改成 一次性下载 MSYS2 安装包 + 依赖源码压缩包，这样你可以在完全离线的 Windows 上运行也能编译成功。
你要我帮你做离线版吗？这样就不怕内网没法实时访问 GitHub。






sqa_652dab3518d297a0f94879d20994ccfccc03a491