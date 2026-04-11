# PowerShell Start Script for ResourceManager Mobile

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Starting ResourceManager Mobile..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .expo folder exists and remove it
$expoPath = ".\.expo"
if (Test-Path $expoPath) {
    Write-Host "[*] Cleaning .expo cache..." -ForegroundColor Yellow
    Remove-Item -Path $expoPath -Recurse -Force
    Write-Host "    [OK] .expo removed" -ForegroundColor Green
} else {
    Write-Host "[SKIP] .expo folder not found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Starting Expo Development Server..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "  - Open http://localhost:8081 in your browser" -ForegroundColor White
Write-Host "  - Press 'a' for Android" -ForegroundColor White
Write-Host "  - Press 'i' for iOS" -ForegroundColor White
Write-Host "  - Press 'w' for Web" -ForegroundColor White
Write-Host "  - Press 'Ctrl+C' to stop" -ForegroundColor White
Write-Host ""

# Start Expo using npx directly
Write-Host "Starting..." -ForegroundColor Green
npx expo start --clear

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Press any key to close..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
