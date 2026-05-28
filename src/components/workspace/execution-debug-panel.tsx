import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { executionEngine, type ExecutionState, type ExecutionEvent, type ExecutionTrace } from "@/runtime/execution-engine"
import { EXECUTION_MODES, type ExecutionModeId } from "@/runtime/execution-mode"
import { useAgentStore } from "@/stores/agent-store"
import { useWorkspaceRuntime } from "@/runtime/workspace-runtime"
import {
  Activity, Cpu, Brain, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Clock, BarChart3, Layers, Terminal, Zap,
  Target, BookOpen, UserCheck, Shield,
} from "lucide-react"

const STATE_META: Record<ExecutionState, { label: string; color: string }> = {
  IDLE:             { label: "Idle",            color: "text-white/30" },
  PLANNING:         { label: "Planning",        color: "text-amber-400" },
  ROUTING:          { label: "Routing",         color: "text-blue-400" },
  EXECUTING:        { label: "Executing",        color: "text-green-400" },
  STREAMING:        { label: "Streaming",        color: "text-cyan-400" },
  WAITING_APPROVAL: { label: "Waiting Approval", color: "text-orange-400" },
  TESTING:          { label: "Testing",          color: "text-purple-400" },
  ROLLBACK:         { label: "Rollback",         color: "text-red-400" },
  ERROR:            { label: "Error",            color: "text-red-500" },
  COMPLETE:         { label: "Complete",         color: "text-green-500" },
}

const MODE_ICONS: Record<ExecutionModeId, typeof Cpu> = {
  autonomous: Cpu,
  fastest: Zap,
  most_accurate: Target,
  research_heavy: BookOpen,
  human_guided: UserCheck,
  safe_mode: Shield,
}

/** Event log with structured details */
function EventRow({ event }: { event: ExecutionEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 as any })
  const typeColors: Record<string, string> = {
    TASK_RECEIVED: "text-blue-400",
    INTENT_CLASSIFIED: "text-purple-400",
    ROLES_SELECTED: "text-green-400",
    DELEGATION_START: "text-cyan-400",
    DELEGATION_COMPLETE: "text-emerald-400",
    STREAM_TOKEN: "text-white/40",
    STREAM_DONE: "text-green-400",
    APPROVAL_REQUIRED: "text-orange-400",
    APPROVAL_GRANTED: "text-green-400",
    APPROVAL_DENIED: "text-red-400",
    TESTS_PASSED: "text-green-400",
    TESTS_FAILED: "text-red-400",
    ROLLBACK_STARTED: "text-red-400",
    ROLLBACK_COMPLETE: "text-orange-400",
    ERROR_OCCURRED: "text-red-500",
    CANCELLED: "text-yellow-400",
    COMPLETED: "text-green-500",
  }

  return (
    <div className="flex items-start gap-2 py-0.5 group">
      <span className="text-[8px] font-mono text-white/20 shrink-0 mt-0.5 w-14 text-right">{time}</span>
      <span className={cn("text-[9px] font-medium shrink-0 w-28 truncate", typeColors[event.type] ?? "text-white/40")}>
        {event.type.replace(/_/g, " ")}
      </span>
      <div className="flex-1 min-w-0">
        {event.role && (
          <span className="text-[9px] text-white/50 font-mono mr-1.5">[{event.role}]</span>
        )}
        {event.message && (
          <span className="text-[9px] text-white/40 truncate">{event.message}</span>
        )}
        {event.durationMs && (
          <span className="text-[8px] text-white/25 ml-1">{event.durationMs}ms</span>
        )}
        {event.tokenCount && (
          <span className="text-[8px] text-white/25 ml-1">{event.tokenCount}tok</span>
        )}
        {event.error && (
          <span className="text-[9px] text-red-400/80 truncate">{event.error}</span>
        )}
      </div>
    </div>
  )
}

