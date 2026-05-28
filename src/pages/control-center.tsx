import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import type { RuntimeRole } from "@/types"
import { useAppStore } from "@/stores/app-store"
import { useAgentStore } from "@/stores/agent-store"
import { cn } from "@/lib/utils"
import { useLeakTracker } from "@/performance/leak-detector"
import {
  Play, Square, RotateCcw, Cpu, MessageSquare, Search,
  Activity, Layers, Brain, AlertTriangle, CheckCircle2, Settings2,
  Wifi, WifiOff, Loader2, Server,
} from "lucide-react"

const stateColors: Record<string, string> = {
  idle: "bg-white/20",
  running: "bg-blue-500",
  error: "bg-red-500",
  completed: "bg-green-500",
}

const roleIcons: Record<string, string> = {
  coding: "bg-blue-500/10 text-blue-500",
  design: "bg-purple-500/10 text-purple-500",
  vision: "bg-pink-500/10 text-pink-500",
  manager: "bg-amber-500/10 text-amber-500",
  qa: "bg-green-500/10 text-green-500",
  runtime: "bg-cyan-500/10 text-cyan-500",
}

const RUNTIME_STATE_DOTS: Record<string, string> = {
  idle: "bg-white/20",
  thinking: "bg-blue-400 animate-pulse",
  planning: "bg-amber-400 animate-pulse",
  executing: "bg-green-400 animate-pulse",
  waiting: "bg-yellow-400",
  reviewing: "bg-purple-400 animate-pulse",
  failed: "bg-red-500",
  recovering: "bg-orange-500 animate-pulse",
}

const CAPABILITY_BADGES: Record<string, { label: string; color: string }> = {
  coding: { label: "Code", color: "bg-blue-500/10 text-blue-400" },
  vision: { label: "Vision", color: "bg-pink-500/10 text-pink-400" },
  reasoning: { label: "Reason", color: "bg-indigo-500/10 text-indigo-400" },
  orchestration: { label: "Orch", color: "bg-amber-500/10 text-amber-400" },
  browsing: { label: "Web", color: "bg-sky-500/10 text-sky-400" },
  toolExecution: { label: "Tools", color: "bg-zinc-500/10 text-zinc-400" },
}

type InitStage = "loading" | "providers" | "orchestration" | "agents" | "ready" | "error"

function InitLoader({ stage }: { stage: InitStage }) {
  const messages: Record<InitStage, { label: string; detail: string }> = {
    loading: { label: "Initializing Runtime Engine...", detail: "Starting system services" },
    providers: { label: "Loading AI Providers...", detail: "Connecting to configured endpoints" },
    orchestration: { label: "Starting Orchestration Layer...", detail: "Warming up agent runtime" },
    agents: { label: "Registering Agent Workforce...", detail: "Loading role configurations" },
    ready: { label: "System Ready", detail: "All systems operational" },
    error: { label: "Initialization Failed", detail: "System encountered an error during startup" },
  }
  const msg = messages[stage] || messages.loading

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-12">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-2 border-white/10 flex items-center justify-center bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-xl">
          {stage === "error" ? (
            <AlertTriangle className="h-8 w-8 text-red-400" />
          ) : (
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          )}
        </div>
        {stage !== "error" && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 animate-ping" />
        )}
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold text-white tracking-tight">{msg.label}</p>
        <p className="text-sm text-white/40">{msg.detail}</p>
      </div>
      <div className="flex gap-1.5">
        {(["loading", "providers", "orchestration", "agents"] as InitStage[]).map((s) => {
          const stages = ["loading", "providers", "orchestration", "agents"]
          const idx = stages.indexOf(s)
          const cur = stages.indexOf(stage === "error" ? "loading" : stage)
          return (
            <div
              key={s}
              className={cn(
                "h-1.5 w-8 rounded-full transition-all duration-500",
                idx <= cur ? "bg-blue-500" : "bg-white/5"
              )}
            />
          )
        })}
      </div>
    </div>
  )
}

