<#
.SYNOPSIS
    Builds the Cashly Windows desktop installer (.exe) via Electron Builder.

.PARAMETER Open
    Open the folder containing the built installer when done.

.EXAMPLE
    .\scripts\build-exe.ps1
    .\scripts\build-exe.ps1 -Open
#>

param(
    [switch]$Open
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "OK: $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "ERROR: $msg" -ForegroundColor Red }

Write-Step "Checking prerequisites"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js not found on PATH. Install it from https://nodejs.org and retry."
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Err "npm not found on PATH."
    exit 1
}
Write-Ok "node $(node --version), npm $(npm --version)"

Write-Step "Building desktop app (npm run electron:dist)"
npm run electron:dist
if ($LASTEXITCODE -ne 0) { Write-Err "electron:dist failed"; exit $LASTEXITCODE }

# electron-builder writes NSIS installers to the "release" directory (see package.json > build.directories.output)
$releaseDir = Join-Path $RepoRoot "release"
$installer = Get-ChildItem -Path $releaseDir -Filter "*.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $installer) {
    Write-Err "Build finished but no .exe was found under $releaseDir"
    exit 1
}

Write-Step "Done"
Write-Ok "Installer: $($installer.FullName)"

if ($Open) {
    Start-Process explorer.exe "/select,`"$($installer.FullName)`""
}
