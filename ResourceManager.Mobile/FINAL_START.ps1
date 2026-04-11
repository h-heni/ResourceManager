# Final Start Script for ResourceManager Mobile

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "RESOURCE MANAGER MOBILE - FINAL FIX" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Step 1: Clean .expo folder
Write-Host "[Step 1/3] Cleaning .expo cache..." -ForegroundColor Yellow

$expoPath = ".\.expo"
if (Test-Path $expoPath) {
    try {
        Remove-Item -Path $expoPath -Recurse -Force -ErrorAction Stop
        Write-Host "            [OK] .expo removed" -ForegroundColor Green
    } catch {
        Write-Host "            [WARN] Could not remove .expo" -ForegroundColor Red
    }
} else {
    Write-Host "            [SKIP] .expo not found" -ForegroundColor Gray
}

# Step 2: Clean Metro cache
Write-Host "[Step 2/3] Cleaning Metro cache..." -ForegroundColor Yellow

$metroPath = "$env:TEMP\metro-bundler"
if (Test-Path $metroPath) {
    try {
        Remove-Item -Path $metroPath -Recurse -Force -ErrorAction Stop
        Write-Host "            [OK] Metro cache removed" -ForegroundColor Green
    } catch {
        Write-Host "            [WARN] Could not remove Metro cache" -ForegroundColor Red
    }
} else {
    Write-Host "            [SKIP] Metro cache not found" -ForegroundColor Gray
}

# Step 3: Start Expo
Write-Host "[Step 3/3] Starting Expo..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EXPED DEV TOOLS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "  - Browser: http://localhost:8081" -ForegroundColor White
Write-Host "  - Android: Press 'a'" -ForegroundColor White
Write-Host "  - iOS: Press 'i'" -ForegroundColor White
Write-Host "  - Web: Press 'w'" -ForegroundColor White
Write-Host ""
Write-Host "Starting now..." -ForegroundColor Green
Write-Host ""

# Start Expo with clear cache and minimal config
Start-Process -FilePath "npx" -ArgumentList "expo","start","--clear","--no-dev","--minify" -NoNewWindow -Wait
