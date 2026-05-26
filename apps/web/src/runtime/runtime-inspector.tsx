import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useWorkspaceRuntime } from "./workspace-runtime"
import { useAgentStore } from "@/stores/agent-store"
import { useLedgerStore } from "@/stores/ledger-store"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { RenderMetrics, type MetricsSnapshot } from "@/runtime/render-engine/render-metrics"
import {
  Activity, Cpu, Users, Network, CheckCircle2, XCircle, Loader2,
  ArrowRight, Wifi, WifiOff, AlertTriangle, Brain, Globe,
  Palette, Code2, Eye, UserCircle, Terminal, Zap, Search,
  ChevronDown, ChevronUp, Clock, BarChart3, Layers, Gauge,
} from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  uninitialized: "text-white/30",
  initializing: "text-blue-400",
  ready: "text-green-400",
  error: "text-red-400",
}

const ROLE_ICONS: Record<string, typeof Cpu> = {
  manager: Brain,
  coder: Code2,
  vision: Eye,
  research: Search,
  runtime: Terminal,
  design: Palette,
  browser: Globe,
  qa: UserCircle,
  memory: Brain,
  "fast-inference": Zap,
}

const ROLE_COLORS: Record<string, string> = {
  manager: "text-amber-400",
  coder: "text-blue-400",
  vision: "text-pink-400",
  research: "text-purple-400",
  runtime: "text-cyan-400",
  design: "text-fuchsia-400",
  browser: "text-sky-400",
  qa: "text-green-400",
  memory: "text-indigo-400",
  "fast-inference": "text-emerald-400",
}

// ── Mini Sparkline ──
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = data.length * 4
  const h = 24

  const points = data.map((v, i) => {
    const x = i * 4 + 2
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(" ")

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-6", className)}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="text-blue-400/70"
      />
      {data.length > 1 && (
        <circle
          cx={(data.length - 1) * 4 + 2}
          cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
          r="2"
          className="fill-blue-400"
        />
      )}
    </svg>
  )
}

