/**
 * AgentOS Studio - Preload Script
 * 
 * This script runs in the renderer process and securely exposes
 * selected Electron APIs to the Next.js frontend.
 * 
 * Security: Only expose approved APIs through contextBridge
 */

import { contextBridge, ipcRenderer } from "electron";

// Define the API exposed to the renderer
const electronAPI = {
  // Dialog operations
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  saveFile: () => ipcRenderer.invoke("dialog:saveFile"),
  showAbout: () => ipcRenderer.invoke("dialog:about"),

  // File system operations
  readFile: (path: string) => ipcRenderer.invoke("fs:readFile", path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke("fs:writeFile", path, content),
  fileExists: (path: string) => ipcRenderer.invoke("fs:exists", path),

  // Platform info
  getPlatform: () => ipcRenderer.invoke("app:getPlatform"),
  getHomePath: () => ipcRenderer.invoke("app:getHomePath"),
  getAppPath: () => ipcRenderer.invoke("app:getAppPath"),

  // Settings storage
  getSetting: (key: string) => ipcRenderer.invoke("settings:get", key),
  setSetting: (key: string, value: any) => ipcRenderer.invoke("settings:set", key, value),

  // Notifications
  showNotification: (title: string, body: string) => ipcRenderer.invoke("notification:show", title, body),

  // Event listeners
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on("open-settings", callback);
    return () => ipcRenderer.removeListener("open-settings", callback);
  },

  onTerminalData: (callback: (data: string) => void) => {
    ipcRenderer.on("terminal:data", (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners("terminal:data");
  },

  // Terminal operations
  terminalWrite: (data: string) => ipcRenderer.send("terminal:write", data),
  terminalResize: (cols: number, rows: number) => ipcRenderer.send("terminal:resize", cols, rows),
  terminalCreate: () => ipcRenderer.invoke("terminal:create"),
  terminalDispose: () => ipcRenderer.invoke("terminal:dispose"),
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}

console.log("AgentOS preload script loaded");