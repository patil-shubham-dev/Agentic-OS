import { useState, useEffect, useCallback, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Plus, X, Terminal, Bot, Clock, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronRight, Trash2,
} from "lucide-react"
import { SessionManager } from "@/runtime/sessions/SessionManager"
import type { SessionDescriptor } from "@/runtime/sessions/ExecutionSession"

interface SessionBarProps {
  className?: string
  onSessionChange?: (sessionId: string) => void
}

const sessionManager = SessionManager.getInstance()

function getStatusIcon(status: string) {
  switch (status) {
    case "running":
      return <Loader2 className="h-2.5 w-2.5 text-blue-400 animate-spin" />
    case "completed":
      return <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
    case "failed":
    case "error":
      return <XCircle className="h-2.5 w-2.5 text-red-400" />
    default:
      return <Clock className="h-2.5 w-2.5 text-white/30" />
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "running": return "border-blue-500/20 bg-blue-500/[0.04]"
    case "completed": return "border-emerald-500/15 bg-emerald-500/[0.03]"
    case "failed":
    case "error": return "border-red-500/15 bg-red-500/[0.03]"
    default: return "border-white/5 bg-white/0"
  }
}

export const SessionBar = memo(function SessionBar({
  className,
  onSessionChange,
}: SessionBarProps) {
  const [sessions, setSessions] = useState<SessionDescriptor[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const unsub = sessionManager.subscribe((descriptors) => {
      setSessions(descriptors)
      const active = sessionManager.getActiveSessionId()
      setActiveId(active)
    })
    return unsub
  }, [])

  const handleCreate = useCallback(() => {
    const session = sessionManager.create(`Session ${sessionManager.getCount() + 1}`)
    setActiveId(session.sessionId)
    onSessionChange?.(session.sessionId)
  }, [onSessionChange])

  const handleSelect = useCallback((sessionId: string) => {
    sessionManager.setActive(sessionId)
    setActiveId(sessionId)
    onSessionChange?.(sessionId)
  }, [onSessionChange])

  const handleDestroy = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    sessionManager.destroy(sessionId)
  }, [])

  if (sessions.length === 0) return null

  const visibleSessions = expanded ? sessions : sessions.slice(-4)

  return (
    <div className={cn("border-b border-white/[0.04] bg-[#0c0c0d]", className)}>
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto scrollbar-none">
        {visibleSessions.map((session) => {
          const isActive = session.sessionId === activeId
          const label = session.label || `Session ${session.sessionId.slice(0, 6)}`

          return (
            <motion.button
              key={session.sessionId}
              layout
              onClick={() => handleSelect(session.sessionId)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-all shrink-0 border",
                isActive
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-sm"
                  : getStatusColor(session.status) + " text-white/40 hover:text-white/70 hover:bg-white/[0.04] border-white/[0.04]",
              )}
            >
              {getStatusIcon(session.status)}
              <span className="truncate max-w-[80px]">{label}</span>
              {session.status === "running" && (
                <span className="inline-block h-1 w-1 rounded-full bg-blue-400 animate-pulse" />
              )}
              <button
                onClick={(e) => handleDestroy(e, session.sessionId)}
                className="rounded p-0.5 text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-all ml-0.5"
                title="Close session"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </motion.button>
          )
        })}

        {/* New session button */}
        <button
          onClick={handleCreate}
          className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[9px] text-white/25 hover:text-white/50 hover:bg-white/[0.04] transition-all shrink-0"
          title="New session"
        >
          <Plus className="h-3 w-3" />
        </button>

        {/* Show more/less */}
        {sessions.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[9px] text-white/20 hover:text-white/40 hover:bg-white/[0.04] transition-all shrink-0"
            title={expanded ? "Show less" : "Show all sessions"}
          >
            {expanded ? (
              <ChevronRight className="h-2.5 w-2.5" />
            ) : (
              <span className="text-[9px]">+{sessions.length - 4}</span>
            )}
          </button>
        )}

        {/* Running count badge */}
        {sessionManager.listRunning().length > 0 && (
          <span className="flex items-center gap-1 ml-auto text-[8px] text-blue-400/60 font-mono">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            {sessionManager.listRunning().length} active
          </span>
        )}
      </div>
    </div>
  )
})
