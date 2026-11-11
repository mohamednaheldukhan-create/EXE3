@echo off
chcp 65001 >nul
echo === Installing dependencies ===
call npm install
if errorlevel 1 goto err
echo === Building EXE installer ===
call npm run dist
if errorlevel 1 goto err
echo.
echo Done. Installer is in the "dist" folder.
pause
exit /b 0
:err
echo Build failed.
pause
exit /b 1
