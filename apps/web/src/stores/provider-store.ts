import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UniversalProviderConfig, ProviderHealthStatus } from "@/lib/runtime/types";
import { BaseUniversalProvider } from "@/lib/runtime/providers/base-provider";
import { createUniversalProvider, checkProviderHealth } from "@/lib/runtime/providers/provider-factory";
import { getJson } from "@/lib/client-api";
import {
  getCurrentSchemaVersion,
  validateProviderStore,
} from "@/lib/runtime/state-validator";

const STORE_NAME = "agentos-provider-store";
const CURRENT_VERSION = getCurrentSchemaVersion(STORE_NAME);

interface ProviderState {
  providers: UniversalProviderConfig[];
  providerInstances: Record<string, BaseUniversalProvider>;
  loading: boolean;
  error: string | null;
  setProviders: (providers: UniversalProviderConfig[]) => void;
  addProvider: (config: UniversalProviderConfig) => void;
  updateProvider: (id: string, updates: Partial<UniversalProviderConfig>) => void;
  removeProvider: (id: string) => void;
  setSelectedModel: (providerId: string, modelName: string) => void;
  getSelectedModel: (providerId: string) => string;
  setProviderHealth: (id: string, status: ProviderHealthStatus, latency: number) => void;
  refreshHealth: () => Promise<void>;
  getInstance: (id: string) => BaseUniversalProvider | undefined;
  hydrate: () => Promise<void>;
  reset: () => void;
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      providers: [],
      providerInstances: {},
      loading: false,
      error: null,

      setProviders: (providers: UniversalProviderConfig[]) => {
        const instances: Record<string, BaseUniversalProvider> = {};
        for (const p of providers) {
          if (!p.enabled || !p.id) continue;
          try {
            instances[p.id] = createUniversalProvider(p);
          } catch (err) {
            console.warn(`[ProviderStore] Failed to create instance for "${p.name}":`, err instanceof Error ? err.message : err);
          }
        }
        set({ providers, providerInstances: instances });
      },

      addProvider: (config: UniversalProviderConfig) => {
        if (!config.id) {
          console.error("[ProviderStore] Cannot add provider without id");
          return;
        }
        const providers = [...get().providers, config];
        const instances = { ...get().providerInstances };
        if (config.enabled) {
          try {
            instances[config.id] = createUniversalProvider(config);
          } catch (err) {
            console.warn(`[ProviderStore] Failed to create instance for "${config.name}":`, err instanceof Error ? err.message : err);
          }
        }
        set({ providers, providerInstances: instances });
      },

