import { memo, useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  Check, X, Loader2, ChevronDown, ChevronRight, Copy,
  FileText, Terminal, Globe, Search, Code, Eye, PenLine,
  Plus, GitBranch, ArrowRight,
} from "lucide-react"

interface ToolCallItemProps {
  toolName: string
  args: string
  status: "pending" | "running" | "complete" | "error"
  result?: string
  durationMs?: number
}

const STATUS_ICONS = {
  pending: ClockIcon,
  running: Loader2,
  complete: Check,
  error: X,
} as const

const STATUS_META = {
  pending: { label: "Waiting", color: "text-foreground/30" },
  running: { label: "Running", color: "text-blue-400" },
  complete: { label: "Done", color: "text-emerald-400/70" },
  error: { label: "Failed", color: "text-red-400" },
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 2" />
    </svg>
  )
}

const TOOL_CONFIG = {
  grep_files: { icon: Search, label: "Search files", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/15" },
  glob_files: { icon: Search, label: "Find files", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/15" },
  read_file: { icon: Eye, label: "Read file", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/15" },
  write_file: { icon: Plus, label: "Create file", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/15" },
  edit_file: { icon: PenLine, label: "Edit file", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/15" },
  run_command: { icon: Terminal, label: "Run command", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/15" },
  launch_browser: { icon: Globe, label: "Launch browser", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/15" },
  browser_navigate: { icon: Globe, label: "Navigate", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/15" },
  browser_screenshot: { icon: Globe, label: "Screenshot", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/15" },
  browser_click: { icon: Globe, label: "Click", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/15" },
  browser_fill: { icon: Globe, label: "Fill form", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/15" },
  delegate_subtask: { icon: GitBranch, label: "Delegate", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/15" },
  run_skill: { icon: Code, label: "Run skill", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/15" },
  design_create_artifact: { icon: Code, label: "Create artifact", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/15" },
  design_add_version: { icon: Code, label: "Add version", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/15" },
} as const

function getToolConfig(name: string) {
  return (TOOL_CONFIG as any)[name] ?? { icon: Code, label: name, color: "text-foreground/50", bg: "bg-foreground/[0.03]", border: "border-foreground/6" }
}

function parseArgs(args: string): Record<string, string> {
  try {
    const parsed = JSON.parse(args)
    if (typeof parsed === "object" && parsed !== null) {
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
      )
    }
  } catch {}
  return { args }
}

function ResultPreview({ result, toolName }: { result: string; toolName: string }) {
  const [expanded, setExpanded] = useState(false)
  const maxLen = 200

  if (toolName === "run_command" || result.length > 500) {
    return (
      <pre className={cn(
        "text-[10px] font-mono leading-relaxed whitespace-pre-wrap rounded-md p-2",
        "bg-foreground/[0.02] text-foreground/60",
        expanded ? "" : "max-h-32 overflow-hidden relative",
      )}>
        {expanded ? result : result.slice(0, maxLen)}
        {!expanded && result.length > maxLen && (
          <span className="text-blue-400/60">...</span>
        )}
      </pre>
    )
  }

  return (
    <div className="text-[10px] text-foreground/50 leading-relaxed whitespace-pre-wrap">
      {result}
    </div>
  )
}

export const ToolCallItem = memo(function ToolCallItem({
  toolName,
  args,
  status,
  result,
  durationMs,
}: ToolCallItemProps) {
  const [expanded, setExpanded] = useState(false)
  const StatusIcon = STATUS_ICONS[status]
  const config = getToolConfig(toolName)
  const structured = useMemo(() => parseArgs(args), [args])
  const argEntries = useMemo(() => Object.entries(structured), [structured])
  const isRunning = status === "running"
  const isFileEdit = toolName === "edit_file"
  const isFileRead = toolName === "read_file"
  const isBash = toolName === "run_command"
  const isSearch = ["grep_files", "glob_files"].includes(toolName)
  const hasResult = !!result && (status === "complete" || status === "error")

  return (
    <div className={cn(
      "rounded-lg border transition-all duration-200",
      status === "running" ? "border-blue-500/20 bg-blue-500/[0.03]" : "border-foreground/6",
      status === "error" && "border-red-500/20 bg-red-500/[0.02]",
    )}>
      {/* Header bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-foreground/[0.02] rounded-lg transition-colors"
      >
        {/* Status icon */}
        <span className="shrink-0">
          {isRunning ? (
            <StatusIcon className="h-3 w-3 animate-spin text-blue-400" />
          ) : status === "complete" ? (
            <StatusIcon className="h-3 w-3 text-emerald-500" />
          ) : status === "error" ? (
            <StatusIcon className="h-3 w-3 text-red-400" />
          ) : (
            <StatusIcon className="h-3 w-3 text-foreground/30" />
          )}
        </span>

        {/* Tool icon badge */}
        <span className={cn("flex items-center justify-center h-5 w-5 rounded-md shrink-0", config.bg)}>
          <config.icon className={cn("h-3 w-3", config.color)} />
        </span>

        {/* Name + summary */}
        <span className="text-[10px] font-medium text-foreground/70 shrink-0">{toolName}</span>

        {/* Duration pill */}
        {durationMs !== undefined && (
          <span className="text-[8px] text-foreground/25 font-mono shrink-0 bg-foreground/[0.03] rounded px-1 py-0.5">
            {(durationMs / 1000).toFixed(1)}s
          </span>
        )}

        {/* Inline arg preview (unexpanded) */}
        <div className="flex-1 min-w-0">
          {!expanded && argEntries.length > 0 && (
            <span className="text-[9px] text-foreground/35 truncate block">
              {argEntries.slice(0, 2).map(([k, v]) => {
                const preview = k === "command" || k === "path" || k === "file_path" ? v : `${k}: ${v.slice(0, 30)}`
                return <span key={k} className="after:content-[',_'] last:after:content-none">{preview}</span>
              })}
              {argEntries.length > 2 && ` +${argEntries.length - 2} more`}
            </span>
          )}
        </div>

        {/* Expand toggle */}
        <span className="text-foreground/20 shrink-0">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-foreground/4">
          {/* Tool-specific rendering */}
          {isBash && <BashTool args={structured} result={result} status={status} />}
          {isFileRead && <FileReadTool args={structured} result={result} />}
          {isFileEdit && <FileEditTool args={structured} result={result} />}
          {isSearch && <SearchTool args={structured} result={result} />}
          {!(isBash || isFileRead || isFileEdit || isSearch) && (
            <div className="px-3 py-2 space-y-1.5">
              {argEntries.map(([key, value]) => (
                <ArgRow key={key} label={key} value={value} />
              ))}
              {hasResult && <ResultSection result={result} toolName={toolName} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

function ArgRow({ label, value }: { label: string; value: string }) {
  const isLong = value.length > 80
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex gap-2 text-[10px] font-mono">
      <span className="text-blue-400/50 shrink-0 w-22 truncate">{label}</span>
      <span className={cn(
        "text-foreground/50 break-all min-w-0",
        isLong && !expanded && "line-clamp-3",
      )}>
        {value}
      </span>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-blue-400/50 hover:text-blue-400 shrink-0 text-[9px]"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  )
}

function ResultSection({ result, toolName }: { result: string; toolName: string }) {
  const [showFull, setShowFull] = useState(false)
  const truncated = result.length > 300 && !showFull

  return (
    <div className="mt-2 pt-2 border-t border-foreground/4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] text-foreground/20 font-medium uppercase tracking-wider">Result</span>
        <button
          onClick={() => navigator.clipboard.writeText(result)}
          className="flex items-center gap-1 text-[8px] text-foreground/30 hover:text-foreground/50 transition-colors"
        >
          <Copy className="h-2.5 w-2.5" />
          Copy
        </button>
      </div>
      <ResultPreview result={truncated ? result.slice(0, 300) : result} toolName={toolName} />
      {truncated && (
        <button
          onClick={() => setShowFull(true)}
          className="text-[9px] text-blue-400/50 hover:text-blue-400 mt-1"
        >
          Show all {result.length} characters
        </button>
      )}
    </div>
  )
}

function BashTool({ args, result, status }: { args: Record<string, string>; result?: string; status: string }) {
  const command = args.command ?? args.cmd ?? ""
  const description = args.description ?? ""

  return (
    <div className="font-mono">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground/[0.03] border-b border-foreground/4">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500/50" />
          <span className="h-2 w-2 rounded-full bg-yellow-500/50" />
          <span className="h-2 w-2 rounded-full bg-green-500/50" />
        </div>
        <span className="text-[8px] text-foreground/20">bash</span>
      </div>

      {/* Command */}
      <div className="px-3 py-2 bg-foreground/[0.04] border-b border-foreground/4">
        <span className="text-[10px] text-emerald-400/70 select-none">$ </span>
        <span className="text-[10px] text-foreground/70">{command}</span>
        {description && (
          <div className="text-[8px] text-foreground/25 mt-0.5">{description}</div>
        )}
      </div>

      {/* Output */}
      {result && (
        <div className="px-3 py-2 max-h-40 overflow-y-auto">
          <pre className="text-[10px] text-foreground/55 leading-relaxed whitespace-pre-wrap">
            {result}
          </pre>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-1 border-t border-foreground/4">
        {status === "complete" && (
          <span className="flex items-center gap-1 text-[8px] text-emerald-500/60">
            <Check className="h-2.5 w-2.5" /> exited 0
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1 text-[8px] text-red-400/60">
            <X className="h-2.5 w-2.5" /> exited non-zero
          </span>
        )}
        {status === "running" && (
          <span className="flex items-center gap-1 text-[8px] text-blue-400/60">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> running
          </span>
        )}
      </div>
    </div>
  )
}

function FileReadTool({ args, result }: { args: Record<string, string>; result?: string }) {
  const filePath = args.file_path ?? args.path ?? ""

  return (
    <div>
      {/* File path header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground/[0.02] border-b border-foreground/4">
        <Eye className="h-3 w-3 text-blue-400/60" />
        <span className="text-[10px] font-mono text-foreground/50 truncate">{filePath}</span>
      </div>

      {/* Content preview */}
      {result && (
        <pre className="text-[10px] font-mono leading-relaxed whitespace-pre-wrap px-3 py-2 max-h-60 overflow-y-auto text-foreground/60">
          {result}
        </pre>
      )}
    </div>
  )
}

function FileEditTool({ args, result }: { args: Record<string, string>; result?: string }) {
  const filePath = args.file_path ?? args.path ?? ""
  const oldStr = args.old_string ?? ""
  const newStr = args.new_string ?? ""

  return (
    <div>
      {/* File path header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground/[0.02] border-b border-foreground/4">
        <PenLine className="h-3 w-3 text-amber-400/60" />
        <span className="text-[10px] font-mono text-foreground/50 truncate">{filePath}</span>
      </div>

      {/* Inline diff preview */}
      <div className="px-3 py-2 space-y-2">
        {oldStr && (
          <div>
            <span className="text-[8px] text-red-400/50 font-medium uppercase tracking-wider">Removed</span>
            <pre className="text-[10px] font-mono leading-relaxed text-red-300/70 bg-red-500/[0.04] rounded p-1.5 mt-0.5 border border-red-500/10">
              {oldStr}
            </pre>
          </div>
        )}
        {newStr && (
          <div>
            <span className="text-[8px] text-emerald-400/50 font-medium uppercase tracking-wider">Added</span>
            <pre className="text-[10px] font-mono leading-relaxed text-emerald-300/70 bg-emerald-500/[0.04] rounded p-1.5 mt-0.5 border border-emerald-500/10">
              {newStr}
            </pre>
          </div>
        )}
        {result && (
          <div className="pt-1.5 border-t border-foreground/4">
            <span className="text-[8px] text-foreground/20 font-medium uppercase tracking-wider">Result</span>
            <p className="text-[10px] text-emerald-400/60 mt-0.5">{result}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SearchTool({ args, result }: { args: Record<string, string>; result?: string }) {
  const pattern = args.pattern ?? args.query ?? ""

  return (
    <div>
      {/* Query header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground/[0.02] border-b border-foreground/4">
        <Search className="h-3 w-3 text-cyan-400/60" />
        <span className="text-[10px] font-mono text-cyan-400/70">{pattern}</span>
      </div>

      {/* Results */}
      {result && (
        <pre className="text-[10px] font-mono leading-relaxed whitespace-pre-wrap px-3 py-2 max-h-48 overflow-y-auto text-foreground/50">
          {result}
        </pre>
      )}
    </div>
  )
}
