@echo off
setlocal EnableExtensions
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\init-fasteners.ps1" %*
exit /b %ERRORLEVEL%
