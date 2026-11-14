<#
.SYNOPSIS
    Builds the Cashly Android APK via Capacitor + Gradle.

.PARAMETER Release
    Build an (unsigned) release APK instead of the default debug APK.

.PARAMETER Open
    Open the folder containing the built APK when done.

.EXAMPLE
    .\scripts\build-apk.ps1
    .\scripts\build-apk.ps1 -Release -Open
#>

param(
    [switch]$Release,
    [switch]$Open
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "OK: $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "ERROR: $msg" -ForegroundColor Red }

# --- Prerequisite checks -----------------------------------------------

Write-Step "Checking prerequisites"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js not found on PATH. Install it from https://nodejs.org and retry."
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Err "npm not found on PATH."
    exit 1
}

if (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
    Write-Err "JAVA_HOME is not set (or points to a missing folder). Gradle needs a JDK 17+ to build the APK."
    exit 1
}
Write-Ok "JAVA_HOME = $env:JAVA_HOME"

# Resolve an Android SDK location: explicit env var, or common install paths.
$sdkDir = $env:ANDROID_HOME
if (-not $sdkDir) { $sdkDir = $env:ANDROID_SDK_ROOT }

if (-not $sdkDir) {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
        "C:\Android\Sdk",
        "C:\Program Files (x86)\Android\android-sdk"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $sdkDir = $c; break }
    }
}

if (-not $sdkDir -or -not (Test-Path $sdkDir)) {
    Write-Err "No Android SDK found. Set ANDROID_HOME/ANDROID_SDK_ROOT, or install Android Studio (which includes the SDK) and retry."
    Write-Host "  Typical default location: $env:LOCALAPPDATA\Android\Sdk"
    exit 1
}
Write-Ok "Android SDK = $sdkDir"

# Gradle reads local.properties for sdk.dir if the env var isn't visible to it.
$localProps = Join-Path $RepoRoot "android\local.properties"
$sdkDirEscaped = $sdkDir -replace '\\', '\\\\'
"sdk.dir=$sdkDirEscaped" | Set-Content -Path $localProps -Encoding ASCII
Write-Ok "Wrote android\local.properties"

# --- Build ---------------------------------------------------------------

Write-Step "Building web app for mobile and syncing Capacitor (npm run mobile:build)"
npm run mobile:build
if ($LASTEXITCODE -ne 0) { Write-Err "mobile:build failed"; exit $LASTEXITCODE }

$gradleTask = if ($Release) { "assembleRelease" } else { "assembleDebug" }
Write-Step "Running Gradle: $gradleTask"
Push-Location (Join-Path $RepoRoot "android")
try {
    & .\gradlew.bat $gradleTask
    if ($LASTEXITCODE -ne 0) { Write-Err "Gradle build failed"; exit $LASTEXITCODE }
}
finally {
    Pop-Location
}

# --- Locate output ---------------------------------------------------------

$variant = if ($Release) { "release" } else { "debug" }
$apkDir = Join-Path $RepoRoot "android\app\build\outputs\apk\$variant"
$apk = Get-ChildItem -Path $apkDir -Filter "*.apk" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $apk) {
    Write-Err "Build finished but no APK was found under $apkDir"
    exit 1
}

$distDir = Join-Path $RepoRoot "dist"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
$destPath = Join-Path $distDir $apk.Name
Copy-Item -Path $apk.FullName -Destination $destPath -Force

Write-Step "Done"
Write-Ok "APK: $destPath"

if ($Open) {
    Start-Process explorer.exe "/select,`"$destPath`""
}
