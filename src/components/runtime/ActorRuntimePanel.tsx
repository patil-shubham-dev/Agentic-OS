import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ActorRuntime } from "@/runtime/observability/ActorRuntime"
import type { ActorDefinition, ActorMessage, ActorStatus } from "@/runtime/observability/ObservabilityTypes"
import type { ActorSnapshot, ActorEvent } from "@/runtime/observability/ActorRuntime"
import {
  Users,
  Activity,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Loader2,
  Play,
  Inbox,
  Send,
  Shield,
  Pause,
  StopCircle,
  ServerCrash,
  MessageSquare,
  Eye,
  EyeOff,
} from "lucide-react"

interface ActorRuntimePanelProps {
  className?: string
}

// ── Status Config ──

const STATUS_CONFIG: Record<ActorStatus, { color: string; bg: string; icon: typeof Play; label: string }> = {
  idle: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Play, label: "Idle" },
  running: { color: "text-green-400", bg: "bg-green-500/10", icon: Loader2, label: "Running" },
  suspended: { color: "text-amber-400", bg: "bg-amber-500/10", icon: Pause, label: "Suspended" },
  stopped: { color: "text-slate-400", bg: "bg-slate-500/10", icon: StopCircle, label: "Stopped" },
  crashed: { color: "text-red-400", bg: "bg-red-500/10", icon: ServerCrash, label: "Crashed" },
}

const LIFECYCLE_COLORS: Record<string, string> = {
  transient: "text-cyan-400",
  persistent: "text-purple-400",
  supervised: "text-amber-400",
}

// ── Stats Bar ──

function StatsBar({ snapshot }: { snapshot: ActorSnapshot }) {
  const s = snapshot.stats
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 gap-1">
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Actors</span>
          <span className="text-[10px] font-mono text-white/70 tabular-nums">{s.totalActors}</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">
            <span className="text-green-400">●</span> Run
          </span>
          <span className="text-[10px] font-mono text-green-400/80 tabular-nums">{s.running}</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">
            <span className="text-amber-400">●</span> Sus
          </span>
          <span className="text-[10px] font-mono text-amber-400/80 tabular-nums">{s.suspended}</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">
            <span className="text-red-400">●</span> Crashed
          </span>
          <span className="text-[10px] font-mono text-red-400/80 tabular-nums">{s.crashed}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Queued</span>
          <span className="text-[10px] font-mono text-white/70 tabular-nums">{s.totalMessagesQueued}</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Processed</span>
          <span className="text-[10px] font-mono text-white/70 tabular-nums">{s.totalMessagesProcessed}</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Avg Time</span>
          <span className="text-[10px] font-mono text-white/70 tabular-nums">{s.avgProcessingTime.toFixed(1)}ms</span>
        </div>
      </div>
    </div>
  )
}

// ── Supervisor Card ──

