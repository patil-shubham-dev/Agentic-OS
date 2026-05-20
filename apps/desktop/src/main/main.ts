/**
 * AgentOS Studio - Desktop Application Main Process
 * 
 * This is the main Electron process that handles:
 * - Window management
 * - Native dialogs
 * - Secure IPC
 * - Credential storage
 * - Terminal (node-pty)
 * - Auto-updates
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  Tray,
  globalShortcut,
  nativeImage,
  Notification,
  shell,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import log from "electron-log";
import Store from "electron-store";

// Initialize logging
log.initialize();
log.transports.file.level = "info";
log.info("AgentOS Studio starting...");

// Initialize store for settings
const store = new Store({
  name: "agentos-settings",
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    lastOpenFolder: "",
    platform: process.platform,
  },
});

// Window reference
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// PTY process reference
let ptyProcess: any = null;

// Development mode check
const isDev = !app.isPackaged;

// Get resource path
function getResourcePath(relativePath: string): string {
  if (isDev) {
    return path.join(__dirname, "..", "..", relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

// Get preload script path
function getPreloadPath(): string {
  return path.join(__dirname, "..", "preload", "preload.js");
}

// Get icon path
function getIconPath(): string {
  const iconName = process.platform === "win32" ? "icon.ico" : "icon.png";
  return getResourcePath(path.join("build", iconName));
}

// Create main window
function createWindow(): void {
  const { width, height } = store.get("windowBounds") as { width: number; height: number };

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 900,
    minHeight: 600,
    title: "AgentOS Studio",
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for node-pty
    },
    show: false,
    backgroundColor: "#020617",
  });

  // Create application menu
  createMenu();

  // Load app
  if (isDev) {
    // Development: load from Next.js dev server
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built Next.js app
    mainWindow.loadFile(path.join(__dirname, "..", "..", "apps", "web", "out", "index.html"));
  }

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    log.info("Main window ready and shown");
  });

  // Save window bounds on resize
  mainWindow.on("resize", () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set("windowBounds", { width: bounds.width, height: bounds.height });
    }
  });

  // Handle window close
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  log.info("Main window created");
}

// Create application menu
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "AgentOS Studio",
      submenu: [
        { label: "About AgentOS Studio", role: "about" },
        { type: "separator" },
        { label: "Preferences...", accelerator: "CmdOrCtrl+,", click: () => sendToRenderer("open-settings") },
        { type: "separator" },
        { label: "Hide AgentOS Studio", role: "hide" },
        { label: "Hide Others", role: "hideOthers" },
        { label: "Show All", role: "unhide" },
        { type: "separator" },
        { label: "Quit AgentOS Studio", role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        { label: "Open Folder...", accelerator: "CmdOrCtrl+O", click: () => handleOpenFolder() },
        { label: "Open File...", accelerator: "CmdOrCtrl+Shift+O", click: () => handleOpenFile() },
        { type: "separator" },
        { label: "New Window", accelerator: "CmdOrCtrl+Shift+N", click: () => createWindow() },
        { type: "separator" },
        { label: "Close Window", role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", role: "undo" },
        { label: "Redo", role: "redo" },
        { type: "separator" },
        { label: "Cut", role: "cut" },
        { label: "Copy", role: "copy" },
        { label: "Paste", role: "paste" },
        { label: "Select All", role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", role: "reload" },
        { label: "Force Reload", role: "forceReload" },
        { label: "Toggle DevTools", role: "toggleDevTools" },
        { type: "separator" },
        { label: "Actual Size", role: "resetZoom" },
        { label: "Zoom In", role: "zoomIn" },
        { label: "Zoom Out", role: "zoomOut" },
        { type: "separator" },
        { label: "Toggle Fullscreen", role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { label: "Minimize", role: "minimize" },
        { label: "Zoom", role: "zoom" },
        { type: "separator" },
        { label: "Bring All to Front", role: "front" },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Documentation", click: () => shell.openExternal("https://docs.agentos.ai") },
        { label: "Report Issue", click: () => shell.openExternal("https://github.com/agentos/agentos/issues") },
        { type: "separator" },
        { label: "About", click: () => showAboutDialog() },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Create system tray
function createTray(): void {
  const iconPath = getIconPath();
  let trayIcon: Electron.NativeImage;

  try {
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
    } else {
      // Create a simple fallback icon
      trayIcon = nativeImage.createEmpty();
    }
    tray = new Tray(trayIcon);
  } catch (e) {
    log.error("Failed to create tray icon:", e);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show AgentOS Studio", click: () => mainWindow?.show() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setToolTip("AgentOS Studio");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow?.show();
  });

  log.info("System tray created");
}

// Register global shortcuts
function registerShortcuts(): void {
  // Toggle window visibility
  globalShortcut.register("CommandOrControl+Shift+A", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });

  log.info("Global shortcuts registered");
}

// IPC Handlers

// Dialog handlers
async function handleOpenFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
    title: "Open Folder",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const folderPath = result.filePaths[0];
  store.set("lastOpenFolder", folderPath);
  return folderPath;
}

async function handleOpenFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    title: "Open File",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function handleSaveFile(): Promise<string | null> {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: "Save File",
  });

  if (result.canceled) {
    return null;
  }

  return result.filePath || null;
}

// File operations
async function handleReadFile(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, "utf-8");
}

async function handleWriteFile(filePath: string, content: string): Promise<void> {
  fs.writeFileSync(filePath, content, "utf-8");
}

async function handleFileExists(filePath: string): Promise<boolean> {
  return fs.existsSync(filePath);
}

// Platform info
function getPlatform(): string {
  return process.platform;
}

function getHomePath(): string {
  return app.getPath("home");
}

function getAppPath(): string {
  return app.getPath("userData");
}

// Settings
function getSettings(key: string): any {
  return store.get(key);
}

function setSetting(key: string, value: any): void {
  store.set(key, value);
}

// Show notification
function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

// About dialog
function showAboutDialog(): void {
  dialog.showMessageBox(mainWindow!, {
    type: "info",
    title: "About AgentOS Studio",
    message: "AgentOS Studio",
    detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChrome: ${process.versions.chrome}`,
  });
}

// Send message to renderer
function sendToRenderer(channel: string, ...args: any[]): void {
  mainWindow?.webContents.send(channel, ...args);
}

// Register all IPC handlers
function registerIPCHandlers(): void {
  // Dialog handlers
  ipcMain.handle("dialog:openFolder", handleOpenFolder);
  ipcMain.handle("dialog:openFile", handleOpenFile);
  ipcMain.handle("dialog:saveFile", handleSaveFile);

  // File handlers
  ipcMain.handle("fs:readFile", handleReadFile);
  ipcMain.handle("fs:writeFile", handleWriteFile);
  ipcMain.handle("fs:exists", handleFileExists);

  // Platform handlers
  ipcMain.handle("app:getPlatform", getPlatform);
  ipcMain.handle("app:getHomePath", getHomePath);
  ipcMain.handle("app:getAppPath", getAppPath);

  // Settings handlers
  ipcMain.handle("settings:get", (_event, key: string) => getSettings(key));
  ipcMain.handle("settings:set", (_event, key: string, value: any) => setSetting(key, value));

  // Notification handler
  ipcMain.handle("notification:show", (_event, title: string, body: string) => showNotification(title, body));

  // Show about dialog
  ipcMain.handle("dialog:about", showAboutDialog);

  log.info("IPC handlers registered");
}

// App event handlers
app.on("ready", () => {
  log.info("App ready");
  registerIPCHandlers();
  createWindow();
  createTray();
  registerShortcuts();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  log.info("App quitting");
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  log.error("Uncaught exception:", error);
  dialog.showErrorBox("Error", `An unexpected error occurred: ${error.message}`);
});

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled rejection:", reason);
});

log.info("Main process initialized");