import { create } from "zustand";
import type { NormalizedModel, ModelCapability } from "@/lib/runtime/types";
import { useProviderStore } from "./provider-store";
import { discoverModels } from "@/lib/runtime/providers/provider-factory";
import { getJson } from "@/lib/client-api";
import { getCachedModels, setCachedModels } from "@/lib/runtime/model-cache";
import { perfMeasureAsync } from "@/lib/runtime/performance-monitor";
import { runGuarded } from "@/lib/runtime/safe-guards";

interface ModelRegistryState {
  /** All discovered models (raw cache) */
  models: NormalizedModel[];
  /** All discovered models with status === "available" (for debug display) */
  availableModels: NormalizedModel[];
  /** Configured + enabled + available models only — source of truth for role assignment */
  activeModels: NormalizedModel[];
  loading: boolean;
  error: string | null;
  lastRefreshed: string | null;
  _hydrated: boolean;

  refresh: () => Promise<void>;
  refreshForProvider: (providerId: string) => Promise<void>;
  getModelsByCapability: (required: ModelCapability[], preferred?: ModelCapability[]) => NormalizedModel[];
  getModelsByProvider: (providerId: string) => NormalizedModel[];
  getModel: (modelId: string) => NormalizedModel | undefined;
  getBestModelForCapabilities: (required: ModelCapability[], preferred?: ModelCapability[]) => NormalizedModel | undefined;
  clear: () => void;
  /** Re-derive activeModels from current state + provider store */
  deriveActiveModels: () => void;
}

function deriveActiveModels(models: NormalizedModel[]): NormalizedModel[] {
  const { providers } = useProviderStore.getState();
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  return models.filter((m) => {
    if (m.status !== "available") return false;

    const provider = providerMap.get(m.providerId);
    if (!provider) return false;
    if (!provider.enabled) return false;

    // ONE provider card = ONE selected model.
    // Only include a model if the provider has an explicit selectedModel
    // that matches this model's name. This prevents raw discovery leakage
    // into role dropdowns and ensures the one-card-one-model contract.
    if (provider.selectedModel) {
      return m.name === provider.selectedModel;
    }

    // Fallback: if provider has a defaultModel but no selectedModel yet,
    // include that as a candidate (during initial setup before save).
    if (provider.defaultModel) {
      return m.name === provider.defaultModel;
    }

    // No model selected or defaulted — exclude all models for this provider.
    // This prevents raw discovery leakage into UI/roles.
    return false;
  });
}

