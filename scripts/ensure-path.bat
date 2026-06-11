@echo off
REM Refresh PATH from registry and ensure Node.js directory is included.
REM Cursor/IDE terminals often keep a stale PATH after Node.js is installed.

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$m=[Environment]::GetEnvironmentVariable('Path','Machine');$u=[Environment]::GetEnvironmentVariable('Path','User');if($m-and$u){$m+';'+$u}elseif($m){$m}else{$u}"`) do set "PATH=%%P"

if exist "%ProgramFiles%\nodejs\node.exe" (
  echo "%PATH%" | findstr /i /c:"%ProgramFiles%\nodejs" >nul 2>&1
  if errorlevel 1 set "PATH=%ProgramFiles%\nodejs%;%PATH%"
)

if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
  echo "%PATH%" | findstr /i /c:"%LOCALAPPDATA%\Programs\nodejs" >nul 2>&1
  if errorlevel 1 set "PATH=%LOCALAPPDATA%\Programs\nodejs%;%PATH%"
)

exit /b 0
