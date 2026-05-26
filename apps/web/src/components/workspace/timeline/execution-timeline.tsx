import { useRef, useEffect, memo, useState, useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import { MessageSquare, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTimelineStore } from "./timeline-store"
import { StepCard } from "./step-card"
import { ManagerRoutingCard } from "./cards/manager-routing-card"
import { ExecutionSummaryCard } from "./cards/execution-summary-card"
import { TurnGroup } from "./TurnGroup"
import { QuickActions } from "./QuickActions"
import { TranscriptModeSelector, type TranscriptMode } from "./TranscriptModeSelector"
import type { TimelineEvent, UserMessageEvent } from "./types"
import type { AgentSession } from "./timeline-store"

const StepCardMem = memo(StepCard)
const ManagerRoutingCardMem = memo(ManagerRoutingCard)
const ExecutionSummaryCardMem = memo(ExecutionSummaryCard)

function renderStepCard(session: AgentSession) {
  return (
    <StepCardMem
      key={session.stepId}
      roleId={session.roleId}
      roleName={session.roleName}
      status={session.status}
      streamingText={session.streamingText}
      toolCalls={session.toolCalls}
      fileEdits={session.fileEdits}
      terminalOutputs={session.terminalOutputs}
      modelName={session.modelName}
      providerName={session.providerName}
      startedAt={session.startedAt}
      onStop={session.status === "running" ? () => {
        useTimelineStore.getState().updateAgentSession(session.stepId, { status: "error" })
      } : undefined}
    />
  )
}

function EventRenderer({ event }: { event: TimelineEvent }) {
  switch (event.type) {
    case "user-message":
      return (
        <div className="flex items-start gap-2 px-1 py-1.5">
          <div className="flex items-center justify-center h-5 w-5 rounded-lg bg-blue-500/15 shrink-0">
            <MessageSquare className="h-2.5 w-2.5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-blue-400/60 font-medium">You</span>
            <p className="text-[12px] text-white/80 mt-0.5 leading-relaxed">{event.content}</p>
          </div>
        </div>
      )
    case "manager-routing":
      return (
        <ManagerRoutingCardMem
          reasoning={event.reasoning}
          selectedRoles={event.detectedRoles}
          context={event.context}
          status={event.status}
        />
      )
    case "execution-summary":
      return (
        <ExecutionSummaryCardMem
          filesEdited={event.filesEdited}
          commandsRun={event.commandsRun}
          browserActions={event.browserActions}
          durationMs={event.durationMs}
          modelName={event.modelName}
          status={event.status}
        />
      )
    case "execution-error":
      return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.03] p-3">
          <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {event.roleId} failed
          </div>
          <p className="text-white/60 text-[11px]">{event.message}</p>
          {event.suggestion && (
            <p className="text-white/40 text-[10px] mt-1">{event.suggestion}</p>
          )}
        </div>
      )
    default:
      return null
  }
}

