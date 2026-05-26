import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  Layers, Loader2, CheckCircle2, XCircle, Play, Square,
  ChevronDown, ChevronUp, Clock, Activity, AlertTriangle,
} from "lucide-react"
import { SessionManager } from "@/runtime/sessions/SessionManager"
import type { SessionDescriptor } from "@/runtime/sessions/ExecutionSession"

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Loader2; color: string }> = {
  idle: { label: "Idle", icon: Clock, color: "text-white/40" },
  running: { label: "Running", icon: Loader2, color: "text-blue-400" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-emerald-400" },
  halted: { label: "Failed", icon: XCircle, color: "text-red-400" },
  orphaned: { label: "Orphaned", icon: AlertTriangle, color: "text-amber-400" },
}

interface ExecutionDockProps {
  className?: string
}

export function ExecutionDock({ className }: ExecutionDockProps) {
  const [sessions, setSessions] = useState<SessionDescriptor[]>([])
  const [expanded, setExpanded] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sessionManager = SessionManager.getInstance()

  useEffect(() => {
    const unsub = sessionManager.subscribe((descriptors) => {
      setSessions(descriptors)
    })
    setActiveId(sessionManager.getActiveSessionId())
    return unsub
  }, [sessionManager])

  const handleSelectSession = useCallback((sessionId: string) => {
    sessionManager.setActive(sessionId)
    setActiveId(sessionId)
  }, [sessionManager])

  const handleNewSession = useCallback(() => {
    const session = sessionManager.create(`Execution #${sessionManager.getCount() + 1}`)
    setActiveId(session.sessionId)
  }, [sessionManager])

  const handleDestroySession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    sessionManager.destroy(sessionId)
    const remaining = sessionManager.list()
    if (remaining.length > 0) {
      setActiveId(remaining[0].sessionId)
    } else {
      setActiveId(null)
    }
  }, [sessionManager])

  if (sessions.length === 0) return null

  return (
    <div className={cn("border-t border-white/8 bg-[#0a0a0b]", className)}>
      {/* Dock header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-2 py-1 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-white/40" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Executions</span>
          <span className="text-[9px] text-white/20 bg-white/5 rounded px-1">{sessions.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleNewSession() }}
            className="text-[9px] px-1.5 py-0.5 rounded text-blue-400 hover:bg-blue-500/15 transition-colors"
          >
            + New
          </button>
          {expanded ? <ChevronDown className="h-3 w-3 text-white/30" /> : <ChevronUp className="h-3 w-3 text-white/30" />}
        </div>
      </button>

      {/* Session tabs */}
      {expanded && (
        <div className="flex items-center gap-1 px-2 pb-1.5 overflow-x-auto">
          {sessions.map((session) => {
            const config = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.idle
            const Icon = config.icon
            const isActive = session.sessionId === activeId

            return (
              <button
                key={session.sessionId}
                onClick={() => handleSelectSession(session.sessionId)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-[9px] transition-all shrink-0",
                  isActive
                    ? "bg-blue-500/10 text-white/70 border border-blue-500/20"
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.03] border border-transparent",
                )}
              >
                <Icon className={cn("h-2.5 w-2.5", config.color, session.status === "running" && "animate-spin")} />
                <span className="truncate max-w-[80px]">{session.label}</span>
                <span className={cn("text-[8px]", config.color)}>
                  {session.state}
                </span>
                <span className="text-white/20 text-[8px]">
                  {session.toolCount}
                </span>
                {session.errorCount > 0 && (
                  <span className="text-red-400 text-[8px]">!{session.errorCount}</span>
                )}
                <button
                  onClick={(e) => handleDestroySession(session.sessionId, e)}
                  className="ml-0.5 text-white/20 hover:text-red-400 transition-colors"
                >
                  <XCircle className="h-2 w-2" />
                </button>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
