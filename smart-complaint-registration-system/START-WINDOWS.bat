@echo off
title Smart Complaint Registration System v3
cd /d "%~dp0"
where node >nul 2>nul || (echo. & echo Node.js is not installed. Download the LTS version from https://nodejs.org , install it, then run this file again. & echo. & pause & exit /b)
if not exist "package.json" (echo package.json not found. Keep this file inside the project folder. & pause & exit /b)
if not exist "node_modules\" goto install
if not exist "backend\node_modules\" goto install
if not exist "frontend\node_modules\" goto install
goto run
:install
echo Installing packages for the first time (needs internet, 2-4 minutes)...
call npm run setup
if errorlevel 1 (echo. & echo Install failed. Check your internet connection and run this file again. & pause & exit /b)
:run
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
echo.
echo Starting... the browser will open at http://localhost:5173 in a few seconds.
echo To stop the project, close this window or press Ctrl+C.
start "" cmd /c "timeout /t 15 >nul & start http://localhost:5173"
call npm run dev
pause
