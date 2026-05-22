import { BrowserWindow } from "electron";
import type { IPty } from "node-pty";
import * as os from "os";

async function loadNodePty(): Promise<typeof import("node-pty")> {
  try {
    return await import("node-pty");
  } catch {
    throw new Error("node-pty is not available on this platform. Terminal features require a supported OS.");
  }
}

interface PtySession {
  pty: IPty;
  id: string;
  cwd: string;
  cols: number;
  rows: number;
  shell: string;
  createdAt: number;
  lastActive: number;
  scrollback: string[];
  maxScrollback: number;
}

const MAX_SCROLLBACK = 5000;
const MAX_SESSIONS = 32;
const ZOMBIE_TIMEOUT = 600_000;
const BUFFER_FLUSH_INTERVAL = 100;

export class TerminalManager {
  private sessions = new Map<string, PtySession>();
  private ptyModule: Awaited<ReturnType<typeof loadNodePty>> | null = null;
  private zombieTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.zombieTimer = setInterval(() => this.cleanupZombies(), 60_000);
  }

  async spawn(id: string, cwd: string, cols: number, rows: number): Promise<void> {
    this.kill(id);

    if (this.sessions.size >= MAX_SESSIONS) {
      const oldest = Array.from(this.sessions.values())
        .sort((a, b) => a.lastActive - b.lastActive)[0];
      if (oldest) this.kill(oldest.id);
    }

    const module = await this.getPtyModule();
    const shell = this.getDefaultShell();
    const resolvedCwd = cwd || process.cwd();

    const ptyProcess = module.spawn(shell, [], {
      name: "xterm-color",
      cols: cols || 80,
      rows: rows || 24,
      cwd: resolvedCwd,
      env: { ...process.env, TERM: "xterm-256color" } as any,
    });

    const now = Date.now();
    const session: PtySession = {
      pty: ptyProcess,
      id,
      cwd: resolvedCwd,
      cols: cols || 80,
      rows: rows || 24,
      shell,
      createdAt: now,
      lastActive: now,
      scrollback: [],
      maxScrollback: MAX_SCROLLBACK,
    };

    let dataBuffer = "";
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    ptyProcess.onData((data: string) => {
      session.lastActive = Date.now();
      dataBuffer += data;
      if (dataBuffer.length > 1024) {
        this.flushData(id, dataBuffer);
        dataBuffer = "";
      } else if (!flushTimer) {
        flushTimer = setTimeout(() => {
          if (dataBuffer) {
            this.flushData(id, dataBuffer);
            dataBuffer = "";
          }
          flushTimer = null;
        }, BUFFER_FLUSH_INTERVAL);
      }

      if (session.scrollback.length >= session.maxScrollback) {
        session.scrollback.splice(0, session.scrollback.length - session.maxScrollback + 1000);
      }
      session.scrollback.push(data);
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      if (flushTimer) clearTimeout(flushTimer);
      if (dataBuffer) this.flushData(id, dataBuffer);
      const session = this.sessions.get(id);
      if (session) {
        session.lastActive = 0;
        const output = session.scrollback.join("").slice(-50000);
        this.sessions.delete(id);
        const mainWindow = this.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("pty:exit", { id, code: exitCode, output });
        }
      }
    });

    this.sessions.set(id, session);
  }

  private flushData(id: string, data: string): void {
    const mainWindow = this.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("pty:data", { id, data });
    }
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`PTY session "${id}" not found`);
    session.lastActive = Date.now();
    session.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`PTY session "${id}" not found`);
    session.cols = cols;
    session.rows = rows;
    session.lastActive = Date.now();
    session.pty.resize(cols, rows);
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      try {
        const pid = (session.pty as any).pid;
        session.pty.kill();
        try {
          if (pid && process.platform === "win32") {
            const { execSync } = require("child_process");
            execSync(`taskkill /F /T /PID ${pid}`, { timeout: 3000 });
          }
        } catch {}
      } catch {}
      this.sessions.delete(id);
    }
  }

  killAll(): void {
    for (const [id] of this.sessions) {
      this.kill(id);
    }
  }

  getSessionInfo(id: string): { id: string; cwd: string; createdAt: number; lastActive: number; cols: number; rows: number } | null {
    const s = this.sessions.get(id);
    if (!s) return null;
    return { id: s.id, cwd: s.cwd, createdAt: s.createdAt, lastActive: s.lastActive, cols: s.cols, rows: s.rows };
  }

  listSessions(): Array<{ id: string; cwd: string; createdAt: number; lastActive: number }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      cwd: s.cwd,
      createdAt: s.createdAt,
      lastActive: s.lastActive,
    }));
  }

  getScrollback(id: string, maxLines = 200): string[] {
    const session = this.sessions.get(id);
    if (!session) return [];
    return session.scrollback.slice(-maxLines);
  }

  restoreSession(id: string, cwd: string, cols: number, rows: number): Promise<void> {
    return this.spawn(id, cwd, cols, rows);
  }

  private cleanupZombies(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActive > ZOMBIE_TIMEOUT && session.lastActive > 0) {
        try {
          session.pty.kill();
        } catch {}
        this.sessions.delete(id);
        const mainWindow = this.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("pty:exit", { id, code: -1, output: "" });
        }
      }
    }
  }

  dispose(): void {
    if (this.zombieTimer) {
      clearInterval(this.zombieTimer);
      this.zombieTimer = null;
    }
    this.killAll();
  }

  private async getPtyModule() {
    if (!this.ptyModule) {
      this.ptyModule = await loadNodePty();
    }
    return this.ptyModule;
  }

  private getDefaultShell(): string {
    if (os.platform() === "win32") return "powershell.exe";
    return os.platform() === "darwin" ? "zsh" : "bash";
  }

  private getMainWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows();
    return windows.length > 0 ? windows[0] : null;
  }
}
