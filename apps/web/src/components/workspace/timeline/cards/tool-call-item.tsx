import { memo, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Check, X, Loader2, Clock } from "lucide-react"

interface ToolCallItemProps {
  toolName: string
  args: string
  status: "pending" | "running" | "complete" | "error"
  result?: string
  durationMs?: number
}

const STATUS_ICONS = {
  pending: Clock,
  running: Loader2,
  complete: Check,
  error: X,
} as const

const STATUS_STYLES = {
  pending: "text-white/30",
  running: "text-blue-300 bg-blue-500/8",
  complete: "text-white/50 bg-white/[0.03]",
  error: "text-red-300 bg-red-500/8",
}

export const ToolCallItem = memo(function ToolCallItem({
  toolName,
  args,
  status,
  result,
  durationMs,
}: ToolCallItemProps) {
  const Icon = STATUS_ICONS[status]
  const isRunning = status === "running"

  const isFile = ["read_file", "write_file", "edit_file"].includes(toolName)
  const isTerminal = toolName === "run_command"
  const isBrowser = toolName === "browser_action"

  return (
    <div className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-xs font-mono", STATUS_STYLES[status])}>
      <span className="shrink-0 mt-0.5">
        {isRunning ? (
          <Icon className="h-3 w-3 animate-spin text-blue-400" />
        ) : (
          <Icon className="h-3 w-3" />
        )}
      </span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[10px] font-medium",
            status === "running" && "text-blue-300",
            status === "complete" && "text-emerald-400/70",
            status === "error" && "text-red-400",
          )}>
            {toolName}
          </span>
          {durationMs !== undefined && (
            <span className="text-[8px] text-white/20">{durationMs}ms</span>
          )}
        </div>

        {args && (
          <div className="text-[9px] text-white/35 truncate max-w-[400px]">
            {isFile && args.startsWith('"') ? args : args}
          </div>
        )}

        {result && status === "complete" && (
          <div className="text-[9px] text-white/30 truncate max-w-[400px]">
            {result.length > 80 ? result.slice(0, 80) + "..." : result}
          </div>
        )}
      </div>
    </div>
  )
})
