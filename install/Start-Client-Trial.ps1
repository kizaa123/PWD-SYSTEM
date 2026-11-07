# Starts production PWD + a temporary public link (Cloudflare quick tunnel) for client demos.
# Keep this PowerShell window open; closing it stops the public link.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root "frontend\dist"
$Port = if ($env:TRIAL_PORT) { $env:TRIAL_PORT } else { "4001" }

if (-not (Test-Path (Join-Path $Dist "index.html"))) {
  Write-Host "Building web app..."
  npm run build --prefix (Join-Path $Root "frontend")
}

$cf = Join-Path $env:TEMP "cloudflared.exe"
if (-not (Test-Path $cf)) {
  Write-Host "Downloading cloudflared..."
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/download/2025.2.0/cloudflared-windows-amd64.exe" -OutFile $cf -UseBasicParsing
}

Write-Host "Starting PWD on http://localhost:$Port/ ..."
$env:NODE_ENV = "production"
$env:PWD_WEB_DIST = $Dist
$env:PORT = $Port
$apiJob = Start-Job -ScriptBlock {
  param($Root, $Port)
  $env:NODE_ENV = "production"
  $env:PWD_WEB_DIST = Join-Path $Root "frontend\dist"
  $env:PORT = $Port
  Set-Location (Join-Path $Root "backend")
  npm run start 2>&1
} -ArgumentList $Root, $Port

Start-Sleep -Seconds 4
try {
  $null = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 10
} catch {
  Receive-Job $apiJob
  throw "API did not start on port $Port"
}

Write-Host ""
Write-Host "Opening public tunnel (URL appears below in ~10 seconds)..." -ForegroundColor Cyan
Write-Host "Send the https://....trycloudflare.com link to your client." -ForegroundColor Green
Write-Host ""
Write-Host "Demo login:" 
Write-Host "  register@accra.gh  /  Pwd@2026   (Social Welfare — registration)"
Write-Host "  admin@ncpd.gov.gh  /  Pwd@2026   (System admin)"
Write-Host ""
Write-Host "Press Ctrl+C to stop tunnel and API." -ForegroundColor Yellow

try {
  & $cf tunnel --url "http://127.0.0.1:$Port"
} finally {
  Stop-Job $apiJob -ErrorAction SilentlyContinue
  Remove-Job $apiJob -Force -ErrorAction SilentlyContinue
}
