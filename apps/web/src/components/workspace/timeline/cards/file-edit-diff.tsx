import { useState, memo, useMemo, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, FileCode, GitPullRequest } from "lucide-react"
import { VerificationBadge, type FileEditVerification } from "./verification-badge"

interface DiffLine {
  type: "add" | "remove" | "context"
  content: string
  lineNumber: number
}

interface FileEditDiffProps {
  path: string
  additions: number
  deletions: number
  diffContent: string
  oldContent?: string
  newContent?: string
  /** Optional auto-verification result shown as a badge */
  verification?: FileEditVerification
}

const EXT_COLORS: Record<string, string> = {
  ts: "text-blue-400", tsx: "text-blue-400",
  js: "text-yellow-400", jsx: "text-yellow-400",
  css: "text-pink-400", html: "text-orange-400",
  json: "text-green-400", md: "text-white/40",
  py: "text-blue-300", rs: "text-orange-400",
}

function getFileExt(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? ""
}

function getFileBreadcrumbs(path: string): string {
  const parts = path.split("/")
  if (parts.length <= 1) return path
  return parts.slice(0, -1).join(" / ")
}

function parseDiff(diffContent: string): DiffLine[] {
  const lines = diffContent.split("\n")
  const parsed: DiffLine[] = []
  let lineNum = 1
  for (const line of lines) {
    if (line.startsWith("+")) {
      parsed.push({ type: "add", content: line.slice(1), lineNumber: lineNum })
    } else if (line.startsWith("-")) {
      parsed.push({ type: "remove", content: line.slice(1), lineNumber: lineNum })
    } else if (line.startsWith("@@")) {
      parsed.push({ type: "context", content: line, lineNumber: lineNum })
    } else {
      parsed.push({ type: "context", content: line, lineNumber: lineNum })
    }
    lineNum++
  }
  return parsed
}

export const FileEditDiff = memo(function FileEditDiff({
  path,
  additions,
  deletions,
  diffContent,
  verification,
}: FileEditDiffProps) {
  const [expanded, setExpanded] = useState(true) // default expanded for better UX
  const scrollRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => parseDiff(diffContent), [diffContent])
  const fileName = path.split("/").pop() || path
  const fileExt = getFileExt(path)
  const breadcrumbs = getFileBreadcrumbs(path)

  // Auto-scroll to first change on expand
  useEffect(() => {
    if (expanded && scrollRef.current) {
      const firstChange = scrollRef.current.querySelector('[data-change="true"]')
      if (firstChange) {
        firstChange.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [expanded])

  const changeCount = lines.filter((l) => l.type !== "context").length

  return (
    <div className="rounded-lg border border-white/8 overflow-hidden transition-all">
      {/* File header with breadcrumbs */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-white/[0.03] transition-colors group"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-white/30" />
          )}
          <FileCode className={cn("h-3 w-3 shrink-0", EXT_COLORS[fileExt] || "text-blue-400")} />
          <span className="text-[11px] font-mono text-white/70 font-medium truncate">{fileName}</span>
          {breadcrumbs && (
            <span className="text-[8px] text-white/20 truncate hidden sm:inline">
              {breadcrumbs}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Verification status badge */}
          {verification && (
            <VerificationBadge verification={verification} />
          )}
          {/* Change summary badges */}
          {additions > 0 && (
            <span className="text-[10px] font-mono text-emerald-400 font-medium">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-[10px] font-mono text-red-400 font-medium">-{deletions}</span>
          )}
          {changeCount > 0 && (
            <span className="text-[8px] text-white/20">{changeCount} changes</span>
          )}
        </div>
      </button>

      {/* Diff content */}
      {expanded && (
        <div className="border-t border-white/8">
          {lines.length > 0 ? (
            <div ref={scrollRef} className="overflow-y-auto max-h-72">
              <div className="font-mono text-[9px] leading-[1.6] min-w-0">
                {lines.map((line, i) => {
                  const isChange = line.type !== "context"
                  // Highlight hunks
                  const isHunk = line.content.startsWith("@@")
                  return (
                    <div
                      key={i}
                      data-change={isChange ? "true" : undefined}
                      className={cn(
                        "flex items-stretch min-w-0",
                        line.type === "add" && "bg-emerald-500/10 hover:bg-emerald-500/15",
                        line.type === "remove" && "bg-red-500/10 hover:bg-red-500/15",
                        line.type === "context" && "hover:bg-white/[0.01]",
                        isHunk && "bg-white/[0.02] border-b border-white/[0.04] border-t border-white/[0.04]",
                      )}
                    >
                      {/* Line number gutter */}
                      <span className={cn(
                        "shrink-0 w-8 text-right pr-2 select-none text-[8px] border-r border-white/[0.04]",
                        line.type === "add" ? "text-emerald-400/30" :
                        line.type === "remove" ? "text-red-400/30" :
                        "text-white/15",
                      )}>
                        {line.lineNumber}
                      </span>
                      {/* Diff marker + content */}
                      <span className="shrink-0 w-4 text-center select-none">
                        <span className={cn(
                          "text-[8px]",
                          line.type === "add" ? "text-emerald-400/50" :
                          line.type === "remove" ? "text-red-400/50" :
                          isHunk ? "text-white/30" : "text-white/10",
                        )}>
                          {isHunk ? "~" : line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                        </span>
                      </span>
                      {/* Content */}
                      <span className={cn(
                        "flex-1 px-2 whitespace-pre overflow-x-auto",
                        line.type === "add" ? "text-emerald-300/80" :
                        line.type === "remove" ? "text-red-300/80" :
                        isHunk ? "text-white/30 italic" :
                        "text-white/35",
                      )}>
                        {isHunk ? line.content.replace(/@@.*@@/, "").trim() : line.content}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 text-[10px] text-white/30">
              <GitPullRequest className="h-3 w-3" />
              <span>Empty diff — no changes to display</span>
            </div>
          )}
          {/* Footer with file path */}
          {path && (
            <div className="flex items-center gap-2 px-3 py-1 border-t border-white/[0.04] bg-white/[0.01]">
              <FileCode className="h-2.5 w-2.5 text-white/20 shrink-0" />
              <span className="text-[8px] text-white/20 font-mono truncate">{path}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