export const useModelRegistry = create<ModelRegistryState>()((set, get) => ({
  models: [],
  availableModels: [],
  activeModels: [],
  loading: false,
  error: null,
  lastRefreshed: null,
  _hydrated: false,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const providerStore = useProviderStore.getState();
      const { providers, providerInstances } = providerStore;

      const cached = getCachedModels(providers);        if (cached && cached.length > 0) {
        const available = cached.filter((m) => m.status === "available");
        const active = deriveActiveModels(cached);
        set({
          models: cached,
          availableModels: available,
          activeModels: active,
          loading: false,
          lastRefreshed: new Date().toISOString(),
          _hydrated: true,
        });
      }

      await runGuarded("model-registry-refresh", async () => {
        const allModels: NormalizedModel[] = [];

        for (const provider of providers) {
          if (!provider.enabled) continue;

          let discovered = false;

          try {
            const data = await getJson<{ success: boolean; models: string[] }>(
              `/api/settings/providers/${provider.id}/discover-models`
            );
            if (data.success && Array.isArray(data.models) && data.models.length > 0) {
              const serverModels: NormalizedModel[] = data.models.map((modelName: string) => {
                const label = modelName.split("/").pop() || modelName;
                const modelId = `${provider.id}:${modelName}`;
                return {
                  id: modelId,
                  providerId: provider.id,
                  providerName: provider.name,
                  name: modelName,
                  label,
                  contextWindow: 128000,
                  maxOutputTokens: 4096,
                  capabilities: ["streaming"],
                  speed: "balanced" as const,
                  status: "available" as const,
                };
              });
              allModels.push(...serverModels);
              discovered = true;
            }
          } catch {
          }

          if (!discovered) {
            const instance = providerInstances[provider.id];
            if (instance) {
              try {
                const providerModels = await discoverModels(instance);
                allModels.push(...providerModels);
                discovered = true;
              } catch (err) {
                console.warn(`Failed to discover models for ${provider.name}:`, err);
              }
            }
          }

          if (!discovered) {
            const fallbackModels = getFallbackModels(provider.id, provider.name);
            allModels.push(...fallbackModels);
          }
        }

        const merged = mergeAndDedupeModels(allModels);
        const available = merged.filter((m) => m.status === "available");
        const active = deriveActiveModels(merged);
        setCachedModels(providers, merged);
        set({
          models: merged,
          availableModels: available,
          activeModels: active,
          loading: false,
          lastRefreshed: new Date().toISOString(),
          _hydrated: true,
        });
      });
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : "Failed to refresh models",
        loading: false,
        _hydrated: true,
      });
    }
  },

  refreshForProvider: async (providerId: string) => {
    const provider = useProviderStore.getState().providers.find((p) => p.id === providerId);
    if (!provider || !provider.enabled) return;

    let discovered = false;
    const newModels: NormalizedModel[] = [];

    try {
      const data = await getJson<{ success: boolean; models: string[] }>(
        `/api/settings/providers/${provider.id}/discover-models`
      );
      if (data.success && Array.isArray(data.models) && data.models.length > 0) {
        const serverModels: NormalizedModel[] = data.models.map((modelName: string) => {
          const label = modelName.split("/").pop() || modelName;
          const modelId = `${provider.id}:${modelName}`;
          return {
            id: modelId,
            providerId: provider.id,
            providerName: provider.name,
            name: modelName,
            label,
            contextWindow: 128000,
            maxOutputTokens: 4096,
            capabilities: ["streaming"],
            speed: "balanced" as const,
            status: "available" as const,
          };
        });
        newModels.push(...serverModels);
        discovered = true;
      }
    } catch {
    }

    if (!discovered) {
      const instance = useProviderStore.getState().providerInstances[provider.id];
      if (instance) {
        try {
          const providerModels = await discoverModels(instance);
          newModels.push(...providerModels);
          discovered = true;
        } catch {
        }
      }
    }

    if (!discovered) {
      const fallbackModels = getFallbackModels(provider.id, provider.name);
      newModels.push(...fallbackModels);
    }

    const existing = get().models.filter((m) => m.providerId !== providerId);
    const merged = mergeAndDedupeModels([...existing, ...newModels]);
    const available = merged.filter((m) => m.status === "available");
    const active = deriveActiveModels(merged);
    set({
      models: merged,
      availableModels: available,
      activeModels: active,
      loading: false,
      lastRefreshed: new Date().toISOString(),
    });
  },

  getModelsByCapability: (required, preferred = []) => {
    return get().activeModels.filter((m) => {
      if (m.status !== "available") return false;
      const hasAllRequired = required.every((c) => m.capabilities.includes(c));
      if (!hasAllRequired) return false;
      if (preferred.length === 0) return true;
      const hasPreferred = preferred.some((c) => m.capabilities.includes(c));
      return hasPreferred;
    });
  },

  getModelsByProvider: (providerId) => {
    return get().activeModels.filter((m) => m.providerId === providerId);
  },

  getModel: (modelId) => {
    return get().models.find((m) => m.id === modelId);
  },

  getBestModelForCapabilities: (required, preferred = []) => {
    const compatible = get().getModelsByCapability(required, preferred);
    if (compatible.length === 0) return undefined;

    return compatible.sort((a, b) => {
      const aScore =
        (a.capabilities.includes("fast-inference") ? 10 : 0) +
        (a.capabilities.includes("reasoning") ? 5 : 0) +
        preferred.filter((c) => a.capabilities.includes(c)).length * 3;
      const bScore =
        (b.capabilities.includes("fast-inference") ? 10 : 0) +
        (b.capabilities.includes("reasoning") ? 5 : 0) +
        preferred.filter((c) => b.capabilities.includes(c)).length * 3;
      return bScore - aScore;
    })[0];
  },

  deriveActiveModels: () => {
    const active = deriveActiveModels(get().models);
    set({ activeModels: active });
  },

  clear: () =>
    set({ models: [], availableModels: [], activeModels: [], lastRefreshed: null }),
}));

function getFallbackModels(providerId: string, providerName: string): NormalizedModel[] {
  return [
    {
      id: `${providerId}:${providerId}-default`,
      providerId,
      providerName,
      name: `${providerName} Default`,
      label: "Default Model",
      contextWindow: 128000,
      maxOutputTokens: 4096,
      capabilities: ["streaming", "tools", "code"],
      speed: "balanced" as const,
      status: "available" as const,
    },
  ];
}

function mergeAndDedupeModels(models: NormalizedModel[]): NormalizedModel[] {
  const seen = new Map<string, NormalizedModel>();

  for (const model of models) {
    // Normalize the key to a consistent format.
    // model.id is typically "providerId:modelName" (e.g. "nvidia:meta/llama-3.1-70b-instruct").
    // Ensure we collapse any double-prefix cases by normalizing.
    const normalizedId = normalizeModelId(model.id, model.providerId);
    const key = normalizedId.toLowerCase();

    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, { ...model, id: normalizedId });
    } else {
      seen.set(key, {
        ...existing,
        capabilities: [...new Set([...existing.capabilities, ...model.capabilities])],
        contextWindow: Math.max(existing.contextWindow, model.contextWindow),
        maxOutputTokens: Math.max(existing.maxOutputTokens, model.maxOutputTokens),
      });
    }
  }

  return Array.from(seen.values());
}

/**
 * Normalize a model ID to ensure no double-prefix (e.g., "nvidia:nvidia:llama" → "nvidia:llama").
 * Some discovery paths produce IDs like "nvidia:nvidia/llama" while others produce "nvidia:llama".
 */
function normalizeModelId(id: string, providerId: string): string {
  const prefix = `${providerId}:`;
  // Check for double prefix: "nvidia:nvidia/..." or "nvidia:nvidia:..."
  if (id.startsWith(prefix + providerId + "/") || id.startsWith(prefix + providerId + ":")) {
    return prefix + id.slice(prefix.length + providerId.length + 1);
  }
  return id;
}
