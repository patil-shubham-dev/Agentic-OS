# AgentOS Studio — Desktop Application Architecture

## Overview

AgentOS Studio runs as a **native desktop application** built on **Electron** + **Next.js**. The Next.js frontend runs inside an Electron `BrowserWindow`, with backend operations routed through a **secure IPC bridge** rather than HTTP API calls.

```
┌─────────────────────────────────────────────────────────┐
│                  Electron Main Process                    │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌───────────┐  │
│  │ Window   │  │ IPC      │  │ Menu   │  │ Auto-     │  │
│  │ Manager  │  │ Handlers │  │ Builder│  │ Updater   │  │
│  └──────────┘  └──────────┘  └────────┘  └───────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐            │
│  │ Tray     │  │ Terminal │  │ Credentials   │            │
│  │ Manager  │  │ (node-pty)│  │ (keytar)      │            │
│  └──────────┘  └──────────┘  └──────────────┘            │
├─────────────────────────────────────────────────────────┤
│                  Preload (contextBridge)                   │
│           Secure API surface for the renderer              │
├─────────────────────────────────────────────────────────┤
│                  BrowserWindow (Renderer)                  │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Next.js Application                    │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────────┐ │    │
│  │  │ Chat   │ │ Monaco │ │ File   │ │ Xterm.js  │ │    │
│  │  │ Panel  │ │ Editor │ │Explorer│ │ Terminal  │ │    │
│  │  └────────┘ └────────┘ └────────┘ └───────────┘ │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
apps/desktop/
├── package.json              # Electron deps + scripts
├── tsconfig.json              # TypeScript config (CommonJS)
├── electron-builder.yml       # Packaging configuration
├── resources/
│   ├── icon.png               # App icon (all platforms)
│   └── entitlements.mac.plist # macOS hardened runtime
├── scripts/
│   ├── dev.mjs               # Dev launcher (Next.js + Electron)
│   └── build-web.mjs         # Build Next.js for packaging
└── src/
    └── main/
        ├── index.ts           # Main entry: window, lifecycle
        ├── preload.ts         # contextBridge API surface
        ├── ipc-handlers.ts    # All IPC handlers
        ├── terminal.ts        # node-pty manager
        ├── credentials.ts     # keytar + local JSON store
        ├── menu.ts            # Native menu builder
        └── updater.ts         # Auto-update module
```

## Development vs. Production

| Aspect | Development | Production |
|--------|-----------|------------|
| **Next.js** | `next dev --turbo` (hot reload) | Pre-built `.next` output |
| **Electron loads** | `http://localhost:3000` | `file://.../.next/server/app/index.html` |
| **DevTools** | Auto-opens | Hidden |
| **Tray icon** | Disabled | Enabled |
| **Auto-updater** | Skipped | Enabled |
| **Window state** | Persisted | Persisted |

## IPC Bridge

The IPC bridge uses Electron's `contextBridge` with `contextIsolation: true` and `nodeIntegration: false`. The renderer has zero direct Node.js access.

### File Operations

```
Renderer → contextBridge → ipcRenderer.invoke → ipcMain.handle → fs/promises
```

**Exposed operations:**
- `readFile`, `writeFile`, `deleteFile`, `renameFile`
- `readDirectory`, `createDirectory`
- `fileExists`, `getFileStats`
- `searchFiles`

### Terminal (PTY)

```
Renderer → contextBridge → ipcRenderer.invoke → ipcMain.handle → node-pty
                                                         ↓
                                              pty:data (event)
                                              pty:exit (event)  → Renderer
```

**Exposed operations:**
- `ptySpawn`, `ptyWrite`, `ptyResize`, `ptyKill`
- `onPtyData`, `onPtyExit` (event listeners)

### Credential Storage

```
Renderer → contextBridge → ipcRenderer.invoke → ipcMain.handle → keytar
                                                                   ↓
                                                          OS Keychain:
                                                          - Windows Credential Manager
                                                          - macOS Keychain
                                                          - Linux Secret Service
```

**Fallback:** When `keytar` is unavailable, credentials are stored in a base64-encoded local JSON file at `<userData>/agentos-store.json`.

**Exposed operations:**
- `credentialSet`, `credentialGet`, `credentialDelete`, `credentialFind`

### Dialogs

Native OS dialogs via Electron's `dialog` module. Browser fallback uses HTML `<input>` elements.

**Exposed operations:**
- `showOpenDialog`, `showSaveDialog`, `showMessageBox`

## Window State Persistence

Window bounds and maximized state are saved to `agentos-store.json` on resize/move and restored on launch.

## Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+P` | Open Command Palette |
| `Cmd/Ctrl+B` | Toggle Sidebar |
| `Cmd/Ctrl+` ` | Toggle Terminal |
| `Cmd/Ctrl+O` | Open Folder |
| `Cmd/Ctrl+N` | New File |
| `Cmd/Ctrl+S` | Save File |
| `Cmd/Ctrl+W` | Close Tab |
| `Cmd/Ctrl+,` | Open Settings |

## Deep Linking

The app registers the `agentos://` protocol handler. On Windows, `app.setAsDefaultProtocolClient` is used. On macOS, the `open-url` event is handled.

## Build Pipeline

```
next build (web app)
       ↓
tsc (compile Electron TypeScript → dist/)
       ↓
electron-builder (package → out/)
       ↓
Installers:
  - Windows: .exe (NSIS)
  - macOS: .dmg + .zip
  - Linux: .AppImage + .deb
```

## Native Capabilities vs. Browser Fallback

| Capability | Electron (Native) | Browser (Fallback) |
|-----------|------------------|-------------------|
| File system | `fs/promises` via IPC | HTTP API routes |
| Terminal | `node-pty` via IPC | HTTP + SSE |
| Credentials | OS Keychain (`keytar`) | HTTP API + encrypted DB |
| Dialogs | Electron `dialog` | HTML `<input>` elements |
| Notifications | Electron `Notification` | Web Notification API |
| Drag & drop | Native file paths | Web DataTransfer API |
| Auto-updates | `electron-updater` | Not available |
