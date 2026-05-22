import { contextBridge, ipcRenderer } from "electron";

/**
 * Secure Electron API exposed to the renderer process.
 * All IPC calls go through contextBridge — no raw Node access.
 */
const api: Record<string, unknown> = {};

function onMethod(channel: string) {
  return (...args: any[]) => (ipcRenderer.invoke as any)(channel, ...args);
}

function onEvent(channel: string, callback: (payload: any) => void): () => void {
  const handler = (_event: any, payload: any) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// ── File Operations ──────────────────────────
api.readFile = onMethod("file:read");
api.writeFile = onMethod("file:write");
api.deleteFile = onMethod("file:delete");
api.renameFile = onMethod("file:rename");
api.readDirectory = onMethod("file:readDir");
api.createDirectory = onMethod("file:createDir");
api.fileExists = onMethod("file:exists");
api.getFileStats = onMethod("file:stats");
api.searchFiles = onMethod("file:search");

// ── File System Bridge ───────────────────────
api.fsReadFile = onMethod("fs:readFile");
api.fsWriteFile = onMethod("fs:writeFile");
api.fsOpenFolder = onMethod("fs:openFolder");
api.fsGetIndex = onMethod("fs:getIndex");
api.fsWatchFolder = onMethod("fs:watchFolder");
api.fsUnwatchFolder = onMethod("fs:unwatchFolder");
api.fsUnwatchAll = onMethod("fs:unwatchAll");
api.fsApplyPatch = onMethod("fs:applyPatch");
api.onFsWatchEvent = (cb: any) => onEvent("fs:watchEvent", cb);

// ── Dialogs ──────────────────────────────────
api.showOpenDialog = onMethod("dialog:open");
api.showSaveDialog = onMethod("dialog:save");
api.showMessageBox = onMethod("dialog:message");

// ── Terminal (PTY) ───────────────────────────
api.ptySpawn = onMethod("pty:spawn");
api.ptyWrite = onMethod("pty:write");
api.ptyResize = onMethod("pty:resize");
api.ptyKill = onMethod("pty:kill");
api.ptyKillAll = onMethod("pty:killAll");
api.ptyList = onMethod("pty:list");
api.ptyScrollback = onMethod("pty:scrollback");
api.ptyInfo = onMethod("pty:info");
api.onPtyData = (cb: any) => onEvent("pty:data", cb);
api.onPtyExit = (cb: any) => onEvent("pty:exit", cb);

// ── Credentials ──────────────────────────────
api.credentialSet = onMethod("credential:set");
api.credentialGet = onMethod("credential:get");
api.credentialDelete = onMethod("credential:delete");
api.credentialFind = onMethod("credential:find");

// ── Window Controls ──────────────────────────
api.minimizeWindow = () => ipcRenderer.send("window:minimize");
api.maximizeWindow = () => ipcRenderer.send("window:maximize");
api.closeWindow = () => ipcRenderer.send("window:close");
api.isMaximized = onMethod("window:isMaximized");

// ── App Info ─────────────────────────────────
api.getAppVersion = onMethod("app:version");
api.getPlatform = process.platform;
api.isElectron = true;

// ── Events (from main) ───────────────────────
api.onDeepLink = (cb: any) => onEvent("deep-link", cb);
api.onGlobalShortcut = (cb: any) => onEvent("global-shortcut", cb);
api.onMenuAction = (cb: any) => onEvent("menu:action", cb);

// ── Provider Operations ──────────────────────────
api.providerAdd = onMethod("provider:add");
api.providerList = onMethod("provider:list");
api.providerRemove = onMethod("provider:remove");
api.providerPing = onMethod("provider:ping");
api.providerStreamChat = onMethod("provider:streamChat");
api.onProviderChunk = (streamId: string, cb: any) => {
  const handler = (_event: any, data: any) => cb(data);
  ipcRenderer.on(`provider:chunk:${streamId}`, handler);
  return () => ipcRenderer.removeListener(`provider:chunk:${streamId}`, handler);
};
api.onProviderDone = (streamId: string, cb: any) => {
  const handler = () => cb();
  ipcRenderer.on(`provider:done:${streamId}`, handler);
  return () => ipcRenderer.removeListener(`provider:done:${streamId}`, handler);
};
api.onProviderError = (streamId: string, cb: any) => {
  const handler = (_event: any, data: any) => cb(data);
  ipcRenderer.on(`provider:error:${streamId}`, handler);
  return () => ipcRenderer.removeListener(`provider:error:${streamId}`, handler);
};

// ── Provider Health ──────────────────────────
api.getProviderHealth = onMethod("provider:getHealth");
api.onProviderHealthUpdate = (cb: any) => onEvent("provider:healthUpdate", cb);

// ── Auto-update ──────────────────────────────
api.onUpdateAvailable = (cb: any) => onEvent("update:available", cb);
api.onUpdateProgress = (cb: any) => onEvent("update:progress", cb);
api.onUpdateDownloaded = (cb: any) => onEvent("update:downloaded", cb);
api.installUpdate = () => ipcRenderer.send("update:install");

// ── Boot / Runtime ───────────────────────────
api.getBootStatus = onMethod("runtime:bootStatus");
api.onBootProgress = (cb: any) => onEvent("boot:progress", cb);
api.getRuntimeState = onMethod("runtime:state");
api.resetRuntime = onMethod("runtime:reset");
api.inspectRuntime = onMethod("runtime:inspect");

contextBridge.exposeInMainWorld("electronAPI", api);
