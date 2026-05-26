param(
  [string]$Version = "",
  [string]$Channel = "stable"
)

Write-Host "=== Agentic-OS Studio Release Pipeline ===" -ForegroundColor Magenta

# Validate version
if (-not $Version) {
  Write-Host "Usage: .\scripts\release.ps1 -Version 1.0.1" -ForegroundColor Red
  exit 1
}

# Update version in all package.json files
Write-Host "`n[1/5] Updating version to $Version..." -ForegroundColor Yellow
$packages = @(
  "package.json",
  "packages/shared/package.json",
  "packages/providers/package.json",
  "packages/ui/package.json",
  "apps/desktop/package.json",
  "apps/web/package.json"
)

foreach ($pkg in $packages) {
  $path = Join-Path $PSScriptRoot "..\$pkg"
  if (Test-Path $path) {
    $content = Get-Content $path -Raw | ConvertFrom-Json
    $content.version = $Version
    $content | ConvertTo-Json -Depth 10 | Set-Content $path
    Write-Host "  Updated $pkg" -ForegroundColor Gray
  }
}

# Update Cargo.toml version
$cargoPath = Join-Path $PSScriptRoot "..\apps\desktop\src-tauri\Cargo.toml"
(Get-Content $cargoPath) -replace '^version = ".*"', "version = `"$Version`"" | Set-Content $cargoPath
Write-Host "  Updated Cargo.toml" -ForegroundColor Gray

# Update tauri.conf.json version
$tauriConfPath = Join-Path $PSScriptRoot "..\apps\desktop\src-tauri\tauri.conf.json"
$tauriConf = Get-Content $tauriConfPath -Raw | ConvertFrom-Json
$tauriConf.version = $Version
$tauriConf | ConvertTo-Json -Depth 10 | Set-Content $tauriConfPath
Write-Host "  Updated tauri.conf.json" -ForegroundColor Gray

# Run build
Write-Host "`n[2/5] Installing dependencies..." -ForegroundColor Yellow
Set-Location (Join-Path $PSScriptRoot "..")
npm install

Write-Host "`n[3/5] Building packages..." -ForegroundColor Yellow
npm run build -w packages/shared
npm run build -w packages/providers
npm run build -w packages/ui

Write-Host "`n[4/5] Building desktop app..." -ForegroundColor Yellow
npm run build -w apps/desktop
npm run tauri build -w apps/desktop

# Generate release artifacts
Write-Host "`n[5/5] Generating release artifacts..." -ForegroundColor Yellow
$bundleDir = "apps/desktop/src-tauri/target/release/bundle"
$releaseDir = "releases/$Version"

if (-not (Test-Path $releaseDir)) {
  New-Item -ItemType Directory -Path $releaseDir -Force
}

# Copy installer
if (Test-Path "$bundleDir/nsis") {
  Copy-Item "$bundleDir/nsis/*.exe" $releaseDir
  Write-Host "  Copied NSIS installer" -ForegroundColor Gray
}

if (Test-Path "$bundleDir/msi") {
  Copy-Item "$bundleDir/msi/*.msi" $releaseDir
  Write-Host "  Copied MSI installer" -ForegroundColor Gray
}

# Create update manifest
$updateManifest = @{
  version = $Version
  channel = $Channel
  date = (Get-Date -Format "yyyy-MM-dd")
  notes = "Release $Version"
  platforms = @{
    "windows-x86_64" = @{
      signature = ""
      url = "https://releases.agentic-os.com/download/$Version/Agentic-OS-Studio_${Version}_x64-setup.exe"
    }
  }
}
$updateManifest | ConvertTo-Json -Depth 10 | Set-Content "$releaseDir/updates.json"

Write-Host "`n=== Release $Version Complete ===" -ForegroundColor Green
Write-Host "Artifacts: $releaseDir" -ForegroundColor Cyan
