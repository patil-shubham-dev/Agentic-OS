import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  WifiOff,
  Server,
  Globe,
  Loader2,
  Search,
  RefreshCw,
  Plus,
  Wifi,
  Activity,
  Cpu,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UniversalProviderConfig } from "@/lib/runtime/types";
import { HealthDot } from "./health-dot";

const GATEWAY_TYPES = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", type: "cloud" as const },
  { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com/v1", type: "cloud" as const },
  { id: "google", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", type: "cloud" as const },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", type: "cloud" as const },
  { id: "nvidia", name: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1", type: "cloud" as const },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", type: "cloud" as const },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", type: "cloud" as const },
  { id: "mistral", name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", type: "cloud" as const },
  { id: "ollama", name: "Ollama (Local)", baseUrl: "http://localhost:11434/v1", type: "local" as const },
  { id: "lmstudio", name: "LM Studio (Local)", baseUrl: "http://localhost:1234/v1", type: "local" as const },
];

interface RoleLabels {
  [role: string]: string;
}

interface ProviderSettingsProps {
  providers: UniversalProviderConfig[];
  modelCount: number;
  localDetecting: boolean;
  testingProvider: string | null;
  providerRoles?: Record<string, string[]>;
  onAddClick: () => void;
  onEditClick: (p: UniversalProviderConfig) => void;
  onDeleteProvider: (p: UniversalProviderConfig) => void;
  onToggleProvider: (p: UniversalProviderConfig, enabled: boolean) => void;
  onTestConnection: (providerId: string) => void;
  onDiscoverModels: () => void;
  onDetectLocal: () => void;
  onGatewaySelect: (gateway: { id: string; name: string; baseUrl: string; type: "cloud" | "local" }) => void;
  getModelsByProvider: (providerId: string) => any[];
}

const ROLE_LABELS: RoleLabels = {
  Manager: "Manager",
  Coding: "Coding",
  Design: "Design",
  Research: "Research",
  "Fast Inference": "Fast",
  Vision: "Vision",
};

export function ProviderSettings({
  providers,
  modelCount,
  localDetecting,
  testingProvider,
  providerRoles,
  onAddClick,
  onEditClick,
  onDeleteProvider,
  onToggleProvider,
  onTestConnection,
  onDiscoverModels,
  onDetectLocal,
  onGatewaySelect,
  getModelsByProvider,
}: ProviderSettingsProps) {
  const providerCount = providers.length;

  const healthLabel = (status: string): { label: string; color: string } => {
    const map: Record<string, { label: string; color: string }> = {
      healthy: { label: "Connected", color: "text-emerald-400" },
      slow: { label: "Slow", color: "text-amber-400" },
      degraded: { label: "Degraded", color: "text-orange-400" },
      offline: { label: "Offline", color: "text-red-400" },
      unknown: { label: "Unknown", color: "text-zinc-500" },
    };
    return map[status] || map.unknown;
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs text-[--text-muted]">
          {providerCount} provider{providerCount !== 1 ? "s" : ""} ·{" "}
          {modelCount} model{modelCount !== 1 ? "s" : ""} available
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-[--border-primary] rounded-lg h-8 text-[--text-secondary] hover:bg-[--bg-elevated]"
            onClick={onDetectLocal}
            disabled={localDetecting}
          >
            {localDetecting ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Search className="w-3 h-3 mr-1" />
            )}
            Detect Local
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-[--border-primary] rounded-lg h-8 text-[--text-secondary] hover:bg-[--bg-elevated]"
            onClick={onDiscoverModels}
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh Models
          </Button>
          <Button
            size="sm"
            className="text-xs bg-[--accent-primary] text-black hover:bg-[--accent-hover] rounded-lg h-8 font-medium shadow-sm shadow-[--glow-soft]"
            onClick={onAddClick}
          >
            <Plus className="w-3 h-3 mr-1" /> Add Provider
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {providerCount === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-14 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-[--bg-tertiary] border border-[--border-primary] flex items-center justify-center mx-auto mb-4">
              <WifiOff className="w-7 h-7 text-[--text-muted]" />
            </div>
            <h3 className="text-lg font-semibold text-[--text-primary]">
              No Providers Connected
            </h3>
            <p className="text-sm text-[--text-muted] max-w-md mx-auto mt-1 mb-8">
              Connect cloud model providers or local endpoints to power your agents.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-lg mx-auto mb-6">
              {GATEWAY_TYPES.map((gt) => {
                const isLocal = gt.id === "ollama" || gt.id === "lmstudio";
                return (
                  <button
                    key={gt.id}
                    type="button"
                    onClick={() => onGatewaySelect(gt)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[--bg-tertiary]/40 border border-[--border-primary] hover:border-[--border-hover] hover:bg-[--bg-tertiary]/60 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[--bg-elevated] border border-[--border-primary] flex items-center justify-center shrink-0 group-hover:border-[--border-secondary] transition-colors">
                      {isLocal ? (
                        <Server className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Globe className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[--text-primary] truncate">
                        {gt.name}
                      </p>
                      <p className="text-[9px] text-[--text-muted] truncate">
                        {isLocal ? "Local endpoint" : "Cloud API"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={onAddClick}
                size="sm"
                className="text-xs bg-[--bg-elevated] hover:bg-[--bg-tertiary] border border-[--border-primary] rounded-lg h-9 text-[--text-secondary]"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Custom Provider
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-[--border-primary] rounded-lg h-9 text-[--text-secondary]"
                onClick={onDetectLocal}
                disabled={localDetecting}
              >
                {localDetecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Search className="w-3.5 h-3.5 mr-1.5" />
                )}
                Detect Local
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 md:grid-cols-2"
          >
            {providers.map((p) => {
              const isLocal = p.type === "local";
              const hl = healthLabel(p.health);
              const roles = providerRoles?.[p.id] || [];

              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="agentos-card overflow-hidden group"
                >
                  <div className="p-4 space-y-3">
                    {/* Header: Icon + Name + Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
                            p.enabled
                              ? "bg-[--bg-elevated] border-[--border-primary]"
                              : "bg-[--bg-tertiary] border-[--border-primary] opacity-60"
                          )}
                        >
                          {isLocal ? (
                            <Server className="w-4 h-4 text-purple-400" />
                          ) : (
                            <Globe className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
                            {p.name}
                          </h3>
                          <p className="text-[10px] text-[--text-muted] font-mono truncate max-w-[200px]">
                            {p.baseUrl}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "text-[9px] px-1.5 py-0 font-medium border-none shrink-0",
                          p.enabled
                            ? "bg-emerald-900/40 text-emerald-400"
                            : "bg-[--bg-tertiary] text-[--text-disabled]"
                        )}
                      >
                        {p.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>

                    {/* Selected Model (ONE per card — enforced architecture) */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[--bg-tertiary]/60 border border-[--border-primary]">
                      <Cpu className="w-3.5 h-3.5 text-[--accent-primary] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono text-[--text-primary] truncate">
                          {p.selectedModel || p.defaultModel || "No model selected"}
                        </p>
                        <p className="text-[9px] text-[--text-muted]">
                          {p.selectedModel ? "Active model — one per card" : "Select a model in configuration"}
                        </p>
                      </div>
                    </div>

                    {/* Health + Latency row */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <HealthDot status={p.health} />
                        <span className={cn("text-[11px] font-medium", hl.color)}>
                          {hl.label}
                        </span>
                      </div>
                      {p.latency ? (
                        <span className="text-[10px] text-[--text-muted]">
                          {p.latency}ms
                        </span>
                      ) : null}
                      {p.lastChecked && (
                        <span className="text-[9px] text-[--text-disabled]">
                          {formatTimeAgo(p.lastChecked)}
                        </span>
                      )}
                    </div>

                    {/* Assigned Roles (if any) */}
                    {roles.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {roles.map((role) => (
                          <Badge
                            key={role}
                            variant="outline"
                            className="text-[9px] bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary] px-1.5 py-0 font-normal"
                          >
                            {ROLE_LABELS[role] || role}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Actions footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-[--border-primary]">
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-elevated]"
                                onClick={() => onTestConnection(p.id)}
                                disabled={testingProvider === p.id}
                              >
                                {testingProvider === p.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Wifi className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[11px] font-medium">
                              Test Connection
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-elevated]"
                                onClick={onDiscoverModels}
                              >
                                <Activity className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[11px] font-medium">
                              Refresh Models
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={p.enabled}
                          onCheckedChange={(v) => onToggleProvider(p, v)}
                          className="data-[state=checked]:bg-emerald-600 scale-75"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2.5 text-[11px] text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-elevated]"
                          onClick={() => onEditClick(p)}
                        >
                          Config
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-950/30 hover:text-rose-400"
                          onClick={() => onDeleteProvider(p)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
