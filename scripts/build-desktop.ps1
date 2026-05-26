param(
  [switch]$Release = $true
)

Write-Host "=== Agentic-OS Studio Desktop Build ===" -ForegroundColor Cyan

# Step 1: Install dependencies
Write-Host "`n[1/4] Installing dependencies..." -ForegroundColor Yellow
npm install
if (-not $?) { throw "npm install failed" }

# Step 2: Build shared packages
Write-Host "`n[2/4] Building shared packages..." -ForegroundColor Yellow
npm run build -w packages/shared
npm run build -w packages/providers
npm run build -w packages/ui
if (-not $?) { throw "Package build failed" }

# Step 3: Build frontend
Write-Host "`n[3/4] Building frontend..." -ForegroundColor Yellow
npm run build -w apps/desktop
if (-not $?) { throw "Frontend build failed" }

# Step 4: Build Tauri desktop app
Write-Host "`n[4/4] Building Tauri desktop app..." -ForegroundColor Yellow
if ($Release) {
  npm run tauri build -w apps/desktop
} else {
  npm run tauri build -w apps/desktop -- --debug
}

if (-not $?) { throw "Tauri build failed" }

Write-Host "`n=== Build Complete ===" -ForegroundColor Green
Write-Host "Installer location: apps/desktop/src-tauri/target/release/bundle/" -ForegroundColor Cyan
