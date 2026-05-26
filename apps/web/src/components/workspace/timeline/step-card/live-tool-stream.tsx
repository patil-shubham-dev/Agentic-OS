import { memo } from "react"
import { Loader2 } from "lucide-react"
import type { ToolCallRecord } from "../step-card"

/**
 * Displays currently running tools with their live streaming args and results.
 * Only renders when there are tools with "running" status.
 */
export const LiveToolStream = memo(function LiveToolStream({ toolCalls }: { toolCalls: ToolCallRecord[] }) {
  const runningTools = toolCalls.filter((tc) => tc.status === "running")
  if (runningTools.length === 0) return null

  return (
    <div className="border-t border-blue-500/10 bg-blue-500/[0.02]">
      {runningTools.map((tc) => (
        <div key={tc.id} className="px-3 py-1.5 border-b border-blue-500/5 last:border-b-0">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-400 shrink-0" />
            <span className="text-[10px] font-mono text-blue-400/80 font-medium">{tc.name}</span>
            {tc.durationMs && (
              <span className="text-[8px] text-white/20 font-mono ml-auto">
                {(tc.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          {/* Streaming args preview */}
          {tc.args && tc.args.length < 200 && (
            <div className="text-[9px] text-white/30 font-mono truncate ml-5">
              {tc.args.slice(0, 100)}{tc.args.length > 100 ? "..." : ""}
            </div>
          )}
          {/* Live result preview as it streams in */}
          {tc.result && (
            <div className="ml-5 mt-0.5">
              <pre className="text-[9px] text-emerald-400/50 font-mono line-clamp-2 leading-relaxed">
                {tc.result.length > 150 ? tc.result.slice(0, 150) + "..." : tc.result}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  )
})
