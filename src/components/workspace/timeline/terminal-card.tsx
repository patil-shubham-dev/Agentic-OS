import { Terminal, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface TerminalCardProps {
  command: string
  output: string
  status: "running" | "success" | "error" | "awaiting-approval"
  exitCode?: number
  onApprove?: () => void
  onReject?: () => void
}

export function TerminalCard({
  command,
  output,
  status,
  exitCode,
  onApprove,
  onReject,
}: TerminalCardProps) {
  return (
    <div className={cn(
      "rounded-lg border font-mono text-xs overflow-hidden",
      status === "running" && "border-amber-500/30 bg-amber-500/5",
      status === "success" && "border-white/10 bg-white/3",
      status === "error" && "border-red-500/30 bg-red-500/5",
      status === "awaiting-approval" && "border-amber-500/50 bg-amber-500/8",
    )}>
      {/* Command header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8">
        <Terminal size={12} className="text-amber-400" />
        <span className="text-white/50">$</span>
        <span className="text-white/80">{command}</span>
        <div className="ml-auto">
          {status === "running" && (
            <span className="text-amber-400 animate-pulse">running...</span>
          )}
          {status === "success" && (
            <span className="text-emerald-400 flex items-center gap-1">
              <Check size={10} /> exit {exitCode ?? 0}
            </span>
          )}
          {status === "error" && (
            <span className="text-red-400 flex items-center gap-1">
              <AlertCircle size={10} /> exit {exitCode}
            </span>
          )}
        </div>
      </div>

      {/* Approval gate */}
      {status === "awaiting-approval" && (
        <div className="px-3 py-2 border-b border-amber-500/20 flex items-center gap-3">
          <span className="text-amber-300 text-xs">AI wants to run this command. Allow?</span>
          <button
            onClick={onApprove}
            className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
          >
            Allow
          </button>
          <button
            onClick={onReject}
            className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            Reject
          </button>
        </div>
      )}

      {/* Output */}
      {output && (
        <div className="px-3 py-2 text-white/50 max-h-40 overflow-y-auto whitespace-pre-wrap leading-5">
          {output}
        </div>
      )}
    </div>
  )
}
