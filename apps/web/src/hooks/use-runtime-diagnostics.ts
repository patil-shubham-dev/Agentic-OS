import { useState, useEffect, useRef, useCallback } from "react";
import { useProviderStore } from "@/stores/provider-store";
import { useModelRegistry } from "@/stores/model-registry";
import { useRoleStore } from "@/stores/role-store";

export interface RuntimeDiagnostics {
  providersLoaded: boolean;
  providerCount: number;
  modelsDiscovered: boolean;
  modelCount: number;
  availableModelCount: number;
  registrySize: number;
  rolesHydrated: boolean;
  assignmentCount: number;
  hydrationComplete: boolean;
  lastRefreshed: string | null;
  registryError: string | null;
  renderCount: number;
  renderCycle: number;
}

export function useRuntimeDiagnostics(): RuntimeDiagnostics {
  const renderRef = useRef(0);
  renderRef.current++;

  const [renderCycle] = useState(() => Date.now());

  const providers = useProviderStore((s) => s.providers);
  const models = useModelRegistry((s) => s.models);
  const availableModels = useModelRegistry((s) => s.availableModels);
  const lastRefreshed = useModelRegistry((s) => s.lastRefreshed);
  const registryError = useModelRegistry((s) => s.error);
  const assignments = useRoleStore((s) => s.assignments);

  const providerCount = providers.length;
  const providersLoaded = providerCount > 0;
  const modelsDiscovered = models.length > 0;
  const modelCount = models.length;
  const availableModelCount = availableModels.length;
  const registrySize = models.length;
  const assignmentCount = assignments.length;
  const rolesHydrated = assignmentCount > 0 || providersLoaded;
  const hydrationComplete = providersLoaded && (modelsDiscovered || providerCount === 0);

  return {
    providersLoaded,
    providerCount,
    modelsDiscovered,
    modelCount,
    availableModelCount,
    registrySize,
    rolesHydrated,
    assignmentCount,
    hydrationComplete,
    lastRefreshed,
    registryError,
    renderCount: renderRef.current,
    renderCycle,
  };
}
