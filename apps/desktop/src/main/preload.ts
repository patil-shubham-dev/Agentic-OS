import { contextBridge, ipcRenderer } from "electron";

/**
 * Secure Electron API exposed to the renderer process.
 * All IPC calls go through contextBridge — no raw Node access.
 */
const electronAPI = {
  // ── File Operations ──────────────────────────
  readFile: (path: string) =>
    ipcRenderer.invoke("file:read", path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke("file:write", path, content),
  deleteFile: (path: string) =>
    ipcRenderer.invoke("file:delete", path),
  renameFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke("file:rename", oldPath, newPath),
  readDirectory: (dirPath: string) =>
    ipcRenderer.invoke("file:readDir", dirPath),
  createDirectory: (dirPath: string) =>
    ipcRenderer.invoke("file:createDir", dirPath),
  fileExists: (path: string) =>
    ipcRenderer.invoke("file:exists", path),
  getFileStats: (path: string) =>
    ipcRenderer.invoke("file:stats", path),
  searchFiles: (pattern: string, rootDir: string) =>
    ipcRenderer.invoke("file:search", pattern, rootDir),

  // ── File System Bridge (fs: prefix) ──────────
  fsReadFile: (path: string) =>
    ipcRenderer.invoke("fs:readFile", path),
  fsWriteFile: (path: string, content: string) =>
    ipcRenderer.invoke("fs:writeFile", path, content),
  fsOpenFolder: () =>
    ipcRenderer.invoke("fs:openFolder"),
  fsGetIndex: (rootPath: string) =>
    ipcRenderer.invoke("fs:getIndex", rootPath),
  fsWatchFolder: (folderPath: string) =>
    ipcRenderer.invoke("fs:watchFolder", folderPath),
  fsUnwatchFolder: (folderPath: string) =>
    ipcRenderer.invoke("fs:unwatchFolder", folderPath),
  fsApplyPatch: (filePath: string, patch: any) =>
    ipcRenderer.invoke("fs:applyPatch", filePath, patch),
  onFsWatchEvent: (callback: (payload: any) => void) => {
    const handler = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on("fs:watchEvent", handler);
    return () => ipcRenderer.removeListener("fs:watchEvent", handler);
  },

  // ── Dialogs ──────────────────────────────────
  showOpenDialog: (options: any) =>
    ipcRenderer.invoke("dialog:open", options),
  showSaveDialog: (options: any) =>
    ipcRenderer.invoke("dialog:save", options),
  showMessageBox: (options: any) =>
    ipcRenderer.invoke("dialog:message", options),

  // ── Terminal (PTY) ───────────────────────────
  ptySpawn: (id: string, cwd: string, cols: number, rows: number) =>
    ipcRenderer.invoke("pty:spawn", id, cwd, cols, rows),
  ptyWrite: (id: string, data: string) =>
    ipcRenderer.invoke("pty:write", id, data),
  ptyResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke("pty:resize", id, cols, rows),
  ptyKill: (id: string) =>
    ipcRenderer.invoke("pty:kill", id),
  onPtyData: (callback: (payload: { id: string; data: string }) => void) => {
    const handler = (_event: any, payload: { id: string; data: string }) =>
      callback(payload);
    ipcRenderer.on("pty:data", handler);
    return () => ipcRenderer.removeListener("pty:data", handler);
  },
  onPtyExit: (callback: (payload: { id: string; code: number }) => void) => {
    const handler = (_event: any, payload: { id: string; code: number }) =>
      callback(payload);
    ipcRenderer.on("pty:exit", handler);
    return () => ipcRenderer.removeListener("pty:exit", handler);
  },

  // ── Credentials (OS Keychain) ────────────────
  credentialSet: (service: string, account: string, password: string) =>
    ipcRenderer.invoke("credential:set", service, account, password),
  credentialGet: (service: string, account: string) =>
    ipcRenderer.invoke("credential:get", service, account),
  credentialDelete: (service: string, account: string) =>
    ipcRenderer.invoke("credential:delete", service, account),
  credentialFind: (service: string) =>
    ipcRenderer.invoke("credential:find", service),

  // ── Window Controls ──────────────────────────
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),

  // ── App Info ─────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  getPlatform: process.platform,
  isElectron: true,

  // ── Event listeners (from main) ──────────────
  onDeepLink: (callback: (url: string) => void) => {
    const handler = (_event: any, url: string) => callback(url);
    ipcRenderer.on("deep-link", handler);
    return () => ipcRenderer.removeListener("deep-link", handler);
  },
  onGlobalShortcut: (callback: (action: string) => void) => {
    const handler = (_event: any, action: string) => callback(action);
    ipcRenderer.on("global-shortcut", handler);
    return () => ipcRenderer.removeListener("global-shortcut", handler);
  },
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: any, action: string) => callback(action);
    ipcRenderer.on("menu:action", handler);
    return () => ipcRenderer.removeListener("menu:action", handler);
  },

  // ── Provider Operations ──────────────────────────
  providerAdd: (config: any) =>
    ipcRenderer.invoke("provider:add", config),
  providerList: () =>
    ipcRenderer.invoke("provider:list"),
  providerRemove: (id: string) =>
    ipcRenderer.invoke("provider:remove", id),
  providerPing: (id: string) =>
    ipcRenderer.invoke("provider:ping", id),
  providerStreamChat: (id: string, messages: any[], model: string) =>
    ipcRenderer.invoke("provider:streamChat", id, messages, model),
  onProviderChunk: (streamId: string, callback: (data: { text: string }) => void) => {
    const handler = (_event: any, data: { text: string }) => callback(data);
    ipcRenderer.on(`provider:chunk:${streamId}`, handler);
    return () => ipcRenderer.removeListener(`provider:chunk:${streamId}`, handler);
  },
  onProviderDone: (streamId: string, callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(`provider:done:${streamId}`, handler);
    return () => ipcRenderer.removeListener(`provider:done:${streamId}`, handler);
  },
  onProviderError: (streamId: string, callback: (data: { error: string }) => void) => {
    const handler = (_event: any, data: { error: string }) => callback(data);
    ipcRenderer.on(`provider:error:${streamId}`, handler);
    return () => ipcRenderer.removeListener(`provider:error:${streamId}`, handler);
  },

  // ── Provider Health ──────────────────────────
  getProviderHealth: () =>
    ipcRenderer.invoke("provider:getHealth"),
  onProviderHealthUpdate: (callback: (results: any[]) => void) => {
    const handler = (_event: any, results: any[]) => callback(results);
    ipcRenderer.on("provider:healthUpdate", handler);
    return () => ipcRenderer.removeListener("provider:healthUpdate", handler);
  },

  // ── Auto-update ──────────────────────────────
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on("update:available", handler);
    return () => ipcRenderer.removeListener("update:available", handler);
  },
  onUpdateProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },
  onUpdateDownloaded: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("update:downloaded", handler);
    return () => ipcRenderer.removeListener("update:downloaded", handler);
  },
  installUpdate: () => ipcRenderer.send("update:install"),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
