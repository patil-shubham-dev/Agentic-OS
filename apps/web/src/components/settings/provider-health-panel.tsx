import { Wifi, WifiOff, Activity, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UniversalProviderConfig } from "@/lib/runtime/types";
import { HealthLabel } from "./health-label";

interface ProviderHealthPanelProps {
  providers: UniversalProviderConfig[];
  onTestConnection: (providerId: string) => void;
  testingProvider: string | null;
}

export function ProviderHealthPanel({
  providers,
  onTestConnection,
  testingProvider,
}: ProviderHealthPanelProps) {
  const healthyCount = providers.filter((p) => p.health === "healthy").length;
  const enabledCount = providers.filter((p) => p.enabled).length;

  return (
    <div className="agentos-card overflow-hidden">
      <div className="border-b border-[--border-primary] px-5 py-4">
        <h3 className="text-base font-semibold text-[--text-primary] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[--accent-primary]" /> Provider Health
        </h3>
        <p className="text-xs text-[--text-muted] mt-0.5">
          {healthyCount}/{enabledCount} providers healthy
        </p>
      </div>
      <div className="p-5 space-y-2">
        {providers.length === 0 ? (
          <div className="py-8 text-center">
            <WifiOff className="w-8 h-8 text-[--text-muted] mx-auto mb-2" />
            <p className="text-xs text-[--text-muted]">No providers configured</p>
          </div>
        ) : (
          providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-3 rounded-xl bg-[--bg-tertiary]/40 border border-[--border-primary]"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    p.health === "healthy" && "bg-emerald-500 animate-pulse",
                    p.health === "slow" && "bg-amber-500",
                    p.health === "degraded" && "bg-orange-500",
                    p.health === "offline" && "bg-red-500",
                    p.health === "unknown" && "bg-zinc-600"
                  )}
                />
                <div>
                  <p className="text-xs font-medium text-[--text-primary]">{p.name}</p>
                  <HealthLabel status={p.health} latency={p.latency} />
                </div>
              </div>
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
