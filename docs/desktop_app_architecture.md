# Desktop Application Architecture

## Overview

AgentOS Studio is built as a desktop application using Electron with a Next.js frontend. This architecture document describes the desktop shell implementation.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│           Desktop Shell (Electron)               │
│  ┌─────────────────────────────────────┐│
│  │  Main Process                        ││
│  │  • Window Management               ││
│  │  • Native Dialogs                  ││
│  │  • Secure IPC                     ││
│  │  • Credential Storage            ││
│  │  • System Tray                   ││
│  │  • Global Shortcuts              ││
│  │  • Auto Updates                  ││
│  └─────────────────────────────────────┘│
│              ↑↓ IPC                     │
│  ┌─────────────────────────────────────┐│
│  │  Preload Script                    ││
│  │  • Context Bridge                 ││
│  │  • Whitelisted APIs              ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│       Renderer (Next.js)                 │
│  • React UI                            │
│  • Client-Side Logic                  │
│  • Web APIs                          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│        AgentOS Runtime                  │
│  • Providers, Roles, Tools            │
│  • Security, Execution             │
└─────────────────────────────────────────┘
```

## Component Details

### Main Process (`src/main/main.ts`)

The Electron main process handles:

1. **Window Management**
   - Create and manage main window
   - Track window bounds (resize/move)
   - Minimize/maximize/close operations
   - Multi-window support

2. **Native Dialogs**
   - Open Folder dialog
   - Open File dialog
   - Save File dialog
   - About dialog

3. **Application Menu**
   - File menu (open, save, new window)
   - Edit menu (undo, redo, cut, copy, paste)
   - View menu (reload, zoom, fullscreen)
   - Window menu (minimize, zoom)
   - Help menu (docs, report, about)

4. **System Tray**
   - Tray icon
   - Context menu
   - Click to show/hide

5. **Global Shortcuts**
   - CommandOrCtrl+Shift+A: Toggle window

6. **Settings Storage**
   - Window bounds
   - Last open folder
   - User preferences

7. **Logging**
   - electron-log integration
   - Error handling

### Preload Script (`src/preload/preload.ts`)

The preload script exposes whitelisted Electron APIs to the renderer:

```typescript
// Exposed APIs
{
  openFolder: () => Promise<string | null>,
  openFile: () => Promise<string | null>,
  saveFile: () => Promise<string | null>,
  readFile: (path: string) => Promise<string>,
  writeFile: (path: string, content: string) => Promise<void>,
  getPlatform: () => Promise<string>,
  getHomePath: () => Promise<string>,
  getAppPath: () => Promise<string>,
  getSetting: (key: string) => Promise<any>,
  setSetting: (key: string, value: any) => Promise<void>,
  showNotification: (title: string, body: string) => void,
}
```

### Security Model

- **Context Isolation**: Enabled
- **Node Integration**: Disabled
- **Sandbox**: Disabled (required for node-pty)
- **IPC**: Only whitelisted channels exposed

## File Structure

```
apps/desktop/
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.preload.json
├── src/
│   ├── main/
│   │   └── main.ts
│   └── preload/
│       └── preload.ts
├── build/
│   ├── icon.ico      (Windows)
│   ├── icon.icns     (macOS)
│   └── icon.png      (Linux)
└── release/              (generated)
    ├── win-unpacked/
    ├── mac/
    └── linux/
```

## Configuration

### electron-builder Configuration

The build process is configured in package.json:

```json
{
  "appId": "ai.agentos.studio",
  "productName": "AgentOS Studio",
  "win": { "target": "nsis" },
  "mac": { "target": "dmg" },
  "linux": { "target": "AppImage" }
}
```

## Build Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:desktop` | Run Electron in dev mode |
| `pnpm build:desktop` | Build TypeScript |
| `pnpm package:desktop` | Package for current OS |
| `pnpm package:desktop:win` | Package for Windows |
| `pnpm package:desktop:mac` | Package for macOS |
| `pnpm package:desktop:linux` | Package for Linux |

## Integration with Next.js

### Development Mode

In development, the Electron app loads from:

```
http://localhost:3000
```

### Production Mode

In production, the Electron app loads the built Next.js app:

```
apps/web/out/index.html
```

This requires first building the Next.js app:

```bash
pnpm build:web
pnpm build:desktop
pnpm package:desktop
```

## Native Capabilities

### Terminal (node-pty)

The terminal integration uses:

- `node-pty` for PTY management
- `xterm.js` for terminal rendering

These packages are listed as dependencies in `@agentos/web`.

### Credential Storage

Secure credential storage is handled via:

- `electron-store` for non-sensitive settings
- `keytar` for API keys (future enhancement)

## Auto Updates

Auto-update functionality is included via `electron-updater`.

Configuration:

```json
{
  "electronUpdater": {
    "provider": "github",
    "owner": "agentos",
    "repo": "agentos-studio"
  }
}
```

## Dependencies

### Runtime Dependencies

- `electron`: ^28.0.0
- `electron-log`: ^5.1.1
- `electron-store`: ^8.1.0
- `electron-updater`: ^6.1.7
- `keytar`: ^7.9.0 (for secure credentials)
- `node-pty`: ^1.0.0

### Build Dependencies

- `electron-builder`: ^24.9.1
- `typescript`: ^5.4.0

## Window Configuration

Default window settings:

```typescript
{
  minWidth: 900,
  minHeight: 600,
  defaultWidth: 1200,
  defaultHeight: 800,
  title: "AgentOS Studio"
}
```

## Performance Considerations

1. **Lazy Loading**: Next.js pages are loaded on-demand
2. **Context Isolation**: Prevents renderer from accessing Node APIs
3. **IPC Batching**: Multiple commands can be batched
4. **Window State**: Remembers last window position/size

## Troubleshooting

### Common Issues

1. **Icon not showing**: Check icon.ico exists in build folder
2. **Window not appearing**: Check electron-log output
3. **IPC failure**: Verify preload script loads correctly

### Logs

Logs are stored in:

- Windows: `%APPDATA%/agentos-studio/logs/`
- macOS: `~/Library/Logs/agentos-studio/`
- Linux: `~/.config/agentos-studio/logs/`

## Future Enhancements

1. **Deep Linking**: Support `agentos://` protocol
2. **Multiple Windows**: Agent workspace windows
3. **Tabs**: Tabbed interface
4. **Updater**: Full auto-update flow
5. **Crash Reporting**: Sentry integration