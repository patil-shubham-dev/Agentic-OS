import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RoleAssignment, RoleCapability, ExecutionTask } from "@/lib/runtime/types";
import { DEFAULT_ROLES } from "@/lib/runtime/types";
import { useModelRegistry } from "./model-registry";
import { useProviderStore } from "./provider-store";
import { getJson, sendJson } from "@/lib/client-api";
import {
  getCurrentSchemaVersion,
  validateRoleStore,
} from "@/lib/runtime/state-validator";

const STORE_NAME = "agentos-role-store";
const CURRENT_VERSION = getCurrentSchemaVersion(STORE_NAME);

interface RoleState {
  roles: RoleCapability[];
  assignments: RoleAssignment[];
  loading: boolean;
  setRoles: (roles: RoleCapability[]) => void;
  setAssignment: (role: string, modelId: string, providerId: string, autoRoute?: boolean) => void;
  getAssignment: (role: string) => RoleAssignment | undefined;
  getModelForRole: (role: string) => { modelId: string; providerId: string } | undefined;
  selectBestModel: (task: ExecutionTask) => { modelId: string; providerId: string };
  hydrate: () => Promise<void>;
  resetToDefaults: () => void;
  /**
   * Reconcile all role assignments against currently active models.
   * Invalidates assignments referencing removed/unconfigured models
   * and auto-recovers them via selectBestModel (auto-route).
   * Call this whenever activeModels changes (provider update, model toggle).
   * Returns a list of roles that were remediated.
   */
  reconcileAssignments: () => string[];
  /**
   * Remove dangling assignments that reference inactive providers.
   */
  cleanupDanglingAssignments: (activeProviderIds: string[]) => void;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      roles: DEFAULT_ROLES,
      assignments: [],
      loading: false,

      setRoles: (roles: RoleCapability[]) => set({ roles }),

      setAssignment: (role: string, modelId: string, providerId: string, autoRoute = true) => {
        const assignments = get().assignments.filter((a: RoleAssignment) => a.role !== role);
        set({
          assignments: [...assignments, { role, modelId, providerId, autoRoute }],
        });
      },

      getAssignment: (role: string) => {
        return get().assignments.find((a: RoleAssignment) => a.role === role);
      },

      getModelForRole: (role: string) => {
        const assignment = get().getAssignment(role);
        if (assignment && !assignment.autoRoute) {
          return { modelId: assignment.modelId, providerId: assignment.providerId };
        }
        const task: ExecutionTask = { id: "auto", role, task: "" };
        return get().selectBestModel(task);
      },

      selectBestModel: (task: ExecutionTask) => {
        const roleConfig = get().roles.find((r: RoleCapability) => r.role === task.role);
        if (!roleConfig) {
          const registry = useModelRegistry.getState();
          const fallback = registry.activeModels[0] ?? registry.availableModels[0];
          if (fallback) {
            return { modelId: fallback.id, providerId: fallback.providerId };
          }
          return { modelId: "", providerId: "" };
        }

        const model = useModelRegistry.getState().getBestModelForCapabilities(
          roleConfig.requires,
          roleConfig.preferred
        );

        if (model) {
          return { modelId: model.id, providerId: model.providerId };
        }

        const registry = useModelRegistry.getState();
        const anyAvailable = registry.activeModels[0] ?? registry.availableModels[0];
        if (anyAvailable) {
          return { modelId: anyAvailable.id, providerId: anyAvailable.providerId };
        }

        return { modelId: "", providerId: "" };
      },

