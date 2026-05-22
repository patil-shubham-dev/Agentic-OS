import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  shell,
  globalShortcut,
  dialog,
} from "electron";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";
import { registerIpcHandlers } from "./ipc-handlers";
import { setupAutoUpdater } from "./updater";
import { getStoreValue, setStoreValue } from "./credentials";
import { DesktopRuntimeManager } from "./runtime-manager";
import { StoreManager } from "./store-manager";
import { TerminalManager } from "./terminal";

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let nextServer: ChildProcess | null = null;
let cleanupTimers: Array<ReturnType<typeof setInterval>> = [];
let fileWatcherCount = 0;
const MAX_FILE_WATCHERS = 20;

const isDev = !app.isPackaged;
const WEB_DEV_URL = process.env.AGENTOS_WEB_URL || "http://localhost:3000";
const WEB_PROD_PORT = 3001;

function getWebUrl(): string {
  if (isDev) return WEB_DEV_URL;
  return `http://localhost:${WEB_PROD_PORT}`;
}

// Shared runtime manager — single source of truth for desktop runtime
let runtimeManager: DesktopRuntimeManager;

// ──────────────────────────────────────────────
// Production Next.js Server
// ──────────────────────────────────────────────

function loadEnvFile(envPath: string): Record<string, string> {
  try {
    const fs = require("fs");
    const content = fs.readFileSync(envPath, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key) vars[key] = val;
    }
    return vars;
  } catch {
    return {};
  }
}

function startNextServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const resourcesPath =
      (process as any).resourcesPath || path.join(__dirname, "../../../");
    const webDir = path.join(resourcesPath, "web");
    const serverDir = path.join(webDir, "apps/web");
    const serverJsPath = path.join(serverDir, "server.js");
    const envPath = path.join(serverDir, ".env");

    try {
      const fs = require("fs");
      if (!fs.existsSync(serverJsPath)) {
        reject(new Error(`Server script not found at: ${serverJsPath}`));
        return;
      }
    } catch { /* ignore */ }

    const envVars = loadEnvFile(envPath);
    const missingRequired = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AGENTOS_ENCRYPTION_KEY"]
      .filter((key) => !envVars[key] && !process.env[key]);
    if (missingRequired.length > 0) {
      console.warn(`[Desktop] Missing required env vars: ${missingRequired.join(", ")}`);
    }

    const childEnv: Record<string, string> = {
      ...process.env,
      ...envVars,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(WEB_PROD_PORT),
    };

    console.log(`[Desktop] Starting Next.js standalone server from: ${serverJsPath}`);

    nextServer = spawn(process.execPath, [serverJsPath], {
      cwd: serverDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnv,
    });

    let started = false;
    let stderrLog = "";
    let timeoutId: NodeJS.Timeout | null = null;
    let pollTimer: NodeJS.Timeout | null = null;
    let apiPollTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (apiPollTimer) { clearInterval(apiPollTimer); apiPollTimer = null; }
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
    };

    const handleSuccess = (url: string) => {
      if (!started) { started = true; cleanup(); resolve(url); }
    };

    const handleFailure = (err: Error) => {
      if (!started) { cleanup(); reject(err); }
    };

    nextServer.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      console.log(`[Next.js] ${text.trim()}`);
      if (!started && (
        text.toLowerCase().includes("ready") ||
        text.includes("Local:") ||
        text.includes("localhost:")
      )) {
        handleSuccess(`http://localhost:${WEB_PROD_PORT}`);
      }
    });

    nextServer.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text && !text.includes("ExperimentalWarning")) {
        stderrLog += text + "\n";
        console.error(`[Next.js] ${text}`);
      }
    });

    nextServer.on("error", (err: Error) => {
      handleFailure(err);
    });

    nextServer.on("exit", (code: number | null) => {
      console.log(`[Next.js] exited with code ${code}`);
      if (!started) {
        const details = stderrLog ? `\n\nStderr:\n${stderrLog.slice(0, 2000)}` : "";
        handleFailure(new Error(`Next.js exited before ready (code: ${code})${details}`));
      }
    });

    const checkApiHealth = async (): Promise<boolean> => {
      try {
        const res = await fetch(`http://localhost:${WEB_PROD_PORT}/api/setup/status`, {
          signal: AbortSignal.timeout(3000),
        });
        const text = await res.text();
        if (text.trim().startsWith("{")) {
          return true;
        }
        console.warn(`[Desktop] API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 100)}`);
        return false;
      } catch {
        return false;
      }
    };

    pollTimer = setInterval(async () => {
      if (started) return;
      try {
        const res = await fetch(`http://localhost:${WEB_PROD_PORT}`, { signal: AbortSignal.timeout(1000) });
        if (res.ok || res.status === 404) {
          handleSuccess(`http://localhost:${WEB_PROD_PORT}`);
        }
      } catch { /* not ready */ }
    }, 1000);

    apiPollTimer = setInterval(async () => {
      if (started) return;
      const healthy = await checkApiHealth();
      if (healthy) {
        handleSuccess(`http://localhost:${WEB_PROD_PORT}`);
      }
    }, 2000);

    timeoutId = setTimeout(() => {
      if (!started) {
        cleanup();
        const details = stderrLog ? `\n\nLast stderr output:\n${stderrLog.slice(0, 2000)}` : "";
        handleFailure(new Error(`Next.js server did not become ready within 60s${details}`));
      }
    }, 60_000);
  });
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

