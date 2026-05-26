import { memo } from "react"
import { cn } from "@/lib/utils"
import {
  Activity,
  Wrench,
  AlertCircle,
  RotateCcw,
  Clock,
  Play,
  Square,
} from "lucide-react"
import { useRuntimeProjectionStore } from "@/stores/runtime-projections-store"
import type { RuntimeState } from "@/runtime/RuntimeTypes"

const STATE_COLORS: Record<RuntimeState, string> = {
  Idle: "text-white/30",
  Planning: "text-cyan-400",
  Retrieval: "text-blue-400",
  Executing: "text-amber-400",
  Verifying: "text-purple-400",
  Repairing: "text-orange-400",
  Completed: "text-emerald-400",
  Halted: "text-red-400",
}

const STATE_BG: Record<RuntimeState, string> = {
  Idle: "bg-white/5",
  Planning: "bg-cyan-500/10",
  Retrieval: "bg-blue-500/10",
  Executing: "bg-amber-500/10",
  Verifying: "bg-purple-500/10",
  Repairing: "bg-orange-500/10",
  Completed: "bg-emerald-500/10",
  Halted: "bg-red-500/10",
}

interface AgentStatusPanelProps {
  className?: string
  onStart?: () => void
  onHalt?: () => void
  compact?: boolean
}

export function AgentStatusPanel({ className, onStart, onHalt, compact }: AgentStatusPanelProps) {
  const currentState = useRuntimeProjectionStore((s) => s.currentState)
  const executionCount = useRuntimeProjectionStore((s) => s.executionCount)
  const totalToolCalls = useRuntimeProjectionStore((s) => s.totalToolCalls)
  const totalErrors = useRuntimeProjectionStore((s) => s.totalErrors)
  const totalRepairs = useRuntimeProjectionStore((s) => s.totalRepairs)
  const currentExecutionId = useRuntimeProjectionStore((s) => s.currentExecutionId)

  const isRunning = currentState !== "Idle" && currentState !== "Completed" && currentState !== "Halted"
  const isTerminal = currentState === "Completed" || currentState === "Halted"

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1",
          STATE_BG[currentState],
        )}>
          <Activity className={cn("h-3 w-3", STATE_COLORS[currentState])} />
          <span className={cn("text-[10px] font-medium", STATE_COLORS[currentState])}>
            {currentState}
          </span>
        </div>
        {totalToolCalls > 0 && (
          <span className="text-[9px] text-white/30 flex items-center gap-1">
            <Wrench className="h-2.5 w-2.5" />
            {totalToolCalls}
          </span>
        )}
        {totalErrors > 0 && (
          <span className="text-[9px] text-red-400/60 flex items-center gap-1">
            <AlertCircle className="h-2.5 w-2.5" />
            {totalErrors}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg border border-white/8 bg-white/[0.02]", className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-white/40" />
          <span className="text-[10px] font-medium text-white/50">Runtime Status</span>
        </div>
        <div className="flex items-center gap-1">
          {!isRunning && onStart && (
            <button
              onClick={onStart}
              className="flex items-center gap-1 rounded px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-[9px] font-medium"
            >
              <Play className="h-2.5 w-2.5" />
              Start
            </button>
          )}
          {isRunning && onHalt && (
            <button
              onClick={onHalt}
              className="flex items-center gap-1 rounded px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-[9px] font-medium"
            >
              <Square className="h-2.5 w-2.5" />
              Halt
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 space-y-2">
        <div className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5",
          STATE_BG[currentState],
        )}>
          <Activity className={cn("h-3 w-3", STATE_COLORS[currentState])} />
          <span className={cn("text-[11px] font-semibold", STATE_COLORS[currentState])}>
            {currentState}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md bg-white/[0.03] px-2 py-1.5">
            <div className="text-[8px] text-white/25 uppercase tracking-wide">Executions</div>
            <div className="text-[11px] font-medium text-white/60">{executionCount}</div>
          </div>
          <div className="rounded-md bg-white/[0.03] px-2 py-1.5">
            <div className="text-[8px] text-white/25 uppercase tracking-wide">Tool Calls</div>
            <div className="text-[11px] font-medium text-white/60">{totalToolCalls}</div>
          </div>
          <div className="rounded-md bg-white/[0.03] px-2 py-1.5">
            <div className="text-[8px] text-white/25 uppercase tracking-wide">Errors</div>
            <div className={cn("text-[11px] font-medium", totalErrors > 0 ? "text-red-400" : "text-white/60")}>
              {totalErrors}
            </div>
          </div>
          <div className="rounded-md bg-white/[0.03] px-2 py-1.5">
            <div className="text-[8px] text-white/25 uppercase tracking-wide">Repairs</div>
            <div className="text-[11px] font-medium text-white/60">{totalRepairs}</div>
          </div>
        </div>

        {currentExecutionId && (
          <div className="flex items-center gap-1 text-[9px] text-white/25">
            <Clock className="h-2.5 w-2.5" />
            <span className="font-mono truncate">{currentExecutionId}</span>
          </div>
        )}
      </div>
    </div>
  )
}