      updateProvider: (id: string, updates: Partial<UniversalProviderConfig>) => {
        if (!id) {
          console.error("[ProviderStore] Cannot update provider without id");
          return;
        }
        const providers = get().providers.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        );
        const instances = { ...get().providerInstances };
        const updated = providers.find((p) => p.id === id);
        if (updated?.enabled) {
          try {
            instances[id] = createUniversalProvider(updated);
          } catch (err) {
            console.warn(`[ProviderStore] Failed to update instance for "${updated.name}":`, err instanceof Error ? err.message : err);
            delete instances[id];
          }
        } else {
          delete instances[id];
        }
        set({ providers, providerInstances: instances });
      },

      setSelectedModel: (providerId: string, modelName: string) => {
        const providers = get().providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                selectedModel: modelName,
                // When selectedModel changes, also update defaultModel for backward compat
                defaultModel: modelName,
              }
            : p
        );
        set({ providers });
      },

      getSelectedModel: (providerId: string) => {
        const provider = get().providers.find((p) => p.id === providerId);
        return provider?.selectedModel ?? provider?.defaultModel ?? "";
      },

      removeProvider: (id: string) => {
        const providers = get().providers.filter((p) => p.id !== id);
        const instances = { ...get().providerInstances };
        delete instances[id];
        set({ providers, providerInstances: instances });
      },

      setProviderHealth: (id: string, status: ProviderHealthStatus, latency: number) => {
        set({
          providers: get().providers.map((p) =>
            p.id === id
              ? { ...p, health: status, latency, lastChecked: new Date().toISOString() }
              : p
          ),
        });
      },

      refreshHealth: async () => {
        const { providers, providerInstances } = get();
        await Promise.all(
          providers.map(async (p) => {
            const instance = providerInstances[p.id];
            if (!instance) return;
            try {
              const health = await checkProviderHealth(instance);
              get().setProviderHealth(p.id, health.status, health.latency);
            } catch {
              get().setProviderHealth(p.id, "offline", 999);
            }
          })
        );
      },

      getInstance: (id: string) => get().providerInstances[id],

      hydrate: async () => {
        set({ loading: true, error: null });
        try {
          const data = await getJson<{ providers: any[] }>("/api/settings/providers");
          const rawProviders = data.providers || data || [];
          const mapped: UniversalProviderConfig[] = rawProviders.map((p: any) => {
            let health: ProviderHealthStatus = "unknown";
            if (p.validation_status === "valid") health = "healthy";
            else if (p.validation_status === "invalid") health = "offline";

            const meta = p.metadata || {};
            // Deterministic resolution:
            // 1. selected_model from server metadata (primary)
            // 2. selectedModel from local cache (secondary)
            // 3. configured_models[0] (legacy migration)
            // 4. default_model (fallback)
            const serverSelectedModel = meta.selected_model || p.selected_model || "";
            const localSelectedModel = p.selectedModel || "";
            const serverConfiguredModels = meta.configured_models || meta.configuredModels || p.configured_models || p.configuredModels || [];
            const legacyConfiguredModels = Array.isArray(serverConfiguredModels) ? serverConfiguredModels : [];

            let selectedModel = serverSelectedModel || localSelectedModel;

            // Fallback: take first configured model if selectedModel is empty
            if (!selectedModel && legacyConfiguredModels.length > 0) {
              selectedModel = legacyConfiguredModels[0];
            }
            // Fallback: use defaultModel if still empty
            if (!selectedModel) {
              selectedModel = p.default_model || p.defaultModel || "";
            }

            return {
              id: p.provider || p.id,
              name: p.label || p.name,
              type:
                p.metadata?.compatibilityMode === "anthropic-compatible"
                  ? ("cloud" as const)
                  : p.id === "ollama" || p.id === "lm-studio"
                    ? ("local" as const)
                    : ("openai-compatible" as const),
              baseUrl: p.base_url || p.baseUrl || "",
              apiKey: undefined,
              defaultModel: p.default_model || p.defaultModel || selectedModel,
              enabled: Boolean(p.enabled),
              selectedModel,
              metadata: p.metadata || {},
              health,
              latency: 0,
            };
          });

          // Deduplicate: if same providerType + selectedModel combo exists, keep only the last one
          const deduped: UniversalProviderConfig[] = [];
          const seen = new Set<string>();
          for (const prov of [...mapped].reverse()) {
            const key = `${prov.id}:${prov.selectedModel}`;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.unshift(prov);
            }
          }

          get().setProviders(deduped);
          set({ error: null });
        } catch {
          if (get().providers.length === 0) {
            set({ error: "Failed to load providers" });
          }
        } finally {
          set({ loading: false });
        }
      },

      reset: () => {
        set({
          providers: [],
          providerInstances: {},
          loading: false,
          error: null,
        });
      },
    }),
    {
      name: STORE_NAME,
      version: CURRENT_VERSION,
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;
        if (version < CURRENT_VERSION) {
          // Migrate configuredModels → selectedModel
          state = {
            ...state,
            providerInstances: {},
            providers: Array.isArray(state.providers)
              ? state.providers.map((p: any) => {
                  const oldConfigured = p.configuredModels ?? [];
                  let selectedModel = p.selectedModel || "";
                  // Fallback: use first configured model
                  if (!selectedModel && Array.isArray(oldConfigured) && oldConfigured.length > 0) {
                    selectedModel = oldConfigured[0];
                  }
                  // Fallback: use defaultModel
                  if (!selectedModel) {
                    selectedModel = p.defaultModel || "";
                  }
                  const { configuredModels: _, ...rest } = p;
                  return {
                    ...rest,
                    selectedModel,
                    // Also sync defaultModel for backward compat
                    defaultModel: selectedModel || p.defaultModel,
                  };
                }).filter((p: any) => p && typeof p === "object" && p.id)
              : [],
          };
        }
        const { sanitized } = validateProviderStore(state);
        // Ensure all providers have selectedModel
        const providers = (sanitized?.providers ?? []).map((p: any) => {
          const oldConfigured = p.configuredModels ?? [];
          let selectedModel = p.selectedModel || "";
          if (!selectedModel && Array.isArray(oldConfigured) && oldConfigured.length > 0) {
            selectedModel = oldConfigured[0];
          }
          const { configuredModels: _, ...rest } = p;
          return {
            ...rest,
            selectedModel: selectedModel || "",
            // Sync defaultModel with selectedModel
            defaultModel: selectedModel || p.defaultModel || "",
          };
        });
        return {
          providers,
          providerInstances: {},
          loading: false,
          error: null,
        };
      },
      partialize: (state: ProviderState) => ({
        providers: state.providers.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          baseUrl: p.baseUrl,
          defaultModel: p.selectedModel || p.defaultModel,
          enabled: p.enabled,
          selectedModel: p.selectedModel ?? "",
          metadata: p.metadata,
          health: "unknown" as ProviderHealthStatus,
          latency: 0,
        })),
      }),
    }
  )
);
