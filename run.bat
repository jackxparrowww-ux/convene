@echo off
setlocal
title Convene - Browser Video Meetings

echo ===================================================
echo             Starting Convene Video Meetings
echo ===================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js (v18+) from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if node_modules exists, install if needed
if not exist "node_modules\" (
    echo [INFO] Dependencies not found. Running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Please check the logs.
        pause
        exit /b 1
    )
)

:: Auto-open browser after server boots
echo [INFO] Starting Convene server at http://localhost:3000 ...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: Start the Next.js + Socket.io server
npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Convene exited with an error.
    pause
)
