@echo off
REM ============================================
REM ResourceManager Mobile - Web Start
REM This bypasses the Node.js SEA bundling issue
REM by using web-only mode
REM ============================================

echo.
echo ============================================
echo ResourceManager Mobile - Web Mode
echo ============================================
echo.
echo [Step 1] Cleaning .expo cache...
if exist ".expo" (
    rmdir /s /q .expo 2>nul
    echo         [OK] Cache cleared
) else (
    echo         [SKIP] No cache found
)

echo.
echo [Step 2] Cleaning node_modules...
if exist "node_modules" (
    echo [*] Removing node_modules...
    rmdir /s /q node_modules 2>nul
    echo     [OK] node_modules removed
)

if exist "package-lock.json" (
    echo [*] Removing package-lock.json...
    del package-lock.json 2>nul
    echo     [OK] package-lock.json removed
)

echo.
echo [Step 3] Installing dependencies...
call npm install --no-audit --no-fund --legacy-peer-deps

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo         [OK] Dependencies installed

echo.
echo ============================================
echo Starting Expo (Web Mode Only)
echo ============================================
echo.
echo   - App will open in your default browser
echo   - URL: http://localhost:19006
echo   - Use Edge or Chrome for best experience
echo.
echo   Close the terminal to stop the app
echo.

REM Start in web mode only - bypasses native bundler
call npx expo start --web --clear

pause
