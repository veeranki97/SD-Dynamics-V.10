@echo off
title SD Dynamics - Fix SQLite
cd /d "%~dp0"
if exist "_system" cd _system
echo.
echo === Rebuild better-sqlite3 for this Node version ===
node -v
echo.
call npm rebuild better-sqlite3
if errorlevel 1 (
  echo Rebuild failed. Trying full reinstall...
  call npm uninstall better-sqlite3
  call npm install better-sqlite3 --save
)
echo.
echo === Quick load test ===
node -e "try{require('better-sqlite3');console.log('OK better-sqlite3 loads')}catch(e){console.error('FAIL',e.message);process.exit(1)}"
if errorlevel 1 (
  echo Still failing. Use the same Node you run the app with.
  pause
  exit /b 1
)
echo.
echo === Start server — watch for [sqlite] Primary store ready ===
node server.js
pause
