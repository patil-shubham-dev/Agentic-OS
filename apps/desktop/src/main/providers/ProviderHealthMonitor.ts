/**
 * ProviderHealthMonitor — pings all active providers on startup
 * and every 5 minutes. Emits health updates to the renderer and
 * stores results in the local store for fast retrieval.
 */

import { BrowserWindow } from "electron";
import { ProviderRegistry } from "./ProviderRegistry";
import { getCredential } from "../credentials";
import { setStoreValue, getStoreValue } from "../credentials";

const HEALTH_STORE_KEY = "provider:health";
const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface ProviderHealthResult {
  providerId: string;
  ok: boolean;
  latency: number;
  lastPinged: string;
  error?: string;
}

export class ProviderHealthMonitor {
  private registry: ProviderRegistry;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  start(): void {
    // Ping immediately on startup
    this.pingAll();

    // Then every 5 minutes
    this.intervalId = setInterval(() => this.pingAll(), PING_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async pingAll(): Promise<void> {
    const configs = this.registry.list();
    if (configs.length === 0) return;

    const results: ProviderHealthResult[] = [];

    for (const cfg of configs) {
      const apiKey = await getCredential("agentos-provider", cfg.id);
      if (!apiKey) {
        results.push({
          providerId: cfg.id,
          ok: false,
          latency: 0,
          lastPinged: new Date().toISOString(),
          error: "No API key stored",
        });
        continue;
      }

      const client = this.registry.activate(cfg.id, apiKey);
      if (!client) {
        results.push({
          providerId: cfg.id,
          ok: false,
          latency: 0,
          lastPinged: new Date().toISOString(),
          error: "Failed to activate client",
        });
        continue;
      }

      const start = performance.now();
      const ok = await client.ping();
      const latency = Math.round(performance.now() - start);

      results.push({
        providerId: cfg.id,
        ok,
        latency,
        lastPinged: new Date().toISOString(),
        error: ok ? undefined : "Connection failed",
      });
    }

    // Persist to local store
    setStoreValue(HEALTH_STORE_KEY, JSON.stringify(results), "local");

    // Emit to all renderer windows
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("provider:healthUpdate", results);
      }
    }
  }

  static getCachedResults(): ProviderHealthResult[] {
    const raw = getStoreValue(HEALTH_STORE_KEY, "local");
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ProviderHealthResult[];
    } catch {
      return [];
    }
  }
}
