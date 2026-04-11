@echo off
setlocal enabledelayedexpansion

REM ============================================
REM ResourceManager Mobile - Clean and Start
REM ============================================

echo.
echo ============================================
echo Cleaning Project Files...
echo ============================================
echo.

REM Clean .expo folder
if exist ".expo" (
    echo [*] Removing .expo cache...
    rmdir /s /q .expo 2>nul
    echo     [OK] .expo removed
) else (
    echo [SKIP] .expo folder not found
)

REM Clean node_modules if --deep flag is provided
if "%1"=="--deep" (
    echo.
    echo [*] Performing deep clean...
    echo.

    if exist "node_modules" (
        echo [*] Removing node_modules...
        rmdir /s /q node_modules 2>nul
        echo     [OK] node_modules removed
    ) else (
        echo [SKIP] node_modules not found
    )

    if exist "package-lock.json" (
        echo [*] Removing package-lock.json...
        del package-lock.json 2>nul
        echo     [OK] package-lock.json removed
    )
)

echo.
echo ============================================
echo Installing Dependencies...
echo ============================================
echo.

REM Clear npm cache
echo [*] Clearing npm cache...
call npm cache clean --force

echo [*] Installing packages...
call npm install --no-audit --no-fund

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
echo Starting Expo Development Server...
echo ============================================
echo.
echo   - Open http://localhost:8081 in your browser
echo   - Press 'a' for Android
echo   - Press 'i' for iOS
echo   - Press 'w' for Web
echo   - Press 'q' to quit
echo.

REM Start expo
call npm start

pause
