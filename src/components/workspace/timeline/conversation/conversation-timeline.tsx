import { useRef, useEffect, useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTimelineStore } from "../timeline-store"
import { ConversationTurn } from "./conversation-turn"
import { QuickActions } from "../QuickActions"
import type { UserMessageEvent } from "../types"
import type { AgentSession } from "../timeline-store"

interface ConversationTimelineProps {
  onSendMessage?: (prompt: string) => void
}

export function ConversationTimeline({ onSendMessage }: ConversationTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const events = useTimelineStore((s) => s.events)
  const agentSessions = useTimelineStore((s) => s.agentSessions)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Auto-scroll during streaming - continuous, smooth
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isAtBottom) return
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(raf)
  })

  // Track scroll position
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const threshold = 80
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
      setIsAtBottom(atBottom)
      setShowScrollButton(!atBottom)
    }
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [])

  const hasItems = events.length > 0 || agentSessions.size > 0

  // Build conversation turns from events + agent sessions
  const conversationTurns = useMemo(() => {
    const turns: { userEvent: UserMessageEvent | null; sessionIds: string[] }[] = []

    // Create turns from events
    for (const event of events) {
      if (event.type === "user-message") {
        turns.push({ userEvent: event as UserMessageEvent, sessionIds: [] })
      }
    }

    // If no user events but have sessions, create implicit turns
    if (turns.length === 0 && agentSessions.size > 0) {
      for (const [id] of agentSessions) {
        turns.push({ userEvent: null, sessionIds: [id] })
      }
      return turns
    }

    // Correlate sessions to turns
    const allSessionIds = Array.from(agentSessions.keys())
    let sessionIdx = 0
    for (const turn of turns) {
      if (sessionIdx < allSessionIds.length) {
        turn.sessionIds.push(allSessionIds[sessionIdx])
        sessionIdx++
      }
    }

    return turns
  }, [events, agentSessions])

  const handleQuickAction = useCallback((prompt: string) => {
    if (onSendMessage) {
      onSendMessage(prompt)
    } else {
      useTimelineStore.getState().addEvent({
        type: "user-message",
        id: `quick-${Date.now()}`,
        content: prompt,
        timestamp: Date.now(),
      })
    }
  }, [onSendMessage])

  const isStreaming = Array.from(agentSessions.values()).some((s) => s.status === "running")

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        className={cn(
          "h-full overflow-y-auto",
          "scrollbar-thin scrollbar-thumb-white/[0.03] scrollbar-track-transparent",
        )}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        <div className="max-w-[680px] mx-auto px-4">
          {!hasItems ? (
            <QuickActions onActionClick={handleQuickAction} className="py-20" />
          ) : (
            <div className="py-3 space-y-3">
              {conversationTurns.map((turn, idx) => {
                const sessions = turn.sessionIds
                  .map((id) => agentSessions.get(id))
                  .filter(Boolean) as AgentSession[]

                return (
                  <ConversationTurn
                    key={turn.userEvent?.id ?? `turn-${idx}`}
                    userEvent={turn.userEvent}
                    sessions={sessions}
                    onFollowUpSelect={onSendMessage}
                  />
                )
              })}
            </div>
          )}

          {/* Inline streaming indicator - subtle, non-blocking */}
          {isStreaming && (
            <div className="flex items-center gap-1.5 pb-3 text-foreground/20">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
              </span>
              <span className="text-[8px] font-mono">Streaming response</span>
            </div>
          )}
        </div>
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {showScrollButton && hasItems && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.12 }}
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-2.5 py-1 text-[8px] font-medium bg-[#0c0c0d]/90 backdrop-blur-xl border border-white/[0.06] text-white/40 hover:text-white/70 transition-all z-20"
          >
            <ChevronDown className="h-2.5 w-2.5" />
            Scroll
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
