import { BrowserWindow, app } from "electron";
import { StoreManager } from "./store-manager";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import { getCredential } from "./credentials";

export type BootPhase =
  | "init"
  | "runtime"
  | "store"
  | "providers"
  | "models"
  | "roles"
  | "workspace"
  | "chat"
  | "session"
  | "ready"
  | "error";

export interface BootProgress {
  phase: BootPhase;
  progress: number;
  error?: string;
}

export interface RuntimeState {
  providers: ProviderRegistry;
  store: StoreManager;
  sessionStore: StoreManager;
  bootPhase: BootPhase;
  bootError: string | null;
  booted: boolean;
}

export class DesktopRuntimeManager {
  private state: RuntimeState;
  private windows: Set<BrowserWindow> = new Set();
  private _safeMode = false;

  constructor() {
    this.state = {
      providers: new ProviderRegistry(),
      store: new StoreManager({ name: "agentos-runtime" }),
      sessionStore: new StoreManager({ name: "agentos-session" }),
      bootPhase: "init",
      bootError: null,
      booted: false,
    };
  }

  get providerRegistry(): ProviderRegistry {
    return this.state.providers;
  }

  get store(): StoreManager {
    return this.state.store;
  }

  get sessionStore(): StoreManager {
    return this.state.sessionStore;
  }

  get bootPhase(): BootPhase {
    return this.state.bootPhase;
  }

  get booted(): boolean {
    return this.state.booted;
  }

  get safeMode(): boolean {
    return this._safeMode;
  }

  setSafeMode(mode: boolean): void {
    this._safeMode = mode;
  }

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on("closed", () => this.windows.delete(win));
  }

  private emitBootProgress(phase: BootPhase, progress: number, error?: string): void {
    this.state.bootPhase = phase;
    if (error) {
      this.state.bootError = error;
    }
    const payload: BootProgress = { phase, progress, error };
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send("boot:progress", payload);
      }
    }
  }

  async boot(): Promise<boolean> {
    try {
      this.emitBootProgress("runtime", 5);
      await this.delay(200);

      this.emitBootProgress("store", 15);
      const persistedPhases = this.sessionStore.get<string>("bootPhase");
      if (persistedPhases === "error") {
        console.warn("[RuntimeManager] Previous boot ended in error");
      }

      this.emitBootProgress("providers", 30);
      const configuredProviders = this.state.providers.list();
      if (configuredProviders.length > 0) {
        for (const cfg of configuredProviders) {
          const apiKey = await getCredential("agentos-provider", cfg.id);
          if (apiKey) {
            this.state.providers.activate(cfg.id, apiKey);
          }
        }
      }

      this.emitBootProgress("models", 50);
      await this.delay(100);

      this.emitBootProgress("roles", 65);
      await this.delay(100);

      this.emitBootProgress("workspace", 80);
      await this.delay(100);

      this.emitBootProgress("chat", 90);
      await this.delay(100);

      this.emitBootProgress("session", 95);

      this.state.booted = true;
      this.sessionStore.set("bootPhase", "ready");
      this.emitBootProgress("ready", 100);
      return true;
    } catch (err: any) {
      this.state.bootError = err.message;
      this.sessionStore.set("bootPhase", "error");
      this.emitBootProgress("error", 0, err.message);
      return false;
    }
  }

  getCachedProviderHealth(): unknown[] {
    try {
      const raw = this.store.get<string>("provider:health");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  shutdown(): void {
    this.state.booted = false;
    this.state.bootError = null;
    this.state.bootPhase = "init";
    this.windows.clear();
  }

  resetRuntime(): void {
    this.state.booted = false;
    this.state.bootError = null;
    this.state.bootPhase = "init";
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
