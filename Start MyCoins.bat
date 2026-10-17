@echo off
rem Double-click this file to start MyCoins. Keep the window open while you use the app.
title MyCoins
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then try again.
  pause
  exit /b 1
)

echo Getting MyCoins ready...
call npm.cmd install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  echo Installing failed. See the messages above.
  pause
  exit /b 1
)

echo Updating the price history...
call npm.cmd run history --silent

echo Starting MyCoins. Your browser will open in a moment.
echo Close this window to stop the app.
call npm.cmd run dev -- --open
pause
