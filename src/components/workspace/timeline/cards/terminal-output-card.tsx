import { useState, useRef, useEffect, memo } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Check, X, Loader2 } from "lucide-react"

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
    <div className={cn(
      "rounded-lg border overflow-hidden font-mono transition-all",
      status === "running" && "border-amber-500/20",
      status === "success" && "border-foreground/6",
      status === "error" && "border-red-500/20",
    )}>
      {/* macOS-style terminal title bar */}
      <div className={cn(
        "flex items-center justify-between px-3 py-1.5 border-b",
        status === "running" ? "bg-amber-500/[0.03] border-amber-500/10" :
        status === "error" ? "bg-red-500/[0.03] border-red-500/10" :
        "bg-foreground/[0.02] border-foreground/4",
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {/* Traffic light dots */}
          <div className="flex gap-1 shrink-0">
            <span className="h-2 w-2 rounded-full bg-red-500/40" />
            <span className="h-2 w-2 rounded-full bg-yellow-500/40" />
            <span className="h-2 w-2 rounded-full bg-green-500/40" />
          </div>
          <span className="text-[8px] text-foreground/20">bash</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Exit code badge */}
          {status === "success" && (
            <span className="flex items-center gap-1 text-[8px] text-emerald-500/60">
              <Check className="h-2.5 w-2.5" />
              {exitCode !== undefined ? `exit ${exitCode}` : "done"}
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1 text-[8px] text-red-400/60">
              <X className="h-2.5 w-2.5" />
              exit {exitCode ?? 1}
            </span>
          )}
          {status === "running" && (
            <span className="flex items-center gap-1 text-[8px] text-amber-400/60">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              running
            </span>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-foreground/20 hover:text-foreground/40 transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Command line — always visible */}
      <div className="px-3 py-1.5 bg-foreground/[0.04] border-b border-foreground/4">
        <span className="text-[10px] text-emerald-400/60 select-none">$ </span>
        <span className="text-[10px] text-foreground/70">{command}</span>
      </div>

      {/* Output — collapsible */}
      {expanded && outputLines.length > 0 && (
        <div
          ref={outputRef}
          className="max-h-48 overflow-y-auto px-3 py-2 space-y-0.5 bg-foreground/[0.02]"
        >
          {outputLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "text-[10px] leading-relaxed whitespace-pre-wrap",
                line.startsWith("error") || line.startsWith("Error") || line.startsWith("FAIL")
                  ? "text-red-400/70"
                  : line.startsWith("warning") || line.startsWith("Warning")
                    ? "text-yellow-400/60"
                    : "text-foreground/50",
              )}
            >
              {line}
            </div>
          ))}
          {status === "running" && (
            <span className="inline-block w-2 h-3.5 bg-amber-400/50 animate-blink align-middle" />
          )}
        </div>
      )}
    </div>
  )
})