function SupervisorCard({ snapshot }: { snapshot: ActorSnapshot }) {
  const sup = snapshot.supervisor
  const strategyColors: Record<string, string> = {
    one_for_one: "text-blue-400",
    one_for_all: "text-red-400",
    rest_for_one: "text-amber-400",
  }

  const strategyLabels: Record<string, string> = {
    one_for_one: "One for One",
    one_for_all: "One for All",
    rest_for_one: "Rest for One",
  }

  return (
    <div className="bg-white/[0.02] rounded border border-white/[0.06] px-2 py-1.5">
      <div className="flex items-center gap-1 mb-1">
        <Shield className="h-2.5 w-2.5 text-cyan-400" />
        <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider">Supervisor</span>
      </div>
      <div className="flex items-center gap-2 text-[8px]">
        <span className={cn("font-mono", strategyColors[sup.strategy])}>{strategyLabels[sup.strategy] ?? sup.strategy}</span>
        <span className="text-white/20">·</span>
        <span className="text-white/30">Max {sup.maxRestarts} restarts / {(sup.windowMs / 1000).toFixed(0)}s window</span>
        <span className="text-white/20">·</span>
        <span className="text-white/30">{sup.children.length} children</span>
      </div>
      {sup.children.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-1">
          {sup.children.slice(0, 8).map((childId) => (
            <span key={childId} className="text-[6px] text-white/25 bg-white/[0.03] rounded px-0.5 font-mono">
              {childId.slice(0, 12)}…
            </span>
          ))}
          {sup.children.length > 8 && (
            <span className="text-[6px] text-white/15">+{sup.children.length - 8}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Actor Card ──

function ActorCard({
  actor,
  expanded,
  onToggle,
}: {
  actor: ActorDefinition
  expanded: boolean
  onToggle: () => void
}) {
  const status = STATUS_CONFIG[actor.status] ?? STATUS_CONFIG.idle
  const StatusIcon = status.icon
  const lifecycleColor = LIFECYCLE_COLORS[actor.lifecycle] ?? "text-white/30"

  return (
    <div className="bg-white/[0.02] rounded border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center gap-1 w-full px-2 py-1.5 hover:bg-white/[0.02] transition-all"
      >
        {expanded ? <ChevronDown className="h-2.5 w-2.5 text-white/30 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 text-white/30 shrink-0" />}
        <div className={cn("h-2 w-2 rounded-full shrink-0", status.bg.replace("/10", "/40"))} />
        <div className="flex-1 min-w-0 text-left">
          <span className="text-[8px] font-medium text-white/60 truncate block">{actor.name}</span>
          <span className="text-[7px] text-white/20 truncate block">Role: {actor.role}</span>
        </div>
        <span className={cn("text-[7px] font-medium px-1 py-0.5 rounded-full flex items-center gap-0.5", status.color, status.bg)}>
          <StatusIcon className={cn("h-2 w-2", actor.status === "running" ? "animate-spin" : "")} />
          {status.label}
        </span>
      </button>

      {/* Quick info */}
      <div className="flex items-center gap-2 px-2 py-0.5 border-t border-white/[0.04] text-[7px] text-white/20">
        <span className={cn("font-medium", lifecycleColor)}>{actor.lifecycle}</span>
        <span>·</span>
        <span className={actor.restartStrategy === "never" ? "text-red-400/60" : "text-white/20"}>{actor.restartStrategy}</span>
        <span>·</span>
        <Inbox className="h-2 w-2" />
        <span>{actor.mailbox.backlog} queued</span>
        <span className="ml-auto">{actor.mailbox.processed} processed</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/[0.04] px-2 py-1.5 space-y-1">
          {/* Dependencies */}
          {actor.dependencies.length > 0 && (
            <div>
              <span className="text-[7px] text-white/25 uppercase tracking-wider">Dependencies</span>
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {actor.dependencies.map((dep) => (
                  <span key={dep} className="text-[6px] text-white/30 bg-white/[0.03] rounded px-0.5 font-mono">{dep}</span>
                ))}
              </div>
            </div>
          )}

          {/* Mailbox messages */}
          {actor.mailbox.messages.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <MessageSquare className="h-2 w-2 text-white/25" />
                <span className="text-[7px] text-white/25 uppercase tracking-wider">Messages ({actor.mailbox.messages.length})</span>
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {actor.mailbox.messages.slice(-10).map((msg) => (
                  <div key={msg.id} className="flex items-start gap-1 text-[7px] bg-white/[0.02] rounded px-1 py-0.5">
                    <span className={cn(
                      "h-1 w-1 rounded-full mt-0.5 shrink-0",
                      msg.priority === "high" ? "bg-red-400" :
                      msg.priority === "normal" ? "bg-blue-400" : "bg-slate-400",
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-0.5">
                        <span className="text-white/40">{msg.from.slice(0, 8)}→</span>
                        <span className="text-white/60 font-medium">{msg.type}</span>
                        <span className="text-white/20 ml-auto">{msg.priority}</span>
                      </div>
                      <span className="text-white/20 block truncate">
                        {typeof msg.payload === "string" ? msg.payload : JSON.stringify(msg.payload).slice(0, 40)}
                      </span>
                      {msg.correlationId && (
                        <span className="text-white/10 font-mono text-[6px]">corr: {msg.correlationId.slice(0, 12)}…</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Event Timeline ──

function EventTimeline({ events }: { events: ActorEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-[8px] text-white/20 py-2 text-center">No actor events recorded</div>
    )
  }

  const eventTypeColors: Record<string, string> = {
    registered: "text-blue-400",
    started: "text-green-400",
    completed: "text-slate-400",
    suspended: "text-amber-400",
    resumed: "text-blue-400",
    crashed: "text-red-400",
    restarted: "text-purple-400",
    stopped: "text-slate-400",
    message_sent: "text-cyan-400",
    message_received: "text-emerald-400",
    message_processed: "text-green-400",
  }

  return (
    <div className="space-y-0.5 max-h-40 overflow-y-auto">
      {events.slice(0, 30).map((event, i) => (
        <div key={i} className="flex items-start gap-1.5 text-[7px]">
          <div className="flex flex-col items-center shrink-0">
            <span className={cn("h-1.5 w-1.5 rounded-full", eventTypeColors[event.type] ?? "text-white/20")} />
            {i < events.length - 1 && <div className="w-px h-full bg-white/[0.03] mt-0.5" />}
          </div>
          <div className="flex-1 min-w-0 pb-0.5">
            <div className="flex items-center gap-1">
              <span className="text-white/40 font-medium capitalize">{event.type.replace("_", " ")}</span>
              <span className="text-white/15 font-mono">{event.actorId.slice(0, 8)}…</span>
            </div>
            <p className="text-white/30 truncate">{event.details}</p>
            <span className="text-white/10">{new Date(event.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Message Flow Visualization ──

function MessageFlow({ actors }: { actors: ActorDefinition[] }) {
  // Find recent message exchanges — show actor-to-actor communication
  const exchangeMap = new Map<string, { from: string; to: string; type: string; count: number }>()

  for (const actor of actors) {
    for (const msg of actor.mailbox.messages) {
      const key = `${msg.from}→${msg.to}→${msg.type}`
      const existing = exchangeMap.get(key)
      if (existing) {
        existing.count++
      } else {
        exchangeMap.set(key, { from: msg.from, to: msg.to, type: msg.type, count: 1 })
      }
    }
  }

  const recentExchanges = Array.from(exchangeMap.values()).slice(-8)

  if (recentExchanges.length === 0) {
    return (
      <div className="text-[8px] text-white/20 py-2 text-center">No message flow</div>
    )
  }

  return (
    <div className="space-y-0.5">
      {recentExchanges.map((ex, i) => (
        <div key={i} className="flex items-center gap-1 text-[7px] bg-white/[0.02] rounded px-1.5 py-0.5">
          <span className="font-mono text-white/40">{ex.from.slice(0, 6)}</span>
          <ArrowRight className="h-2 w-2 text-white/20 shrink-0" />
          <span className="font-mono text-white/40">{ex.to.slice(0, 6)}</span>
          <span className="text-white/50 capitalize">{ex.type}</span>
          <span className="text-white/20 ml-auto">{ex.count}×</span>
        </div>
      ))}
    </div>
  )
}

// ── Empty State ──

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[160px]">
      <div className="text-center px-6">
        <Users className="h-6 w-6 text-white/15 mx-auto mb-2" />
        <p className="text-[10px] text-white/25">No actors registered</p>
        <p className="text-[8px] text-white/15 mt-1 leading-relaxed">
          Actor instances appear here when they are registered.<br />
          Each actor has its own mailbox, lifecycle, and status.
        </p>
        <div className="flex items-center justify-center gap-3 mt-2 text-[7px] text-white/20">
          <span className="flex items-center gap-0.5"><span className="text-green-400">●</span> Running</span>
          <span className="flex items-center gap-0.5"><span className="text-blue-400">●</span> Idle</span>
          <span className="flex items-center gap-0.5"><span className="text-amber-400">●</span> Suspended</span>
          <span className="flex items-center gap-0.5"><span className="text-red-400">●</span> Crashed</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──

export function ActorRuntimePanel({ className }: ActorRuntimePanelProps) {
  const engine = ActorRuntime.getInstance()
  const [snapshot, setSnapshot] = useState<ActorSnapshot>(engine.snapshot())
  const [events, setEvents] = useState<ActorEvent[]>(engine.getEvents())
  const [expandedActors, setExpandedActors] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<ActorStatus | "all">("all")
  const [showEvents, setShowEvents] = useState(false)

  useEffect(() => {
    const refresh = () => {
      setSnapshot(engine.snapshot())
      setEvents(engine.getEvents())
    }
    refresh()
    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  }, [engine])

  const filteredActors = statusFilter === "all"
    ? snapshot.actors
    : snapshot.actors.filter((a) => a.status === statusFilter)

  const toggleActor = (id: string) => {
    setExpandedActors((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Users className="h-3 w-3 text-teal-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Actor Runtime</span>
          {snapshot.actors.length > 0 && (
            <span className="text-[8px] text-white/20 bg-white/5 rounded px-1">{snapshot.actors.length}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-2 py-1.5 border-b border-white/[0.04]">
        <StatsBar snapshot={snapshot} />
      </div>

      {/* Supervisor */}
      <div className="px-2 py-1.5 border-b border-white/[0.04]">
        <SupervisorCard snapshot={snapshot} />
      </div>

      {/* Filters */}
      {snapshot.actors.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.04] overflow-x-auto">
          {(["all", "running", "idle", "suspended", "stopped", "crashed"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={cn(
                "text-[7px] px-1.5 py-0.5 rounded-full transition-all shrink-0",
                statusFilter === filter
                  ? "bg-white/10 text-white/60"
                  : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]",
              )}
            >
              {filter === "all" ? "All" : STATUS_CONFIG[filter]?.label ?? filter}
            </button>
          ))}
          <button
            onClick={() => setShowEvents(!showEvents)}
            className={cn(
              "text-[7px] px-1.5 py-0.5 rounded-full transition-all ml-auto flex items-center gap-0.5 shrink-0",
              showEvents ? "bg-white/10 text-white/60" : "text-white/30 hover:text-white/50",
            )}
          >
            {showEvents ? <Eye className="h-2 w-2" /> : <EyeOff className="h-2 w-2" />}
            Events
          </button>
        </div>
      )}

      {/* Events panel */}
      {showEvents && (
        <div className="border-b border-white/[0.04] px-2 py-1.5 max-h-32 overflow-hidden">
          <div className="flex items-center gap-1 mb-0.5">
            <Activity className="h-2 w-2 text-white/25" />
            <span className="text-[7px] text-white/25 uppercase tracking-wider">Event Stream</span>
          </div>
          <EventTimeline events={events} />
        </div>
      )}

      {/* Message flow */}
      {snapshot.actors.length > 0 && snapshot.stats.totalMessagesQueued > 0 && (
        <div className="px-2 py-1.5 border-b border-white/[0.04]">
          <div className="flex items-center gap-1 mb-0.5">
            <Send className="h-2 w-2 text-white/25" />
            <span className="text-[7px] text-white/25 uppercase tracking-wider">Message Flow</span>
          </div>
          <MessageFlow actors={snapshot.actors} />
        </div>
      )}

      {/* Empty state */}
      {snapshot.actors.length === 0 && <EmptyState />}

      {/* Actor list */}
      {snapshot.actors.length > 0 && (
        <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
          {filteredActors.length === 0 ? (
            <div className="text-[8px] text-white/20 py-4 text-center">No actors match the status filter</div>
          ) : (
            filteredActors.map((actor) => (
              <ActorCard
                key={actor.id}
                actor={actor}
                expanded={expandedActors.has(actor.id)}
                onToggle={() => toggleActor(actor.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Legend */}
      {snapshot.actors.length > 0 && (
        <div className="px-2 py-1 border-t border-white/[0.04]">
          <div className="flex items-center gap-2 text-[6px] text-white/20 flex-wrap">
            {(["transient", "persistent", "supervised"] as const).map((lc) => (
              <span key={lc} className={cn("flex items-center gap-0.5 capitalize", LIFECYCLE_COLORS[lc])}>
                ● {lc}
              </span>
            ))}
            <span className="text-white/10">|</span>
            <span className="text-white/20">1:1</span>
            <span className="text-white/20">1:A</span>
            <span className="text-white/20">R:1</span>
          </div>
        </div>
      )}
    </div>
  )
}
