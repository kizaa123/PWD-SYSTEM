# Builds the web app and assembles a branded installation folder for the client.
# Run from repo root:  powershell -ExecutionPolicy Bypass -File install\Package-Release.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Version = (Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json).version
$Stamp = Get-Date -Format "yyyyMMdd"
$OutName = "PWD-Support-Register-v$Version-$Stamp"
$ReleaseRoot = Join-Path $Root "release"
$OutDir = Join-Path $ReleaseRoot $OutName

$LogoSrc = Join-Path $Root "frontend\public\system-logo.jpg"
$LogoPng = Join-Path $Root "frontend\public\system-logo.png"
if (-not (Test-Path $LogoSrc) -and -not (Test-Path $LogoPng)) {
  Write-Warning "No system-logo.jpg/png in frontend\public — add your organisation logo before packaging."
}

Write-Host "Building frontend..."
Push-Location (Join-Path $Root "frontend")
npm run build
Pop-Location

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir | Out-Null

$Dirs = @(
  @{ Src = "backend"; Dst = "backend"; Exclude = @("node_modules") },
  @{ Src = "frontend\dist"; Dst = "web"; Exclude = @() },
  @{ Src = "install\client"; Dst = "."; Exclude = @() }
)

function Copy-Tree($relSrc, $relDst, $exclude) {
  $from = Join-Path $Root $relSrc
  $to = Join-Path $OutDir $relDst
  if (-not (Test-Path $from)) { return }
  New-Item -ItemType Directory -Path $to -Force | Out-Null
  Get-ChildItem -Path $from -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($from.Length).TrimStart("\")
    if ($rel -match '(^|[\\/])node_modules([\\/]|$)') { return }
    foreach ($ex in $exclude) { if ($rel -like "$ex*") { return } }
    $dest = Join-Path $to $rel
    $destParent = Split-Path $dest -Parent
    if (-not (Test-Path $destParent)) { New-Item -ItemType Directory -Path $destParent -Force | Out-Null }
    Copy-Item $_.FullName $dest -Force
  }
}

Copy-Tree "backend" "backend" @("node_modules")
Copy-Tree "frontend\dist" "web" @()
Copy-Tree "install\client" "." @()

$BrandDir = Join-Path $OutDir "branding"
New-Item -ItemType Directory -Path $BrandDir -Force | Out-Null
if (Test-Path $LogoSrc) { Copy-Item $LogoSrc (Join-Path $BrandDir "system-logo.jpg") -Force }
if (Test-Path $LogoPng) { Copy-Item $LogoPng (Join-Path $BrandDir "system-logo.png") -Force }

Copy-Item (Join-Path $Root "package.json") (Join-Path $OutDir "package.json") -Force
Copy-Item (Join-Path $Root "README.md") (Join-Path $OutDir "README.md") -Force

$Zip = Join-Path $ReleaseRoot "$OutName.zip"
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path $OutDir -DestinationPath $Zip

Write-Host ""
Write-Host "Release ready:" -ForegroundColor Green
Write-Host "  Folder: $OutDir"
Write-Host "  Zip:    $Zip"
Write-Host ""
Write-Host "Deploy this zip on the organisation machine; keep source and release archives in your repo."
Write-Host "See install/MANAGED-DEPLOYMENT.md for backup and upgrade workflow."
