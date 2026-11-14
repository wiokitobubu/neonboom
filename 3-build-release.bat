@echo off
setlocal
cd /d "%~dp0"
title NEON BOOM - release build
echo.
echo  ==================================================
echo    NEON BOOM  -  build the files for Google Play
echo  ==================================================
echo.
call node tools\android.mjs release
if errorlevel 1 goto :fail
echo.
echo  [OK] Your files are in the "release" folder. It opens now.
start "" "%~dp0release"
pause
exit /b 0

:fail
echo.
echo  [X] The build stopped. Read the red lines above.
echo      Take a photo of this window if you need help.
pause
exit /b 1
