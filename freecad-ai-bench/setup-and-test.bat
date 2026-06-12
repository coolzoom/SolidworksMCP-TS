@echo off
setlocal EnableExtensions
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-all.ps1" %*
set "EC=%ERRORLEVEL%"
endlocal & exit /b %EC%
