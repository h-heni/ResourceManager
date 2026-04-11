@echo off
setlocal enabledelayedexpansion

echo ============================================
echo ResourceManager Mobile - Minimal Start
echo ============================================
echo.

REM Clean .expo cache
if exist ".expo" (
    echo [*] Cleaning .expo cache...
    rmdir /s /q .expo 2>nul
    echo     [OK] .expo removed
) else (
    echo [SKIP] .expo folder not found
)

echo.
echo ============================================
echo Cleaning node_modules...
echo ============================================
echo.

REM Clean node_modules and lock files
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
echo ============================================
echo Installing Minimal Dependencies...
echo ============================================
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo ============================================
    echo ERROR: npm install failed
    echo ============================================
    pause
    exit /b 1
)

echo     [OK] Dependencies installed

echo.
echo ============================================
echo Starting Expo (Minimal Mode)...
echo ============================================
echo.
echo   - Open http://localhost:8081 in browser
echo   - Press 'a' for Android
echo   - Press 'i' for iOS
echo   - Press 'w' for Web
echo.

call npm start

pause
