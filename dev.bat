@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call "%~dp0scripts\ensure-path.bat"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERR]  Node.js not found. Install from https://nodejs.org/ then restart Cursor.
  exit /b 1
)

call npm run dev %*
