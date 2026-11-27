@echo off
rem Double-click to start Flowboard on Windows. Keep this window open while you use the app.
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org and try again. & pause & exit /b 1)
if not exist node_modules (
  echo Installing for the first time, this takes a minute...
  call npm install || (pause & exit /b 1)
)
echo Starting Flowboard at http://127.0.0.1:5173 ... keep this window open.
call npm start
pause
