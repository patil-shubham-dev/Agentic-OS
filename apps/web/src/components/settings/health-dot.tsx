import { cn } from "@/lib/utils";

export function HealthDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    healthy: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]",
    slow: "bg-amber-500 shadow-[0_0_6px_rgba(245,165,36,0.5)]",
    degraded: "bg-orange-500 shadow-[0_0_6px_rgba(251,146,60,0.5)]",
    offline: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]",
    unknown: "bg-zinc-600",
  };
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-full shrink-0",
        colorMap[status] || "bg-zinc-600",
        status === "healthy" && "animate-pulse"
      )}
    />
  );
}
