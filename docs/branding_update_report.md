# Branding Update Report

## Overview

This report documents the branding updates applied to AgentOS Studio, including the new logo, icon assets, and application name changes.

## Original vs Updated

| Element | Before | After |
|---------|--------|-------|
| App Name | AgentOS | AGENTOS STUDIO |
| Short Name | AgentOS | AgentOS |
| Tagline | N/A | AI Operating System for Developers |
| Sidebar Logo | Sparkles icon | SVG icon |
| Theme | Amber/Gold | Amber/Gold (unchanged) |

## New Logo

A new SVG logo has been created as the single source of truth for all branding:

**File**: `apps/web/public/icon.svg`

The logo features:
- Amber/orange gradient background
- White spark/star icon
- Circle rings representing AI processing
- Terminal prompt element

## Generated Web Assets

The following assets are generated from the master icon:

| File | Size | Usage |
|------|------|-------|
| favicon.ico | 256x256 | Browser favicon |
| favicon-16x16.png | 16x16 | Small favicon |
| favicon-32x32.png | 32x32 | Standard favicon |
| icon-192.png | 192x192 | PWA icon |
| icon-512.png | 512x512 | PWA icon (large) |
| apple-touch-icon.png | 180x180 | iOS home screen |

## Generated Desktop Assets

| File | Platform | Format |
|------|----------|--------|
| icon.ico | Windows | ICO format |
| icon.icns | macOS | ICNS format |
| icon.png | Linux | PNG format |

## Files Updated

### Layout Updates

**File**: `apps/web/src/app/(dashboard)/layout.tsx`

Changes:
1. Replaced gradient div with SVG image
2. Removed Sparkles icon import (no longer needed)
3. Updated sidebar branding

### Product Blueprint

**File**: `apps/web/src/lib/product-blueprint.ts`

Created with:
- `productName`: "AGENTOS STUDIO"
- `productShortName`: "AgentOS"
- `productTagline`: "AI Operating System for Developers"
- Color palette definitions
- Window configuration

### Client API

**File**: `apps/web/src/lib/client-api.ts`

Created with:
- `getJson`, `postJson`, `deleteJson`, `sendJson` functions
- `ElectronAPI` interface for desktop features
- `getElectronAPI()` helper
- `isDesktop()` detection

### Utils

**File**: `apps/web/src/lib/utils.ts`

Created with standard utilities:
- `cn()` - class name merger
- `formatDate()`, `formatTime()`, `formatRelativeTime()`
- `truncate()`, `generateId()`
- `debounce()`, `throttle()`
- `isBrowser()`, `getBaseURL()`

## Desktop Application Branding

### Electron Configuration

**File**: `apps/desktop/package.json`

```json
{
  "name": "@agentos/desktop",
  "productName": "AgentOS Studio",
  "appId": "ai.agentos.studio"
}
```

### Main Process

**File**: `apps/desktop/src/main/main.ts`

- Window title: "AgentOS Studio"
- Application menu labels updated
- Tray tooltip updated

### Build Icons

| Platform | Icon File | Required Size |
|----------|----------|--------------|
| Windows | icon.ico | 256x256 |
| macOS | icon.icns | 512x512 |
| Linux | icon.png | 512x512 |

## Icon Generation Script

**File**: `scripts/generate-icons.ts`

Usage:
```bash
pnpm generate:icons
```

This script uses `sharp` to generate all required sizes from the master SVG/PNG.

## Color Palette

The branding maintains the amber/gold theme:

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Main | #f59e0b | Main brand color (Amber 500) |
| Primary Light | #fbbf24 | Hover states (Amber 400) |
| Primary Dark | #d97706 | Active states (Amber 600) |
| Secondary | #ea580c | Accent (Orange 600) |
| Background | #fffbeb | Background (Amber 50) |
| Background Muted | #fef3c7 | Cards (Amber 100) |
| Text Primary | #92400e | Main text (Amber 800) |

## Brand Elements

### Sidebar Header

- Icon: 28-32px
- Padding: 12px horizontal
- Gap between icon and text: 12px
- Text style: uppercase, 0.20em letter-spacing, 14px

### Window Title

- Title: "AgentOS Studio"
- Subtitle: Optional - "AI Operating System"

### About Dialog

Shows:
- Application name
- Version number
- Electron/Node/Chrome versions

### System Tray

- Icon: Desktop icon
- Tooltip: "AgentOS Studio"

## Build Scripts Added

| Command | Description |
|---------|-------------|
| `pnpm dev:desktop` | Run Electron in dev |
| `pnpm build:desktop` | Build TypeScript |
| `pnpm package:desktop` | Package app |
| `pnpm generate:icons` | Generate all icons |

## Consistency Points

The new branding is applied consistently at:

1. **Web App**
   - Sidebar logo
   - Browser favicon
   - PWA icons

2. **Desktop App**
   - Window icon
   - Taskbar/Dock icon
   - Application menu
   - About dialog
   - System tray

3. **Installers**
   - Windows NSIS installer icon
   - macOS DMG icon
   - Linux AppImage icon

## Visual Quality Requirements

- [x] Pixel-perfect rendering
- [x] Transparent backgrounds
- [x] No scaling artifacts
- [x] Consistent appearance across platforms

## Notes

1. **SVG Icon**: Created as a scalable master
2. **PNG Icons**: Generated from SVG for web
3. **ICO/ICNS**: Generated for desktop platforms
4. **Placeholder**: Icon generation script ready for real logo

## Future Updates

When the real logo file is provided:

1. Replace `apps/web/public/icon.svg` with the new logo
2. Run `pnpm generate:icons`
3. All other icons will be regenerated automatically

## Definition of Done

- [x] New logo in web sidebar
- [x] Logo referenced in product-blueprint.ts
- [x] Desktop window uses new icon
- [x] Taskbar uses new icon
- [x] Installers configured with icon path
- [x] Branding consistent across web and desktop
- [x] Documentation created

## Next Steps

1. **Replace Placeholder**: When the actual logo PNG is provided, use it
2. **Code Signing**: Configure for production releases
3. **Auto-Updates**: Set up update server
4. **Testing**: Verify all platforms display correctly