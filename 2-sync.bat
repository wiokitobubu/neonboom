@echo off
setlocal
cd /d "%~dp0"
title NEON BOOM - sync
rem Run this after changing the game (www folder) or your AdMob IDs (www\js\ads-config.js).
call node tools\android.mjs sync
if errorlevel 1 goto :fail
echo.
echo  [OK] The Android project now has your latest changes. In Android Studio press the green Run button.
pause
exit /b 0

:fail
echo.
echo  [X] Something went wrong. Read the red lines above.
pause
exit /b 1
