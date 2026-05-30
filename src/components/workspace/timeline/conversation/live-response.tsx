import { memo, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ResponseStream } from "./response-stream"
import { useTimelineStore } from "../timeline-store"
import { Copy, Check, ThumbsUp, ThumbsDown, ChevronDown, ChevronRight, Code, FileText, Terminal, Loader2 } from "lucide-react"
import type { ToolCallRecord, FileEditRecord, TerminalRecord } from "../step-card"

interface LiveResponseProps {
  stepId: string
  streamingText: string
  toolCalls: ToolCallRecord[]
  fileEdits: FileEditRecord[]
  terminalOutputs: TerminalRecord[]
  status: "running" | "complete" | "error"
  startedAt?: number
  modelName?: string
  onFollowUpSelect?: (prompt: string) => void
}

type ActivityItem = {
  id: string
  type: "tool" | "file" | "terminal"
  label: string
  status: "running" | "complete" | "error"
  detail?: string
}

export const LiveResponse = memo(function LiveResponse({
  stepId,
  streamingText: _propStreamingText,
  toolCalls,
  fileEdits,
  terminalOutputs,
  status,
  startedAt,
  modelName,
  onFollowUpSelect,
}: LiveResponseProps) {
  const storeText = useTimelineStore((s) => {
    const live = s.streamingTexts.get(stepId)
    if (live !== undefined) return live
    return s.agentSessions.get(stepId)?.streamingText ?? ""
  })
  const streamingText = storeText || _propStreamingText
  const [showActions, setShowActions] = useState(false)
  const [showMetadata, setShowMetadata] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rated, setRated] = useState<"up" | "down" | null>(null)
  const isRunning = status === "running"
  const isComplete = status === "complete"
  const hasText = streamingText.length > 0
  const hasActivity = toolCalls.length > 0 || fileEdits.length > 0 || terminalOutputs.length > 0

  const activities: ActivityItem[] = [
    ...toolCalls.map((tc) => ({
      id: tc.id,
      type: "tool" as const,
      label: tc.name,
      status: tc.status as "running" | "complete" | "error",
    })),
    ...fileEdits.map((fe) => ({
      id: fe.path,
      type: "file" as const,
      label: fe.path.split("/").pop() || fe.path,
      status: "complete" as const,
      detail: `+${fe.additions}/-${fe.deletions}`,
    })),
    ...terminalOutputs.map((t, i) => ({
      id: `term-${i}`,
      type: "terminal" as const,
      label: t.command.slice(0, 40),
      status: t.status === "running" ? ("running" as const) : t.exitCode === 0 ? ("complete" as const) : ("error" as const),
    })),
  ]

  const runningActivities = activities.filter((a) => a.status === "running")

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(streamingText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [streamingText])

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="assistant-response"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Waiting state */}
      {!hasText && isRunning && (
        <div className="streaming-thought">
          <div className="thinking-dots">
            <span /><span /><span />
          </div>
          <span>Thinking</span>
        </div>
      )}

      {/* Error state */}
      {!hasText && status === "error" && (
        <div className="streaming-thought" style={{ color: "rgba(248, 113, 113, 0.5)" }}>
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          <span>Response failed</span>
        </div>
      )}

      {/* Empty completed state */}
      {!hasText && isComplete && (
        <div className="streaming-thought">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400/40" />
          <span>No response content</span>
        </div>
      )}

      {/* Streaming markdown */}
      <ResponseStream text={streamingText} isStreaming={isRunning} />

      {/* Running activity badges */}
      {isRunning && runningActivities.length > 0 && hasText && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {runningActivities.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/6 border border-blue-500/8 px-2.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[10px] text-blue-400/50 font-mono">{a.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* Message actions bar — hover-revealed */}
      {hasText && isComplete && (
        <div className={`message-actions mt-3 ${showActions || copied ? 'message-actions-visible' : ''}`}>
          <button onClick={handleCopy} title="Copy">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
          <button onClick={() => setRated(rated === "up" ? null : "up")} title="Good response">
            <ThumbsUp className="h-3 w-3" style={rated === "up" ? { color: "#34d399" } : undefined} />
          </button>
          <button onClick={() => setRated(rated === "down" ? null : "down")} title="Bad response">
            <ThumbsDown className="h-3 w-3" style={rated === "down" ? { color: "#f87171" } : undefined} />
          </button>
          {hasActivity && (
            <>
              <span className="w-px h-3 bg-foreground/8 mx-1" />
              <button onClick={() => setShowMetadata(!showMetadata)} title="Show activity">
                {showMetadata ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            </>
          )}
        </div>
      )}

      {/* Activity details panel */}
      <AnimatePresence>
        {showMetadata && isComplete && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 pl-2.5 border-l border-foreground/6 space-y-0.5">
              {activities.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-0.5">
                  {a.type === "tool" && <Code className="h-2.5 w-2.5 text-foreground/25" />}
                  {a.type === "file" && <FileText className="h-2.5 w-2.5 text-foreground/25" />}
                  {a.type === "terminal" && <Terminal className="h-2.5 w-2.5 text-foreground/25" />}
                  <span className="text-[10px] text-foreground/45 flex-1 min-w-0 truncate">{a.label}</span>
                  {a.detail && <span className="text-[8px] text-foreground/20 font-mono">{a.detail}</span>}
                  {a.status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-400/60" />}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})
