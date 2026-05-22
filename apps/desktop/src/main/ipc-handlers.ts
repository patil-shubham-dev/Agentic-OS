import { ipcMain, dialog, app, BrowserWindow } from "electron";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { TerminalManager } from "./terminal";
import {
  setCredential,
  getCredential,
  deleteCredential,
  findCredentials,
  setStoreValue,
  getStoreValue,
} from "./credentials";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import type { ChatMessage } from "./providers/ProviderClient";
import { DesktopRuntimeManager } from "./runtime-manager";
import { StoreManager } from "./store-manager";

const execAsync = promisify(exec);

const DEFAULT_SKIP_DIRS = new Set([".git", "node_modules", ".next", ".turbo", "dist", "build", ".cache", "__pycache__", ".vercel", ".svelte-kit", ".wrangler"]);
const DEFAULT_SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".otf", ".mp3", ".mp4", ".webm", ".wav", ".ogg", ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib", ".bin", ".wasm", ".map"]);
const MAX_INDEX_FILES = 50_000;
const MAX_INDEX_DEPTH = 12;

function parseGitignore(content: string): string[] {
  return content.split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.replace(/\/$/, "").replace(/^\/?/, ""));
}

function matchesIgnore(filePath: string, patterns: string[]): boolean {
  const relative = filePath.replace(/\\/g, "/");
  for (const p of patterns) {
    if (p.startsWith("*.") && relative.endsWith(p.slice(1))) return true;
    if (p.includes("/")) {
      if (relative === p || relative.startsWith(p + "/") || relative.includes("/" + p + "/")) return true;
    } else {
      if (relative.split("/").includes(p)) return true;
    }
  }
  return false;
}

async function loadGitignorePatterns(rootDir: string): Promise<string[]> {
  try {
    const content = await fsp.readFile(path.join(rootDir, ".gitignore"), "utf-8");
    return parseGitignore(content);
  } catch {
    return [];
  }
}

interface IpcRequestStats {
  total: number;
  completed: number;
  timedOut: number;
  active: Set<string>;
}

const ipcStats: IpcRequestStats = { total: 0, completed: 0, timedOut: 0, active: new Set() };

