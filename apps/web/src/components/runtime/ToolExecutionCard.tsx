import { memo } from "react"
import { Wrench, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActiveToolDisplay } from "@/stores/runtime-projections-store"

interface ToolExecutionCardProps {
  tool: ActiveToolDisplay
}

const STATUS_STYLES = {
  running: "border-amber-500/20 bg-amber-500/[0.02]",
  completed: "border-emerald-500/15 bg-emerald-500/[0.01]",
  failed: "border-red-500/20 bg-red-500/[0.02]",
} as const

export const ToolExecutionCard = memo(function ToolExecutionCard({ tool }: ToolExecutionCardProps) {
  return (
    <div className={cn("rounded-lg border overflow-hidden", STATUS_STYLES[tool.status])}>
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "flex items-center justify-center h-5 w-5 rounded shrink-0",
            tool.status === "running" && "bg-amber-500/10",
            tool.status === "completed" && "bg-emerald-500/10",
            tool.status === "failed" && "bg-red-500/10",
          )}>
            {tool.status === "running" && <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />}
            {tool.status === "completed" && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
            {tool.status === "failed" && <XCircle className="h-3 w-3 text-red-400" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-white/70 truncate">{tool.toolName}</span>
              {tool.durationMs !== null && (
                <span className="flex items-center gap-0.5 text-[8px] text-white/20">
                  <Clock className="h-2 w-2" />
                  {tool.durationMs}ms
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={cn(
          "text-[9px] font-medium shrink-0",
          tool.status === "running" && "text-amber-400/70",
          tool.status === "completed" && "text-emerald-400/70",
          tool.status === "failed" && "text-red-400/70",
        )}>
          {tool.status}
        </span>
      </div>

      {tool.args && (
        <div className="px-3 pb-1">
          <div className="text-[9px] text-white/35 font-mono truncate max-w-full">{tool.args}</div>
        </div>
      )}

      {tool.accumulatedOutput && (
        <div className="border-t border-white/6 px-3 py-1.5 max-h-24 overflow-y-auto">
          <div className="text-[9px] text-white/40 font-mono whitespace-pre-wrap leading-relaxed">
            {tool.accumulatedOutput}
          </div>
        </div>
      )}

      {tool.error && (
        <div className="border-t border-red-500/10 px-3 py-1.5">
          <div className="text-[9px] text-red-400/60 font-mono">{tool.error}</div>
        </div>
      )}
    </div>
  )
})
