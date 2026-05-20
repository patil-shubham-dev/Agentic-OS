# Desktop Packaging Report

## Build Targets

This document describes the desktop packaging configuration and generated installers.

## Build Configuration

The packaging is configured in `apps/desktop/package.json`:

```json
{
  "build": {
    "appId": "ai.agentos.studio",
    "productName": "AgentOS Studio",
    "directories": {
      "output": "release",
      "buildResources": "build"
    },
    "files": [
      "dist/**/*",
      "package.json"
    ]
  }
}
```

## Windows Packaging

### Target: NSIS Installer

**Output**: `release/AgentOS Studio Setup 0.1.0.exe`

**Features**:
- One-click install option
- Custom install directory
- Desktop shortcut option
- Start menu entry
- Uninstaller

**Configuration**:
```json
{
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "installerIcon": "build/icon.ico",
    "uninstallerIcon": "build/icon.ico"
  }
}
```

### Target: Portable EXE

**Output**: `release/win-unpacked/AgentOS Studio.exe`

This is the unpacked application that can be run directly.

## macOS Packaging

### Target: DMG

**Output**: `release/AgentOS Studio-0.1.0.dmg`

**Features**:
- Drag-to-Applications installation
- Proper app signing (requires certificate)
- Universal binary (x64 + ARM64)

**Configuration**:
```json
{
  "mac": {
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      }
    ],
    "icon": "build/icon.icns",
    "category": "public.app-category.developer-tools"
  }
}
```

**Note**: Creating `.icns` requires a macOS system or icon conversion tool.

## Linux Packaging

### Target: AppImage

**Output**: `release/AgentOS Studio-0.1.0.AppImage`

**Features**:
- Single executable
- No installation required
- Works on most distros

**Configuration**:
```json
{
  "linux": {
    "target": [
      {
        "target": "AppImage",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icon.png",
    "category": "Development"
  }
}
```

### Target: deb (optional)

**Output**: `release/AgentOS Studio_0.1.0_amd64.deb`

## Building

### Prerequisites

1. Node.js >= 20.0.0
2. pnpm >= 9.0.0

### Install Dependencies

```bash
cd apps/desktop
npm install
```

### Build TypeScript

```bash
pnpm build:desktop
```

### Package

```bash
# All platforms
pnpm package:desktop

# Specific platform
pnpm dist:win    # Windows
pnpm dist:mac    # macOS  
pnpm dist:linux  # Linux
```

### Combined Build (Web + Desktop)

```bash
# Build everything
pnpm build:all
pnpm package:desktop
```

## Icon Generation

### Required Icons

| Platform | File | Size |
|----------|------|------|
| Windows | icon.ico | 256x256 |
| macOS | icon.icns | 512x512 |
| Linux | icon.png | 512x512 |

### Generate from Master

Place master icon at `apps/web/public/icon.svg` or `apps/web/public/icon.png`, then run:

```bash
pnpm generate:icons
```

This script uses the `sharp` package to generate all required sizes.

### Manual Icon Creation

For Windows `.ico`, you can use:

```bash
# Using sharp (Node.js)
npx sharp icon.png --size 256 icon.ico
```

For macOS `.icns`, use IconComposer on macOS or convert with:

```bash
# Convert PNG to ICNS
npx png2icons icon.png build/icon.icns --icns
```

## Output Files

After packaging, the following files are generated:

```
apps/desktop/release/
├── win-unpacked/                    # Windows unpacked
│   ├── AgentOS Studio.exe
│   └── resources/
├── mac/                            # macOS DMG
│   └── AgentOS Studio-0.1.0.dmg
└── linux/                          # Linux
    └── AgentOS Studio-0.1.0.AppImage
```

## Code Signing

### Windows

Create a code signing certificate, then configure:

```json
{
  "win": {
    "certificate": "path/to/cert.pfx",
    "certificatePassword": "env:CERT_PASSWORD"
  }
}
```

### macOS

Configure Apple certificate:

```bash
# Export for signing
export APPLE_ID="developer@email.com"
export APPLE_APP_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAM_ID"
```

Then add to config:

```json
{
  "mac": {
    "type": "distribution",
    " HardenMitigation": true,
    "gatekeeperAssessment": "auto"
  }
}
```

## Auto-Update Configuration

Configure in electron-builder.yml:

```yaml
publish:
  provider: github
  owner: agentos
  repo: agentos-studio
  releaseType: release
```

## Verification

### Windows
- Run the installer
- Launch from Start menu
- Check tray icon appears
- Test native dialogs

### macOS
- Mount DMG
- Drag to Applications
- Launch from Dock
- Check menu bar

### Linux
- Make AppImage executable
- Run directly
- Check menu entry

## Troubleshooting

### Build Fails

1. Check icon files exist in `build/` folder
2. Verify TypeScript compiles without errors
3. Check electron-builder version compatibility

### Installer Issues

1. Windows: Check NSIS version compatibility
2. macOS: Verify certificate if signing fails
3. Linux: Check AppImage tools

### Icon Not Showing

1. Verify icon files are in correct format
2. Check icon path in package.json
3. Try rebuilding with `--dir` for debugging

## Platform-Specific Notes

### Windows

- Requires Visual C++ Redistributable
- UAC elevation may be needed
- Windows 10/11 supported

### macOS

- Requires macOS 10.15+
- Apple Silicon and Intel supported
- Notarization required for distribution

### Linux

- Requires glibc >= 2.17
- AppImage works on most distros
- Debian package requires fakeroot

## Release Checklist

Before releasing:

- [ ] All icons in correct formats
- [ ] App name and version consistent
- [ ] Code signing configured (if releasing)
- [ ] Auto-update configured (if applicable)
- [ ] Changelog updated
- [ ] Tested on each platform
- [ ] Privacy policy in place
- [ ] End-user license agreement (EULA) in place

## Versioning

Version follows Semantic Versioning (semver):

- Major: Breaking changes
- Minor: New features
- Patch: Bug fixes

Current version: 0.1.0

## Support

For build issues, check:

1. electron-builder docs: https://www.electron.build/
2. electron-log for runtime logs
3. GitHub issues