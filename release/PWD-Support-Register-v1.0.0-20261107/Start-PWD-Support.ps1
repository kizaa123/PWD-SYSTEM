$ErrorActionPreference = "Stop"
$AppRoot = $PSScriptRoot

$env:NODE_ENV = "production"
$env:PWD_WEB_DIST = Join-Path $AppRoot "web"
$env:PORT = if ($env:PORT) { $env:PORT } else { "4000" }

Write-Host "PWD Support — starting on http://localhost:$($env:PORT)/"
Write-Host "Press Ctrl+C to stop."
Push-Location (Join-Path $AppRoot "backend")
npm run start