function wrapHandler<T>(channel: string, handler: (...args: any[]) => Promise<T> | T) {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<T> => {
    ipcStats.total++;
    const requestId = `${channel}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    ipcStats.active.add(requestId);
    try {
      const result = await Promise.race([
        (async () => handler(_event, ...args))(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`IPC timeout: ${channel}`)), 30_000)
        ),
      ]);
      ipcStats.completed++;
      return result;
    } catch (err: any) {
      if (err.message?.includes("IPC timeout")) {
        ipcStats.timedOut++;
      }
      throw err;
    } finally {
      ipcStats.active.delete(requestId);
    }
  };
}

/**
 * Registers all IPC handlers for the Electron main process.
 * Accepts the shared RuntimeManager for coordinated runtime access.
 */
export function registerIpcHandlers(runtimeManager: DesktopRuntimeManager): void {
  const terminalManager = new TerminalManager();
  const providerRegistry = runtimeManager.providerRegistry;
  const store = runtimeManager.store;

  // ────────────────────────────────────────────
  // IPC Request Stats
  // ────────────────────────────────────────────

  ipcMain.handle("_ipc-stats", () => {
    return {
      total: ipcStats.total,
      completed: ipcStats.completed,
      timedOut: ipcStats.timedOut,
      activeCount: ipcStats.active.size,
    };
  });

  // ────────────────────────────────────────────
  // Runtime Management
  // ────────────────────────────────────────────

  ipcMain.handle("runtime:bootStatus", wrapHandler("runtime:bootStatus", () => {
    return {
      phase: runtimeManager.bootPhase,
      booted: runtimeManager.booted,
      error: runtimeManager.safeMode ? null : null,
      safeMode: runtimeManager.safeMode,
    };
  }));

  ipcMain.handle("runtime:state", wrapHandler("runtime:state", () => {
    return {
      phase: runtimeManager.bootPhase,
      booted: runtimeManager.booted,
      bootError: null,
      safeMode: runtimeManager.safeMode,
      providers: providerRegistry.list(),
    };
  }));

  ipcMain.handle("runtime:reset", wrapHandler("runtime:reset", () => {
    runtimeManager.resetRuntime();
    return { success: true };
  }));

  // ────────────────────────────────────────────
  // File Operations
  // ────────────────────────────────────────────

  ipcMain.handle("file:read", async (_event, filePath: string) => {
    try {
      const resolved = path.resolve(filePath);
      const content = await fsp.readFile(resolved, "utf-8");
      return { success: true, content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    "file:write",
    async (_event, filePath: string, content: string) => {
      try {
        const resolved = path.resolve(filePath);
        await fsp.mkdir(path.dirname(resolved), { recursive: true });
        await fsp.writeFile(resolved, content, "utf-8");
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle("file:delete", async (_event, filePath: string) => {
    try {
      const resolved = path.resolve(filePath);
      await fsp.rm(resolved, { recursive: true, force: true });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    "file:rename",
    async (_event, oldPath: string, newPath: string) => {
      try {
        const resolvedOld = path.resolve(oldPath);
        const resolvedNew = path.resolve(newPath);
        await fsp.mkdir(path.dirname(resolvedNew), { recursive: true });
        await fsp.rename(resolvedOld, resolvedNew);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle("file:readDir", async (_event, dirPath: string) => {
    try {
      const resolved = path.resolve(dirPath);
      const entries = await fsp.readdir(resolved, { withFileTypes: true });
      const items = entries.map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDir: entry.isDirectory(),
        size: 0,
        modifiedAt: "",
      }));
      const withStats = await Promise.all(
        items.map(async (item) => {
          try {
            const stats = await fsp.stat(item.path);
            return {
              ...item,
              size: stats.size,
              modifiedAt: stats.mtime.toISOString(),
            };
          } catch {
            return item;
          }
        })
      );
      return { success: true, items: withStats };
    } catch (err: any) {
      return { success: false, error: err.message, items: [] };
    }
  });

  ipcMain.handle("file:createDir", async (_event, dirPath: string) => {
    try {
      const resolved = path.resolve(dirPath);
      await fsp.mkdir(resolved, { recursive: true });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("file:exists", async (_event, filePath: string) => {
    try {
      const resolved = path.resolve(filePath);
      await fsp.access(resolved);
      return { success: true, exists: true };
    } catch {
      return { success: true, exists: false };
    }
  });

  ipcMain.handle("file:stats", async (_event, filePath: string) => {
    try {
      const resolved = path.resolve(filePath);
      const stats = await fsp.stat(resolved);
      return {
        success: true,
        stats: {
          size: stats.size,
          isDir: stats.isDirectory(),
          isFile: stats.isFile(),
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    "file:search",
    async (_event, pattern: string, rootDir: string) => {
      try {
        const isWin = process.platform === "win32";
        const searchDir = rootDir ? path.resolve(rootDir) : process.cwd();
        const cmd = isWin
          ? `findstr /s /i /n "${pattern}" "${searchDir}\\*.*"`
          : `grep -rn -i "${pattern}" "${searchDir}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md" --include="*.css" --include="*.html" | head -200`;

        const { stdout } = await execAsync(cmd, {
          cwd: searchDir,
          shell: isWin ? "cmd.exe" : "/bin/bash",
          timeout: 15_000,
        });
        return { success: true, results: stdout.slice(0, 50_000) };
      } catch {
        return { success: true, results: "No matches found." };
      }
    }
  );

  // ────────────────────────────────────────────
  // Dialog Operations
  // ────────────────────────────────────────────

  ipcMain.handle("dialog:open", async (_event, options: any) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "openDirectory", "multiSelections"],
      ...options,
    });
    return result;
  });

  ipcMain.handle("dialog:save", async (_event, options: any) => {
    const result = await dialog.showSaveDialog(options);
    return result;
  });

  ipcMain.handle("dialog:message", async (_event, options: any) => {
    const result = await dialog.showMessageBox(options);
    return result;
  });

  // ────────────────────────────────────────────
  // Terminal (PTY)
  // ────────────────────────────────────────────

  ipcMain.handle(
    "pty:spawn",
    async (_event: Electron.IpcMainInvokeEvent, id: string, cwd: string, cols: number, rows: number) => {
      try {
        await terminalManager.spawn(id, cwd, cols, rows);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle(
    "pty:write",
    async (_event, id: string, data: string) => {
      try {
        terminalManager.write(id, data);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle(
    "pty:resize",
    async (_event, id: string, cols: number, rows: number) => {
      try {
        terminalManager.resize(id, cols, rows);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle("pty:kill", async (_event, id: string) => {
    try {
      terminalManager.kill(id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ────────────────────────────────────────────
  // Credential Storage (OS Keychain)
  // ────────────────────────────────────────────

  ipcMain.handle(
    "credential:set",
    async (_event, service: string, account: string, password: string) => {
      try {
        await setCredential(service, account, password);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle(
    "credential:get",
    async (_event, service: string, account: string) => {
      try {
        const password = await getCredential(service, account);
        return { success: true, password };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle(
    "credential:delete",
    async (_event, service: string, account: string) => {
      try {
        await deleteCredential(service, account);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle("credential:find", async (_event, service: string) => {
    try {
      const accounts = await findCredentials(service);
      return { success: true, accounts };
    } catch {
      return { success: true, accounts: [] };
    }
  });

  // ────────────────────────────────────────────
  // Window Controls
  // ────────────────────────────────────────────

  ipcMain.on("window:minimize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on("window:maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });

  ipcMain.on("window:close", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  ipcMain.handle("window:isMaximized", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isMaximized() ?? false;
  });

  // ────────────────────────────────────────────
  // App Info
  // ────────────────────────────────────────────

  ipcMain.handle("app:version", () => {
    return app.getVersion();
  });

  // ────────────────────────────────────────────
  // Provider Operations
  // ────────────────────────────────────────────

  ipcMain.handle(
    "provider:add",
    async (_event, config: {
      id: string;
      gatewayType: string;
      displayName: string;
      defaultModel: string;
      apiKey: string;
      baseUrl?: string;
      selectedModel: string;
    }) => {
      try {
        if (!config.selectedModel) {
          return { success: false, error: "A model must be selected for this provider." };
        }

        providerRegistry.add({
          id: config.id,
          gatewayType: config.gatewayType,
          displayName: config.displayName,
          defaultModel: config.defaultModel,
          baseUrl: config.baseUrl,
          enabled: true,
          selectedModel: config.selectedModel,
        });

        await setCredential("agentos-provider", config.id, config.apiKey);

        return { success: true, id: config.id };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle("provider:list", async () => {
    const configs = providerRegistry.list();
    const masked = await Promise.all(
      configs.map(async (c) => {
        const hasKey = await getCredential("agentos-provider", c.id);
        return { ...c, hasApiKey: !!hasKey };
      })
    );
    return masked;
  });

  ipcMain.handle("provider:remove", async (_event, id: string) => {
    try {
      providerRegistry.remove(id);
      await deleteCredential("agentos-provider", id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("provider:ping", wrapHandler("provider:ping", async (_event: Electron.IpcMainInvokeEvent, id: string) => {
    const apiKey = await getCredential("agentos-provider", id);
    if (!apiKey) return { ok: false, latency: 0, error: "No API key stored" };

    const client = providerRegistry.activate(id, apiKey);
    if (!client) return { ok: false, latency: 0, error: "Provider not found" };

    const start = performance.now();
    try {
      const ok = await client.ping();
      const latency = Math.round(performance.now() - start);
      return { ok, latency };
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      return { ok: false, latency, error: err.message || "Connection failed" };
    }
  }));

  ipcMain.handle(
    "provider:streamChat",
    wrapHandler("provider:streamChat", async (
      _event: Electron.IpcMainInvokeEvent,
      id: string,
      messages: ChatMessage[],
      model: string,
      tools?: Array<{ function: { name: string; description?: string; parameters?: Record<string, unknown> }; type: string }>
    ) => {
      const apiKey = await getCredential("agentos-provider", id);
      if (!apiKey) return { error: "No API key stored" };

      const client = providerRegistry.activate(id, apiKey);
      if (!client) return { error: "Provider not found" };

      const streamId = `provider:${id}:${Date.now()}`;
      const win = BrowserWindow.getFocusedWindow();

      (async () => {
        try {
          const gen = client.streamChat(messages, model, tools);
          for await (const chunk of gen) {
            if (win && !win.isDestroyed()) {
              // Forward structured StreamChunk (type/content/toolCall/done)
              win.webContents.send(`provider:chunk:${streamId}`, chunk);
            }
          }
          if (win && !win.isDestroyed()) {
            win.webContents.send(`provider:done:${streamId}`);
          }
        } catch (err: any) {
          if (win && !win.isDestroyed()) {
            win.webContents.send(`provider:error:${streamId}`, {
              error: err.message || "Stream failed",
            });
          }
        }
      })();

      return { streamId };
    })
  );

  // ────────────────────────────────────────────
  // Update Install
  // ────────────────────────────────────────────

  // ────────────────────────────────────────────
  // File System Bridge (fs: prefix)
  // ────────────────────────────────────────────

  const folderWatchers = new Map<string, fs.FSWatcher>();

  ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
    try {
      const resolved = path.resolve(filePath);
      const content = await fsp.readFile(resolved, "utf-8");
      return { success: true, content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:writeFile", async (_event, filePath: string, content: string) => {
    try {
      const resolved = path.resolve(filePath);
      await fsp.mkdir(path.dirname(resolved), { recursive: true });
      await fsp.writeFile(resolved, content, "utf-8");
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:openFolder", wrapHandler("fs:openFolder", async (_event: Electron.IpcMainInvokeEvent) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, path: null, tree: null };
      }
      const rootPath = result.filePaths[0];
      const gitignorePatterns = await loadGitignorePatterns(rootPath);

      async function buildTree(dir: string, depth: number = 0): Promise<any[]> {
        if (depth > MAX_INDEX_DEPTH) return [];
        const entries: any[] = [];
        try {
          const items = await fsp.readdir(dir, { withFileTypes: true });
          for (const item of items) {
            if (DEFAULT_SKIP_DIRS.has(item.name)) continue;
            if (matchesIgnore(path.join(dir, item.name).replace(rootPath, ""), gitignorePatterns)) continue;
            const fullPath = path.join(dir, item.name);
            if (DEFAULT_SKIP_EXT.has(path.extname(item.name).toLowerCase())) continue;
            if (item.isDirectory()) {
              const children = await buildTree(fullPath, depth + 1);
              entries.push({ name: item.name, path: fullPath, isDir: true, children });
            } else {
              try {
                const stat = await fsp.stat(fullPath);
                entries.push({ name: item.name, path: fullPath, isDir: false, size: stat.size, modifiedAt: stat.mtime.toISOString() });
              } catch {
                entries.push({ name: item.name, path: fullPath, isDir: false, size: 0, modifiedAt: "" });
              }
            }
          }
        } catch {}
        entries.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        return entries;
      }

      const tree = await buildTree(rootPath);
      return { success: true, path: rootPath, tree };
    } catch (err: any) {
      return { success: false, error: err.message, path: null, tree: null };
    }
  }));

  ipcMain.handle("fs:getIndex", wrapHandler("fs:getIndex", async (_event: Electron.IpcMainInvokeEvent, rootPath: string) => {
    try {
      const resolved = path.resolve(rootPath);
      const gitignorePatterns = await loadGitignorePatterns(resolved);
      const files: { name: string; path: string; ext: string; size: number; modifiedAt: string }[] = [];
      let fileCount = 0;

      async function walk(dir: string, depth: number = 0): Promise<void> {
        if (depth > MAX_INDEX_DEPTH || fileCount >= MAX_INDEX_FILES) return;
        try {
          const items = await fsp.readdir(dir, { withFileTypes: true });
          for (const item of items) {
            if (fileCount >= MAX_INDEX_FILES) return;
            if (DEFAULT_SKIP_DIRS.has(item.name)) continue;
            if (matchesIgnore(path.join(dir, item.name).replace(resolved, ""), gitignorePatterns)) continue;
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
              await walk(fullPath, depth + 1);
            } else {
              if (DEFAULT_SKIP_EXT.has(path.extname(item.name).toLowerCase())) continue;
              try {
                const stat = await fsp.stat(fullPath);
                files.push({
                  name: item.name,
                  path: fullPath,
                  ext: path.extname(item.name).toLowerCase(),
                  size: stat.size,
                  modifiedAt: stat.mtime.toISOString(),
                });
                fileCount++;
              } catch {}
            }
          }
        } catch {}
      }

      await walk(resolved);
      return { success: true, files };
    } catch (err: any) {
      return { success: false, error: err.message, files: [] };
    }
  }));

  ipcMain.handle("fs:watchFolder", async (_event, folderPath: string) => {
    try {
      const resolved = path.resolve(folderPath);
      const existing = folderWatchers.get(resolved);
      if (existing) {
        existing.close();
        folderWatchers.delete(resolved);
      }

      const watcher = fs.watch(resolved, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const fullPath = path.join(resolved, filename.toString());
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send("fs:watchEvent", {
              eventType,
              path: fullPath,
              relativePath: filename.toString().replace(/\\/g, "/"),
            });
          }
        }
      });

      folderWatchers.set(resolved, watcher);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:unwatchFolder", async (_event, folderPath: string) => {
    try {
      const resolved = path.resolve(folderPath);
      const watcher = folderWatchers.get(resolved);
      if (watcher) {
        watcher.close();
        folderWatchers.delete(resolved);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:applyPatch", async (_event, filePath: string, patch: { oldString?: string; newString?: string; oldContent?: string; newContent?: string }) => {
    try {
      const resolved = path.resolve(filePath);
      let currentContent: string;
      try {
        currentContent = await fsp.readFile(resolved, "utf-8");
      } catch {
        currentContent = "";
      }

      if (patch.oldString !== undefined && patch.newString !== undefined) {
        const idx = currentContent.indexOf(patch.oldString);
        if (idx === -1) {
          return { success: false, error: "Patch target string not found in file" };
        }
        currentContent = currentContent.replace(patch.oldString, patch.newString);
      } else if (patch.newContent !== undefined) {
        currentContent = patch.newContent;
      } else {
        return { success: false, error: "Invalid patch format" };
      }

      await fsp.writeFile(resolved, currentContent, "utf-8");
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ────────────────────────────────────────────
  // PTY Inspection (for runtime diagnostics)
  // ────────────────────────────────────────────

  ipcMain.handle("pty:list", wrapHandler("pty:list", () => {
    return terminalManager.listSessions();
  }));

  ipcMain.handle("pty:scrollback", wrapHandler("pty:scrollback", (_event: Electron.IpcMainInvokeEvent, id: string, maxLines?: number) => {
    return terminalManager.getScrollback(id, maxLines);
  }));

  ipcMain.handle("pty:info", wrapHandler("pty:info", (_event: Electron.IpcMainInvokeEvent, id: string) => {
    return terminalManager.getSessionInfo(id);
  }));

  ipcMain.handle("pty:killAll", wrapHandler("pty:killAll", () => {
    terminalManager.killAll();
    return { success: true };
  }));

  // ────────────────────────────────────────────
  // Runtime Inspection
  // ────────────────────────────────────────────

  ipcMain.handle("runtime:inspect", wrapHandler("runtime:inspect", () => {
    return {
      bootPhase: runtimeManager.bootPhase,
      booted: runtimeManager.booted,
      safeMode: runtimeManager.safeMode,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      providers: providerRegistry.list().length,
      sessions: terminalManager.listSessions().length,
    };
  }));

  // ────────────────────────────────────────────
  // File Watcher Cleanup
  // ────────────────────────────────────────────

  ipcMain.handle("fs:unwatchAll", wrapHandler("fs:unwatchAll", () => {
    let count = 0;
    for (const [path, watcher] of folderWatchers) {
      watcher.close();
      folderWatchers.delete(path);
      count++;
    }
    return { success: true, count };
  }));

  // ────────────────────────────────────────────
  // Provider Health
  // ────────────────────────────────────────────

  ipcMain.handle("provider:getHealth", wrapHandler("provider:getHealth", async () => {
    return runtimeManager.getCachedProviderHealth();
  }));

  ipcMain.on("update:install", () => {
    try {
      const { installUpdate } = require("./updater");
      installUpdate();
    } catch (err: any) {
      console.error("[Desktop] Failed to install update:", err.message);
    }
  });
}
