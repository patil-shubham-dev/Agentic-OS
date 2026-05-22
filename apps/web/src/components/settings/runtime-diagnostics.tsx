import { useState, useEffect } from "react";
import { Bug, ChevronDown, ChevronRight, Wifi, WifiOff, Loader2, AlertTriangle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRuntimeDiagnostics } from "@/hooks/use-runtime-diagnostics";
import { useProviderStore } from "@/stores/provider-store";
import { getHeartbeatResults, onHeartbeat } from "@/lib/runtime/heartbeat-monitor";
import { getCrashEvents } from "@/lib/runtime/crash-analytics";
import { perfReport, type Measurement } from "@/lib/runtime/performance-monitor";
import { getJson } from "@/lib/client-api";

export function RuntimeDiagnosticsPanel() {
  const [open, setOpen] = useState(false);
  const diag = useRuntimeDiagnostics();
  const [hbEntries, setHbEntries] = useState<ReturnType<typeof getHeartbeatResults>>([]);
  const [crashEntries, setCrashEntries] = useState<ReturnType<typeof getCrashEvents>>([]);
  const [perfEntries, setPerfEntries] = useState<Measurement[]>([]);
  const [ipcStats, setIpcStats] = useState<{ total: number; timedOut: number } | null>(null);

  useEffect(() => {
    setHbEntries(getHeartbeatResults());
    setCrashEntries(getCrashEvents());
    setPerfEntries(perfReport());

    const unsub = onHeartbeat((entries) => {
      setHbEntries(entries);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!open) return;
    try {
      getJson<Record<string, unknown>>("/api/_ipc-stats").then((d) => {
        if (d && typeof d.total === "number") {
          setIpcStats(d as { total: number; timedOut: number });
        }
      }).catch(() => {});
    } catch {}
  }, [open]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full bg-[--bg-elevated] border border-[--border-primary] flex items-center justify-center hover:bg-[--bg-tertiary] transition-colors shadow-lg"
        title="Runtime Diagnostics"
      >
        <Bug className="w-4 h-4 text-[--accent-primary]" />
      </button>

      {open && (
        <div className="absolute bottom-12 right-0 w-96 max-h-[80vh] overflow-y-auto rounded-xl bg-[--bg-secondary] border border-[--border-primary] shadow-2xl p-4 text-xs font-mono space-y-3">
          <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2 border-b border-[--border-primary] pb-2">
            <Bug className="w-3.5 h-3.5 text-[--accent-primary]" />
            Runtime Diagnostics
          </h3>

          <StatusRow label="Hydration" value={diag.hydrationComplete ? "Complete" : "Pending"} status={diag.hydrationComplete ? "ok" : "warn"} />
          <StatusRow label="Providers" value={`${diag.providerCount} loaded`} status={diag.providersLoaded ? "ok" : "idle"} />
          <StatusRow label="Models" value={`${diag.modelCount} total, ${diag.availableModelCount} available`} status={diag.modelsDiscovered ? "ok" : "warn"} />
          <StatusRow label="Roles" value={`${diag.assignmentCount} assignments`} status={diag.rolesHydrated ? "ok" : "idle"} />

          <div className="h-px bg-[--border-primary]" />

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[--text-muted]">
              <span>Registry refreshed</span>
              <span>{diag.lastRefreshed ? new Date(diag.lastRefreshed).toLocaleTimeString() : "never"}</span>
            </div>
            <div className="flex justify-between text-[10px] text-[--text-muted]">
              <span>Render count</span>
              <span className={diag.renderCount > 20 ? "text-amber-400" : ""}>{diag.renderCount}</span>
            </div>
            <div className="flex justify-between text-[10px] text-[--text-muted]">
              <span>Render cycle</span>
              <span>{new Date(diag.renderCycle).toLocaleTimeString()}</span>
            </div>
            {ipcStats && (
              <div className="flex justify-between text-[10px] text-[--text-muted]">
                <span>IPC calls</span>
                <span className={ipcStats.timedOut > 0 ? "text-red-400" : ""}>
                  {ipcStats.total} total, {ipcStats.timedOut} timed out
                </span>
              </div>
            )}
          </div>

          {diag.registryError && (
            <div className="p-2 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-[10px]">
              Registry error: {diag.registryError}
            </div>
          )}

          {diag.renderCount > 50 && (
            <div className="p-2 rounded-lg bg-amber-950/20 border border-amber-800/30 text-amber-400 text-[10px]">
              High render count ({diag.renderCount}). Possible infinite rerender loop.
            </div>
          )}

          <Section title="Heartbeat Monitor" defaultOpen={false}>
            <div className="text-[10px] space-y-1">
              <div className="flex items-center gap-2">
                {hbEntries.length > 0 && hbEntries.every((e) => e.status === "healthy") ? (
                  <Activity className="w-3 h-3 text-emerald-500 shrink-0" />
                ) : hbEntries.length > 0 ? (
                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin text-[--text-muted] shrink-0" />
                )}
                <span className="text-[--text-muted]">
                  {hbEntries.length > 0
                    ? `${hbEntries.filter((e) => e.status === "healthy").length}/${hbEntries.length} healthy`
                    : "No data"}
                </span>
              </div>
              {hbEntries.filter((e) => e.status !== "healthy").length > 0 && (
                <div className="pl-5 space-y-0.5 text-red-400">
                  {hbEntries.filter((e) => e.status !== "healthy").map((e: { name: string; status: string; error?: string }) => (
                    <div key={e.name}>{e.name}: {e.error ?? e.status}</div>
                  ))}
                </div>
              )}
              {hbEntries.length > 0 && (
                <div className="flex justify-between text-[--text-muted] mt-1 pt-1 border-t border-[--border-primary]">
                  <span>Last check</span>
                  <span>{new Date(hbEntries[0].lastCheck).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </Section>

          <Section title="Crash Log" defaultOpen={false}>
            {crashEntries.length === 0 ? (
              <div className="text-[--text-muted] italic">No crashes recorded</div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {crashEntries.slice(-10).reverse().map((entry: { timestamp: string; message: string }, i: number) => (
                  <div key={i} className="text-[9px] leading-tight text-red-400/80 border-b border-[--border-primary] pb-1">
                    <div className="text-[--text-muted]">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                    <div className="truncate">{entry.message}</div>
                  </div>
                ))}
              </div>
            )}
            {crashEntries.length > 10 && (
              <div className="text-[9px] text-[--text-muted] mt-1">
                Showing last 10 of {crashEntries.length} entries
              </div>
            )}
          </Section>

          <Section title="Performance" defaultOpen={false}>
            {perfEntries.length === 0 ? (
              <div className="text-[--text-muted] italic">No measurements yet</div>
            ) : (
              <div className="space-y-0.5 text-[10px]">
                {perfEntries.filter((e: Measurement) => e.duration != null).slice(-8).reverse().map((entry: Measurement, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-[--text-muted] truncate max-w-[180px]">{entry.key}</span>
                    <span className={cn(entry.duration! > 1000 ? "text-amber-400" : "text-[--text-primary]")}>
                      {entry.duration!.toFixed(1)}ms
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Provider State" defaultOpen={false}>
            <ProviderStateView />
          </Section>
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, value, status }: { label: string; value: string; status: "ok" | "warn" | "idle" }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {status === "ok" ? (
        <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
      ) : status === "warn" ? (
        <WifiOff className="w-3 h-3 text-amber-500 shrink-0" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-[--text-muted] shrink-0" />
      )}
      <span className="text-[--text-muted] w-16">{label}</span>
      <span className="text-[--text-primary]">{value}</span>
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] font-medium text-[--text-muted] hover:text-[--text-primary] w-full text-left"
      >
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        {title}
      </button>
      {expanded && <div className="pl-4 mt-1 space-y-0.5">{children}</div>}
    </div>
  );
}

function ProviderStateView() {
  const providers = useProviderStore((s) => s.providers);
  if (providers.length === 0) return <div className="text-[--text-muted] italic">No providers</div>;
  return (
    <>
      {providers.map((p) => (
        <div key={p.id} className="flex items-center gap-2 py-0.5 text-[10px]">
          <span className={cn("w-1.5 h-1.5 rounded-full", p.enabled ? "bg-emerald-500" : "bg-gray-500")} />
          <span className="text-[--text-primary]">{p.name}</span>
          <span className="text-[--text-muted]">({p.id})</span>
          <span className="ml-auto text-[--text-muted]">{p.health}</span>
        </div>
      ))}
    </>
  );
}
