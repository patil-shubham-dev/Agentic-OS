import { memo } from "react"
import { Zap } from "lucide-react"
import type { StepCardStatus } from "../step-card"

/**
 * Per-message footer metrics showing duration, model name, and provider name.
 * Only renders when the message is in a terminal state with a startedAt timestamp.
 */
export const MessageMetrics = memo(function MessageMetrics({
  startedAt,
  status,
  modelName,
  providerName,
}: {
  startedAt?: number
  status: StepCardStatus
  modelName?: string
  providerName?: string
}) {
  if (status === "running" || status === "waiting") return null
  if (!startedAt) return null

  const durationMs = Date.now() - startedAt
  const seconds = Math.floor(durationMs / 1000)
  const durationStr = seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`

  return (
    <div className="flex items-center gap-2 px-3 py-1 text-[9px] text-white/20 border-t border-white/[0.03]">
      <Zap className="h-2.5 w-2.5" />
      <span>{durationStr}</span>
      {modelName && <span>{modelName}</span>}
      {providerName && <span>via {providerName}</span>}
    </div>
  )
})
