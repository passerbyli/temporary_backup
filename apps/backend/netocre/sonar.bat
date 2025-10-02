@echo off
setlocal

REM ==============================
REM 输入参数
REM ==============================
set PROJECT_PATH=%1
if "%PROJECT_PATH%"=="" (
  echo ❌ 错误：未传入项目路径（包含 .sln 文件的目录）
  echo 用法示例：run-sonar.bat D:\projects\ProjectA
  exit /b 1
)

REM ==============================
REM 全局配置（可统一设置）
REM ==============================
set SONAR_HOST_URL=http://localhost:9000
set SONAR_TOKEN=your-sonar-token
set SONAR_PROJECT_KEY=%~nx1       REM 使用文件夹名作为 ProjectKey（可自定义）
set SONAR_PROJECT_NAME=%~nx1      REM 同上
set SONAR_SOLUTION=               REM 自动查找 *.sln

REM ==============================
REM 进入项目路径
REM ==============================
cd /d %PROJECT_PATH%

REM 查找 sln 文件
for %%f in (*.sln) do (
    set SONAR_SOLUTION=%%f
    goto :found
)

:found
if "%SONAR_SOLUTION%"=="" (
  echo ❌ 未找到 .sln 文件，请确认路径正确：%PROJECT_PATH%
  exit /b 1
)

echo ✅ 项目路径：%PROJECT_PATH%
echo ✅ 使用解决方案文件：%SONAR_SOLUTION%
echo ✅ 项目Key：%SONAR_PROJECT_KEY%
echo ✅ SonarQube 地址：%SONAR_HOST_URL%

REM ==============================
REM 执行扫描流程
REM ==============================
dotnet tool install --global dotnet-sonarscanner >nul 2>&1
set PATH=%PATH%;%USERPROFILE%\.dotnet\tools

echo 🟡 [1/4] dotnet restore
dotnet restore %SONAR_SOLUTION%
if errorlevel 1 exit /b 1

echo 🟡 [2/4] SonarScanner Begin
dotnet sonarscanner begin ^
  /k:"%SONAR_PROJECT_KEY%" ^
  /n:"%SONAR_PROJECT_NAME%" ^
  /d:sonar.host.url="%SONAR_HOST_URL%" ^
  /d:sonar.login="%SONAR_TOKEN%"

if errorlevel 1 exit /b 1

echo 🟡 [3/4] dotnet build
dotnet build %SONAR_SOLUTION% --no-incremental
if errorlevel 1 exit /b 1

echo 🟡 [4/4] SonarScanner End
dotnet sonarscanner end /d:sonar.login="%SONAR_TOKEN%"
if errorlevel 1 exit /b 1

echo ✅ SonarQube 分析完成
endlocal