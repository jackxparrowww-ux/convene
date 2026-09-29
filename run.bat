@echo off
setlocal enabledelayedexpansion
title Convene - High Performance Video Meetings

echo ===================================================
echo     Convene Video Meetings - Fast Production Mode
echo ===================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js (v18+) from https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Check dependencies
if not exist "node_modules\" (
    echo [INFO] Dependencies not found. Installing packages...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: 3. Check production build
if not exist ".next\" (
    echo [INFO] Optimized production build not found. Building now...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Production build failed.
        pause
        exit /b 1
    )
)

:: 4. Auto-open browser
echo.
echo [INFO] Starting Convene high-speed production server...
echo [INFO] Opening http://localhost:3000 in your browser...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: 5. Run the high-performance server
node server.js --production

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Convene exited with an error code %errorlevel%.
    pause
)
