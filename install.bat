@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM SolidWorks MCP Server - Installation Script (Windows)
REM Auto-detects: Node 20-22, Python, SolidWorks version/path, winax 3.4.2

cd /d "%~dp0"
set "PROJECT_DIR=%CD%"
set "REPO_URL=https://github.com/vespo92/SolidworksMCP-TS.git"
set "MIN_NODE_MAJOR=20"
set "MAX_NODE_WINAX_MAJOR=22"
set "WINAX_PIN_VERSION=3.4.2"

set "MOCK_ONLY=0"
set "SKIP_MCP_CONFIG=0"
set "MCP_CLIENT=both"
set "RUN_TESTS=0"
set "AUTO_INSTALL=0"
set "SKIP_PREREQS=0"
set "WINAX_OK=1"

:parse_args
if "%~1"=="" goto end_parse
if /i "%~1"=="--mock-only" (set "MOCK_ONLY=1" & shift & goto parse_args)
if /i "%~1"=="--skip-mcp-config" (set "SKIP_MCP_CONFIG=1" & shift & goto parse_args)
if /i "%~1"=="--run-tests" (set "RUN_TESTS=1" & shift & goto parse_args)
if /i "%~1"=="--install-deps" (set "AUTO_INSTALL=1" & shift & goto parse_args)
if /i "%~1"=="--skip-prereqs" (set "SKIP_PREREQS=1" & shift & goto parse_args)
if /i "%~1"=="--help" goto show_help
if /i "%~1"=="-h" goto show_help
if /i "%~1"=="--client" (
  set "MCP_CLIENT=%~2"
  if not "!MCP_CLIENT!"=="claude" if not "!MCP_CLIENT!"=="cursor" if not "!MCP_CLIENT!"=="both" (
    call :error "Invalid --client: !MCP_CLIENT!"
    exit /b 1
  )
  shift & shift & goto parse_args
)
call :error "Unknown option: %~1"
goto show_help

:show_help
echo.
echo Usage: install.bat [OPTIONS]
echo   --install-deps   Install Node 20, Python 3.12, VS Build Tools via winget
echo   --mock-only      Skip winax (development only)
echo   --client cursor  Configure Cursor MCP only
echo   --skip-mcp-config
echo   --run-tests
echo.
echo Auto-initialized: Node 20-22, Python, SolidWorks year/path, winax %WINAX_PIN_VERSION%
echo.
exit /b 0

:end_parse
echo.
echo ============================================================
echo        SolidWorks MCP Server - Installer
echo ============================================================
echo.

call :info "Refreshing PATH..."
call :refresh_path

if "%MOCK_ONLY%"=="0" (
  call :info "Detecting runtime versions..."
  call :init_versions
  if errorlevel 1 if "%AUTO_INSTALL%"=="0" (
    call :warn "Retrying with automatic dependency install..."
    set "AUTO_INSTALL=1"
  )
)

if "%SKIP_PREREQS%"=="0" if "%MOCK_ONLY%"=="0" (
  call :setup_prerequisites || exit /b 1
  call :init_versions || (
    call :error "Version init failed. Install Node 20: winget install OpenJS.NodeJS.20"
    exit /b 1
  )
)

call :apply_runtime_env
call :check_node || exit /b 1
call :check_npm || exit /b 1
call :check_project_root || exit /b 1

if "%MOCK_ONLY%"=="1" (
  call :info "Mock-only mode"
) else (
  call :info "Production: Node !NODE_WINAX_VERSION!, SW !SW_VERSION!, winax %WINAX_PIN_VERSION%"
)

echo.
call :sync_env_file
call :install_dependencies || exit /b 1
if "%MOCK_ONLY%"=="0" if "%SKIP_PREREQS%"=="0" call :build_winax
call :build_project || exit /b 1
call :verify_winax
if "%RUN_TESTS%"=="1" call :run_tests || exit /b 1
if "%SKIP_MCP_CONFIG%"=="0" (call :configure_mcp_clients) else (call :info "Skipping MCP config")
call :print_summary
if "%WINAX_OK%"=="0" if "%MOCK_ONLY%"=="0" exit /b 1
exit /b 0

:refresh_path
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$m=[Environment]::GetEnvironmentVariable('Path','Machine');$u=[Environment]::GetEnvironmentVariable('Path','User');if($m-and$u){$m+';'+$u}elseif($m){$m}else{$u}"`) do set "PATH=%%P"
exit /b 0

:init_versions
set "DETECT_FLAGS="
if "%MOCK_ONLY%"=="0" set "DETECT_FLAGS=-UpdateDotEnv -Production"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\scripts\detect-versions.ps1" -ProjectDir "%PROJECT_DIR%" %DETECT_FLAGS%
if errorlevel 1 exit /b 1
if not exist "%PROJECT_DIR%\scripts\.install-versions.bat" (
  call :error "scripts\.install-versions.bat not created"
  exit /b 1
)
call "%PROJECT_DIR%\scripts\.install-versions.bat"
exit /b 0

:apply_runtime_env
if exist "%PROJECT_DIR%\scripts\.install-versions.bat" call "%PROJECT_DIR%\scripts\.install-versions.bat"
if defined NODE_WINAX_EXE for %%D in ("!NODE_WINAX_EXE!") do set "PATH=%%~dpD;!PATH!"
if defined PYTHON_EXE (
  set "PYTHON=!PYTHON_EXE!"
  set "npm_config_python=!PYTHON_EXE!"
)
set "GYP_MSVS_VERSION=2022"
exit /b 0

