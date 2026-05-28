import { memo } from "react"
import { Zap, DollarSign } from "lucide-react"
import type { StepCardStatus } from "../step-card"

const COST_PER_1K_TOKENS: Record<string, number> = {
  "gpt-4o": 0.0025,
  "gpt-4o-mini": 0.00015,
  "claude-sonnet-4-20250514": 0.003,
  "claude-haiku-3-5-20241022": 0.0008,
  "claude-3-5-sonnet-20241022": 0.003,
  default: 0.001,
}

function estimateCost(modelName?: string, durationMs?: number): string {
  if (!durationMs || durationMs < 1000) return ""
  const rate = COST_PER_1K_TOKENS[modelName ?? ""] ?? COST_PER_1K_TOKENS.default
  const estimatedTokens = Math.round(durationMs / 1000 * 15)
  const cost = (estimatedTokens / 1000) * rate
  if (cost < 0.01) return "<$0.01"
  return `$${cost.toFixed(2)}`
}

export const MessageMetrics = memo(function MessageMetrics({
  startedAt,
  status,
  modelName,
  providerName,
  toolCallCount,
  fileEditCount,
}: {
  startedAt?: number
  status: StepCardStatus
  modelName?: string
  providerName?: string
  toolCallCount?: number
  fileEditCount?: number
}) {
  if (status === "running" || status === "waiting") return null
  if (!startedAt) return null

  const durationMs = Date.now() - startedAt
  const seconds = Math.floor(durationMs / 1000)
  const durationStr = seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const costStr = estimateCost(modelName, durationMs)

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[9px] text-foreground/25 border-t border-foreground/4 flex-wrap">
      <Zap className="h-2.5 w-2.5" />
      <span>{durationStr}</span>
      {costStr && (
        <>
          <span className="text-foreground/15">·</span>
          <DollarSign className="h-2.5 w-2.5" />
          <span>{costStr}</span>
        </>
      )}
      {toolCallCount !== undefined && toolCallCount > 0 && (
        <>
          <span className="text-foreground/15">·</span>
          <span>{toolCallCount} tool call{toolCallCount !== 1 ? "s" : ""}</span>
        </>
      )}
      {fileEditCount !== undefined && fileEditCount > 0 && (
        <>
          <span className="text-foreground/15">·</span>
          <span>{fileEditCount} file{fileEditCount !== 1 ? "s" : ""}</span>
        </>
      )}
      {modelName && (
        <>
          <span className="text-foreground/15">·</span>
          <span className="font-mono">{modelName}</span>
        </>
      )}
      {providerName && (
        <>
          <span className="text-foreground/15">·</span>
          <span>{providerName}</span>
        </>
      )}
    </div>
  )
})
