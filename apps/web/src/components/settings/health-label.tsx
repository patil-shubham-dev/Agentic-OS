import { HealthDot } from "./health-dot";
import { cn } from "@/lib/utils";

export function HealthLabel({ status, latency }: { status: string; latency?: number }) {
  const labelMap: Record<string, string> = {
    healthy: "Healthy",
    slow: "Slow",
    degraded: "Degraded",
    offline: "Offline",
    unknown: "Unknown",
  };
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-[--text-muted]">
      <HealthDot status={status} />
      <span>{labelMap[status] || "Unknown"}</span>
      {latency ? <span className="text-[--text-disabled]">· {latency}ms</span> : null}
    </span>
  );
}
