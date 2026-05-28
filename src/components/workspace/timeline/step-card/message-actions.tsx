import { useState, memo } from "react"
import { Copy, Check, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StepCardStatus } from "../step-card"

/**
 * Message action buttons: Copy, Rate (thumbs up/down), and Retry.
 * Only renders when the message is in a terminal state (complete or error).
 */
export const MessageActions = memo(function MessageActions({
  text,
  status,
  onRetry,
}: {
  text: string
  status: StepCardStatus
  onRetry?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [rated, setRated] = useState<"up" | "down" | null>(null)

  if (status === "running" || status === "waiting") return null

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-t border-foreground/4">
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {}
        }}
        className={cn(
          "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] transition-all",
          copied
          ? "text-emerald-400/70 bg-emerald-500/10"
          : "text-foreground/25 hover:text-foreground/50 hover:bg-foreground/[0.04]",
        )}
      >
        {copied ? <><Check className="h-2.5 w-2.5" /> Copied</> : <><Copy className="h-2.5 w-2.5" /> Copy</>}
      </button>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] text-foreground/25 hover:text-foreground/50 hover:bg-foreground/[0.04] transition-all"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          Retry
        </button>
      )}

      <span className="text-foreground/6 select-none">|</span>

      <button
        onClick={() => setRated(rated === "up" ? null : "up")}
        className={cn(
          "rounded-md p-0.5 transition-all",
          rated === "up" ? "text-emerald-400" : "text-foreground/20 hover:text-foreground/50 hover:bg-foreground/[0.04]",
        )}
      >
        <ThumbsUp className="h-2.5 w-2.5" />
      </button>
      <button
        onClick={() => setRated(rated === "down" ? null : "down")}
        className={cn(
          "rounded-md p-0.5 transition-all",
          rated === "down" ? "text-red-400" : "text-foreground/20 hover:text-foreground/50 hover:bg-foreground/[0.04]",
        )}
      >
        <ThumbsDown className="h-2.5 w-2.5" />
      </button>
    </div>
  )
})
