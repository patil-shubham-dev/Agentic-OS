import { useState } from "react"
import { useLedgerStore } from "@/stores/ledger-store"
import { useAgentStore } from "@/stores/agent-store"
import { Search, CheckCircle, XCircle, GitBranch, Code, Palette, Eye, LayoutDashboard, Cpu, UserCircle, Sparkles, Play, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const ROLE_ICONS: Record<string, typeof Code> = {
  coding: Code,
  design: Palette,
  vision: Eye,
  qa: LayoutDashboard,
  manager: UserCircle,
  runtime: Cpu,
}

const ROLE_COLORS: Record<string, string> = {
  coding: "text-blue-500",
  design: "text-pink-500",
  vision: "text-purple-500",
  qa: "text-green-500",
  manager: "text-amber-500",
  runtime: "text-cyan-500",
}

const STEP_ICONS: Record<string, typeof Play> = {
  analyze: Sparkles,
  delegate: GitBranch,
  execute: Play,
  review: Eye,
  complete: CheckCircle,
  error: XCircle,
}

export function TransactionLog() {
  const entries = useLedgerStore((s) => s.entries)
  const orchestrationSteps = useAgentStore((s) => s.orchestrationSteps)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">("all")
  const [view, setView] = useState<"entries" | "orchestration">("entries")

  const filtered = entries.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        e.summary.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.agentId.toLowerCase().includes(q) ||
        (e.file?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  if (entries.length === 0 && orchestrationSteps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-muted-foreground">No ledger entries yet</p>
        <p className="text-xs text-muted-foreground mt-1">Agent actions will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2 space-y-2">
        <h3 className="text-sm font-medium">Transaction Log</h3>

        {/* View toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setView("entries")}
            className={cn("rounded px-2 py-0.5 text-xs transition-colors", view === "entries" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Entries ({entries.length})
          </button>
          <button
            onClick={() => setView("orchestration")}
            className={cn("rounded px-2 py-0.5 text-xs transition-colors", view === "orchestration" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            <GitBranch className="h-3 w-3 inline mr-0.5" />
            Orchestration ({orchestrationSteps.length})
          </button>
        </div>

        {view === "entries" && (
          <>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries..."
                className="h-7 w-full rounded border bg-background pl-7 pr-2 text-xs outline-none"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "success", "error"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs transition-colors",
                    statusFilter === s
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "all" ? "All" : s === "success" ? "Success" : "Error"}
                  <span className="ml-1 text-xs opacity-60">
                    {s === "all" ? entries.length : entries.filter((e) => e.status === s).length}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === "orchestration" && orchestrationSteps.length > 0 && (
          <div className="relative p-3">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border/50" />

            <div className="space-y-3">
              {orchestrationSteps.map((step) => {
                const StepIcon = STEP_ICONS[step.type] || Play
                const AgentIcon = ROLE_ICONS[step.agent] || Code
                const roleColor = ROLE_COLORS[step.agent] || "text-muted-foreground"
                const statusColor =
                  step.status === "done" ? "bg-green-500" :
                  step.status === "failed" ? "bg-red-500" :
                  step.status === "running" ? "bg-blue-500 animate-pulse" :
                  "bg-muted-foreground/30"
                const statusTextColor =
                  step.status === "done" ? "text-green-500" :
                  step.status === "failed" ? "text-red-500" :
                  step.status === "running" ? "text-blue-500" :
                  "text-muted-foreground"

                return (
                  <div key={step.id} className="relative flex items-start gap-3">
                    {/* Timeline dot */}
                    <div className={cn("relative z-10 mt-1 h-4 w-4 rounded-full flex items-center justify-center", statusColor)}>
                      {step.status === "running" ? (
                        <Loader2 className="h-2.5 w-2.5 text-white animate-spin" />
                      ) : (
                        <StepIcon className="h-2.5 w-2.5 text-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium", statusTextColor)}>
                          {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
                        </span>
                        <span className={cn("text-[10px] flex items-center gap-0.5", roleColor)}>
                          <AgentIcon className="h-2.5 w-2.5" />
                          {step.agent}
                        </span>
                        <span className="text-[9px] text-muted-foreground ml-auto">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{step.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {view === "entries" && (
          <>
            {filtered.map((entry, i) => (
              <div
                key={i}
                className="border-b px-3 py-2 text-xs hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {entry.status === "success" ? (
                    <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                  )}
                  <span className={cn("font-medium capitalize", ROLE_COLORS[entry.agentId] || "")}>
                    {entry.agentId}
                  </span>
                  <span className="text-muted-foreground">{entry.action}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground pl-5">{entry.summary}</p>
                {entry.file && (
                  <p className="text-[10px] text-muted-foreground pl-5 font-mono">{entry.file}</p>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>
          {view === "entries"
            ? `${filtered.length} of ${entries.length} entries`
            : `${orchestrationSteps.length} steps`}
        </span>
        {view === "orchestration" && orchestrationSteps.length > 0 && (
          <span className="text-[9px] text-muted-foreground/60">
            {orchestrationSteps.filter((s) => s.status === "done").length} done ·{" "}
            {orchestrationSteps.filter((s) => s.status === "running").length} running
          </span>
        )}
      </div>
    </div>
  )
}
