import { memo, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Terminal, FileText, Search, Code, Globe, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCallRecord } from "../step-card"

const TOOL_LABELS: Record<string, string> = {
  read_file: "Reading file",
  write_file: "Writing file",
  edit_file: "Editing file",
  grep: "Searching",
  search: "Searching",
  run_command: "Running command",
  terminal: "Running command",
  bash: "Running command",
  browser_navigate: "Navigating",
  browser_click: "Clicking",
  browser_type: "Typing",
  browser_snapshot: "Capturing page",
  web_fetch: "Fetching URL",
  web_search: "Searching web",
  delegate_task: "Delegating",
  spawn_agent: "Starting agent",
}

const TOOL_ICONS: Record<string, typeof Terminal> = {
  read_file: FileText,
  write_file: FileText,
  edit_file: FileText,
  grep: Search,
  search: Search,
  run_command: Terminal,
  terminal: Terminal,
  bash: Terminal,
  browser: Globe,
  navigate: Globe,
  web_search: Globe,
}

interface ToolCallBlockProps {
  tool: ToolCallRecord
  isLatest: boolean
}

export const ToolCallBlock = memo(function ToolCallBlock({ tool, isLatest }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(isLatest)
  const isRunning = tool.status === "running"
  const isError = tool.status === "error"
  const isComplete = tool.status === "complete"

  const Icon = TOOL_ICONS[tool.name] ?? Code

  const toggleExpand = useCallback(() => setExpanded((e) => !e), [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group flex items-start gap-2.5 py-1.5",
      )}
    >
      {/* Status indicator */}
      <div className="flex-shrink-0 mt-0.5">
        {isRunning && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400/70" />
        )}
        {isComplete && (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/60" />
        )}
        {isError && (
          <XCircle className="h-3.5 w-3.5 text-red-400/60" />
        )}
      </div>

      {/* Tool content */}
      <div className="flex-1 min-w-0">
        <button
          onClick={toggleExpand}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground/50 hover:text-foreground/80 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
          )}
          <Icon className="h-3 w-3 flex-shrink-0" />
          <span>{TOOL_LABELS[tool.name] ?? tool.name}</span>
          {isComplete && tool.durationMs != null && (
            <span className="text-[10px] text-foreground/30 font-mono">{tool.durationMs}ms</span>
          )}
          {isRunning && (
            <span className="inline-flex gap-0.5 ml-1">
              <span className="h-1 w-1 rounded-full bg-blue-400/40 animate-pulse" />
              <span className="h-1 w-1 rounded-full bg-blue-400/40 animate-pulse delay-75" />
              <span className="h-1 w-1 rounded-full bg-blue-400/40 animate-pulse delay-150" />
            </span>
          )}
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
              <div className="mt-1 rounded-lg bg-white/[0.02] border border-white/[0.05] p-2.5">
                <pre className="text-[11px] text-foreground/60 font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {tool.args}
                </pre>
                {isRunning && tool.progress && (
                  <div className="mt-2 pt-2 border-t border-white/[0.05]">
                    <div className="text-[10px] text-foreground/30 font-medium mb-1">Progress</div>
                    <pre className="text-[11px] text-blue-400/60 font-mono whitespace-pre-wrap break-all leading-relaxed">
                      {tool.progress}
                    </pre>
                  </div>
                )}
                {tool.result && isComplete && (
                  <div className="mt-2 pt-2 border-t border-white/[0.05]">
                    <div className="text-[10px] text-foreground/30 font-medium mb-1">Result</div>
                    <pre className="text-[11px] text-emerald-400/60 font-mono whitespace-pre-wrap break-all leading-relaxed">
                      {tool.result}
                    </pre>
                  </div>
                )}
                {isError && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-red-400/60">
                    <AlertCircle className="h-2.5 w-2.5" />
                    <span>Tool failed</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
})
