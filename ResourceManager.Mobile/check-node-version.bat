@echo off
setlocal enabledelayedexpansion

echo ============================================
echo Checking Node.js Version
echo ============================================
echo.

REM Get current Node.js version
for /f "delims=" %%i in ('node --version') do set NODE_VERSION=%%i

echo Current Node.js version: %NODE_VERSION%

echo.
echo ============================================
echo Checking compatibility with Expo
echo ============================================
echo.

REM Extract major version
for /f "tokens=1,2 delims=v." %%a in ("%NODE_VERSION%") do (
    set NODE_MAJOR=%%a
)

echo Major version: v%NODE_MAJOR%

if "%NODE_MAJOR%"=="20" (
    echo [!] You are using Node.js v20
    echo.
    echo This version has known issues with Expo on Windows:
    echo - Node:sea bundling error
    echo - Cannot create external directories
    echo.
    echo [RECOMMENDED] Use Node.js v18.x instead
    echo.
    echo To install Node.js v18:
    echo   1. Download from: https://nodejs.org/en/download
    echo   2. Select version 18.x LTS
    echo   3. Run installer with PATH enabled
    echo   4. Restart terminal
    echo   5. Verify with: node --version
    echo.
    echo For detailed instructions, see: DOWNLOAD_NODE_V18.md
) else if "%NODE_MAJOR%"=="18" (
    echo [OK] You are using Node.js v18
    echo.
    echo This version is compatible with Expo
    echo.
    echo You can run: npm start
) else if "%NODE_MAJOR%"=="19" (
    echo [OK] You are using Node.js v19
    echo.
    echo This version should work with Expo
    echo.
    echo You can run: npm start
) else if "%NODE_MAJOR%" geq "21" (
    echo [OK] You are using Node.js v%NODE_MAJOR% or higher
    echo.
    echo This version may have new fixes for Expo
    echo.
    echo You can run: npm start
) else (
    echo [?] Unknown Node.js version: %NODE_MAJOR%
    echo.
    echo Try updating to Node.js v18 for best compatibility
)

echo.
echo ============================================
echo Press any key to close...
echo ============================================

pause
