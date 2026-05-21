/**
 * ProviderRegistry — manages ProviderClient instances keyed by provider ID.
 * Persists provider configs to the local store and API keys to the OS keychain.
 */

import { ProviderClient, ProviderConfig } from "./ProviderClient";
import {
  setStoreValue,
  getStoreValue,
  deleteStoreValue,
} from "../credentials";

const CONFIG_KEY = "provider:configs";

export interface StoredProviderConfig {
  id: string;
  gatewayType: string;
  displayName: string;
  defaultModel: string;
  baseUrl?: string;
  enabled: boolean;
}

export class ProviderRegistry {
  private clients = new Map<string, ProviderClient>();
  private configs = new Map<string, StoredProviderConfig>();

  constructor() {
    this.loadConfigs();
  }

  // ── Persistence ──────────────────────────────────

  private loadConfigs(): void {
    try {
      const raw = getStoreValue(CONFIG_KEY, "local");
      if (raw) {
        const parsed: StoredProviderConfig[] = JSON.parse(raw);
        for (const cfg of parsed) {
          this.configs.set(cfg.id, cfg);
        }
      }
    } catch {
      // corrupted config — start fresh
      this.configs.clear();
    }
  }

  private saveConfigs(): void {
    const arr = Array.from(this.configs.values());
    setStoreValue(CONFIG_KEY, JSON.stringify(arr), "local");
  }

  // ── CRUD ─────────────────────────────────────────

  add(config: StoredProviderConfig): void {
    this.configs.set(config.id, config);
    this.saveConfigs();
  }

  remove(id: string): boolean {
    const existed = this.configs.delete(id);
    if (existed) {
      this.clients.delete(id);
      this.saveConfigs();
    }
    return existed;
  }

  list(): StoredProviderConfig[] {
    return Array.from(this.configs.values()).map((c) => ({
      ...c,
      // mask the key when listing
    }));
  }

  // ── Client lifecycle ─────────────────────────────

  getClient(id: string): ProviderClient | undefined {
    return this.clients.get(id);
  }

  /**
   * Build a ProviderClient from a stored config + decrypted API key.
   * Call this after retrieving the key from the OS keychain.
   */
  activate(
    id: string,
    apiKey: string
  ): ProviderClient | undefined {
    const stored = this.configs.get(id);
    if (!stored) return undefined;

    const client = new ProviderClient({
      id: stored.id,
      gatewayType: stored.gatewayType as ProviderConfig["gatewayType"],
      displayName: stored.displayName,
      apiKey,
      defaultModel: stored.defaultModel,
      baseUrl: stored.baseUrl,
    });

    this.clients.set(id, client);
    return client;
  }

  deactivate(id: string): void {
    this.clients.delete(id);
  }
}
