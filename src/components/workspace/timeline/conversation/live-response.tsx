import { memo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ResponseStream } from "./response-stream"
import { Copy, Check, ThumbsUp, ThumbsDown, ChevronDown, ChevronRight, Code, FileText, Terminal, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCallRecord, FileEditRecord, TerminalRecord } from "../step-card"

interface LiveResponseProps {
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
  streamingText,
  toolCalls,
  fileEdits,
  terminalOutputs,
  status,
  startedAt,
  modelName,
  onFollowUpSelect,
}: LiveResponseProps) {
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      {/* === RESPONSE CONTENT === */}
      <div className={cn(
        "transition-opacity duration-200",
        isRunning && !hasText ? "opacity-70" : "opacity-100",
      )}>
        {/* Waiting state - subtle breathing before first token */}
        {!hasText && isRunning && (
          <div className="flex items-center gap-2 py-0.5">
            <div className="thinking-dots">
              <span /><span /><span />
            </div>
            <span className="text-[11px] text-foreground/30 font-normal">Thinking</span>
          </div>
        )}

        {/* Live streaming prose */}
        <ResponseStream text={streamingText} isStreaming={isRunning} />

        {/* Inline running activity badges - shown during streaming */}
        {isRunning && runningActivities.length > 0 && hasText && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {runningActivities.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-blue-500/8 border border-blue-500/10 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[9px] text-blue-400/60 font-mono">{a.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* === COMPLETED STATE ACTIONS === */}
      {hasText && isComplete && (
        <div className="flex items-center gap-1 mt-2 opacity-30 hover:opacity-100 transition-opacity">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(streamingText)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              } catch {}
            }}
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] transition-all",
              copied ? "text-emerald-400/60 bg-emerald-500/10" : "text-foreground/20 hover:text-foreground/40 hover:bg-foreground/[0.04]",
            )}
          >
            {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <span className="text-foreground/5 select-none">|</span>
          <button
            onClick={() => setRated(rated === "up" ? null : "up")}
            className={cn("rounded-md p-0.5 transition-all", rated === "up" ? "text-emerald-400" : "text-foreground/15 hover:text-foreground/35")}
          >
            <ThumbsUp className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => setRated(rated === "down" ? null : "down")}
            className={cn("rounded-md p-0.5 transition-all", rated === "down" ? "text-red-400" : "text-foreground/15 hover:text-foreground/35")}
          >
            <ThumbsDown className="h-2.5 w-2.5" />
          </button>

          {/* Activity metadata toggle */}
          {hasActivity && (
            <>
              <span className="text-foreground/5 select-none">|</span>
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="flex items-center gap-1 text-[9px] text-foreground/20 hover:text-foreground/40 transition-colors"
              >
                {showMetadata ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                {activities.length} action{activities.length !== 1 ? "s" : ""}
              </button>
            </>
          )}
        </div>
      )}

      {/* === COLLAPSED ACTIVITY DETAILS === */}
      <AnimatePresence>
        {showMetadata && isComplete && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 pl-2 border-l border-foreground/6 space-y-1">
              {activities.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-0.5">
                  {a.type === "tool" && <Code className="h-2.5 w-2.5 text-foreground/25" />}
                  {a.type === "file" && <FileText className="h-2.5 w-2.5 text-foreground/25" />}
                  {a.type === "terminal" && <Terminal className="h-2.5 w-2.5 text-foreground/25" />}
                  <span className="text-[10px] text-foreground/50 flex-1 min-w-0 truncate">{a.label}</span>
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