function FallbackCard({ title, description, action, actionLabel, icon: Icon }: {
  title: string
  description: string
  action?: () => void
  actionLabel?: string
  icon?: typeof AlertTriangle
}) {
  const IconComp = Icon || AlertTriangle
  return (
    <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] to-transparent p-5 backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-amber-500/10 p-2 shrink-0">
          <IconComp className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-300">{title}</p>
          <p className="text-xs text-white/50 mt-1">{description}</p>
          {action && actionLabel && (
            <button
              onClick={action}
              className="flex items-center gap-1 text-xs text-amber-400 hover:underline mt-2 transition-colors"
            >
              <Settings2 className="h-3 w-3" /> {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DiagnosticsOverlay() {
  const [diagnostics, setDiagnostics] = useState<{ key: string; value: string }[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const enabled = sessionStorage.getItem("opencode-diagnostics") === "true"
    setVisible(enabled)
    if (enabled) {
      setDiagnostics([
        { key: "Router", value: "HashRouter (active)" },
        { key: "Safe Mode", value: sessionStorage.getItem("opencode-safe-mode") === "true" ? "Enabled" : "Disabled" },
        { key: "Location", value: window.location.hash || "/" },
        { key: "User Agent", value: navigator.userAgent.slice(0, 60) },
        { key: "Session", value: new Date().toISOString() },
      ])
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-2xl border border-blue-500/20 bg-black/90 backdrop-blur-xl p-3 shadow-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-[10px] font-medium text-blue-300">Runtime Diagnostics</span>
      </div>
      <div className="space-y-1">
        {diagnostics.map((d) => (
          <div key={d.key} className="flex items-center justify-between gap-2 text-[9px]">
            <span className="text-white/40">{d.key}</span>
            <span className="text-white/70 font-mono truncate max-w-[160px]">{d.value}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => { sessionStorage.removeItem("opencode-diagnostics"); location.reload() }}
        className="mt-2 text-[9px] text-blue-400/60 hover:text-blue-400"
      >
        Dismiss
      </button>
    </div>
  )
}

function OrchestrationPanel({
  managerConfigured,
  roleConfigStats,
  navigate,
}: {
  managerConfigured: boolean
  roleConfigStats: { total: number; enabled: number; configured: number; executing: number }
  navigate: ReturnType<typeof useNavigate>
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/10">
          <Brain className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <span className="text-xs font-semibold text-white/70">Orchestration</span>
      </div>
      <div className="space-y-2">
        {managerConfigured ? (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-400">Ready</span>
            <span className="text-xs text-white/40">– Manager is active</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-400">Setup Required</span>
            <button onClick={() => navigate("/settings")} className="text-xs text-amber-500 hover:underline ml-1">Configure</button>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>{roleConfigStats.configured} role(s) configured</span>
          <span className="text-white/[0.06]">·</span>
          <span>{roleConfigStats.executing} executing</span>
        </div>
        {!managerConfigured && (
          <p className="text-[10px] text-amber-400/70 mt-1">
            Autonomous orchestration is unavailable until a Manager role is configured with a provider and model.
          </p>
        )}
      </div>
    </div>
  )
}

function ProviderStatusCard({ providers }: { providers: ReturnType<typeof useAppStore.getState>["providers"] }) {
  const configured = providers.filter((p) => p.apiKey.length > 0).length

  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-500/10">
          <Server className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <span className="text-xs font-semibold text-white/70">Providers</span>
      </div>
      {providers.length === 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-white/30" />
            <span className="text-sm text-white/50">No Providers</span>
          </div>
          <p className="text-[10px] text-white/30">Add an AI provider to enable agent orchestration.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Wifi className={cn("h-4 w-4", configured > 0 ? "text-green-400" : "text-white/30")} />
              <span className="text-sm font-medium text-white/70">{configured}/{providers.length} configured</span>
            </div>
            <span className="text-xs text-white/40">{providers.reduce((s, p) => s + p.models.length, 0)} models</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {providers.slice(0, 4).map((p) => (
              <span
                key={p.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono border",
                  p.apiKey
                    ? "border-green-500/20 text-green-400 bg-green-500/5"
                    : "border-white/10 text-white/40 bg-white/[0.02]"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", p.apiKey ? "bg-green-500" : "bg-white/20")} />
                {p.name}
              </span>
            ))}
            {providers.length > 4 && (
              <span className="text-[9px] text-white/30">+{providers.length - 4}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RuntimeHealthCard({
  roleConfigs,
  isProcessing,
  taskQueue,
}: {
  roleConfigs: ReturnType<typeof useAppStore.getState>["roleConfigs"]
  isProcessing: boolean
  taskQueue: ReturnType<typeof useAgentStore.getState>["taskQueue"]
}) {
  const runningRoles = roleConfigs.filter((r) => r.runtimeState === "executing" || r.runtimeState === "thinking")
  const failedRoles = roleConfigs.filter((r) => r.runtimeState === "failed")

  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple-500/10">
          <Activity className="h-3.5 w-3.5 text-purple-400" />
        </div>
        <span className="text-xs font-semibold text-white/70">Runtime Health</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={cn("inline-block h-2 w-2 rounded-full", isProcessing ? "bg-green-500 animate-pulse" : "bg-green-500")} />
            <span className="text-sm font-medium text-white/70">{isProcessing ? "Active" : "Idle"}</span>
          </div>
          <span className="text-xs text-white/40">{runningRoles.length} running · {failedRoles.length} failed</span>
        </div>
        {taskQueue.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Activity className="h-3 w-3" />
            <span>{taskQueue.length} tasks in queue</span>
            <span className="text-[10px]">({taskQueue.filter((t) => t.status === "queued").length} queued, {taskQueue.filter((t) => t.status === "running").length} running)</span>
          </div>
        )}
        {failedRoles.length > 0 && (
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 px-3 py-2">
            <p className="text-[10px] text-red-400 font-medium">{failedRoles.length} agent(s) in failed state</p>
            <p className="text-[9px] text-red-300/60 mt-0.5">{failedRoles.map((r) => r.name).join(", ")}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function ControlCenterPage() {
  useLeakTracker("ControlCenterPage")
  const navigate = useNavigate()
  const [initStage, setInitStage] = useState<InitStage>("loading")

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      try {
        if (!cancelled) setInitStage("loading")
        await new Promise((r) => setTimeout(r, 200))
        if (!cancelled) setInitStage("providers")
        const providers = useAppStore.getState().providers
        if (!cancelled && providers.length === 0) await new Promise((r) => setTimeout(r, 150))
        if (!cancelled) setInitStage("orchestration")
        await new Promise((r) => setTimeout(r, 150))
        if (!cancelled) setInitStage("agents")
        const roleConfigs = useAppStore.getState().roleConfigs
        if (!cancelled && roleConfigs.length === 0) {
          useAppStore.getState().initializeDefaultRoles()
          await new Promise((r) => setTimeout(r, 100))
        }
        if (!cancelled) { setInitStage("ready"); await new Promise((r) => setTimeout(r, 300)); setInitStage("ready") }
      } catch {
        if (!cancelled) setInitStage("error")
      }
    }
    initialize()
    return () => { cancelled = true }
  }, [])

  const agents = useAppStore((s) => s.agents)
  const roleConfigs = useAppStore((s) => s.roleConfigs)
  const providers = useAppStore((s) => s.providers)
  const processingRole = useAgentStore((s) => s.processingRole)
  const isProcessing = useAgentStore((s) => s.isProcessing)
  const taskQueue = useAgentStore((s) => s.taskQueue)
  const activeRole = useAgentStore((s) => s.activeRole)
  const conversations = useAgentStore((s) => s.conversations)
  const orchestrationSteps = useAgentStore((s) => s.orchestrationSteps)
  const [agentSearch, setAgentSearch] = useState("")
  const [showAllRoles, setShowAllRoles] = useState(false)

  const totalTokens = agents.reduce((sum, a) => sum + a.tokenUsage, 0)
  const totalMessages = Object.values(conversations).reduce((sum, c) => sum + (c?.messages?.length ?? 0), 0)
  const managerConfigured = useMemo(() => {
    const mgr = roleConfigs.find((r) => r.name.toLowerCase() === "manager")
    return !!(mgr && mgr.isEnabled && mgr.model && mgr.providerId)
  }, [roleConfigs])

  const enabledRoleConfigs = useMemo(() => roleConfigs.filter((r) => r.isEnabled), [roleConfigs])

  const roleConfigStats = useMemo(() => ({
    total: roleConfigs.length,
    enabled: enabledRoleConfigs.length,
    configured: enabledRoleConfigs.filter((r) => r.model && r.providerId).length,
    executing: enabledRoleConfigs.filter((r) => r.runtimeState === "executing").length,
  }), [roleConfigs, enabledRoleConfigs])

  const activeSteps = orchestrationSteps.filter((s) => s.status === "running").length
  const completedSteps = orchestrationSteps.filter((s) => s.status === "done").length
  const totalSteps = orchestrationSteps.length

  function getAgentState(roleId: string): { state: string; task: string | null } {
    const role = roleConfigs.find((r) => r.id === roleId || r.runtimeRole === roleId)
    const key = (role?.runtimeRole ?? roleId) as RuntimeRole
    const conv = conversations[key]
    const lastMsg = conv?.messages?.filter((m: { role: string }) => m.role === "user").slice(-1)[0]
    return {
      state: conv?.messages && conv.messages.length > 0 ? "completed" : "idle",
      task: lastMsg?.content?.slice(0, 100) ?? null,
    }
  }

  function getMessageCount(roleId: string): number {
    const role = roleConfigs.find((r) => r.id === roleId || r.runtimeRole === roleId)
    const key = (role?.runtimeRole ?? roleId) as RuntimeRole
    return conversations[key]?.messages?.length ?? 0
  }

  const filteredRoles = enabledRoleConfigs.filter((r) => {
    if (!agentSearch) return true
    const q = agentSearch.toLowerCase()
    return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
  })

  if (initStage !== "ready" && initStage !== "error") {
    return <InitLoader stage={initStage} />
  }

  return (
    <ErrorBoundary>
      <div className="h-full overflow-y-auto bg-[#0a0a0b]">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
        <DiagnosticsOverlay />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/40">Mission control for the AI operating system</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">System:</span>
              <span className="text-xs font-medium text-white/70">Online</span>
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            {managerConfigured ? (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Manager Ready
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Manager Required
              </span>
            )}
          </div>
        </div>

        {/* Summary stats bar — 6 columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Tokens", value: `${(totalTokens / 1000).toFixed(1)}K`, icon: Cpu, color: "text-blue-400", detail: "across all agents" },
            { label: "Total Messages", value: totalMessages.toLocaleString(), icon: MessageSquare, color: "text-purple-400", detail: "conversation history" },
            { label: "Active Roles", value: `${roleConfigStats.configured}/${roleConfigStats.enabled}`, icon: Layers, color: "text-amber-400", detail: `${roleConfigStats.executing} executing` },
            { label: "Orchestration Steps", value: totalSteps > 0 ? `${completedSteps}/${totalSteps}` : "—", icon: Brain, color: "text-green-400", detail: totalSteps > 0 ? `${activeSteps} active` : "idle" },
            { label: "Providers", value: `${providers.length}`, icon: Server, color: "text-cyan-400", detail: `${providers.filter((p) => p.apiKey).length} connected` },
            { label: "Task Queue", value: `${taskQueue.length}`, icon: Activity, color: "text-rose-400", detail: taskQueue.length > 0 ? `${taskQueue.filter((t) => t.status === "running").length} running` : "empty" },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xl font-bold text-white">{stat.value}</span>
                  <Icon className={cn("h-4 w-4", stat.color)} />
                </div>
                <p className="text-[10px] text-white/40">{stat.label}</p>
                <p className="text-[8px] text-white/20">{stat.detail}</p>
              </div>
            )
          })}
        </div>

        {/* Second row: orchestration, runtime, providers */}
        <div className="grid grid-cols-3 gap-4">
          <OrchestrationPanel managerConfigured={managerConfigured} roleConfigStats={roleConfigStats} navigate={navigate} />
          <RuntimeHealthCard roleConfigs={roleConfigs} isProcessing={isProcessing} taskQueue={taskQueue} />
          <ProviderStatusCard providers={providers} />
        </div>

        {/* Task Queue */}
        {taskQueue.length > 0 && (
          <div className="rounded-2xl border-l-4 border-l-blue-500 border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-semibold text-white/70">Task Queue</span>
              </div>
              <span className="text-xs text-white/40">{taskQueue.length} tasks</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {taskQueue.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 transition-colors">
                  <span className={cn(
                    "inline-block h-2 w-2 rounded-full shrink-0",
                    task.status === "running" ? "bg-blue-500 animate-pulse" :
                    task.status === "completed" ? "bg-green-500" :
                    task.status === "failed" ? "bg-red-500" : "bg-white/20"
                  )} />
                  <span className={cn("text-[10px] font-medium w-20 shrink-0 capitalize", roleIcons[task.role]?.split(" ")[1] ?? "text-white/70")}>
                    {task.role}
                  </span>
                  <span className="text-[10px] text-white/50 truncate flex-1">{task.prompt}</span>
                  <span className="text-[8px] text-white/30 shrink-0">{new Date(Date.now()).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent filter */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
            <input
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              placeholder="Search agents..."
              className="h-9 w-full rounded-xl border border-white/5 bg-white/[0.03] pl-8 pr-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/10"
            />
          </div>
          {enabledRoleConfigs.length > 6 && (
            <button onClick={() => setShowAllRoles(!showAllRoles)} className="text-xs text-white/40 hover:text-white/70 transition-colors">
              {showAllRoles ? "Show less" : `Show all ${enabledRoleConfigs.length}`}
            </button>
          )}
        </div>

        {/* Agent cards */}
        {(filteredRoles.length > 0 || roleConfigs.length === 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredRoles.map((roleConfig) => {
                const agentRole = roleConfig.runtimeRole ?? roleConfig.id as any
                const agentState = getAgentState(roleConfig.id)
                const msgCount = getMessageCount(roleConfig.id)
                const isConfigured = !!(roleConfig.model && roleConfig.providerId)
                const isManager = roleConfig.name.toLowerCase() === "manager"
                const stateDot = RUNTIME_STATE_DOTS[roleConfig.runtimeState] || RUNTIME_STATE_DOTS.idle

                return (
                  <motion.div
                    key={roleConfig.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "rounded-2xl border transition-all duration-200 backdrop-blur-xl",
                      isConfigured
                        ? "border-green-500/10 bg-gradient-to-br from-green-500/[0.02] to-white/[0.01]"
                        : "border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
                    )}
                  >
                    <div className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "flex items-center justify-center h-8 w-8 rounded-xl",
                            roleIcons[agentRole] ?? "bg-white/[0.04] text-white/40"
                          )}>
                            <Activity className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white/80 truncate">{roleConfig.name}</h3>
                            <p className="text-[10px] text-white/40 truncate">{roleConfig.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("inline-block h-2 w-2 rounded-full", stateDot)} />
                          {isConfigured && (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                      </div>

                      {/* Stats grid — 3 columns, no cost */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
                          <p className="text-[8px] text-white/30 uppercase tracking-wider">Model</p>
                          <p className="text-[10px] font-medium text-white/60 truncate mt-0.5">
                            {roleConfig.model ? (
                              <>
                                {roleConfig.model.split("/").pop()?.slice(0, 20)}
                                {roleConfig.fallbackModel && <span className="text-white/20"> +1</span>}
                              </>
                            ) : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
                          <p className="text-[8px] text-white/30 uppercase tracking-wider">Tokens</p>
                          <p className="text-[10px] font-medium text-white/60 mt-0.5">
                            {agents.find((a) => a.role === agentRole)?.tokenUsage?.toLocaleString() ?? 0}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
                          <p className="text-[8px] text-white/30 uppercase tracking-wider">Messages</p>
                          <p className="text-[10px] font-medium text-white/60 mt-0.5">{msgCount}</p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-white/40">Status:</span>
                        <span className={cn(
                          "text-[10px] font-medium capitalize",
                          roleConfig.runtimeState === "executing" ? "text-green-400" :
                          roleConfig.runtimeState === "failed" ? "text-red-400" :
                          roleConfig.runtimeState === "thinking" ? "text-blue-400" :
                          "text-white/40"
                        )}>
                          {roleConfig.runtimeState}
                        </span>
                        {isConfigured ? (
                          <span className="ml-auto text-[8px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md">configured</span>
                        ) : (
                          <span className="ml-auto text-[8px] text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded-md">no config</span>
                        )}
                      </div>

                      {/* Capability tags */}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(CAPABILITY_BADGES).map(([key, badge]) => {
                          if ((roleConfig.capabilities as any)[key]) {
                            return (
                              <span key={key} className={cn("text-[8px] px-1.5 py-0.5 rounded-md", badge.color)}>
                                {badge.label}
                              </span>
                            )
                          }
                          return null
                        })}
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-1.5 pt-1">
                        <button className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all disabled:opacity-50 border border-blue-500/10" disabled={isProcessing || !managerConfigured}>
                          <Play className="h-3 w-3" /> Run
                        </button>
                        {agentState.state === "running" && (
                          <button className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all border border-red-500/10">
                            <Square className="h-3 w-3" /> Stop
                          </button>
                        )}
                        <button className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium bg-white/[0.04] text-white/50 hover:bg-white/[0.08] transition-all border border-white/5">
                          <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                      </div>

                      {agentState.task && (
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                          <p className="text-[8px] text-white/30 uppercase tracking-wider mb-0.5">Last Task</p>
                          <p className="text-[10px] text-white/60 truncate">{agentState.task}</p>
                        </div>
                      )}

                      {!isManager && !managerConfigured && (
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-2.5 py-1.5">
                          <p className="text-[9px] text-amber-400">Configure Manager role first for orchestration</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-white/5" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-24 bg-white/5 rounded" />
                    <div className="h-2 w-32 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-10 bg-white/5 rounded-xl" />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <div className="h-6 w-14 bg-white/5 rounded-xl" />
                  <div className="h-6 w-14 bg-white/5 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