let windowStateStore: StoreManager;

function loadWindowState(): WindowState | null {
  try {
    const raw = windowStateStore.get<string>("bounds");
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
    windowStateStore.set("bounds", JSON.stringify(state));
  } catch {
    // Silently fail
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function saveWindowStateDebounced(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveWindowState, 500);
}

// ──────────────────────────────────────────────
// Window Creation
// ──────────────────────────────────────────────

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "AgentOS Studio",
    icon: path.join(__dirname, "../../resources/icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#0C0C0E",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !isDev,
    },
  });

  // Register window with runtime manager for boot progress events
  runtimeManager.registerWindow(win);

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

  win.on("resize", saveWindowStateDebounced);
  win.on("move", saveWindowStateDebounced);

  win.on("close", (e: Electron.Event) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // Start desktop runtime boot sequence
  // Renderer will show boot screen via the boot:progress events
  runtimeManager.boot().catch((err) => {
    console.error("[Desktop] Runtime boot failed:", err);
  });

  // Load content
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
// Tray
// ──────────────────────────────────────────────

function createTray(): void {
  const iconPath = path.join(__dirname, "../../resources/icon.png");
  let trayImage: Electron.NativeImage;
  try {
    trayImage = nativeImage.createFromPath(iconPath);
    trayImage = trayImage.resize({ width: 16, height: 16 });
  } catch {
    return;
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
// Deep Linking
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
    const deepLink = argv.find((arg: string) => arg.startsWith("agentos://"));
    if (deepLink) handleDeepLink(deepLink);
  });
}

// ──────────────────────────────────────────────
// Memory Leak Prevention
// ──────────────────────────────────────────────

function registerCleanupTimer(timer: ReturnType<typeof setInterval>): void {
  cleanupTimers.push(timer);
}

function clearAllTimers(): void {
  for (const t of cleanupTimers) clearInterval(t);
  cleanupTimers = [];
}

// Periodic memory pressure check — every 5 minutes
registerCleanupTimer(setInterval(() => {
  const mem = process.memoryUsage();
  if (mem.heapUsed > 1.5 * 1024 * 1024 * 1024) {
    console.warn(`[Desktop] High memory usage: ${(mem.heapUsed / 1024 / 1024 / 1024).toFixed(1)}GB — forcing GC`);
    if (global.gc) global.gc();
  }
  if (fileWatcherCount > MAX_FILE_WATCHERS) {
    console.warn(`[Desktop] Too many file watchers: ${fileWatcherCount} — triggering cleanup`);
    fileWatcherCount = 0;
  }
}, 300_000));

app.whenReady().then(async () => {
  // Initialize desktop runtime manager (owns providers, stores, boot lifecycle)
  runtimeManager = new DesktopRuntimeManager();

  // Initialize window state store
  windowStateStore = new StoreManager({ name: "agentos-window-state" });

  // Register all IPC handlers with shared runtime
  registerIpcHandlers(runtimeManager);

  // Start provider health monitor
  const { ProviderHealthMonitor } = require("./providers/ProviderHealthMonitor");
  const healthMonitor = new ProviderHealthMonitor(runtimeManager.providerRegistry);
  healthMonitor.start();

  // Remove native menu bar
  Menu.setApplicationMenu(null);

  // Create window — runtime boot starts in the background
  try {
    await createWindow();
  } catch (err: any) {
    console.error("[Desktop] Failed to create window:", err.message);
    if (!isDev) {
      dialog.showErrorBox(
        "AgentOS Studio - Startup Error",
        `Failed to start the application:\n\n${err.message}\n\nPlease try reinstalling or check the logs.`
      );
    }
    app.exit(1);
    return;
  }

  if (!isDev) {
    createTray();
    setupAutoUpdater(mainWindow!);
  }

  globalShortcut.register("CommandOrControl+Shift+P", () => {
    mainWindow?.webContents.send("global-shortcut", "command-palette");
  });

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

  clearAllTimers();

  if (runtimeManager) {
    runtimeManager.shutdown();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    saveWindowState();
    mainWindow.destroy();
    mainWindow = null;
  }

  if (nextServer) {
    try { nextServer.kill(); } catch {}
    nextServer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
