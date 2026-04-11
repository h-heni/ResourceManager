@echo off
REM ============================================
REM Simple Start - Using local web server
REM Bypasses the problematic Expo CLI on Windows
REM ============================================

echo.
echo ============================================
echo ResourceManager Mobile - Simple Start
echo ============================================
echo.
echo This starts a simple local web server
echo that serves the React Native web app
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [Step 1] Installing dependencies...
    call npm install
)

echo.
echo [Step 2] Starting local web server...
echo.

REM Create simple HTTP server using node
echo Starting server at http://localhost:8080
echo.
echo Press Ctrl+C to stop
echo.

node -e "const http = require('http'); const fs = require('fs'); const path = require('path'); const port = 8080; const mimeTypes = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'}; http.createServer((req, res) => { const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url); const ext = path.extname(filePath); const contentType = mimeTypes[ext] || 'text/plain'; fs.readFile(filePath, (err, data) => { if (err) { res.writeHead(404); res.end('Not found'); } else { res.writeHead(200, {'Content-Type': contentType}); res.end(data); }}); }).listen(port, () => { console.log(`Server running at http://localhost:${port}/`); });"
