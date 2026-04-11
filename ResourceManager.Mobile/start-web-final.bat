@echo off
setlocal enabledelayedexpansion

echo ============================================
echo ResourceManager Mobile - Web Mode
echo This starts the web version directly
echo No Metro bundler, no port conflicts
echo ============================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [Step 1] Installing dependencies...
    call npm install --no-audit --no-fund --legacy-peer-deps

    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Installation failed
        pause
        exit /b 1
    )

    echo         [OK] Dependencies installed
) else (
    echo [Step 1] Dependencies already installed
)

echo.
echo [Step 2] Starting Expo Web Server...
echo.

REM Use web subcommand which doesn't trigger Metro bundler
call npx expo start web

pause
