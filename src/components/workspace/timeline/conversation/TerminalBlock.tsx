import { memo, useRef, useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, MinusCircle } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { cn } from "@/lib/utils"
import type { TerminalRecord } from "../step-card"

interface TerminalBlockProps {
  terminal: TerminalRecord
  compact?: boolean
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export const TerminalBlock = memo(function TerminalBlock({ terminal, compact = true }: TerminalBlockProps) {
  const isRunning = terminal.status === "running"
  const isSuccess = terminal.status === "success"
  const isError = terminal.status === "error"
  const isCancelled = terminal.status === "cancelled"
  const [expanded, setExpanded] = useState(false)

  // Auto-expand on start or error
  useEffect(() => {
    if (isRunning) setExpanded(true)
    if (isSuccess) setExpanded(false)
    if (isError) setExpanded(true)
  }, [isRunning, isSuccess, isError])

  const toggleExpand = useCallback(() => setExpanded((e) => !e), [])

  const outputRef = useRef<HTMLPreElement>(null)
  useEffect(() => {
    if (outputRef.current && isRunning) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [terminal.output, isRunning])

  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number>(Date.now())
  useEffect(() => {
    if (!isRunning) {
      if (terminal.durationMs != null) setElapsed(terminal.durationMs)
      return
    }
    startTimeRef.current = Date.now()
    setElapsed(0)
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current)
    }, 100)
    return () => clearInterval(interval)
  }, [isRunning, terminal.durationMs])

  const displayDuration = isRunning ? elapsed : (terminal.durationMs ?? elapsed)
  const cleanOutput = stripAnsi(terminal.output)

  const humanLabel = isRunning ? "Running a quick check" : isError ? "Something went wrong" : isCancelled ? "Cancelled" : "Done"

  return (
    <motion.div
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className="group py-1"
    >
      <button
        onClick={toggleExpand}
        className={cn(
          "flex items-center gap-2 text-xs font-medium w-full text-left",
          "transition-colors",
          "text-white/50 hover:text-white/70",
        )}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-white/20" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-white/20" />
        )}
        <span className="text-xs text-white/40 italic">{humanLabel}</span>

        {isSuccess && <CheckCircle2 className="h-3 w-3 text-emerald-400/50 flex-shrink-0" />}
        {isError && <XCircle className="h-3 w-3 text-red-400/50 flex-shrink-0" />}
        {isCancelled && <MinusCircle className="h-3 w-3 text-white/20 flex-shrink-0" />}
        {isRunning && <Loader2 className="h-3 w-3 animate-spin text-amber-400/60 flex-shrink-0" />}

        <span className="text-[10px] text-white/20 font-mono ml-auto">{formatDuration(displayDuration)}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="relative mt-1 space-y-1">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/30 border border-white/[0.04]">
                <span className="text-[11px] font-mono text-white/40">$</span>
                <code className="text-[11px] font-mono text-white/60 flex-1 truncate">{terminal.command}</code>
              </div>
              {cleanOutput && !isRunning && (
                <div className="absolute top-10 right-2 z-10">
                  <CopyButton text={cleanOutput} className="px-1 py-0.5 rounded bg-black/60 border border-white/[0.04]" />
                </div>
              )}
              <pre
                ref={outputRef}
                className={cn(
                  "rounded-lg bg-black/40 border border-white/[0.04] p-2.5",
                  "text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed",
                  "max-h-[200px] overflow-y-auto",
                  "scrollbar-thin scrollbar-thumb-white/[0.03] scrollbar-track-transparent",
                )}
              >
                <code>
                  {cleanOutput || (isRunning ? "" : "")}
                  {isRunning && cleanOutput ? <span className="animate-pulse text-amber-400/60">█</span> : ""}
                </code>
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})
