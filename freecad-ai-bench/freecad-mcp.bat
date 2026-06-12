@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Unified freecad-ai-bench entry (FreeCAD + Fasteners + MCP)
REM   freecad-mcp.bat              full setup (default)
REM   freecad-mcp.bat help           list commands
REM   freecad-mcp.bat mcp            MCP only
REM   freecad-mcp.bat screw -Size M5 -Length 60

set "ACTION=setup"
if /I "%~1"=="help" set "ACTION=help" & goto :run
if /I "%~1"=="/?" set "ACTION=help" & goto :run
if /I "%~1"=="-h" set "ACTION=help" & goto :run
if not "%~1"=="" set "ACTION=%~1"

:run
if /I not "%ACTION%"=="help" shift
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\freecad-mcp.ps1" -Action %ACTION% -CursorScope both %1 %2 %3 %4 %5 %6 %7 %8 %9
set "EC=%ERRORLEVEL%"
if %EC%==0 (
  if /I not "%ACTION%"=="help" (
    echo.
    echo [OK] freecad-ai-bench [%ACTION%] done.
  )
)
endlocal & exit /b %EC%
