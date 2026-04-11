@echo off
setlocal enabledelayedexpansion

echo ============================================
echo Custom Metro Bundler Start
echo This bypasses the Node.js SEA bundling issue
echo ============================================
echo.

REM Clean cache
if exist ".expo" (
    echo [Step 1] Cleaning .expo cache...
    rmdir /s /q .expo 2>nul
    echo         [OK] Cache cleared
) else (
    echo [Step 1] No cache to clean
)

echo.
echo [Step 2] Starting custom Metro bundler...
echo.

REM Start custom Metro bundler (bypasses Expo CLI issue)
node metro-bundler.js

pause
