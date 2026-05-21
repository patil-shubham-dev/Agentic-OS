import { create } from "zustand";
import type { NormalizedModel, ModelCapability } from "@/lib/runtime/types";
import { useProviderStore } from "./provider-store";
import { discoverModels } from "@/lib/runtime/providers/provider-factory";

interface ModelRegistryState {
  models: NormalizedModel[];
  loading: boolean;
  error: string | null;
  lastRefreshed: string | null;

  availableModels: NormalizedModel[];

  refresh: () => Promise<void>;
  getModelsByCapability: (required: ModelCapability[], preferred?: ModelCapability[]) => NormalizedModel[];
  getModelsByProvider: (providerId: string) => NormalizedModel[];
  getModel: (modelId: string) => NormalizedModel | undefined;
  getBestModelForCapabilities: (required: ModelCapability[], preferred?: ModelCapability[]) => NormalizedModel | undefined;
  clear: () => void;
}

export const useModelRegistry = create<ModelRegistryState>()((set, get) => ({
  models: [],
  loading: false,
  error: null,
  lastRefreshed: null,

  get availableModels() {
    return get().models.filter((m) => m.status === "available");
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const providerStore = useProviderStore.getState();
      const { providers, providerInstances } = providerStore;

      const allModels: NormalizedModel[] = [];

      for (const provider of providers) {
        if (!provider.enabled) continue;
        const instance = providerInstances[provider.id];
        if (!instance) continue;

        try {
          const providerModels = await discoverModels(instance);
          allModels.push(...providerModels);
        } catch (err) {
          console.warn(`Failed to discover models for ${provider.name}:`, err);
        }
      }

      const merged = mergeAndDedupeModels(allModels);
      set({ models: merged, loading: false, lastRefreshed: new Date().toISOString() });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Failed to refresh models", loading: false });
    }
  },

  getModelsByCapability: (required, preferred = []) => {
    return get().models.filter((m) => {
      if (m.status !== "available") return false;
      const hasAllRequired = required.every((c) => m.capabilities.has(c));
      if (!hasAllRequired) return false;
      if (preferred.length === 0) return true;
      const hasPreferred = preferred.some((c) => m.capabilities.has(c));
      return hasPreferred;
    });
  },

  getModelsByProvider: (providerId) => {
    return get().models.filter((m) => m.providerId === providerId);
  },

  getModel: (modelId) => {
    return get().models.find((m) => m.id === modelId);
  },

  getBestModelForCapabilities: (required, preferred = []) => {
    const compatible = get().getModelsByCapability(required, preferred);
    if (compatible.length === 0) return undefined;

    return compatible.sort((a, b) => {
      const aScore = (a.capabilities.has("fast-inference") ? 10 : 0) +
                     (a.capabilities.has("reasoning") ? 5 : 0) +
                     (preferred.filter((c) => a.capabilities.has(c)).length * 3);
      const bScore = (b.capabilities.has("fast-inference") ? 10 : 0) +
                     (b.capabilities.has("reasoning") ? 5 : 0) +
                     (preferred.filter((c) => b.capabilities.has(c)).length * 3);
      return bScore - aScore;
    })[0];
  },

  clear: () => set({ models: [], lastRefreshed: null }),
}));

function mergeAndDedupeModels(models: NormalizedModel[]): NormalizedModel[] {
  const seen = new Map<string, NormalizedModel>();

  for (const model of models) {
    const key = `${model.providerId}:${model.id}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, model);
    } else {
      seen.set(key, {
        ...existing,
        capabilities: new Set([...existing.capabilities, ...model.capabilities]),
        contextWindow: Math.max(existing.contextWindow, model.contextWindow),
        maxOutputTokens: Math.max(existing.maxOutputTokens, model.maxOutputTokens),
      });
    }
  }

  return Array.from(seen.values());
}
