@echo off
setlocal
cd /d "%~dp0"
title NEON BOOM - setup
echo.
echo  ==================================================
echo    NEON BOOM  -  Android project setup (one time)
echo  ==================================================
echo.
where node >nul 2>nul
if errorlevel 1 goto :nonode
call node tools\android.mjs setup
if errorlevel 1 goto :fail
echo.
echo  Opening Android Studio...
call npx cap open android
echo.
echo  [OK] All done. You can close this window.
pause
exit /b 0

:nonode
echo  [X] Node.js is not installed yet.
echo      1. Your browser opens the Node.js website now.
echo      2. Download the "LTS" version, install it with all the default choices.
echo      3. Restart the computer, then double-click 1-setup.bat again.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:fail
echo.
echo  [X] Something went wrong. Read the red lines above.
echo      Take a photo of this window if you need help.
pause
exit /b 1
