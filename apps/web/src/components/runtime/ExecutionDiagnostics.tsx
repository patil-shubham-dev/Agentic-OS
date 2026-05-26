import { cn } from "@/lib/utils"
import { useRuntimeProjectionStore } from "@/stores/runtime-projections-store"
import { StructuredError } from "./StructuredError"
import {
  Cpu,
  Activity,
  Wrench,
  AlertCircle,
  Timer,
  RefreshCw,
} from "lucide-react"

interface ExecutionDiagnosticsProps {
  className?: string
  onRetry?: () => void
}

export function ExecutionDiagnostics({ className, onRetry }: ExecutionDiagnosticsProps) {
  const currentState = useRuntimeProjectionStore((s) => s.currentState)
  const totalErrors = useRuntimeProjectionStore((s) => s.totalErrors)
  const totalToolCalls = useRuntimeProjectionStore((s) => s.totalToolCalls)
  const totalRepairs = useRuntimeProjectionStore((s) => s.totalRepairs)
  const activeTools = useRuntimeProjectionStore((s) => s.activeTools)
  const currentExecutionId = useRuntimeProjectionStore((s) => s.currentExecutionId)
  const projectedEvents = useRuntimeProjectionStore((s) => s.projectedEvents)

  const lastEvents = projectedEvents.slice(-10)
  const lastError = lastEvents.find((e) => e.kind === "execution_error" || e.kind === "tool_failed")
  const lastHalt = lastEvents.find((e) => e.kind === "execution_halted")

  const failedTools = Array.from(activeTools.values()).filter((t) => t.status === "failed")
  const runningTools = Array.from(activeTools.values()).filter((t) => t.status === "running")

  const hasFailed = currentState === "Halted" || currentState === "Idle" && totalErrors > 0

  return (
    <div className={cn("flex flex-col overflow-y-auto", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8">
        <Cpu className="h-3 w-3 text-cyan-400" />
        <span className="text-[9px] font-medium text-white/40 uppercase tracking-wider">Execution Diagnostics</span>
        {hasFailed && (
          <span className="text-[9px] text-red-400 ml-auto">Failed</span>
        )}
      </div>

      <div className="flex-1 px-3 py-2 space-y-2 overflow-y-auto">
        {/* State overview */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded bg-white/[0.03] px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] text-white/30 mb-0.5">
              <Activity className="h-2.5 w-2.5" />
              State
            </div>
            <span className={cn(
              "text-[11px] font-medium",
              hasFailed ? "text-red-400" : "text-white/70",
            )}>{currentState}</span>
          </div>
          <div className="rounded bg-white/[0.03] px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] text-white/30 mb-0.5">
              <Wrench className="h-2.5 w-2.5" />
              Tool calls
            </div>
            <span className="text-[11px] text-white/70">{totalToolCalls}</span>
          </div>
          <div className="rounded bg-white/[0.03] px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] text-white/30 mb-0.5">
              <AlertCircle className="h-2.5 w-2.5" />
              Errors
            </div>
            <span className={cn("text-[11px]", totalErrors > 0 ? "text-red-400" : "text-white/70")}>{totalErrors}</span>
          </div>
          <div className="rounded bg-white/[0.03] px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] text-white/30 mb-0.5">
              <Timer className="h-2.5 w-2.5" />
              Repairs
            </div>
            <span className="text-[11px] text-white/70">{totalRepairs}</span>
          </div>
        </div>

        {/* Failed tools */}
        {failedTools.length > 0 && (
          <div>
            <span className="text-[9px] text-red-400/60 font-medium block mb-1">Failed Tools</span>
            {failedTools.map((tool) => (
              <StructuredError
                key={tool.toolId}
                title={`Tool Failed: ${tool.toolName}`}
                cause={tool.error ?? "Unknown error"}
                suggestedFixes={["Verify tool configuration", "Check provider connectivity", "Retry execution"]}
                onRetry={onRetry}
                className="mb-1"
              />
            ))}
          </div>
        )}

        {/* Running tools */}
        {runningTools.length > 0 && (
          <div>
            <span className="text-[9px] text-amber-400/60 font-medium block mb-1">Running Tools</span>
            {runningTools.map((tool) => (
              <div key={tool.toolId} className="rounded border border-amber-500/15 bg-amber-500/[0.03] px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <RefreshCw className="h-2.5 w-2.5 text-amber-400 animate-spin" />
                  <span className="text-[10px] text-amber-300">{tool.toolName}</span>
                </div>
                {tool.accumulatedOutput && (
                  <p className="text-[9px] text-white/40 mt-0.5 truncate">{tool.accumulatedOutput.slice(0, 100)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Last error */}
        {lastError && (
          <div>
            <span className="text-[9px] text-red-400/60 font-medium block mb-1">Last Error</span>
            <div className="rounded border border-red-500/15 bg-red-500/[0.03] px-2 py-1.5">
              <p className="text-[10px] text-red-300">
                {"error" in lastError ? (lastError as any).error : "Unknown"}
              </p>
            </div>
          </div>
        )}

        {/* Halt reason */}
        {lastHalt && (
          <div>
            <span className="text-[9px] text-red-400/60 font-medium block mb-1">Execution Halted</span>
            <div className="rounded border border-red-500/15 bg-red-500/[0.03] px-2 py-1.5">
              <p className="text-[10px] text-red-300">
                {"reason" in lastHalt ? (lastHalt as any).reason : "No reason"}
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalToolCalls === 0 && !hasFailed && (
          <div className="flex items-center justify-center h-24">
            <div className="text-center">
              <Activity className="h-4 w-4 text-white/20 mx-auto mb-1" />
              <p className="text-[10px] text-white/25">No execution data yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