// ── Topology Node ──
function TopologyNode({ role, wired, name, providerName, model }: {
  role: string
  wired: boolean
  name: string
  providerName?: string
  model?: string
}) {
  const Icon = ROLE_ICONS[role] || Cpu
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all",
      wired
        ? "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"
        : "border-white/[0.03] bg-white/[0.01] opacity-50",
    )}>
      <div className="relative flex items-center justify-center h-5 w-5 rounded-lg shrink-0 bg-white/[0.04]">
        <Icon className={cn("h-2.5 w-2.5", wired ? ROLE_COLORS[role] || "text-white/40" : "text-white/20")} />
        {wired && (
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-500 border border-[#0a0a0b]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[10px] font-medium truncate", wired ? "text-white/70" : "text-white/30")}>
            {name}
          </span>
          {!wired && (
            <WifiOff className="h-2 w-2 text-white/20 shrink-0" />
          )}
        </div>
        {wired && providerName && (
          <p className="text-[8px] text-white/30 truncate">{providerName} / {model}</p>
        )}
      </div>
    </div>
  )
}

// ── Execution Log Stream ──
function ExecutionLogStream({ maxEntries = 20 }: { maxEntries?: number }) {
  const orchestrationSteps = useAgentStore((s) => s.orchestrationSteps)
  const ledgerEntries = useLedgerStore((s) => s.entries)
  const [expanded, setExpanded] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const logs = useMemo(() => {
    const steps = orchestrationSteps.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      type: "orchestration" as const,
      agent: s.agent,
      status: s.status,
      description: s.description,
    }))

    const ledgers = ledgerEntries.slice(-10).map((e) => ({
      id: `${e.timestamp}-${e.action}`,
      timestamp: new Date(e.timestamp).getTime(),
      type: "ledger" as const,
      agent: e.agentId,
      status: e.status === "success" ? "done" as const : "failed" as const,
      description: e.summary.slice(0, 80),
    }))

    return [...steps, ...ledgers]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxEntries)
  }, [orchestrationSteps, ledgerEntries, maxEntries])

  useEffect(() => {
    if (expanded) logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs.length, expanded])

  if (logs.length === 0) return null

  return (
    <div className="border-t border-white/[0.06]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 text-[10px] text-white/40 hover:text-white/60 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Clock className="h-2.5 w-2.5" />
          <span className="font-medium">Execution Log</span>
          <span className="text-[8px] text-white/20">{logs.length} entries</span>
        </div>
        {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-40 overflow-y-auto space-y-0.5 px-3 pb-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 py-0.5">
                  <div className={cn(
                    "mt-0.5 h-1.5 w-1.5 rounded-full shrink-0",
                    log.status === "running" ? "bg-blue-500 animate-pulse" :
                    log.status === "done" ? "bg-green-500" :
                    log.status === "failed" ? "bg-red-500" : "bg-white/20",
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-[9px] font-medium",
                        log.status === "running" ? "text-blue-400" :
                        log.status === "done" ? "text-green-400" :
                        log.status === "failed" ? "text-red-400" : "text-white/40",
                      )}>
                        {log.agent}
                      </span>
                      <span className="text-[8px] text-white/20 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[9px] text-white/40 truncate">{log.description}</p>
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main RuntimeInspector ──
export function RuntimeInspector() {
  const status = useWorkspaceRuntime((s) => s.status)
  const statusMessage = useWorkspaceRuntime((s) => s.statusMessage)
  const totalProviders = useWorkspaceRuntime((s) => s.totalProviders)
  const totalRoles = useWorkspaceRuntime((s) => s.totalRoles)
  const wiredRoles = useWorkspaceRuntime((s) => s.wiredRoles)
  const managerWired = useWorkspaceRuntime((s) => s.managerWired)
  const isReady = useWorkspaceRuntime((s) => s.isReady)
  const wiredAgents = useWorkspaceRuntime((s) => s.wiredAgents)
  const memoryPressure = useWorkspaceRuntime((s) => s.memoryPressure)
  const tokenUsage = useWorkspaceRuntime((s) => s.tokenUsage)
  const bootSequence = useWorkspaceRuntime((s) => s.bootSequence)
  const error = useWorkspaceRuntime((s) => s.error)

  const [showTopology, setShowTopology] = useState(true)
  const [showMetrics, setShowMetrics] = useState(true)

  // Track token usage over time for sparkline
  const tokenHistoryRef = useRef<number[]>([])
  const [tokenHistory, setTokenHistory] = useState<number[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      const current = useWorkspaceRuntime.getState().tokenUsage
      tokenHistoryRef.current = [...tokenHistoryRef.current.slice(-19), current]
      if (tokenHistoryRef.current.length >= 2) {
        setTokenHistory([...tokenHistoryRef.current])
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // All roles for topology visualization
  const allRoles = useMemo(() => [
    { id: "manager", name: "Manager", wired: managerWired },
    { id: "coder", name: "Coder", wired: wiredAgents.some((a) => a.runtimeRole === "coder") },
    { id: "design", name: "Design", wired: wiredAgents.some((a) => a.runtimeRole === "design") },
    { id: "research", name: "Research", wired: wiredAgents.some((a) => a.runtimeRole === "research") },
    { id: "browser", name: "Browser", wired: wiredAgents.some((a) => a.runtimeRole === "browser") },
    { id: "runtime", name: "Runtime", wired: wiredAgents.some((a) => a.runtimeRole === "runtime") },
    { id: "vision", name: "Vision", wired: wiredAgents.some((a) => a.runtimeRole === "vision") },
    { id: "qa", name: "QA", wired: wiredAgents.some((a) => a.runtimeRole === "qa") },
    { id: "fast-inference", name: "Fast Inf.", wired: wiredAgents.some((a) => a.runtimeRole === "fast-inference") },
    { id: "memory", name: "Memory", wired: wiredAgents.some((a) => a.runtimeRole === "memory") },
  ], [wiredAgents, managerWired])

  // ── Render metrics live subscription ──
  const [renderMetrics, setRenderMetrics] = useState<MetricsSnapshot | null>(null)

  useEffect(() => {
    const metrics = RenderMetrics.getInstance()
    const unsub = metrics.onMetrics((snapshot) => {
      setRenderMetrics(snapshot)
    })
    return unsub
  }, [])

  return (
    <div className="text-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[11px] font-semibold text-white/70">Runtime Inspector</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium",
            status === "ready" && isReady ? "bg-green-500/10 text-green-400" :
            status === "error" ? "bg-red-500/10 text-red-400" :
            status === "initializing" ? "bg-blue-500/10 text-blue-400" :
            "bg-white/[0.04] text-white/40",
          )}>
            {status === "initializing" && <Loader2 className="h-2 w-2 animate-spin" />}
            {status === "ready" && isReady ? "Active" : status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2">
        <span className={cn("font-medium text-[10px]", STATUS_COLORS[status])}>
          {status === "initializing" && <Loader2 className="inline h-2.5 w-2.5 animate-spin mr-1" />}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        <span className="text-[9px] text-white/40">{statusMessage}</span>
        {isReady && <CheckCircle2 className="h-3 w-3 text-green-500" />}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5 border border-red-500/15">
          <XCircle className="h-3 w-3 shrink-0" />
          <span className="text-[9px]">{error}</span>
        </div>
      )}

      {/* ── Agent Topology ── */}
      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <button
          onClick={() => setShowTopology(!showTopology)}
          className="flex items-center justify-between w-full px-2.5 py-1.5 bg-white/[0.02] text-[10px] text-white/50 hover:text-white/70 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Layers className="h-2.5 w-2.5" />
            <span className="font-medium">Agent Topology</span>
            <span className="text-[8px] text-white/20">{wiredRoles}/{totalRoles} wired</span>
          </div>
          {showTopology ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        </button>
        <AnimatePresence>
          {showTopology && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-2 space-y-1">
                {allRoles.map((role) => {
                  const wired = wiredAgents.find((a) => a.runtimeRole === role.id)
                  return (
                    <TopologyNode
                      key={role.id}
                      role={role.id}
                      wired={!!wired}
                      name={role.name}
                      providerName={wired?.providerName}
                      model={wired?.model}
                    />
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Metrics Grid ── */}
      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="flex items-center justify-between w-full px-2.5 py-1.5 bg-white/[0.02] text-[10px] text-white/50 hover:text-white/70 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-2.5 w-2.5" />
            <span className="font-medium">Metrics</span>
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
              <div className="p-2.5 space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1.5">
                    <Cpu className="h-3 w-3 text-blue-400" />
                    <span className="text-[9px] text-white/40">Providers:</span>
                    <span className="text-[10px] font-medium text-white/70">{totalProviders}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1.5">
                    <Users className="h-3 w-3 text-purple-400" />
                    <span className="text-[9px] text-white/40">Roles:</span>
                    <span className="text-[10px] font-medium text-white/70">{totalRoles}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1.5">
                    <Network className="h-3 w-3 text-green-400" />
                    <span className="text-[9px] text-white/40">Wired:</span>
                    <span className="text-[10px] font-medium text-white/70">{wiredRoles}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1.5">
                    <Users className="h-3 w-3 text-amber-400" />
                    <span className="text-[9px] text-white/40">Manager:</span>
                    <span className={cn("text-[10px] font-medium", managerWired ? "text-green-400" : "text-red-400")}>
                      {managerWired ? "Wired" : "Not wired"}
                    </span>
                  </div>
                </div>

                {/* Token usage sparkline */}
                {tokenHistory.length >= 2 && (
                  <div className="rounded bg-white/[0.03] px-2 py-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <Activity className="h-2.5 w-2.5 text-blue-400" />
                        <span className="text-[9px] text-white/40">Token Usage</span>
                      </div>
                      <span className="text-[9px] font-mono text-white/50">
                        {(tokenHistory[tokenHistory.length - 1] / 1000).toFixed(1)}k
                      </span>
                    </div>
                    <Sparkline data={tokenHistory} className="w-full" />
                  </div>
                )}

                {/* Memory + Token inline */}
                {(memoryPressure > 0 || tokenUsage > 0) && (
                  <div className="flex items-center gap-3">
                    {memoryPressure > 0 && (
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          memoryPressure > 70 ? "bg-red-500" : memoryPressure > 40 ? "bg-amber-500" : "bg-green-500",
                        )} />
                        <span className="text-[9px] text-white/40">Mem: {memoryPressure}%</span>
                      </div>
                    )}
                    {tokenUsage > 0 && (
                      <div className="flex items-center gap-1">
                        <Activity className="h-2.5 w-2.5 text-white/30" />
                        <span className="text-[9px] text-white/40">{(tokenUsage / 1000).toFixed(1)}k tokens</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Render Engine Metrics ── */}
      {renderMetrics && (
        <div className="border border-white/[0.06] rounded-lg overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.02]">
            <Gauge className="h-2.5 w-2.5 text-blue-400" />
            <span className="text-[10px] font-medium text-white/50">Render Engine</span>
            <span className="text-[8px] text-white/20 ml-auto">{renderMetrics.renderFps} FPS</span>
          </div>
          <div className="p-2 grid grid-cols-2 gap-1">
            <div className="flex items-center gap-1 rounded bg-white/[0.03] px-1.5 py-1">
              <span className="text-[8px] text-white/30">TPS</span>
              <span className="text-[9px] font-mono text-white/60">{renderMetrics.tokensPerSecond}</span>
            </div>
            <div className="flex items-center gap-1 rounded bg-white/[0.03] px-1.5 py-1">
              <span className="text-[8px] text-white/30">FPS</span>
              <span className={cn("text-[9px] font-mono", renderMetrics.renderFps >= 30 ? "text-green-400" : renderMetrics.renderFps >= 15 ? "text-yellow-400" : "text-red-400")}>{renderMetrics.renderFps}</span>
            </div>
            <div className="flex items-center gap-1 rounded bg-white/[0.03] px-1.5 py-1">
              <span className="text-[8px] text-white/30">Flushes</span>
              <span className="text-[9px] font-mono text-white/60">{renderMetrics.totalFlushes}</span>
            </div>
            <div className="flex items-center gap-1 rounded bg-white/[0.03] px-1.5 py-1">
              <span className="text-[8px] text-white/30">Queue</span>
              <span className={cn("text-[9px] font-mono", renderMetrics.schedulerQueueDepth > 10 ? "text-yellow-400" : "text-white/60")}>{renderMetrics.schedulerQueueDepth}</span>
            </div>
            <div className="flex items-center gap-1 rounded bg-white/[0.03] px-1.5 py-1">
              <span className="text-[8px] text-white/30">Buffers</span>
              <span className="text-[9px] font-mono text-white/60">{renderMetrics.activeBuffers}</span>
            </div>
            <div className="flex items-center gap-1 rounded bg-white/[0.03] px-1.5 py-1">
              <span className="text-[8px] text-white/30">Active</span>
              <span className="text-[9px] font-mono text-white/60">{renderMetrics.activeStepCards}</span>
            </div>
            <div className="flex items-center gap-1 rounded bg-white/[0.03] px-1.5 py-1 col-span-2">
              <span className="text-[8px] text-white/30">Total tokens</span>
              <span className="text-[9px] font-mono text-white/60">{renderMetrics.totalTokens}</span>
              <span className="text-[8px] text-white/20 ml-auto">max {renderMetrics.maxTokensPerFlush}/flush</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Wired Agents Detail ── */}
      {wiredAgents.length > 0 && !showTopology && (
        <div>
          <span className="text-[9px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1 mb-1.5">
            <Wifi className="h-2.5 w-2.5 text-green-400" />
            Connected Agents
          </span>
          <div className="space-y-1">
            {wiredAgents.map((agent) => {
              const Icon = ROLE_ICONS[agent.runtimeRole] || Cpu
              return (
                <div
                  key={agent.roleId}
                  className="flex items-center justify-between rounded bg-white/[0.03] px-2 py-1"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className={cn("h-2.5 w-2.5 shrink-0", ROLE_COLORS[agent.runtimeRole] || "text-white/40")} />
                    <span className="text-[10px] font-medium text-white/60 truncate">{agent.name}</span>
                  </div>
                  <span className="text-[8px] text-white/30 truncate ml-2">
                    {agent.providerName} / {agent.model}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Boot Sequence ── */}
      <div>
        <span className="text-[9px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1 mb-1.5">
          <Loader2 className="h-2.5 w-2.5 text-blue-400" />
          Boot Sequence
        </span>
        <div className="space-y-0.5">
          {bootSequence.map((step, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {step.status === "running" ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-400" />
              ) : step.status === "done" ? (
                <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
              ) : step.status === "failed" ? (
                <XCircle className="h-2.5 w-2.5 text-red-500" />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              )}
              <span className={cn(
                "text-[9px]",
                step.status === "done" ? "text-white/50" :
                step.status === "running" ? "text-blue-400" :
                step.status === "failed" ? "text-red-400" :
                "text-white/30",
              )}>
                {step.step}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Execution Log Stream ── */}
      <ExecutionLogStream />
    </div>
  )
}
