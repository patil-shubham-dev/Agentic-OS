import { useState, useRef, useEffect, memo } from "react"
import { cn } from "@/lib/utils"
import { Terminal, ChevronDown, ChevronRight, Check, X, Loader2 } from "lucide-react"

interface TerminalOutputCardProps {
  command: string
  output: string
  exitCode?: number
  status: "running" | "success" | "error"
}

export const TerminalOutputCard = memo(function TerminalOutputCard({
  command,
  output,
  exitCode,
  status,
}: TerminalOutputCardProps) {
  const [expanded, setExpanded] = useState(true)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outputRef.current && status === "running") {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, status])

  const outputLines = output.split("\n").filter(Boolean)

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden font-mono",
        status === "running" && "border-amber-500/20 bg-amber-500/[0.02]",
        status === "success" && "border-white/8 bg-white/[0.02]",
        status === "error" && "border-red-500/20 bg-red-500/[0.02]",
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-white/30" />
          )}
          <Terminal className="h-3 w-3 shrink-0 text-amber-400" />
          <span className="text-[10px] text-white/50">$</span>
          <span className="text-[11px] text-white/70 truncate max-w-[300px]">{command}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === "running" && (
            <span className="flex items-center gap-1 text-[9px] text-amber-400/70">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              running
            </span>
          )}
          {status === "success" && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400/70">
              <Check className="h-2.5 w-2.5" />
              exit {exitCode ?? 0}
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1 text-[9px] text-red-400/70">
              <X className="h-2.5 w-2.5" />
              exit {exitCode}
            </span>
          )}
        </div>
      </button>

      {expanded && outputLines.length > 0 && (
        <div
          ref={outputRef}
          className="border-t border-white/8 max-h-48 overflow-y-auto px-3 py-2 space-y-0.5"
        >
          {outputLines.map((line, i) => (
            <div key={i} className="text-[10px] text-white/50 leading-relaxed whitespace-pre-wrap">
              {line}
            </div>
          ))}
          {status === "running" && (
            <span className="inline-block w-2 h-3 bg-amber-400/50 animate-pulse" />
          )}
        </div>
      )}
    </div>
  )
})
