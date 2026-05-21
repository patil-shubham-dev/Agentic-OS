import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  shell,
  globalShortcut,
} from "electron";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";
import { registerIpcHandlers } from "./ipc-handlers";
import { setupAutoUpdater } from "./updater";
import { buildAppMenu } from "./menu";
import { getStoreValue, setStoreValue } from "./credentials";

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let nextServer: ChildProcess | null = null;

const isDev = !app.isPackaged;
const WEB_DEV_URL = process.env.AGENTOS_WEB_URL || "http://localhost:3000";
const WEB_PROD_PORT = 3001; // Use different port in prod to avoid conflicts
function getWebUrl(): string {
  if (isDev) return WEB_DEV_URL;
  return `http://localhost:${WEB_PROD_PORT}`;
}

// ──────────────────────────────────────────────
// Production Next.js Server
// ──────────────────────────────────────────────

function startNextServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    // In production, the Next.js app is bundled at resourcesPath/web
    const resourcesPath =
      (process as any).resourcesPath || path.join(__dirname, "../../");
    const webDir = path.join(resourcesPath, "web");
    const serverJsPath = path.join(webDir, "apps/web/server.js");

    console.log(`[Desktop] Starting Next.js standalone server from: ${serverJsPath}`);

    nextServer = spawn(process.execPath, [serverJsPath], {
      cwd: path.join(webDir, "apps/web"),
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        PORT: String(WEB_PROD_PORT),
      },
    });

    let started = false;
    let pollInterval: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const handleSuccess = (url: string) => {
      if (!started) {
        started = true;
        cleanup();
        resolve(url);
      }
    };

    const handleFailure = (err: Error) => {
      if (!started) {
        cleanup();
        reject(err);
      }
    };

    nextServer.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      console.log(`[Next.js] ${text.trim()}`);
      if (!started && (
        text.toLowerCase().includes("ready") ||
        text.includes("Local:") ||
        text.includes("localhost:") ||
        text.includes("http://localhost:")
      )) {
        handleSuccess(`http://localhost:${WEB_PROD_PORT}`);
      }
    });

    nextServer.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text && !text.includes("ExperimentalWarning")) {
        console.error(`[Next.js] ${text}`);
      }
    });

    nextServer.on("error", (err: Error) => {
      handleFailure(err);
    });

    nextServer.on("exit", (code: number | null) => {
      console.log(`[Next.js] exited with code ${code}`);
      if (!started) {
        handleFailure(new Error(`Next.js exited before ready (code: ${code})`));
      }
    });

    // Polling fallback check
    pollInterval = setInterval(async () => {
      if (started) return;
      try {
        const res = await fetch(`http://localhost:${WEB_PROD_PORT}`, { signal: AbortSignal.timeout(1000) });
        if (res.ok || res.status === 404) {
          handleSuccess(`http://localhost:${WEB_PROD_PORT}`);
        }
      } catch {
        // Not ready yet
      }
    }, 1000);

    // Timeout after 30 seconds
    timeoutId = setTimeout(() => {
      if (!started) {
        handleFailure(new Error("Next.js server did not become ready within 30s"));
      }
    }, 30_000);
  });
}

// ──────────────────────────────────────────────
// Window
// ──────────────────────────────────────────────

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "AgentOS Studio",
    icon: path.join(__dirname, "../../resources/icon.png"),
    backgroundColor: "#1C1C1E",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !isDev,
    },
  });

  // Restore last window state
  const savedState = loadWindowState();
  if (savedState) {
    win.setBounds(savedState);
  }

  win.once("ready-to-show", () => {
    win.show();
    if (savedState?.maximized) win.maximize();
  });

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Save window state on resize/move
  win.on("resize", saveWindowStateDebounced);
  win.on("move", saveWindowStateDebounced);

  win.on("close", (e: Electron.Event) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // Load content — in production, start Next.js server first
  if (isDev) {
    win.loadURL(WEB_DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const url = await startNextServer();
    win.loadURL(url);
  }

  mainWindow = win;
  return win;
}

// ──────────────────────────────────────────────
// Window State Persistence
// ──────────────────────────────────────────────

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

function loadWindowState(): WindowState | null {
  try {
    const raw = getStoreValue("window-state", "local");
    return raw ? (JSON.parse(raw) as WindowState) : null;
  } catch {
    return null;
  }
}

function saveWindowState(): void {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    const state: WindowState = {
      ...bounds,
      maximized: mainWindow.isMaximized(),
    };
    setStoreValue("window-state", JSON.stringify(state), "local");
  } catch {
    // Silently fail — window state is non-critical
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function saveWindowStateDebounced(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveWindowState, 500);
}

// ──────────────────────────────────────────────
// Tray
// ──────────────────────────────────────────────

function createTray(): void {
  const iconPath = path.join(__dirname, "../../resources/icon.png");
  let trayImage: Electron.NativeImage;
  try {
    trayImage = nativeImage.createFromPath(iconPath);
    trayImage = trayImage.resize({ width: 16, height: 16 });
  } catch {
    return; // No icon available
  }

  tray = new Tray(trayImage);
  tray.setToolTip("AgentOS Studio");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show AgentOS Studio",
      click: () => mainWindow?.show(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => mainWindow?.show());
}

// ──────────────────────────────────────────────
// Deep Linking (agentos:// protocol)
// ──────────────────────────────────────────────

function handleDeepLink(url: string): void {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.webContents.send("deep-link", url);
}

// ──────────────────────────────────────────────
// App Lifecycle
// ──────────────────────────────────────────────

app.setAsDefaultProtocolClient("agentos");

app.on("open-url", (_event: Electron.Event, url: string) => {
  handleDeepLink(url);
});

// Second instance handling (Windows deep links)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event: Electron.Event, argv: string[]) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    // Handle deep link from second instance args
    const deepLink = argv.find((arg: string) => arg.startsWith("agentos://"));
    if (deepLink) handleDeepLink(deepLink);
  });
}

app.whenReady().then(async () => {
  // Register IPC handlers
  const { providerRegistry } = registerIpcHandlers();

  // Start provider health monitor
  const { ProviderHealthMonitor } = require("./providers/ProviderHealthMonitor");
  const healthMonitor = new ProviderHealthMonitor(providerRegistry);
  healthMonitor.start();

  // Build native menu
  const menu = buildAppMenu(() => mainWindow);
  Menu.setApplicationMenu(menu);

  // Create main window (handles server startup internally in production)
  try {
    await createWindow();
  } catch (err: any) {
    console.error("[Desktop] Failed to create window:", err.message);
    // In production, show an error dialog
    if (!isDev) {
      const { dialog: dl } = require("electron");
      dl.showErrorBox(
        "AgentOS Studio - Startup Error",
        `Failed to start the application:\n\n${err.message}\n\nPlease try reinstalling or check the logs.`
      );
    }
    app.exit(1);
    return;
  }

  // Tray (skip in dev for simplicity)
  if (!isDev) {
    createTray();
  }

  // Auto-updater (production only)
  if (!isDev) {
    setupAutoUpdater(mainWindow!);
  }

  // Global shortcuts
  globalShortcut.register("CommandOrControl+Shift+P", () => {
    mainWindow?.webContents.send("global-shortcut", "command-palette");
  });

  // macOS: re-create window on activate
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (!mainWindow && !isQuitting) {
        createWindow().catch((err: Error) => {
          console.error("[Desktop] Failed to create window:", err.message);
        });
      }
    } else {
      mainWindow?.show();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (nextServer) {
    nextServer.kill();
    nextServer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
