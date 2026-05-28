import { useState, useEffect, useCallback, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Plus, X, Clock, CheckCircle2, XCircle, Loader2,
  ChevronRight,
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

function SessionTab({ session, isActive, onSelect, onDestroy }: {
  session: SessionDescriptor
  isActive: boolean
  onSelect: () => void
  onDestroy: (e: React.MouseEvent) => void
}) {
  const [showClose, setShowClose] = useState(false)
  const label = session.label || `Session ${session.sessionId.slice(0, 6)}`

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
      onClick={onSelect}
      onMouseEnter={() => setShowClose(true)}
      onMouseLeave={() => setShowClose(false)}
      className={cn(
        "relative flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-all shrink-0 border group",
        isActive
          ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-sm shadow-blue-500/10"
          : getStatusColor(session.status) + " text-white/40 hover:text-white/70 hover:bg-white/[0.04] border-white/[0.04]",
      )}
    >
      {/* Active tab bottom accent line */}
      {isActive && (
        <motion.span
          layoutId="session-active-indicator"
          className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-gradient-to-r from-blue-400 to-blue-500"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      {getStatusIcon(session.status)}

      <span className="truncate max-w-[80px]">{label}</span>

      {/* Running dot indicator */}
      {session.status === "running" && (
        <span className="inline-block h-1 w-1 rounded-full bg-blue-400 animate-pulse" />
      )}

      {/* Close button - visible on hover or always for active */}
      <AnimatePresence mode="wait">
        {(showClose || isActive) && (
          <motion.button
            initial={{ opacity: 0, width: 0, scale: 0.8 }}
            animate={{ opacity: 1, width: "auto", scale: 1 }}
            exit={{ opacity: 0, width: 0, scale: 0.8 }}
            transition={{ duration: 0.1 }}
            onClick={(e) => {
              e.stopPropagation()
              onDestroy(e)
            }}
            className={cn(
              "rounded p-0.5 transition-all overflow-hidden shrink-0",
              "text-white/20 hover:text-white/50 hover:bg-white/[0.06]",
            )}
            title="Close session"
          >
            <X className="h-2.5 w-2.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.button>
  )
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

  return (
    <div className={cn("border-b border-white/[0.04] bg-[#0c0c0d]", className)}>
      <div className={cn(
        "flex items-center gap-1 px-2 py-1.5 scrollbar-none transition-all duration-200",
        expanded ? "overflow-x-auto" : "overflow-x-hidden",
        !expanded && sessions.length > 4 && "[mask-image:linear-gradient(to_right,transparent_32px,black_72px)]",
      )}>
        {/* Scrollable sessions container — always renders all for AnimatePresence exit animations */}
        <AnimatePresence mode="popLayout">
          {sessions.map((session) => (
            <SessionTab
              key={session.sessionId}
              session={session}
              isActive={session.sessionId === activeId}
              onSelect={() => handleSelect(session.sessionId)}
              onDestroy={(e) => handleDestroy(e, session.sessionId)}
            />
          ))}
        </AnimatePresence>

        {/* New session button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreate}
          className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[9px] text-white/25 hover:text-white/50 hover:bg-white/[0.04] transition-all shrink-0"
          title="New session"
        >
          <Plus className="h-3 w-3" />
        </motion.button>

        {/* Show more/less */}
        {sessions.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[9px] text-white/20 hover:text-white/40 hover:bg-white/[0.04] transition-all shrink-0"
            title={expanded ? "Show less" : "Show all sessions"}
          >
            {expanded ? (
              <ChevronRight className="h-2.5 w-2.5 rotate-180" />
            ) : (
              <span className="text-[9px] font-mono">+{sessions.length - 4}</span>
            )}
          </button>
        )}

        {/* Space filler */}
        <div className="flex-1" />

        {/* Running count badge */}
        {sessionManager.listRunning().length > 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-[8px] text-blue-400/60 font-mono shrink-0"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
            </span>
            {sessionManager.listRunning().length} active
          </motion.span>
        )}
      </div>
    </div>
  )
})
