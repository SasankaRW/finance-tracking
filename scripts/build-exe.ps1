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
function Write-Warn($msg) { Write-Host "WARN: $msg" -ForegroundColor Yellow }

function Test-IsElevated {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-DeveloperModeEnabled {
    try {
        $val = Get-ItemPropertyValue -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -Name AllowDevelopmentWithoutDevLicense -ErrorAction Stop
        return $val -eq 1
    } catch {
        return $false
    }
}

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

# electron-builder must extract a vendor archive (winCodeSign) that contains symlinks.
# Creating symlinks on Windows requires either an elevated shell or Developer Mode -
# without one of those, 7-Zip fails with "Cannot create symbolic link: A required
# privilege is not held by the client" partway through packaging.
if (-not (Test-IsElevated) -and -not (Test-DeveloperModeEnabled)) {
    Write-Err "Symlink privilege is unavailable, so electron-builder's dependency extraction will fail."
    Write-Host ""
    Write-Host "electron-builder needs to unpack a vendor tool archive that contains symbolic links." -ForegroundColor Yellow
    Write-Host "Windows only allows non-admin accounts to create symlinks when Developer Mode is on." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Fix (one-time, recommended): enable Developer Mode, then re-run this script:" -ForegroundColor Yellow
    Write-Host "    Settings > Privacy & security > For developers > Developer Mode > On" -ForegroundColor Yellow
    Write-Host "    (or run: start ms-settings:developers)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: re-run this script from an elevated (Run as Administrator) PowerShell." -ForegroundColor Yellow

    $staleCache = Join-Path $env:LOCALAPPDATA "electron-builder\Cache\winCodeSign"
    if (Test-Path $staleCache) {
        Write-Warn "Removing incomplete winCodeSign cache at $staleCache so the next attempt starts clean."
        Remove-Item -Recurse -Force $staleCache -ErrorAction SilentlyContinue
    }

    exit 1
}

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
