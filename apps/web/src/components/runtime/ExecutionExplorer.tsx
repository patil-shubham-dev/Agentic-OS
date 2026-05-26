import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Network, GitBranch, Layers, Wrench, Loader2, CheckCircle2,
  XCircle, ChevronDown, ChevronRight, Cpu, Timer, FileCode,
  Zap, AlertTriangle,
} from "lucide-react"
import { useRuntimeProjectionStore } from "@/stores/runtime-projections-store"

interface ExecutionExplorerProps {
  className?: string
}

const STATE_TELEMETRY: Record<string, { phase: string; activeAgent: string; color: string }> = {
  Idle: { phase: "idle", activeAgent: "none", color: "text-white/30" },
  Planning: { phase: "planning", activeAgent: "coordinator", color: "text-cyan-400" },
  Retrieval: { phase: "researching", activeAgent: "researcher", color: "text-blue-400" },
  Executing: { phase: "executing", activeAgent: "coder", color: "text-amber-400" },
  Verifying: { phase: "verifying", activeAgent: "verifier", color: "text-purple-400" },
  Repairing: { phase: "repairing", activeAgent: "verifier", color: "text-orange-400" },
  Completed: { phase: "completed", activeAgent: "none", color: "text-emerald-400" },
  Halted: { phase: "failed", activeAgent: "none", color: "text-red-400" },
}

const AGENT_CONFIG: { kind: string; name: string; icon: typeof Network; phases: string[] }[] = [
  { kind: "coordinator", name: "Coordinator", icon: Network, phases: ["planning"] },
  { kind: "researcher", name: "Research", icon: Layers, phases: ["researching"] },
  { kind: "coder", name: "Coder", icon: Wrench, phases: ["executing"] },
  { kind: "verifier", name: "Verifier", icon: CheckCircle2, phases: ["verifying", "repairing"] },
]

