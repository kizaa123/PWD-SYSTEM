# Writes deploy/.env from prompts and checks deploy/Caddyfile uses env-based domain.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env"
$Example = Join-Path $PSScriptRoot ".env.example"

if (-not (Test-Path $EnvFile)) {
  if (Test-Path $Example) { Copy-Item $Example $EnvFile }
  else { Set-Content $EnvFile "PWD_DOMAIN=`nPWD_TOKEN_SECRET=`n" }
}

$domain = Read-Host "Public domain (e.g. register.yourassembly.gov.gh)"
$secret = -join ((1..32) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })

$lines = Get-Content $EnvFile -ErrorAction SilentlyContinue
$out = @()
$seenDomain = $false
$seenSecret = $false
foreach ($line in $lines) {
  if ($line -match '^PWD_DOMAIN=') { $out += "PWD_DOMAIN=$domain"; $seenDomain = $true }
  elseif ($line -match '^PWD_TOKEN_SECRET=') { $out += "PWD_TOKEN_SECRET=$secret"; $seenSecret = $true }
  else { $out += $line }
}
if (-not $seenDomain) { $out += "PWD_DOMAIN=$domain" }
if (-not $seenSecret) { $out += "PWD_TOKEN_SECRET=$secret" }
Set-Content -Path $EnvFile -Value $out

Write-Host ""
Write-Host ".env ready at $EnvFile"
Write-Host "Point DNS A record:  $domain  ->  your VPS public IP"
Write-Host "On the VPS run:      docker compose up -d --build"
Write-Host ""
