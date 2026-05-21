import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UniversalProviderConfig, ProviderHealthStatus } from "@/lib/runtime/types";
import { BaseUniversalProvider } from "@/lib/runtime/providers/base-provider";
import { createUniversalProvider, checkProviderHealth } from "@/lib/runtime/providers/provider-factory";

interface ProviderState {
  providers: UniversalProviderConfig[];
  providerInstances: Record<string, BaseUniversalProvider>;
  loading: boolean;
  error: string | null;

  setProviders: (providers: UniversalProviderConfig[]) => void;
  addProvider: (config: UniversalProviderConfig) => void;
  updateProvider: (id: string, updates: Partial<UniversalProviderConfig>) => void;
  removeProvider: (id: string) => void;
  setProviderHealth: (id: string, status: ProviderHealthStatus, latency: number) => void;
  refreshHealth: () => Promise<void>;
  getInstance: (id: string) => BaseUniversalProvider | undefined;
  hydrate: () => Promise<void>;
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      providers: [],
      providerInstances: {},
      loading: false,
      error: null,

      setProviders: (providers) => {
        const instances: Record<string, BaseUniversalProvider> = {};
        for (const p of providers) {
          if (p.enabled) {
            instances[p.id] = createUniversalProvider(p);
          }
        }
        set({ providers, providerInstances: instances });
      },

      addProvider: (config) => {
        const providers = [...get().providers, config];
        const instances = { ...get().providerInstances };
        if (config.enabled) {
          instances[config.id] = createUniversalProvider(config);
        }
        set({ providers, providerInstances: instances });
      },

      updateProvider: (id, updates) => {
        const providers = get().providers.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        );
        const instances = { ...get().providerInstances };
        const updated = providers.find((p) => p.id === id);
        if (updated?.enabled) {
          instances[id] = createUniversalProvider(updated);
        } else if (!updated?.enabled) {
          delete instances[id];
        }
        set({ providers, providerInstances: instances });
      },

      removeProvider: (id) => {
        const providers = get().providers.filter((p) => p.id !== id);
        const instances = { ...get().providerInstances };
        delete instances[id];
        set({ providers, providerInstances: instances });
      },

      setProviderHealth: (id, status, latency) => {
        set({
          providers: get().providers.map((p) =>
            p.id === id ? { ...p, health: status, latency, lastChecked: new Date().toISOString() } : p
          ),
        });
      },

      refreshHealth: async () => {
        const { providers, providerInstances } = get();
        for (const p of providers) {
          const instance = providerInstances[p.id];
          if (!instance) continue;
          try {
            const health = await checkProviderHealth(instance);
            get().setProviderHealth(p.id, health.status, health.latency);
          } catch {
            get().setProviderHealth(p.id, "offline", 999);
          }
        }
      },

      getInstance: (id) => get().providerInstances[id],

      hydrate: async () => {
        set({ loading: true });
        try {
          const res = await fetch("/api/settings/providers");
          const data = await res.json();
          const rawProviders = data.providers || data || [];
          const mapped: UniversalProviderConfig[] = rawProviders.map((p: any) => ({
            id: p.provider || p.id,
            name: p.label || p.name,
            type: (p.metadata?.compatibilityMode === "anthropic-compatible" ? "cloud" :
                   p.id === "ollama" || p.id === "lm-studio" ? "local" : "openai-compatible") as any,
            baseUrl: p.base_url || p.baseUrl || "",
            apiKey: undefined,
            defaultModel: p.default_model || p.defaultModel || "",
            enabled: Boolean(p.enabled),
            metadata: p.metadata || {},
            health: "unknown" as ProviderHealthStatus,
            latency: 0,
          }));
          get().setProviders(mapped);
        } catch {
          set({ error: "Failed to load providers" });
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "agentos-provider-store",
      partialize: (state) => ({
        providers: state.providers.map((p) => ({
          ...p,
          apiKey: undefined,
          health: "unknown" as ProviderHealthStatus,
        })),
      }),
    }
  )
);
