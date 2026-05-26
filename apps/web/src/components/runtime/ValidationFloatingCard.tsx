import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, RefreshCw, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ValidationIssue {
  id: string
  severity: "error" | "warning" | "info"
  message: string
  filePath: string
  line?: number
  suggestion?: string
  repairable: boolean
}

interface ValidationFloatingCardProps {
  issues: ValidationIssue[]
  onDismiss: (id: string) => void
  onRepair: (id: string) => void
  onRevert: (id: string) => void
  className?: string
}

export function ValidationFloatingCard({
  issues,
  onDismiss,
  onRepair,
  onRevert,
  className,
}: ValidationFloatingCardProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => (prev === id ? null : id))
  }, [])

  if (issues.length === 0) return null

  return (
    <div className={cn("absolute bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm", className)}>
      <AnimatePresence>
        {issues.map((issue) => (
          <motion.div
            key={issue.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-md cursor-pointer",
              issue.severity === "error"
                ? "bg-red-950/70 border-red-500/30"
                : issue.severity === "warning"
                  ? "bg-amber-950/70 border-amber-500/30"
                  : "bg-blue-950/70 border-blue-500/30",
            )}
            onClick={() => toggleExpand(issue.id)}
          >
            <div className="flex items-start gap-2">
              {issue.severity === "error" ? (
                <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-[11px] font-medium",
                    issue.severity === "error" ? "text-red-300" : "text-amber-300",
                  )}>
                    {issue.severity === "error" ? "Error" : "Warning"}
                  </span>
                  <span className="text-[10px] text-white/40 truncate">
                    {issue.filePath}{issue.line != null ? `:${issue.line}` : ""}
                  </span>
                </div>
                <p className="text-[11px] text-white/70 mt-0.5 line-clamp-2">{issue.message}</p>

                <AnimatePresence>
                  {expanded === issue.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {issue.suggestion && (
                        <p className="text-[10px] text-white/50 mt-1 italic">{issue.suggestion}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2">
                        {issue.repairable && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRepair(issue.id) }}
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
                          >
                            <RefreshCw className="h-2.5 w-2.5" />
                            Fix
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onRevert(issue.id) }}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                        >
                          <Undo2 className="h-2.5 w-2.5" />
                          Revert
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDismiss(issue.id) }}
                          className="text-[10px] px-2 py-1 rounded-md text-white/30 hover:text-white/50 hover:bg-white/5 transition-colors ml-auto"
                        >
                          Dismiss
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
