import { cn } from "@/lib/utils"
import {
  Activity,
  Wrench,
  AlertCircle,
  RotateCcw,
  Cpu,
  Shield,
  Gauge,
  MemoryStick,
  Timer,
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

interface RuntimeStatusBarProps {
  className?: string
  providerName?: string
}

export function RuntimeStatusBar({ className, providerName }: RuntimeStatusBarProps) {
  const currentState = useRuntimeProjectionStore((s) => s.currentState)
  const totalToolCalls = useRuntimeProjectionStore((s) => s.totalToolCalls)
  const totalErrors = useRuntimeProjectionStore((s) => s.totalErrors)
  const totalRepairs = useRuntimeProjectionStore((s) => s.totalRepairs)
  const executionCount = useRuntimeProjectionStore((s) => s.executionCount)

  const isSandboxed = true

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 h-[22px] border-t border-white/[0.02] bg-[#0a0a0b] text-[9px]",
        className,
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Runtime state */}
        <div className={cn("flex items-center gap-1 rounded px-1.5 py-0.5", STATE_BG[currentState])}>
          <Activity className={cn("h-2.5 w-2.5", STATE_COLORS[currentState])} />
          <span className={cn("font-medium", STATE_COLORS[currentState])}>{currentState}</span>
        </div>

        {/* Provider */}
        {providerName && (
          <span className="flex items-center gap-1 text-white/30">
            <Cpu className="h-2.5 w-2.5" />
            {providerName}
          </span>
        )}

        {/* Sandbox state */}
        <span className="flex items-center gap-1 text-white/30">
          <Shield className={cn("h-2.5 w-2.5", isSandboxed ? "text-emerald-400/60" : "text-red-400/60")} />
          <span className={isSandboxed ? "text-emerald-400/60" : "text-red-400/60"}>
            {isSandboxed ? "sandbox" : "exposed"}
          </span>
        </span>
      </div>

      {/* Center section */}
      <div className="flex items-center gap-3">
        {/* Token budget indicator (placeholder) */}
        <span className="flex items-center gap-1 text-white/20">
          <Gauge className="h-2.5 w-2.5" />
          <span>0k</span>
        </span>

        {/* Memory pressure (placeholder) */}
        <span className="flex items-center gap-1 text-white/20">
          <MemoryStick className="h-2.5 w-2.5" />
          <span>0%</span>
        </span>

        {/* Execution health */}
        {executionCount > 0 && (
          <span className="flex items-center gap-1 text-white/20">
            <Timer className="h-2.5 w-2.5" />
            <span>{executionCount} exec</span>
          </span>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {totalToolCalls > 0 && (
          <span className="flex items-center gap-1 text-white/25">
            <Wrench className="h-2.5 w-2.5" />
            {totalToolCalls}
          </span>
        )}
        {totalErrors > 0 && (
          <span className="flex items-center gap-1 text-red-400/60">
            <AlertCircle className="h-2.5 w-2.5" />
            {totalErrors}
          </span>
        )}
        {totalRepairs > 0 && (
          <span className="flex items-center gap-1 text-amber-400/60">
            <RotateCcw className="h-2.5 w-2.5" />
            {totalRepairs}
          </span>
        )}
        {/* Model latency placeholder */}
        <span className="text-white/15">—</span>
      </div>
    </div>
  )
}