:check_node
where node >nul 2>&1 || (call :error "Node.js not found" & exit /b 1)
for /f "delims=" %%V in ('node --version 2^>nul') do set "ACTIVE_NODE_VERSION=%%V"
set "ACTIVE_NODE_VER=!ACTIVE_NODE_VERSION:v=!"
for /f "tokens=1 delims=." %%M in ("!ACTIVE_NODE_VER!") do set "ACTIVE_NODE_MAJOR=%%M"
if !ACTIVE_NODE_MAJOR! LSS %MIN_NODE_MAJOR% (
  call :error "Node.js %MIN_NODE_MAJOR%+ required (found !ACTIVE_NODE_VERSION!)"
  exit /b 1
)
if "%MOCK_ONLY%"=="0" if !ACTIVE_NODE_MAJOR! GTR %MAX_NODE_WINAX_MAJOR% (
  if not defined NODE_WINAX_EXE (
    call :error "Node !ACTIVE_NODE_VERSION! too new for winax - need v20-v%MAX_NODE_WINAX_MAJOR%"
    echo   Run: winget install OpenJS.NodeJS.20
    echo   Then: install.bat --install-deps
    exit /b 1
  )
  call :warn "Using Node !NODE_WINAX_VERSION! for winax (default is !ACTIVE_NODE_VERSION!)"
)
call :success "Node.js !ACTIVE_NODE_VERSION!"
exit /b 0

:check_npm
where npm >nul 2>&1 || (call :error "npm not found" & exit /b 1)
for /f "delims=" %%V in ('npm --version 2^>nul') do call :success "npm %%V"
exit /b 0

:setup_prerequisites
set "PS_FLAG="
if "%AUTO_INSTALL%"=="1" set "PS_FLAG=-InstallMissing"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\scripts\setup-prerequisites.ps1" -CheckOnly %PS_FLAG% -ProjectDir "%PROJECT_DIR%" || exit /b 1
call :success "Prerequisites OK"
exit /b 0

:build_winax
call :info "Building winax %WINAX_PIN_VERSION%..."
call :apply_runtime_env
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\scripts\setup-prerequisites.ps1" -BuildWinax -ProjectDir "%PROJECT_DIR%" || (
  set "WINAX_OK=0" & call :warn "winax build failed"
)
exit /b 0

:check_project_root
if not exist "%PROJECT_DIR%\package.json" (call :error "Not in project root" & exit /b 1)
exit /b 0

:sync_env_file
if "%MOCK_ONLY%"=="1" (
  if not exist "%PROJECT_DIR%\.env" (
    copy /y "%PROJECT_DIR%\.env.example" "%PROJECT_DIR%\.env" >nul 2>&1
    echo USE_MOCK_SOLIDWORKS=true>> "%PROJECT_DIR%\.env"
  )
  call :success ".env ready (mock)"
  exit /b 0
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\scripts\detect-versions.ps1" -ProjectDir "%PROJECT_DIR%" -UpdateDotEnv -Production
call "%PROJECT_DIR%\scripts\.install-versions.bat"
call :success ".env synced: SW!SW_VERSION!, Python, paths"
exit /b 0

:install_dependencies
call :info "npm install..."
call :apply_runtime_env
if "%MOCK_ONLY%"=="1" (call npm install --ignore-scripts) else (call npm install --foreground-scripts)
if errorlevel 1 (call :error "npm install failed" & exit /b 1)
call :success "Dependencies installed"
exit /b 0

:build_project
call :info "Building TypeScript..."
call :apply_runtime_env
call npm run build || (call :error "Build failed" & exit /b 1)
call :success "Build complete"
exit /b 0

:verify_winax
if "%MOCK_ONLY%"=="1" exit /b 0
call :apply_runtime_env
node scripts\check-winax.mjs >nul 2>&1 || (
  set "WINAX_OK=0"
  call :warn "winax not loaded - install Node 20 and re-run install.bat --install-deps"
)
if "%WINAX_OK%"=="1" call :success "winax loaded"
exit /b 0

:run_tests
set "USE_MOCK_SOLIDWORKS=true"
call npm test || exit /b 1
call :success "Tests passed"
exit /b 0

:configure_mcp_clients
set "PROJECT_DIR_FWD=!PROJECT_DIR:\=/!"
for /f "delims=" %%P in ('node -e "console.log(require('path').resolve('!PROJECT_DIR_FWD!/dist/index.js'))"') do set "ENTRYPOINT=%%P"
call :info "MCP config: SW !SW_VERSION!, entry !ENTRYPOINT!"
node "%PROJECT_DIR%\scripts\configure-mcp.mjs" --client "%MCP_CLIENT%" --project-dir "%PROJECT_DIR%"
call :success "MCP configured - restart Cursor"
exit /b 0

:print_summary
echo.
echo ============================================================
echo   Installation Complete
echo ============================================================
echo   SolidWorks:  !SW_VERSION! ^(!SW_PROG_ID!^)
echo   Node winax:  !NODE_WINAX_VERSION!
echo   Python:      !PYTHON_VERSION!
echo   winax:       %WINAX_PIN_VERSION%
if "%WINAX_OK%"=="0" if "%MOCK_ONLY%"=="0" (
  echo   Status:      winax NOT ready - install Node 20
) else if "%MOCK_ONLY%"=="0" (
  echo   Status:      Ready for COM automation
)
echo   Dev server:  dev.bat
echo ============================================================
echo.
exit /b 0

:info
echo [INFO] %~1
exit /b 0
:success
echo [OK]   %~1
exit /b 0
:warn
echo [WARN] %~1
exit /b 0
:error
echo [ERR]  %~1
exit /b 0