export function ExecutionTimeline({ onSendMessage }: { onSendMessage?: (prompt: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const events = useTimelineStore((s) => s.events)
  const agentSessions = useTimelineStore((s) => s.agentSessions)
  const prevEventCountRef = useRef(0)

  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>("normal")

  // Auto-scroll on new events
  useEffect(() => {
    const el = scrollRef.current
    const count = events.length + agentSessions.size
    if (el && count > prevEventCountRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
    prevEventCountRef.current = count
  })

  const hasItems = events.length > 0 || agentSessions.size > 0

  // Group events into conversational turns; each user message starts a new turn.
  // Agent sessions created after a user message and before the next one belong to that turn.
  // We use a sequential session index that increments with each addAgentSession call,
  // creating a deterministic mapping between turn index and session index.
  const conversationTurns = useMemo(() => {
    const turns: { userEvent: UserMessageEvent; eventIds: string[]; sessionIds: string[] }[] = []
    let currentTurn: { userEvent: UserMessageEvent; eventIds: string[]; sessionIds: string[] } | null = null

    // Build turns from events
    for (const event of events) {
      if (event.type === "user-message") {
        currentTurn = { userEvent: event as UserMessageEvent, eventIds: [], sessionIds: [] }
        turns.push(currentTurn)
      } else if (currentTurn) {
        currentTurn.eventIds.push(event.id)
      }
    }

    // Simple session correlation: session n belongs to turn n (since sessions are created
    // sequentially per user turn via the execution pipeline). For complex scenarios with
    // multiple sessions per turn, we distribute them round-robin.
    const allSessionIds = Array.from(agentSessions.keys())
    let sessionIdx = 0
    for (const turn of turns) {
      // Each turn gets at least one session if available
      if (sessionIdx < allSessionIds.length) {
        turn.sessionIds.push(allSessionIds[sessionIdx])
        sessionIdx++
      }
    }
    // Remaining unmatched sessions: distribute round-robin across turns
    if (sessionIdx < allSessionIds.length) {
      const remaining = allSessionIds.slice(sessionIdx)
      for (let i = 0; i < remaining.length && turns.length > 0; i++) {
        const turnIdx = i % turns.length
        turns[turnIdx].sessionIds.push(remaining[i])
      }
    }

    return turns
  }, [events, agentSessions])

  const handleQuickAction = useCallback((prompt: string) => {
    if (onSendMessage) {
      // Real execution via parent
      onSendMessage(prompt)
    } else {
      // Fallback: add a user-message event to the timeline
      useTimelineStore.getState().addEvent({
        type: "user-message",
        id: `quick-${Date.now()}`,
        content: prompt,
        timestamp: Date.now(),
      })
    }
  }, [onSendMessage])

  const handleResend = useCallback((content: string) => {
    if (onSendMessage) {
      onSendMessage(content)
    }
  }, [onSendMessage])

  // Check if an event type should be shown based on transcript mode
  const isEventVisible = useCallback((event: TimelineEvent) => {
    if (transcriptMode === "summary") {
      return event.type === "user-message" || 
             event.type === "execution-summary" || 
             event.type === "execution-error"
    }
    return true
  }, [transcriptMode])

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex-1 overflow-y-auto",
        "scrollbar-thin scrollbar-thumb-white/[0.04] scrollbar-track-transparent",
        "hover:scrollbar-thumb-white/[0.08]",
      )}
      role="log"
      aria-label="Execution timeline"
      aria-live="polite"
    >
      {!hasItems ? (
        <QuickActions 
          onActionClick={handleQuickAction} 
          className="py-12"
        />
      ) : (
        <div className="px-3 py-3 space-y-3">
          {/* Transcript mode selector */}
          {hasItems && (
            <div className="flex items-center justify-end px-0.5 pb-1">
              <TranscriptModeSelector
                mode={transcriptMode}
                onChange={setTranscriptMode}
              />
            </div>
          )}

          {/* Streaming active dot */}
          {hasItems && Array.from(agentSessions.values()).some(s => s.status === "running") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-0.5 py-0.5"
            >
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <span className="text-[9px] text-blue-400/60 font-medium">
                Streaming response...
              </span>
            </motion.div>
          )}

          {/* Render as conversation turns with staggered entrance */}
          <motion.div
            initial="initial"
            animate="animate"
            variants={{
              animate: {
                transition: {
                  staggerChildren: 0.04,
                },
              },
            }}
            className="space-y-3"
          >
            {conversationTurns.map((turn, turnIdx) => {
              const isLatest = turnIdx === conversationTurns.length - 1

              return (
                <motion.div
                  key={turn.userEvent.id}
                  variants={{
                    initial: { opacity: 0, y: 12 },
                    animate: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <TurnGroup
                    userEvent={turn.userEvent}
                    isLatest={isLatest}
                    onRetry={handleResend}
                  >
                    {/* Agent sessions correlated to this turn */}
                    {turn.sessionIds.map((stepId) => {
                      const session = agentSessions.get(stepId)
                      if (!session) return null
                      return renderStepCard(session)
                    })}

                    {/* Standalone events */}
                    {turn.eventIds.map((id) => {
                      const event = events.find((e) => e.id === id)
                      if (!event || !isEventVisible(event)) return null
                      return <EventRenderer key={id} event={event} />
                    })}
                  </TurnGroup>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Fallback: unmatched sessions */}
          {conversationTurns.length === 0 && Array.from(agentSessions.values()).map(renderStepCard)}
        </div>
      )}
    </div>
  )
}
