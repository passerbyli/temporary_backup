@echo off
setlocal enabledelayedexpansion

REM ================================================================
REM 固定 SonarQube 配置（按需修改）
REM ================================================================
set "SONAR_HOST_URL=http://localhost:9000"
set "SONAR_TOKEN=sqa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

REM 固定扫描范围（可按项目统一规范调整）
set "SONAR_SOURCES=src"
set "SONAR_EXCLUSIONS=**/bin/**,**/obj/**,**/Migrations/**"

REM 可选项：有值才会附加到 begin 参数中
set "SONAR_TESTS="  REM 例：tests
set "SONAR_PROJECT_BASE_DIR="  REM 例：.
set "SONAR_SCM_EXCLUSIONS_DISABLED="  REM 例：true 或 false

REM ================================================================
REM 用法：
REM  base-sonar.bat "<sln路径>" "<项目名称>"
REM 规则：
REM  - 项目KEY = 项目名称
REM  - sonar.sources / sonar.exclusions 固定
REM  - SONAR_TESTS / SONAR_PROJECT_BASE_DIR / SONAR_SCM_EXCLUSIONS_DISABLED
REM  为空时不传参
REM 示例：
REM  base-sonar.bat ".\code\blog.sln" "Blog"
REM ================================================================

REM ---------------- 参数校验 ----------------
if "%~1"=="" (
  echo [ERROR] 缺少第1个参数：解决方案 .sln 路径
  exit /b 1
)
if "%~2"=="" (
  echo [ERROR] 缺少第2个参数：项目名称（同时作为项目KEY）
  exit /b 1
)

set "SLN_PATH=%~1"
set "PROJECT_NAME=%~2"
set "PROJECT_KEY=%PROJECT_NAME%"

REM 绝对路径化，避免相对路径导致的构建问题
for %%I in ("%SLN_PATH%") do set "SLN_PATH=%%~fI"

if not exist "%SLN_PATH%" (
  echo [ERROR] 未找到解决方案文件：%SLN_PATH%
  exit /b 1
)

if "%SONAR_HOST_URL%"=="" (
  echo [ERROR] SONAR_HOST_URL 未设置
  exit /b 1
)
if "%SONAR_TOKEN%"=="" (
  echo [ERROR] SONAR_TOKEN 未设置
  exit /b 1
)

REM ---------------- 环境检查 ----------------
where dotnet >nul 2>&1
if errorlevel 1 (
  echo [ERROR] 未找到 dotnet CLI，请先安装 .NET SDK
  exit /b 1
)

where curl >nul 2>&1
if errorlevel 1 (
  echo [ERROR] 未找到 curl，请安装或加入 PATH 后再试
  exit /b 1
)

where dotnet-sonarscanner >nul 2>&1
if errorlevel 1 (
  echo [INFO] 未检测到 dotnet-sonarscanner，正在安装...
  dotnet tool install --global dotnet-sonarscanner
  if errorlevel 1 (
    echo [ERROR] 安装 dotnet-sonarscanner 失败
    exit /b 1
  )
)
set "PATH=%USERPROFILE%\.dotnet\tools;%PATH%"

REM ---------------- 输出最终配置 ----------------
echo ==============================================================
echo [INFO] SonarQube 服务器 : %SONAR_HOST_URL%
echo [INFO] Sonar Token  : 已隐藏
echo [INFO] 解决方案路径  : %SLN_PATH%
echo [INFO] 项目 Key/Name  : %PROJECT_KEY%
echo [INFO] 扫描源码目录  : %SONAR_SOURCES%
echo [INFO] 忽略规则  : %SONAR_EXCLUSIONS%
if not "%SONAR_TESTS%"=="" (
  echo [INFO] 测试目录  : %SONAR_TESTS%
)
if not "%SONAR_PROJECT_BASE_DIR%"=="" (
  echo [INFO] 项目基目录  : %SONAR_PROJECT_BASE_DIR%
)
if not "%SONAR_SCM_EXCLUSIONS_DISABLED%"=="" (
  echo [INFO] 禁用SCM排除  : %SONAR_SCM_EXCLUSIONS_DISABLED%
)
echo ==============================================================

REM ---------------- 如无则创建项目 ----------------
echo [INFO] 检查 Sonar 项目是否已存在...
for /f "usebackq delims=" %%R in (`curl -s -u %SONAR_TOKEN%: "%SONAR_HOST_URL%/api/projects/search?projects=%PROJECT_KEY%"`) do set "SEARCH_JSON=%%R"

REM 使用延迟展开避免 JSON 中的 & | 等字符干扰管道
echo(!SEARCH_JSON! | find "\"key\":\"%PROJECT_KEY%\"" >nul
if errorlevel 1 (
  echo [INFO] 项目不存在，正在创建 "%PROJECT_NAME%" (key=%PROJECT_KEY%) ...
  curl -s -u %SONAR_TOKEN%: -X POST "%SONAR_HOST_URL%/api/projects/create" ^
  -d "name=%PROJECT_NAME%" -d "project=%PROJECT_KEY%" >nul
  if errorlevel 1 (
    echo [ERROR] 创建 Sonar 项目失败
    exit /b 1
  )
  ) else (
  echo [INFO] 项目已存在
)

REM ---------------- 拼接 begin 命令（有值才附加） ----------------
set "BEGIN_CMD=dotnet sonarscanner begin ^
/k:\"%PROJECT_KEY%\" ^
/n:\"%PROJECT_NAME%\" ^
/d:sonar.host.url=\"%SONAR_HOST_URL%\" ^
/d:sonar.token=\"%SONAR_TOKEN%\" ^
/d:sonar.sources=\"%SONAR_SOURCES%\" ^
/d:sonar.exclusions=\"%SONAR_EXCLUSIONS%\""

if not "%SONAR_TESTS%"=="" (
  set "BEGIN_CMD=!BEGIN_CMD! /d:sonar.tests=\"%SONAR_TESTS%\""
)
if not "%SONAR_PROJECT_BASE_DIR%"=="" (
  set "BEGIN_CMD=!BEGIN_CMD! /d:sonar.projectBaseDir=\"%SONAR_PROJECT_BASE_DIR%\""
)
if not "%SONAR_SCM_EXCLUSIONS_DISABLED%"=="" (
  set "BEGIN_CMD=!BEGIN_CMD! /d:sonar.scm.exclusions.disabled=\"%SONAR_SCM_EXCLUSIONS_DISABLED%\""
)

REM ---------------- Sonar 分析：BEGIN ----------------
echo [INFO] SonarScanner BEGIN
REM 展开并执行组合命令
cmd /c "!BEGIN_CMD!"
if errorlevel 1 (
  echo [ERROR] sonarscanner begin 失败
  exit /b 1
)

REM ---------------- 构建解决方案 ----------------
echo [INFO] dotnet build "%SLN_PATH%"
dotnet build "%SLN_PATH%" --no-incremental
if errorlevel 1 (
  echo [ERROR] 构建失败，终止分析
  REM 如需强制 end 以便清理，可在此处按需调用；一般无需
  exit /b 1
)

REM ---------------- Sonar 分析：END ----------------
echo [INFO] SonarScanner END
dotnet sonarscanner end /d:sonar.token="%SONAR_TOKEN%"
if errorlevel 1 (
  echo [ERROR] sonarscanner end 失败
  exit /b 1
)

echo [SUCCESS] Sonar 分析完成：%PROJECT_KEY%
endlocal
