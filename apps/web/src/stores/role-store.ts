import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RoleAssignment, RoleCapability, ExecutionTask } from "@/lib/runtime/types";
import { DEFAULT_ROLES } from "@/lib/runtime/types";
import { useModelRegistry } from "./model-registry";

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
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      roles: DEFAULT_ROLES,
      assignments: [],
      loading: false,

      setRoles: (roles) => set({ roles }),

      setAssignment: (role, modelId, providerId, autoRoute = true) => {
        const assignments = get().assignments.filter((a) => a.role !== role);
        set({
          assignments: [...assignments, { role, modelId, providerId, autoRoute }],
        });
      },

      getAssignment: (role) => {
        return get().assignments.find((a) => a.role === role);
      },

      getModelForRole: (role) => {
        const assignment = get().getAssignment(role);
        if (assignment && !assignment.autoRoute) {
          return { modelId: assignment.modelId, providerId: assignment.providerId };
        }
        const task: ExecutionTask = { id: "auto", role, task: "" };
        return get().selectBestModel(task);
      },

      selectBestModel: (task) => {
        const roleConfig = get().roles.find((r) => r.role === task.role);
        if (!roleConfig) {
          const fallback = useModelRegistry.getState().models[0];
          return { modelId: fallback?.id || "gpt-4o", providerId: fallback?.providerId || "openai" };
        }

        const model = useModelRegistry.getState().getBestModelForCapabilities(
          roleConfig.requires,
          roleConfig.preferred
        );

        if (model) {
          return { modelId: model.id, providerId: model.providerId };
        }

        const anyAvailable = useModelRegistry.getState().availableModels[0];
        return {
          modelId: anyAvailable?.id || "gpt-4o",
          providerId: anyAvailable?.providerId || "openai",
        };
      },

      hydrate: async () => {
        set({ loading: true });
        try {
          const res = await fetch("/api/settings/roles");
          const data = await res.json();
          const savedRoles = data.roles || {};
          const assignments: RoleAssignment[] = [];

          for (const [role, modelId] of Object.entries(savedRoles)) {
            const providerId = typeof modelId === "string" ? modelId.split(":")[0] || "unknown" : "unknown";
            assignments.push({
              role,
              modelId: typeof modelId === "string" ? modelId : String(modelId),
              providerId,
              autoRoute: false,
            });
          }

          set({ assignments, loading: false });
        } catch {
          set({ loading: false });
        }
      },

      resetToDefaults: () => {
        set({ assignments: [] });
      },
    }),
    {
      name: "agentos-role-store",
      partialize: (state) => ({ assignments: state.assignments }),
    }
  )
);