/** Mini sparkline for token usage */
function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const h = 20
  const w = data.length * 3 + 4
  const points = data.map((v, i) => {
    const x = i * 3 + 2
    const y = h - ((v / max) * (h - 4)) - 2
    return `${x},${y}`
  }).join(" ")

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-5">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} className="text-blue-400/60" />
      <circle cx={w - 2} cy={h - ((data[data.length - 1] / max) * (h - 4)) - 2} r="1.5" className="fill-blue-400" />
    </svg>
  )
}

export function ExecutionDebugPanel() {
  const [engineState, setEngineState] = useState(executionEngine.getState())
  const [diagnostics, setDiagnostics] = useState(executionEngine.getDiagnostics())
  const [events, setEvents] = useState<ExecutionEvent[]>([])
  const [showEvents, setShowEvents] = useState(true)
  const [showTimeline, setShowTimeline] = useState(true)
  const [showMetrics, setShowMetrics] = useState(true)
  const eventEndRef = useRef<HTMLDivElement>(null)
  const [tokenHistory, setTokenHistory] = useState<number[]>([])

  const executionMode = useAgentStore((s) => s.executionMode)
  const isProcessing = useAgentStore((s) => s.isProcessing)
  const wiredAgents = useWorkspaceRuntime((s) => s.wiredAgents)
  const runtimeStatus = useWorkspaceRuntime((s) => s.status)
  const runtimeReady = useWorkspaceRuntime((s) => s.isReady)

  const modeConfig = EXECUTION_MODES[executionMode]

  // Subscribe to engine events
  useEffect(() => {
    const unsub = executionEngine.subscribe((event) => {
      setEngineState(executionEngine.getState())
      setDiagnostics(executionEngine.getDiagnostics())
      setEvents((prev) => {
        const next = [...prev, event]
        // Keep last 200 events
        return next.length > 200 ? next.slice(-200) : next
      })
    })
    return unsub
  }, [])

  // Track token usage over time for sparkline
  useEffect(() => {
    const interval = setInterval(() => {
      if (diagnostics.totalTokens > 0) {
        setTokenHistory((prev) => [...prev.slice(-19), diagnostics.totalTokens])
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [diagnostics.totalTokens])

  // Auto-scroll event log
  useEffect(() => {
    if (showEvents) eventEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events.length, showEvents])

  const stateMeta = STATE_META[engineState] ?? { label: engineState, color: "text-white/30" }
  const trace = diagnostics.trace
  const traceDuration = trace?.startedAt ? (trace.endedAt ?? Date.now()) - trace.startedAt : 0

  const currentTrace = executionEngine.getTrace()

  // Filter for active role info
  const activeRoleInfo = useMemo(() => {
    if (!currentTrace) return null
    return {
      role: currentTrace.currentRole ?? "—",
      model: currentTrace.currentModel ?? "—",
      provider: currentTrace.currentProvider ?? "—",
      tokens: currentTrace.tokenUsage,
      toolCalls: currentTrace.toolCallCount,
      errors: currentTrace.errorCount,
    }
  }, [currentTrace])

  return (
    <div className="text-xs space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[11px] font-semibold text-white/70">Execution Pipeline</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode badge */}
          {modeConfig && (
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium border border-white/[0.06] bg-white/[0.03] text-white/50">
              {React.createElement(MODE_ICONS[executionMode] ?? Cpu, { className: "h-2.5 w-2.5", ...(modeConfig.color ? { className: `h-2.5 w-2.5 ${modeConfig.color}` } : {}) }) as any}
              {modeConfig.label}
            </span>
          )}
          {/* State badge */}
          <span className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium",
            engineState === "ERROR" ? "bg-red-500/10 text-red-400" :
            engineState === "COMPLETE" ? "bg-green-500/10 text-green-400" :
            engineState === "IDLE" ? "bg-white/[0.04] text-white/40" :
            "bg-blue-500/10 text-blue-400",
          )}>
            {engineState !== "IDLE" && engineState !== "COMPLETE" && engineState !== "ERROR" && (
              <Loader2 className="h-2 w-2 animate-spin" />
            )}
            {stateMeta.label}
          </span>
        </div>
      </div>

      {/* Active Execution Trace */}
      {currentTrace && (
        <div className="border border-white/[0.06] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center justify-between w-full px-2.5 py-1.5 bg-white/[0.02] text-[10px] text-white/50 hover:text-white/70"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="h-2.5 w-2.5" />
              <span className="font-medium">Active Trace</span>
              <span className="text-[8px] text-white/20">{(traceDuration / 1000).toFixed(1)}s</span>
            </div>
            {showTimeline ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          </button>
          <AnimatePresence>
            {showTimeline && currentTrace && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-2.5 space-y-2">
                  {/* Trace summary grid */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1.5">
                      <Brain className="h-3 w-3 text-amber-400" />
                      <span className="text-[9px] text-white/40">Role:</span>
                      <span className="text-[10px] font-medium text-white/70">{activeRoleInfo?.role}</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1.5">
                      <Cpu className="h-3 w-3 text-blue-400" />
                      <span className="text-[9px] text-white/40">Model:</span>
                      <span className="text-[10px] font-medium text-white/70 truncate">{activeRoleInfo?.model}</span>
                    </div>
                  </div>

                  {/* Provider, Tokens, Tool Calls, Errors */}
                  <div className="grid grid-cols-4 gap-1">
                    <div className="text-[8px] text-white/30 px-1">
                      <span className="block text-[7px] uppercase tracking-wider mb-0.5">Provider</span>
                      <span className="text-white/50 truncate block">{activeRoleInfo?.provider}</span>
                    </div>
                    <div className="text-[8px] text-white/30 px-1">
                      <span className="block text-[7px] uppercase tracking-wider mb-0.5">Tokens</span>
                      <span className="text-white/50">{activeRoleInfo?.tokens ?? 0}</span>
                    </div>
                    <div className="text-[8px] text-white/30 px-1">
                      <span className="block text-[7px] uppercase tracking-wider mb-0.5">Tools</span>
                      <span className="text-white/50">{activeRoleInfo?.toolCalls ?? 0}</span>
                    </div>
                    <div className="text-[8px] text-white/30 px-1">
                      <span className="block text-[7px] uppercase tracking-wider mb-0.5">Errors</span>
                      <span className={cn((activeRoleInfo?.errors ?? 0) > 0 ? "text-red-400" : "text-white/50")}>
                        {activeRoleInfo?.errors ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* State progress indicator */}
                  <div className="flex items-center gap-1">
                    {(["PLANNING", "ROUTING", "EXECUTING", "STREAMING", "COMPLETE"] as ExecutionState[]).map((s) => {
                      const meta = STATE_META[s]
                      const isActive = engineState === s
                      const isPast = currentTrace.events.some((e) => {
                        if (s === "PLANNING") return e.type === "TASK_RECEIVED"
                        if (s === "ROUTING") return e.type === "INTENT_CLASSIFIED"
                        if (s === "EXECUTING") return e.type === "DELEGATION_START"
                        if (s === "STREAMING") return e.type === "DELEGATION_COMPLETE"
                        if (s === "COMPLETE") return e.type === "COMPLETED"
                        return false
                      })
                      return (
                        <div key={s} className={cn(
                          "flex-1 h-1 rounded-full transition-all",
                          isPast || isActive ? "bg-blue-500" : "bg-white/[0.06]",
                          isActive && "animate-pulse",
                        )} />
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-[7px] text-white/20">
                    <span>PLANNING</span>
                    <span>ROUTING</span>
                    <span>EXECUTING</span>
                    <span>STREAMING</span>
                    <span>DONE</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Metrics section */}
      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="flex items-center justify-between w-full px-2.5 py-1.5 bg-white/[0.02] text-[10px] text-white/50 hover:text-white/70"
        >
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-2.5 w-2.5" />
            <span className="font-medium">Engine Metrics</span>
          </div>
          {showMetrics ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        </button>
        <AnimatePresence>
          {showMetrics && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-2.5 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[7px] uppercase tracking-wider text-white/30 block">Traces</span>
                    <span className="text-[11px] font-medium text-white/70">{diagnostics.historyLength}</span>
                  </div>
                  <div className="rounded bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[7px] uppercase tracking-wider text-white/30 block">Total Tokens</span>
                    <span className="text-[11px] font-medium text-white/70">{(diagnostics.totalTokens / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="rounded bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[7px] uppercase tracking-wider text-white/30 block">Tool Calls</span>
                    <span className="text-[11px] font-medium text-white/70">{diagnostics.totalToolCalls}</span>
                  </div>
                  <div className="rounded bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[7px] uppercase tracking-wider text-white/30 block">Avg Exec</span>
                    <span className="text-[11px] font-medium text-white/70">{(diagnostics.avgExecutionMs / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="rounded bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[7px] uppercase tracking-wider text-white/30 block">Errors</span>
                    <span className={cn("text-[11px] font-medium", diagnostics.totalErrors > 0 ? "text-red-400" : "text-white/70")}>
                      {diagnostics.totalErrors}
                    </span>
                  </div>
                  <div className="rounded bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[7px] uppercase tracking-wider text-white/30 block">State</span>
                    <span className={cn("text-[11px] font-medium", stateMeta.color)}>{stateMeta.label}</span>
                  </div>
                </div>

                {/* Token sparkline */}
                {tokenHistory.length >= 2 && (
                  <div className="rounded bg-white/[0.03] px-2 py-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] text-white/30">Token Usage Over Time</span>
                      <span className="text-[8px] font-mono text-white/20">{(diagnostics.totalTokens / 1000).toFixed(1)}k</span>
                    </div>
                    <MiniSparkline data={tokenHistory} />
                  </div>
                )}

                {/* Model info from wired agents */}
                {wiredAgents.length > 0 && (
                  <div className="rounded bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[7px] uppercase tracking-wider text-white/30 block mb-1">Wired Agents</span>
                    <div className="space-y-0.5">
                      {wiredAgents.slice(0, 5).map((a) => (
                        <div key={a.roleId} className="flex items-center justify-between text-[8px]">
                          <span className="text-white/50">{a.name}</span>
                          <span className="text-white/25 truncate ml-2 max-w-[120px]">{a.providerName}/{a.model}</span>
                        </div>
                      ))}
                      {wiredAgents.length > 5 && (
                        <span className="text-[7px] text-white/20">+{wiredAgents.length - 5} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Mode config summary */}
                {modeConfig && (
                  <div className="flex flex-wrap gap-1">
                    <span className={cn(
                      "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px]",
                      modeConfig.autoExecuteTools ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400",
                    )}>
                      {modeConfig.autoExecuteTools ? "Auto-exec" : "Requires approval"}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px]",
                      modeConfig.runTestsAfterImpl ? "bg-purple-500/10 text-purple-400" : "bg-white/[0.04] text-white/30",
                    )}>
                      {modeConfig.runTestsAfterImpl ? "Tests enabled" : "No tests"}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px]",
                      modeConfig.fileMutationsAllowed ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400",
                    )}>
                      {modeConfig.fileMutationsAllowed ? "File writes OK" : "Read-only"}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] bg-white/[0.04] text-white/30">
                      Retries: {modeConfig.maxRetries}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Event Log */}
      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <button
          onClick={() => setShowEvents(!showEvents)}
          className="flex items-center justify-between w-full px-2.5 py-1.5 bg-white/[0.02] text-[10px] text-white/50 hover:text-white/70"
        >
          <div className="flex items-center gap-1.5">
            <Terminal className="h-2.5 w-2.5" />
            <span className="font-medium">Event Log</span>
            <span className="text-[8px] text-white/20">{events.length} events</span>
          </div>
          {showEvents ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        </button>
        <AnimatePresence>
          {showEvents && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-48 overflow-y-auto px-2.5 py-1.5 space-y-0.5">
                {events.length === 0 ? (
                  <p className="text-[9px] text-white/20 text-center py-4">No events yet — send a message to start execution</p>
                ) : (
                  events.map((event, i) => <EventRow key={`${event.type}-${event.timestamp}-${i}`} event={event} />)
                )}
                <div ref={eventEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Need React for JSX elements
import React from "react"
