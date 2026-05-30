import { useWorkspaceStore } from "@/stores/workspace-store"
import { useAgentStore } from "@/stores/agent-store"
import { useWorkspaceRuntime } from "@/runtime/workspace-runtime"
import { cn } from "@/lib/utils"
import {
  Cpu, Brain, Wifi, WifiOff, Users, Activity,
  ArrowRight, CheckCircle2, AlertTriangle,
} from "lucide-react"

export function ExecutionTopology({ className }: { className?: string }) {
  const rootPath = useWorkspaceStore((s) => s.rootPath)
  const runtimeConfig = useWorkspaceStore((s) => s.runtimeConfig)

  // Runtime state
  const runtimeStatus = useWorkspaceRuntime((s) => s.status)
  const runtimeReady = useWorkspaceRuntime((s) => s.isReady)
  const wiredAgents = useWorkspaceRuntime((s) => s.wiredAgents)
  const totalProviders = useWorkspaceRuntime((s) => s.totalProviders)
  const totalRoles = useWorkspaceRuntime((s) => s.totalRoles)
  const managerWired = useWorkspaceRuntime((s) => s.managerWired)

  if (!rootPath) return null

  const stateColor: Record<string, string> = {
    idle: "text-muted-foreground",
    analyzing: "text-blue-500",
    planning: "text-amber-500",
    executing: "text-green-500",
    reviewing: "text-purple-500",
    error: "text-red-500",
  }

  const modeIcons: Record<string, typeof Cpu> = {
    autonomous: Brain,
    fastest: Activity,
    most_accurate: CheckCircle2,
    research_heavy: Users,
    human_guided: Users,
    safe_mode: AlertTriangle,
  }

  return (
    <div className={cn("rounded-lg border bg-black/20 p-3", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Workspace Runtime</span>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-full",
          runtimeReady ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"
        )}>
          {runtimeReady ? "Active" : runtimeStatus === "initializing" ? "Starting" : "Inactive"}
        </span>
      </div>

      {/* Runtime status */}
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Runtime</span>
          <span className={cn(
            "font-medium",
            runtimeReady ? "text-green-400" : "text-muted-foreground"
          )}>
            {runtimeReady ? "Ready" : runtimeStatus}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Providers</span>
          <span className="font-medium">{totalProviders}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Roles</span>
          <span className="font-medium">{totalRoles}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Wired Agents</span>
          <span className="font-medium">{wiredAgents.length}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Manager</span>
          {managerWired ? (
            <span className="flex items-center gap-1 text-green-400"><Wifi className="h-3 w-3" /> Wired</span>
          ) : (
            <span className="flex items-center gap-1 text-red-400"><WifiOff className="h-3 w-3" /> Not wired</span>
          )}
        </div>

      </div>

      {/* Wired agents list */}
      {wiredAgents.length > 0 && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <div className="text-[10px] text-muted-foreground font-medium mb-1.5">Connected Agents</div>
          <div className="space-y-1">
            {wiredAgents.map((agent) => (
              <div key={agent.roleId} className="flex items-center gap-1.5 text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="font-medium">{agent.name}</span>
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-muted-foreground truncate">{agent.model}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function TopologyIndicator() {
  const runtimeReady = useWorkspaceRuntime((s) => s.isReady)
  const wiredAgents = useWorkspaceRuntime((s) => s.wiredAgents)
  const runtimeStatus = useWorkspaceRuntime((s) => s.status)

  if (!runtimeReady) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium",
        runtimeStatus === "initializing" ? "bg-blue-500/10 text-blue-400" : "bg-muted/20 text-muted-foreground"
      )}>
        {runtimeStatus === "initializing" ? "Starting" : "Offline"}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
      {wiredAgents.length} agent{wiredAgents.length !== 1 ? "s" : ""}
    </span>
  )
}
