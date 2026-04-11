@echo off
REM ============================================
REM ResourceManager Mobile - Run Now
REM ============================================
REM This script will clean cache and start the app
REM with minimal dependencies to bypass Node.js SEA issues
REM ============================================
echo.

echo.
echo [Step 1] Cleaning .expo cache...
if exist ".expo" (
    rmdir /s /q .expo 2>nul
    echo         [OK] Cache cleared
) else (
    echo         [SKIP] No cache found
)

echo.
echo [Step 2] Installing dependencies...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo         [OK] Dependencies installed

echo.
echo [Step 3] Starting Expo Development Server...
echo.
echo ============================================
echo   Open this URL in your browser:
echo   http://localhost:8081
echo.
echo   Press 'a' for Android
echo   Press 'i' for iOS (requires macOS)
echo   Press 'w' for Web
echo ============================================
echo.

REM Start with npx to bypass potential node module issues
npx expo start --clear

pause