function LiveAgentHierarchy() {
  const currentState = useRuntimeProjectionStore((s) => s.currentState)
  const activeTools = useRuntimeProjectionStore((s) => s.activeTools)
  const currentExecutionId = useRuntimeProjectionStore((s) => s.currentExecutionId)
  const totalErrors = useRuntimeProjectionStore((s) => s.totalErrors)
  const projectedEvents = useRuntimeProjectionStore((s) => s.projectedEvents)
  const telemetry = STATE_TELEMETRY[currentState] ?? STATE_TELEMETRY.Idle

  const failedTools = Array.from(activeTools.values()).filter((t) => t.status === "failed")
  const runningTools = Array.from(activeTools.values()).filter((t) => t.status === "running")
  const lastEvents = projectedEvents.slice(-5)
  const lastToolEvent = lastEvents.reverse().find(
    (e) => e.kind === "tool_started" || e.kind === "tool_completed" || e.kind === "tool_failed",
  )

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Network className="h-3 w-3 text-white/40" />
        <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Agents</span>
      </div>
      {AGENT_CONFIG.map((agent) => {
        const Icon = agent.icon
        const isActive = agent.phases.includes(telemetry.phase)
        const hasError = agent.kind === telemetry.activeAgent && totalErrors > 0 && currentState === "Halted"
        const toolCount = agent.kind === "coder" ? runningTools.length : 0

        return (
          <div
            key={agent.kind}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded transition-colors",
              isActive ? (hasError ? "bg-red-500/8 text-red-300" : "bg-blue-500/8 text-blue-300") : "text-white/40 hover:bg-white/[0.03]",
            )}
          >
            <Icon className={cn("h-3 w-3", isActive && !hasError && "animate-pulse")} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium truncate">{agent.name}</span>
                {isActive && !hasError && (
                  <Loader2 className="h-2 w-2 text-blue-400 animate-spin shrink-0" />
                )}
                {hasError && (
                  <XCircle className="h-2.5 w-2.5 text-red-400 shrink-0" />
                )}
              </div>
              {/* Active tool indicator */}
              {isActive && runningTools.length > 0 && (
                <span className="text-[8px] text-white/30 block truncate mt-0.5">
                  <Wrench className="h-2 w-2 inline mr-0.5" />
                  {runningTools[0].toolName}
                  {runningTools.length > 1 && ` +${runningTools.length - 1}`}
                </span>
              )}
            </div>
            {isActive && toolCount > 0 && (
              <span className="text-[8px] text-white/30 bg-white/5 rounded px-1">{toolCount}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LiveTelemetryPanel() {
  const currentState = useRuntimeProjectionStore((s) => s.currentState)
  const totalToolCalls = useRuntimeProjectionStore((s) => s.totalToolCalls)
  const totalErrors = useRuntimeProjectionStore((s) => s.totalErrors)
  const totalRepairs = useRuntimeProjectionStore((s) => s.totalRepairs)
  const executionCount = useRuntimeProjectionStore((s) => s.executionCount)
  const activeTools = useRuntimeProjectionStore((s) => s.activeTools)
  const projectedEvents = useRuntimeProjectionStore((s) => s.projectedEvents)

  const telemetry = STATE_TELEMETRY[currentState] ?? STATE_TELEMETRY.Idle
  const isActive = currentState !== "Idle" && currentState !== "Completed"
  const runningTools = Array.from(activeTools.values()).filter((t) => t.status === "running")
  const lastFilePath = projectedEvents.slice().reverse().find((e) => e.kind === "tool_requested")

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Cpu className="h-3 w-3 text-white/40" />
        <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Runtime</span>
      </div>
      <div className="px-2 space-y-0.5">
        {/* Phase */}
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">Phase</span>
          <span className={cn("text-[9px] font-medium", telemetry.color)}>{telemetry.phase}</span>
        </div>
        {/* Active tool */}
        {runningTools.length > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-white/35">Active tool</span>
            <span className="text-[9px] text-amber-300">{runningTools[0].toolName}</span>
          </div>
        )}
        {/* Execution depth */}
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">Depth</span>
          <span className="text-[9px] text-white/60">{executionCount > 0 ? `#${executionCount}` : "—"}</span>
        </div>
        {/* Current file (from last tool_requested) */}
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">File</span>
          <span className="text-[9px] text-white/60 truncate max-w-[100px]" title={lastFilePath && "args" in lastFilePath ? (lastFilePath as any).args : ""}>
            <FileCode className="h-2 w-2 inline mr-0.5" />
            {lastFilePath && "args" in lastFilePath ? ((lastFilePath as any).args ?? "").split(" ").slice(-1)[0]?.split("/").pop() ?? "—" : "—"}
          </span>
        </div>
        {/* Token usage (placeholder - actual TPM tracking) */}
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">Tokens</span>
          <span className="text-[9px] text-white/60">
            <Zap className="h-2 w-2 inline mr-0.5" />
            {totalToolCalls > 0 ? `${totalToolCalls * 500}+` : "—"}
          </span>
        </div>
        {/* Provider latency */}
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">Latency</span>
          <span className="text-[9px] text-white/60">
            <Timer className="h-2 w-2 inline mr-0.5" />
            {isActive ? "streaming" : "—"}
          </span>
        </div>
      </div>
    </div>
  )
}

function ExecutionSummary() {
  const executionCount = useRuntimeProjectionStore((s) => s.executionCount)
  const totalToolCalls = useRuntimeProjectionStore((s) => s.totalToolCalls)
  const totalErrors = useRuntimeProjectionStore((s) => s.totalErrors)
  const totalRepairs = useRuntimeProjectionStore((s) => s.totalRepairs)
  const currentState = useRuntimeProjectionStore((s) => s.currentState)

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Layers className="h-3 w-3 text-white/40" />
        <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Executions</span>
      </div>
      <div className="px-2 space-y-0.5">
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">Count</span>
          <span className="text-[9px] text-white/60">{executionCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">Tools</span>
          <span className="text-[9px] text-white/60">{totalToolCalls}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">Errors</span>
          <span className={cn("text-[9px]", totalErrors > 0 ? "text-red-400" : "text-white/60")}>{totalErrors}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">Repairs</span>
          <span className="text-[9px] text-white/60">{totalRepairs}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-white/35">State</span>
          <span className={cn("text-[9px]", STATE_TELEMETRY[currentState]?.color ?? "text-white/60")}>{currentState}</span>
        </div>
      </div>
    </div>
  )
}

function WorktreeStatus() {
  const currentState = useRuntimeProjectionStore((s) => s.currentState)
  const isActive = currentState !== "Idle" && currentState !== "Completed"

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <GitBranch className="h-3 w-3 text-white/40" />
        <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Worktrees</span>
      </div>
      <div className="px-2 py-1">
        {isActive && (
          <div className="flex items-center gap-2 text-[9px] text-amber-400/70">
            <Loader2 className="h-2 w-2 animate-spin" />
            execution active
          </div>
        )}
        {!isActive && (
          <div className="text-[9px] text-white/25">no active worktrees</div>
        )}
      </div>
    </div>
  )
}

export function ExecutionExplorer({ className }: ExecutionExplorerProps) {
  const [expanded, setExpanded] = useState(true)
  const currentState = useRuntimeProjectionStore((s) => s.currentState)
  const totalErrors = useRuntimeProjectionStore((s) => s.totalErrors)
  const hasFailed = currentState === "Halted" || (currentState === "Idle" && totalErrors > 0)

  return (
    <div className={cn("flex flex-col overflow-y-auto", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center justify-between px-2 py-1.5 border-b border-white/8 hover:bg-white/[0.03] transition-colors",
          hasFailed && "bg-red-500/[0.03]",
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Execution</span>
          {hasFailed && <AlertTriangle className="h-2.5 w-2.5 text-red-400" />}
        </div>
        {expanded ? <ChevronDown className="h-2.5 w-2.5 text-white/30" /> : <ChevronRight className="h-2.5 w-2.5 text-white/30" />}
      </button>
      {expanded && (
        <div className="flex-1 space-y-3 py-2">
          <LiveAgentHierarchy />
          <div className="border-t border-white/8 mx-2" />
          <LiveTelemetryPanel />
          <div className="border-t border-white/8 mx-2" />
          <ExecutionSummary />
          <div className="border-t border-white/8 mx-2" />
          <WorktreeStatus />
        </div>
      )}
    </div>
  )
}
