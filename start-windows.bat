@echo off
rem Double-click to start Esquisso on Windows. Keep this window open while you use the app.
rem Runs in cmd.exe and calls npm.cmd directly, so PowerShell's script policy doesn't apply.
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and try again.
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo Installing for the first time, this takes a minute...
  call npm.cmd install
  if errorlevel 1 (
    echo Install failed. See the messages above.
    pause
    exit /b 1
  )
)
echo Starting Esquisso at http://127.0.0.1:5173 - keep this window open.
call npm.cmd start
pause
