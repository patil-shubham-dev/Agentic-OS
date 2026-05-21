# AgentOS Studio — Desktop Packaging Report

## Build Targets

| Platform | Installer | Architecture | Notes |
|----------|-----------|-------------|-------|
| **Windows** | `.exe` (NSIS) | x64, arm64 | One-click or custom install, desktop shortcut, start menu |
| **macOS** | `.dmg` + `.zip` | x64, arm64 | Notarized DMG, hardened runtime |
| **Linux** | `.AppImage` + `.deb` | x64, arm64 | AppImage portable, DEB for Debian/Ubuntu |

## Configuration

The packaging configuration is in **`apps/desktop/electron-builder.yml`**.

### Key Settings

- **App ID:** `com.agentos.studio`
- **Product Name:** `AgentOS Studio`
- **Copyright:** Copyright © 2025 AgentOS Studio
- **ASAR:** Enabled (with `keytar` and `node-pty` unpacked)

### Windows

```yaml
win:
  target:
    - target: nsis
      arch: [x64, arm64]
  artifactName: "AgentOS-Studio-Setup-${version}-${arch}.exe"
```

- NSIS installer with per-machine and per-user options
- Creates desktop shortcut and start menu entry
- Custom installation directory supported

### macOS

```yaml
mac:
  target:
    - target: dmg
      arch: [x64, arm64]
    - target: zip
      arch: [x64, arm64]
  category: public.app-category.developer-tools
  hardenedRuntime: true
  entitlements: resources/entitlements.mac.plist
  entitlementsInherit: resources/entitlements.mac.plist
```

- Hardened runtime with JIT + filesystem + networking entitlements
- DMG for distribution, ZIP for direct download
- Requires Apple Developer ID certificate for notarization

### Linux

```yaml
linux:
  target:
    - target: AppImage
      arch: [x64, arm64]
    - target: deb
      arch: [x64, arm64]
  category: Development
```

- AppImage: Portable, works on any modern Linux distro
- DEB: Native Debian/Ubuntu package with `.desktop` file

## Code Signing

### macOS

```bash
# Sign the app manually (requires Apple Developer ID cert)
export CSC_LINK="path/to/developer.p12"
export CSC_KEY_PASSWORD="password"

pnpm run build:mac
```

### Windows

```bash
# Sign with Authenticode certificate
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="password"

pnpm run build:win
```

### Linux

Linux packages are not code-signed. AppImage and DEB are distributed with checksums.

## Auto-Updates

Uses `electron-updater` with a generic/HTTP release server.

### Release Server

```yaml
publish:
  provider: generic
  url: https://releases.agentos.studio
  channel: latest
```

### Required Release Files

```
releases.agentos.studio/
├── latest.yml                          # Windows update manifest
├── latest-mac.yml                      # macOS update manifest
├── latest-linux.yml                    # Linux update manifest
├── AgentOS-Studio-Setup-${version}-x64.exe
├── AgentOS-Studio-${version}-x64.dmg
├── AgentOS-Studio-${version}-x64.AppImage
└── AgentOS-Studio-${version}-x64.deb
```

## CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/release.yml
name: Build and Release

on:
  push:
    tags:
      - "v*"

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: pnpm install

      - name: Build web app
        run: pnpm --filter @agentos/web build

      - name: Build desktop app
        run: pnpm --filter @agentos/desktop build
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: agentos-studio-${{ matrix.os }}
          path: apps/desktop/out/*

  create-release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
      - uses: softprops/action-gh-release@v1
        with:
          files: |
            agentos-studio-ubuntu-latest/*
            agentos-studio-macos-latest/*
            agentos-studio-windows-latest/*
```

## Build Commands

```bash
# Install all dependencies (from monorepo root)
pnpm install

# Development
pnpm --filter @agentos/desktop dev

# Build for packaging
pnpm --filter @agentos/web build          # Build Next.js
pnpm --filter @agentos/desktop build      # Package desktop app

# Platform-specific packages
pnpm --filter @agentos/desktop build:win
pnpm --filter @agentos/desktop build:mac
pnpm --filter @agentos/desktop build:linux

# Package only (no publish)
pnpm --filter @agentos/desktop package
```

## Output Structure

```
apps/desktop/out/
├── AgentOS-Studio-Setup-0.1.0-x64.exe     # Windows installer
├── AgentOS-Studio-0.1.0-x64.dmg           # macOS DMG
├── AgentOS-Studio-0.1.0-x64.zip           # macOS zip
├── AgentOS-Studio-0.1.0-x64.AppImage      # Linux AppImage
├── AgentOS-Studio-0.1.0-x64.deb           # Linux DEB
├── latest.yml                             # Windows update manifest
├── latest-mac.yml                         # macOS update manifest
└── latest-linux.yml                       # Linux update manifest
```

## Known Limitations

1. **`node-pty` native module** — Must be built for the target platform. Prebuilt binaries are available for Windows/macOS/Linux x64/arm64 via `@electron/rebuild`.
2. **`keytar` native module** — Same constraint as node-pty. Falls back to local encrypted store when unavailable.
3. **macOS notarization** — Requires an active Apple Developer Program membership and a valid Developer ID certificate.
4. **Windows code signing** — Requires an Authenticode certificate (EV or standard).
5. **Next.js output** — The full `.next` directory is ~200MB; the `.next/standalone` output mode should be investigated for smaller packages.
