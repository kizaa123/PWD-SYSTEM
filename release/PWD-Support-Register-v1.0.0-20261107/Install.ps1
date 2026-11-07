# First-time setup on the organisation PC (Node.js 22+ required).
$ErrorActionPreference = "Stop"
$AppRoot = $PSScriptRoot

function Show-Branding {
  $logo = Join-Path $AppRoot "branding\system-logo.jpg"
  if (-not (Test-Path $logo)) { $logo = Join-Path $AppRoot "web\system-logo.jpg" }
  Write-Host ""
  Write-Host "  PWD Support Management System" -ForegroundColor Cyan
  Write-Host "  Installation" -ForegroundColor White
  if (Test-Path $logo) {
    Write-Host "  Logo: $logo"
  }
  Write-Host ""
}

Show-Branding

$nodeVer = (node -v 2>$null)
if (-not $nodeVer) {
  Write-Error "Node.js is not installed. Install Node.js 22 LTS from https://nodejs.org/ then run this script again."
}
Write-Host "Node $nodeVer"

Write-Host "Installing API dependencies..."
Push-Location (Join-Path $AppRoot "backend")
npm install --omit=dev
Pop-Location

if (-not (Test-Path (Join-Path $AppRoot "web\index.html"))) {
  Write-Error "Missing web\index.html — use the full release package from your vendor (run Package-Release.ps1)."
}

$dataDir = Join-Path $AppRoot "backend\data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }

$seed = Read-Host "Load demo regions, districts, and sample staff? (y/N)"
if ($seed -eq "y" -or $seed -eq "Y") {
  Push-Location (Join-Path $AppRoot "backend")
  npm run seed
  Pop-Location
  Write-Host "Demo data loaded. Change all passwords before production use."
} else {
  Write-Host "Skipped seed — database will initialize on first API start if empty."
}

Write-Host ""
Write-Host "Installation complete. Double-click Start-PWD-Support.bat or run Start-PWD-Support.ps1" -ForegroundColor Green
Write-Host "Then open http://localhost:4000 in your browser."
