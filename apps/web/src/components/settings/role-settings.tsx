import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Cpu,
  Search,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoleStore } from "@/stores/role-store";
import { useModelRegistry } from "@/stores/model-registry";
import { DEFAULT_ROLES } from "@/lib/runtime/types";
import type { NormalizedModel } from "@/lib/runtime/types";
import { RoleCapabilityBadges } from "./role-capability-badges";

const ROLE_ICONS: Record<string, React.ReactNode> = {
  Manager: <Cpu className="w-4 h-4" />,
  Coding: <Cpu className="w-4 h-4" />,
  Design: <Cpu className="w-4 h-4" />,
  Research: <Cpu className="w-4 h-4" />,
  "Fast Inference": <Zap className="w-4 h-4" />,
  Vision: <Cpu className="w-4 h-4" />,
};

interface RoleSettingsProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSaveRole: (role: string, modelId: string) => void;
  onAutoRoute: (role: string, autoRoute: boolean) => void;
}

export function RoleSettings({
  searchQuery,
  onSearchChange,
  onSaveRole,
  onAutoRoute,
}: RoleSettingsProps) {
  const assignments = useRoleStore((s) => s.assignments);
  const getAssignment = useRoleStore((s) => s.getAssignment);
  const activeModels = useModelRegistry((s) => s.activeModels);
  const getModel = useModelRegistry((s) => s.getModel);

  // Derive a set of active model IDs for fast stale check
  const activeModelIds = useMemo(
    () => new Set(activeModels.map((m) => m.id)),
    [activeModels]
  );

  const filteredModels = useMemo(() => {
    if (!searchQuery) return activeModels;
    const q = searchQuery.toLowerCase();
    return activeModels.filter((m) =>
      m.label.toLowerCase().includes(q) ||
      m.providerName.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  }, [searchQuery, activeModels]);

  return (
    <div className="agentos-card overflow-hidden">
      <div className="border-b border-[--border-primary] px-5 py-4">
        <h3 className="text-base font-semibold text-[--text-primary] flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[--accent-primary]" /> Universal Role Allocation
        </h3>
        <p className="text-xs text-[--text-muted] mt-0.5">
          Each role defines required capabilities. The system selects the best compatible
          model from any connected provider.
        </p>
      </div>
      <div className="p-5 space-y-3">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[--text-muted]" />
          <Input
            className="pl-9 h-9 text-xs bg-[--bg-tertiary] border-[--border-primary] rounded-lg text-[--text-primary] placeholder:text-[--text-disabled]"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {DEFAULT_ROLES.map((role, idx) => {
          const assignment = getAssignment(role.role);
          const assignedModel = assignment
            ? getModel(assignment.modelId) ||
              (assignment.providerId
                ? getModel(`${assignment.providerId}:${assignment.modelId}`)
                : null)
            : null;
          const autoRoute = assignment?.autoRoute ?? true;
          const hasNoModel = !assignedModel && autoRoute;

          // Stale check: model has a manual assignment but is no longer in activeModels
          const isStale =
            !autoRoute &&
            assignedModel != null &&
            !activeModelIds.has(assignedModel.id);

          return (
            <motion.div
              key={role.role}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "p-4 rounded-xl border space-y-3 transition-colors",
                hasNoModel
                  ? "bg-amber-950/10 border-amber-800/30"
                  : "bg-[--bg-tertiary]/30 border-[--border-primary] hover:border-[--border-secondary]/40"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[--bg-elevated] border border-[--border-primary] flex items-center justify-center text-[--accent-primary]">
                    {ROLE_ICONS[role.role] || <Cpu className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[--text-primary]">
                      {role.label}
                    </h4>
                    <p className="text-[11px] text-[--text-muted]">{role.description}</p>
                    <div className="mt-1.5">
                      <RoleCapabilityBadges role={role} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span className="text-[10px] text-[--text-muted]">Auto</span>
                    <Switch
                      checked={autoRoute}
                      onCheckedChange={(v) => onAutoRoute(role.role, v)}
                      className="data-[state=checked]:bg-emerald-600 scale-75"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={assignedModel ? assignedModel.id : "__auto__"}
                  onValueChange={(val) => {
                    if (val === "__auto__") {
                      onAutoRoute(role.role, true);
                    } else {
                      onSaveRole(role.role, val);
                    }
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "flex-1 h-9 text-xs border rounded-lg",
                      autoRoute
                        ? "bg-[--bg-tertiary]/40 border-[--border-primary] text-[--text-muted]"
                        : "bg-[--bg-tertiary] border-[--border-secondary] text-[--text-primary]"
                    )}
                  >
                    <SelectValue
                      placeholder={
                        autoRoute
                          ? "Auto-route (best match)"
                          : assignedModel
                            ? `${assignedModel.providerName}/${assignedModel.label}`
                            : "Select model..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="agentos-glass-elevated max-h-[300px]">
                    <SelectItem
                      value="__auto__"
                      className="text-xs text-[--text-muted] focus:bg-[--bg-elevated] focus:text-[--text-primary]"
                    >
                      <span className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-emerald-500" /> Auto-route (best match)
                      </span>
                    </SelectItem>
                    {filteredModels.map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        className="text-xs text-[--text-primary] focus:bg-[--bg-elevated]"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              m.speed === "fast"
                                ? "bg-emerald-500"
                                : m.speed === "balanced"
                                  ? "bg-amber-500"
                                  : "bg-[--text-disabled]"
                            )}
                          />
                          <span className="font-medium text-[--text-primary]">
                            {m.providerName}
                          </span>
                          <span className="text-[--text-muted]">/</span>
                          <span className="text-[--text-secondary]">{m.label}</span>
                          <ModelSpeedBadge model={m} />
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {assignedModel && !autoRoute && !isStale && (
                  <Badge
                    className={cn(
                      "text-[9px] px-1.5 py-0 font-mono border-none shrink-0",
                      assignedModel.speed === "fast"
                        ? "bg-emerald-900/40 text-emerald-400"
                        : assignedModel.speed === "balanced"
                          ? "bg-amber-950/40 text-[--accent-primary]"
                          : "bg-[--bg-tertiary] text-[--text-disabled]"
                    )}
                  >
                    {assignedModel.speed}
                  </Badge>
                )}

                {isStale && (
                  <Badge className="text-[9px] px-1.5 py-0 font-mono border-none shrink-0 bg-rose-900/40 text-rose-400">
                    stale
                  </Badge>
                )}
              </div>

              {hasNoModel && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/20 border border-amber-800/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[11px] text-amber-400">
                    No model assigned. <span className="font-medium">Enable Auto-route</span> or select a model below.
                  </p>
                </div>
              )}

              {isStale && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-950/20 border border-rose-800/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <p className="text-[11px] text-rose-400">
                    Assigned model <span className="font-medium">{assignedModel?.label}</span> is no longer available.{" "}
                    Select a different model or enable <span className="font-medium">Auto-route</span>.
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ModelSpeedBadge({ model }: { model: NormalizedModel }) {
  const colorMap: Record<string, string> = {
    fast: "text-emerald-400",
    balanced: "text-amber-400",
    slow: "text-[--text-disabled]",
  };
  return (
    <span className={cn("text-[9px] font-medium", colorMap[model.speed] || "text-[--text-muted]")}>
      {model.speed}
    </span>
  );
}
