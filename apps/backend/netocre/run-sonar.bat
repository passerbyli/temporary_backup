@echo off
setlocal enabledelayedexpansion

REM =====================================================================
REM 固定配置（可根据实际修改）
REM =====================================================================
set SONAR_HOST_URL=http://localhost:9000
set SONAR_TOKEN=sqa_a9c955535de5ef6e2a308b04ed849d876a9cc15c

REM =====================================================================
REM 读取 sonar-project.properties
REM =====================================================================
set PROP_FILE=sonar-project.properties
if not exist "%PROP_FILE%" (
  echo [ERROR] 未找到配置文件 %PROP_FILE% ，请确认文件存在于项目根目录
  exit /b 1
)

REM 循环读取配置文件的键值对
for /f "usebackq tokens=1,* delims==" %%A in ("%PROP_FILE%") do (
  set k=%%A
  set v=%%B
  set k=!k: =!
  if /i "!k!"=="sln.path"           set SLN_PATH=!v!
  if /i "!k!"=="sonar.projectKey"   set PROJECT_KEY=!v!
  if /i "!k!"=="sonar.projectName"  set PROJECT_NAME=!v!
  if /i "!k!"=="sonar.sources"      set PROJECT_SOURCES=!v!
  if /i "!k!"=="sonar.exclusions"   set PROJECT_EXCLUSIONS=!v!
)

REM 去掉多余引号和空格
for %%X in (SLN_PATH PROJECT_KEY PROJECT_NAME PROJECT_SOURCES PROJECT_EXCLUSIONS) do (
  set TMP=!%%X!
  set TMP=!TMP:"=!
  set TMP=!TMP: =!
  set %%X=!TMP!
)

REM =====================================================================
REM 检查必填项
REM =====================================================================
if "%SLN_PATH%"=="" (
  echo [ERROR] sln.path 未配置
  exit /b 1
)

REM 如果未指定 projectKey/projectName，默认使用 sln 文件名
if "%PROJECT_KEY%"=="" (
  for %%F in ("%SLN_PATH%") do set PROJECT_KEY=%%~nF
)
if "%PROJECT_NAME%"=="" (
  set PROJECT_NAME=%PROJECT_KEY%
)

REM =====================================================================
REM 输出最终配置（方便调试）
REM =====================================================================
echo ==============================================================
echo [INFO] SonarQube 服务器 : %SONAR_HOST_URL%
echo [INFO] Sonar Token     : 已隐藏
echo [INFO] 解决方案路径    : %SLN_PATH%
echo [INFO] 项目 Key        : %PROJECT_KEY%
echo [INFO] 项目名称        : %PROJECT_NAME%
echo [INFO] 源码路径        : %PROJECT_SOURCES%
echo [INFO] 忽略路径        : %PROJECT_EXCLUSIONS%
echo ==============================================================

REM =====================================================================
REM 确保 dotnet-sonarscanner 已安装
REM =====================================================================
where dotnet-sonarscanner >nul 2>&1
if errorlevel 1 (
  echo [INFO] 未检测到 dotnet-sonarscanner，正在安装...
  dotnet tool install --global dotnet-sonarscanner
  if errorlevel 1 (
    echo [ERROR] 安装 dotnet-sonarscanner 失败
    exit /b 1
  )
)
set PATH=%USERPROFILE%\.dotnet\tools;%PATH%

REM =====================================================================
REM 检查 Sonar 项目是否存在，不存在则自动创建
REM =====================================================================
echo [INFO] 检查 Sonar 项目是否已存在...
for /f "usebackq delims=" %%R in (`curl -s -u %SONAR_TOKEN%: "%SONAR_HOST_URL%/api/projects/search?projects=%PROJECT_KEY%"`) do set SEARCH_JSON=%%R
echo %SEARCH_JSON% | find "\"key\":\"%PROJECT_KEY%\"" >nul
if errorlevel 1 (
  echo [INFO] 项目不存在，正在创建...
  curl -s -u %SONAR_TOKEN%: -X POST "%SONAR_HOST_URL%/api/projects/create" ^
    -d "name=%PROJECT_NAME%" -d "project=%PROJECT_KEY%" >nul
  if errorlevel 1 (
    echo [ERROR] 创建 Sonar 项目失败
    exit /b 1
  )
) else (
  echo [INFO] 项目已存在
)

REM =====================================================================
REM 执行 Sonar 分析流程
REM =====================================================================
echo [INFO] 开始 Sonar 分析...
dotnet sonarscanner begin ^
  /k:"%PROJECT_KEY%" ^
  /d:sonar.host.url="%SONAR_HOST_URL%" ^
  /d:sonar.token="%SONAR_TOKEN%" ^
  /d:sonar.sources="%PROJECT_SOURCES%" ^
  /d:sonar.exclusions="%PROJECT_EXCLUSIONS%"

REM =====================================================================
REM 编译解决方案
REM =====================================================================
dotnet build "%SLN_PATH%" --no-incremental
if errorlevel 1 (
  echo [ERROR] 构建失败，Sonar 分析终止
  exit /b 1
)

REM =====================================================================
REM 结束 Sonar 分析
REM =====================================================================
dotnet sonarscanner end /d:sonar.token="%SONAR_TOKEN%"
if errorlevel 1 (
  echo [ERROR] Sonar 分析结束失败
  exit /b 1
)

echo [SUCCESS] Sonar 分析完成
endlocal