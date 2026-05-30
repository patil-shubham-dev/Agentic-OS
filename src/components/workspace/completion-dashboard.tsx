import { useCompletionStore, type CompletionSource } from "@/lib/completion/completion-store"
import { cn } from "@/lib/utils"
import { BarChart3, Activity, Zap, Database, Brain, RefreshCw, Check, X } from "lucide-react"

const sourceLabels: Record<CompletionSource, string> = {
  cache: "Cache",
  syntax: "Syntax",
  pattern: "Pattern",
  workspace: "Workspace",
  ai: "AI",
}

const sourceIcons: Record<CompletionSource, typeof Zap> = {
  cache: Database,
  syntax: Zap,
  pattern: Activity,
  workspace: Database,
  ai: Brain,
}

export function CompletionDashboard() {
  const totalSuggestions = useCompletionStore((s) => s.totalSuggestions)
  const accepted = useCompletionStore((s) => s.accepted)
  const rejected = useCompletionStore((s) => s.rejected)
  const avgLatency = useCompletionStore((s) => s.avgLatency)
  const perSource = useCompletionStore((s) => s.perSource)
  const aiCost = useCompletionStore((s) => s.aiCost)
  const resetSession = useCompletionStore((s) => s.resetSession)

  const acceptRate = totalSuggestions > 0 ? ((accepted / totalSuggestions) * 100).toFixed(1) : "—"
  const total = totalSuggestions || 1

  return (
    <div className="flex flex-col gap-3 text-[11px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
          <span className="font-medium text-white/70">Completion Metrics</span>
        </div>
        <button
          onClick={resetSession}
          className="flex items-center gap-1 rounded px-2 py-1 text-[9px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          Reset
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 px-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase mb-1">
            <Check className="h-2.5 w-2.5 text-green-400" />
            Accept Rate
          </div>
          <span className="text-lg font-semibold text-green-400">{acceptRate}%</span>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase mb-1">
            <Activity className="h-2.5 w-2.5 text-blue-400" />
            Avg Latency
          </div>
          <span className="text-lg font-semibold text-blue-400">{avgLatency}ms</span>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase mb-1">
            <X className="h-2.5 w-2.5 text-red-400" />
            Rejected
          </div>
          <span className="text-lg font-semibold text-red-400">{rejected}</span>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase mb-1">
            <Brain className="h-2.5 w-2.5 text-purple-400" />
            AI Tokens
          </div>
          <span className="text-lg font-semibold text-purple-400">{aiCost.toLocaleString()}</span>
        </div>
      </div>

      {/* Per-source breakdown */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase mb-2">
          <Zap className="h-2.5 w-2.5" />
          By Source
        </div>
        <div className="space-y-1.5">
          {(Object.keys(sourceLabels) as CompletionSource[]).map((source) => {
            const data = perSource[source]
            const Icon = sourceIcons[source]
            const pct = total > 0 ? ((data.shown / total) * 100).toFixed(0) : "0"
            return (
              <div key={source} className="flex items-center gap-2">
                <Icon className="h-3 w-3 text-white/30 shrink-0" />
                <span className="w-16 text-[10px] text-white/50">{sourceLabels[source]}</span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      source === "ai" ? "bg-purple-500/50" :
                      source === "cache" ? "bg-blue-500/50" :
                      source === "syntax" ? "bg-yellow-500/50" :
                      source === "pattern" ? "bg-green-500/50" :
                      "bg-orange-500/50",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[9px] font-mono text-white/40">{pct}%</span>
                <span className="w-6 text-right text-[9px] font-mono text-white/20">{data.accepted}✓</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
