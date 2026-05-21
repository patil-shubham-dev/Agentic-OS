import { BrowserWindow } from "electron";
import type { IPty } from "node-pty";
import * as os from "os";

// Dynamic import — node-pty is an optional native module
async function loadNodePty(): Promise<typeof import("node-pty")> {
  try {
    return await import("node-pty");
  } catch {
    throw new Error(
      "node-pty is not available on this platform. Terminal features require a supported OS."
    );
  }
}

interface PtySession {
  pty: IPty;
  id: string;
}

/**
 * Manages PTY (pseudo-terminal) sessions for the Electron main process.
 * Each session maps to a unique ID (used by Xterm.js instances in the renderer).
 */
export class TerminalManager {
  private sessions = new Map<string, PtySession>();
  private ptyModule: Awaited<ReturnType<typeof loadNodePty>> | null = null;

  /**
   * Spawn a new PTY session.
   */
  async spawn(id: string, cwd: string, cols: number, rows: number): Promise<void> {
    // Kill existing session with same ID
    this.kill(id);

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

    const session: PtySession = {
      pty: ptyProcess,
      id,
    };

    // Forward data to renderer
    ptyProcess.onData((data: string) => {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("pty:data", { id, data });
      }
    });

    // Forward exit to renderer
    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      this.sessions.delete(id);
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("pty:exit", { id, code: exitCode });
      }
    });

    this.sessions.set(id, session);
  }

  /**
   * Write data to a PTY session.
   */
  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`PTY session "${id}" not found`);
    }
    session.pty.write(data);
  }

  /**
   * Resize a PTY session.
   */
  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`PTY session "${id}" not found`);
    }
    session.pty.resize(cols, rows);
  }

  /**
   * Kill a PTY session.
   */
  kill(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      try {
        session.pty.kill();
      } catch {
        // Already killed
      }
      this.sessions.delete(id);
    }
  }

  /**
   * Kill all active sessions.
   */
  killAll(): void {
    for (const [id] of this.sessions) {
      this.kill(id);
    }
  }

  private async getPtyModule() {
    if (!this.ptyModule) {
      this.ptyModule = await loadNodePty();
    }
    return this.ptyModule;
  }

  private getDefaultShell(): string {
    if (os.platform() === "win32") {
      return "powershell.exe";
    }
    return os.platform() === "darwin" ? "zsh" : "bash";
  }

  private getMainWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows();
    return windows.length > 0 ? windows[0] : null;
  }
}
