import { useProviderStore } from "@/stores/provider-store";
import { useModelRegistry } from "@/stores/model-registry";
import { useRoleStore } from "@/stores/role-store";
import { Bug, ChevronDown, ChevronRight, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const providerStore = useProviderStore();
  const modelRegistry = useModelRegistry();
  const roleStore = useRoleStore();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full bg-[--bg-elevated] border border-[--border-primary] flex items-center justify-center hover:bg-[--bg-tertiary] transition-colors shadow-lg"
        title="Debug: Provider/Model/Role Status"
      >
        <Bug className="w-4 h-4 text-[--accent-primary]" />
      </button>

      {open && (
        <div className="absolute bottom-12 right-0 w-96 max-h-[70vh] overflow-y-auto rounded-xl bg-[--bg-secondary] border border-[--border-primary] shadow-2xl p-4 text-xs font-mono space-y-3">
          <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2 border-b border-[--border-primary] pb-2">
            <Bug className="w-3.5 h-3.5 text-[--accent-primary]" />
            Provider / Model / Role Debug
          </h3>

          {/* Providers */}
          <Section title={`Providers (${providerStore.providers.length})`} defaultOpen>
            {providerStore.providers.length === 0 ? (
              <div className="text-[--text-muted] italic">No providers configured</div>
            ) : (
              providerStore.providers.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-0.5">
                  {p.health === "healthy" || p.health === "unknown" ? (
                    <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-rose-500 shrink-0" />
                  )}
                  <span className="text-[--text-primary]">{p.name}</span>
                  <span className="text-[--text-muted]">({p.id})</span>
                  <span className={cn(
                    "ml-auto text-[10px]",
                    p.enabled ? "text-emerald-500" : "text-[--text-disabled]"
                  )}>
                    {p.enabled ? "enabled" : "disabled"}
                  </span>
                </div>
              ))
            )}
          </Section>

          {/* Models */}
          <Section title={`Models (${modelRegistry.availableModels.length} available)`} defaultOpen>
            {modelRegistry.models.length === 0 ? (
              <div className="text-[--text-muted] italic">No models discovered</div>
            ) : (
              modelRegistry.availableModels.map((m) => (
                <div key={`${m.providerId}:${m.id}`} className="flex items-center gap-1 py-0.5">
                  <span className="text-[--accent-primary]">{m.providerName}</span>
                  <span className="text-[--text-muted]">/</span>
                  <span className="text-[--text-primary]">{m.label}</span>
                  <span className={cn(
                    "ml-auto text-[9px]",
                    m.status === "available" ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {m.status}
                  </span>
                </div>
              ))
            )}
          </Section>

          {/* Role Assignments */}
          <Section title={`Role Assignments (${roleStore.assignments.length})`} defaultOpen>
            {roleStore.assignments.length === 0 ? (
              <div className="text-[--text-muted] italic">No role assignments</div>
            ) : (
              roleStore.assignments.map((a) => (
                <div key={a.role} className="py-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[--accent-soft] font-semibold">{a.role}</span>
                    {a.autoRoute ? (
                      <span className="text-[10px] text-emerald-500 ml-auto">auto-route</span>
                    ) : a.providerId ? (
                      <span className="text-[10px] text-[--text-muted] ml-auto">
                        {a.providerId}/{a.modelId.split("/").pop()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-500 ml-auto">no model</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </Section>

          {/* Raw State */}
          <div className="text-[9px] text-[--text-muted] pt-2 border-t border-[--border-primary]">
            Registry refreshed: {modelRegistry.lastRefreshed ? new Date(modelRegistry.lastRefreshed).toLocaleTimeString() : "never"}
            <br />
            Loading: {modelRegistry.loading ? "yes" : "no"}
            <br />
            Error: {modelRegistry.error || "none"}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] font-medium text-[--text-muted] hover:text-[--text-primary] w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        {title}
      </button>
      {expanded && <div className="pl-4 mt-1 space-y-0.5">{children}</div>}
    </div>
  );
}