      hydrate: async () => {
        set({ loading: true });
        try {
          const data = await getJson<{ roles: Record<string, string> }>("/api/settings/roles");
          const savedRoles = data.roles || {};
          let skippedMalformed = false;
          let normalizedPrefix = false;
          const assignments: RoleAssignment[] = [];
          const registry = useModelRegistry.getState();

          for (const [role, saved] of Object.entries(savedRoles)) {
            const value = typeof saved === "string" ? saved : String(saved);

            // Skip empty/malformed entries like ":" from old bugs
            if (!value || value === ":" || value.split(":").filter(Boolean).length === 0) {
              skippedMalformed = true;
              continue;
            }

            const colonIdx = value.indexOf(":");
            let providerId: string;
            let modelId: string;
            if (colonIdx >= 0) {
              providerId = value.substring(0, colonIdx);
              modelId = value.substring(colonIdx + 1);
            } else {
              providerId = "";
              modelId = value;
            }

            // Normalize double-prefix: if modelId starts with "providerId:", strip it
            // This fixes corrupted data from the old double-prefix bug
            if (providerId && modelId.startsWith(providerId + ":")) {
              modelId = modelId.slice(providerId.length + 1);
              normalizedPrefix = true;
            }

            if (!providerId) {
              const model = registry.getModel(modelId);
              if (model) {
                providerId = model.providerId;
              }
            }

            assignments.push({
              role,
              modelId,
              providerId,
              autoRoute: !providerId,
            });
          }

          set({ assignments, loading: false });

          // Reconcile against current active models after loading server data.
          // This ensures stale assignments (referencing removed/unconfigured models)
          // are auto-recovered on every page load.
          let needsPersist = skippedMalformed || normalizedPrefix;
          try {
            const remediated = get().reconcileAssignments();
            if (remediated.length > 0) {
              needsPersist = true;
              const activeProviderIds = useProviderStore.getState().providers.map((p) => p.id);
              get().cleanupDanglingAssignments(activeProviderIds);
            }
          } catch {
            // Non-critical — reconciliation is best-effort
          }

          // Persist cleaned assignments back to server so corrupted data is
          // permanently fixed on every page load (until server is clean).
          // Fires when:
          //   - Empty/malformed entries like ":" were skipped
          //   - Assignments were remediated (referenced removed/unconfigured models)
          //   - Double-prefix model IDs were normalized
          if (needsPersist) {
            try {
              const currentAssignments = get().assignments;
              const rolesPayload: Record<string, string> = {};
              for (const a of currentAssignments) {
                if (!a.autoRoute) {
                  rolesPayload[a.role] = `${a.providerId}:${a.modelId}`;
                }
              }
              await sendJson("/api/settings/roles", "POST", { roles: rolesPayload });
            } catch {
              // Best-effort server sync
            }
          }
        } catch {
          set({ loading: false });
        }
      },

      reconcileAssignments: () => {
        const currentAssignments = get().assignments;
        const registry = useModelRegistry.getState();
        const activeModels = registry.activeModels;
        const activeModelIds = new Set(activeModels.map((m) => m.id));
        const remediated: string[] = [];

        const updatedAssignments = currentAssignments.map((a) => {
          if (a.autoRoute) return a;

          const fullId = `${a.providerId}:${a.modelId}`;
          const modelExists =
            activeModelIds.has(fullId) ||
            activeModels.some(
              (m) =>
                m.id === a.modelId ||
                (m.providerId === a.providerId && m.name === a.modelId)
            );

          if (modelExists) return a;

          // Model no longer active — auto-recover
          remediated.push(a.role);
          return { ...a, autoRoute: true };
        });

        if (remediated.length > 0) {
          set({ assignments: updatedAssignments });
        }

        return remediated;
      },

      resetToDefaults: () => {
        set({ assignments: [] });
      },

      /**
       * Remove dangling assignments that reference inactive providers.
       * Called automatically after provider config changes.
       */
      cleanupDanglingAssignments: (activeProviderIds: string[]) => {
        const currentAssignments = get().assignments;
        const cleaned = currentAssignments.filter((a) => {
          if (a.autoRoute) return true;
          return activeProviderIds.includes(a.providerId);
        });
        if (cleaned.length !== currentAssignments.length) {
          set({ assignments: cleaned });
        }
      },
    }),
    {
      name: STORE_NAME,
      version: CURRENT_VERSION,
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;
        if (version < CURRENT_VERSION) {
          state = {
            ...state,
            roles: state.roles ?? DEFAULT_ROLES,
            assignments: Array.isArray(state.assignments)
              ? state.assignments
                  .filter((a: any) => a && typeof a.role === "string")
                  // Normalize model IDs that have a double-prefix from an old bug
                  // (modelId was stored as full prefixed ID like "nvidia:meta/llama-3.1-70b-instruct"
                  //  but should be just the model name like "meta/llama-3.1-70b-instruct")
                  .map((a: any) => {
                    if (a.modelId && typeof a.modelId === 'string' && a.modelId.includes(':') && a.providerId) {
                      const prefix = a.providerId + ':';
                      if (a.modelId.startsWith(prefix)) {
                        return { ...a, modelId: a.modelId.slice(prefix.length) };
                      }
                    }
                    return a;
                  })
              : [],
          };
        }
        const { sanitized } = validateRoleStore(state);
        return {
          roles: sanitized?.roles ?? DEFAULT_ROLES,
          assignments: sanitized?.assignments ?? [],
          loading: false,
        };
      },

      partialize: (state: RoleState) => ({
        assignments: state.assignments,
      }),
    }
  )
);
