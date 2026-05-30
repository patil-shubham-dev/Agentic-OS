import { memo, useState, useEffect } from "react"
import { Clock, Loader2 } from "lucide-react"
import type { AgentSession } from "../timeline-store"

interface ExecutionHeaderProps {
  session: AgentSession
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

export const ExecutionHeader = memo(function ExecutionHeader({ session }: ExecutionHeaderProps) {
  const isRunning = session.status === "running"
  const isComplete = session.status === "complete"
  const isError = session.status === "error"
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [isRunning])

  const duration = isRunning && session.startedAt
    ? now - session.startedAt
    : (session.completedAt && session.startedAt
      ? session.completedAt - session.startedAt
      : null)

  return (
    <div       className="flex items-center gap-2 py-0.5 text-xs">

      {isRunning && (
        <span className="flex items-center gap-1 text-blue-400/50">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Running</span>
        </span>
      )}
      {isComplete && (
        <span className="text-emerald-400/50">Complete</span>
      )}
      {isError && (
        <span className="text-red-400/50">Error</span>
      )}

      {duration != null && (
        <>
          <span className="text-foreground/20 mx-0.5">·</span>
          <span className="flex items-center gap-1 text-foreground/30 font-mono text-[10px]">
            <Clock className="h-3 w-3" />
            {formatDuration(duration)}
          </span>
        </>
      )}
    </div>
  )
})