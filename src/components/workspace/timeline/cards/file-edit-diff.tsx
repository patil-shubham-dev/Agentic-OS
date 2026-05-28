import { useState, memo, useMemo, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, FileCode, GitPullRequest, Copy, ExternalLink } from "lucide-react"
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
  verification?: FileEditVerification
}

const EXT_COLORS: Record<string, string> = {
  ts: "text-blue-400", tsx: "text-blue-400",
  js: "text-yellow-400", jsx: "text-yellow-400",
  css: "text-pink-400", html: "text-orange-400",
  json: "text-green-400", md: "text-foreground/40",
  py: "text-blue-300", rs: "text-orange-400",
  go: "text-cyan-400",
  swift: "text-orange-400", kt: "text-purple-400",
  vue: "text-emerald-400", svelte: "text-orange-400",
  mdx: "text-blue-400",
}

function getFileExt(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? ""
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
  const [expanded, setExpanded] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => parseDiff(diffContent), [diffContent])
  const fileName = path.split("/").pop() || path
  const fileExt = getFileExt(path)
  const dirPath = path.split("/").slice(0, -1).join("/")

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
    <div className="rounded-lg border border-foreground/6 overflow-hidden transition-all">
      {/* Stats bar — always visible */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-foreground/[0.02] border-b border-foreground/4">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className={cn("h-3 w-3 shrink-0", EXT_COLORS[fileExt] || "text-blue-400")} />
          <span className={cn("text-[10px] font-mono font-medium truncate", EXT_COLORS[fileExt] || "text-foreground/70")}>
            {fileName}
          </span>
          {dirPath && (
            <span className="text-[8px] text-foreground/20 truncate hidden sm:inline">{dirPath}/</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {verification && <VerificationBadge verification={verification} />}
          {additions > 0 && (
            <span className="text-[9px] font-mono text-emerald-400 font-medium">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-[9px] font-mono text-red-400 font-medium">-{deletions}</span>
          )}
          <span className="text-[7px] text-foreground/20">{changeCount} lines</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-foreground/20 hover:text-foreground/40 transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Diff content */}
      {expanded && (
        <div>
          {lines.length > 0 ? (
            <div ref={scrollRef} className="overflow-y-auto max-h-80">
              <div className="font-mono text-[9px] leading-[1.6] min-w-0">
                {lines.map((line, i) => {
                  const isChange = line.type !== "context"
                  const isHunk = line.content.startsWith("@@")
                  return (
                    <div
                      key={i}
                      data-change={isChange ? "true" : undefined}
                      className={cn(
                        "flex items-stretch min-w-0 group",
                        line.type === "add" && "bg-emerald-500/8 hover:bg-emerald-500/12",
                        line.type === "remove" && "bg-red-500/8 hover:bg-red-500/12",
                        line.type === "context" && "hover:bg-foreground/[0.01]",
                        isHunk && "bg-foreground/[0.02] border-y border-foreground/4",
                      )}
                    >
                      {/* Line number gutter */}
                      <span className={cn(
                        "shrink-0 w-10 text-right pr-2 select-none border-r border-foreground/4 text-[8px]",
                        line.type === "add" ? "text-emerald-500/30" :
                        line.type === "remove" ? "text-red-500/30" :
                        "text-foreground/15",
                      )}>
                        {line.lineNumber}
                      </span>

                      {/* Diff marker */}
                      <span className="shrink-0 w-4 text-center select-none">
                        <span className={cn(
                          "text-[8px]",
                          line.type === "add" ? "text-emerald-500/50" :
                          line.type === "remove" ? "text-red-500/50" :
                          isHunk ? "text-foreground/30" : "text-foreground/10",
                        )}>
                          {isHunk ? "~" : line.type === "add" ? "+" : line.type === "remove" ? "─" : " "}
                        </span>
                      </span>

                      {/* Content */}
                      <span className={cn(
                        "flex-1 px-2 whitespace-pre overflow-x-auto",
                        line.type === "add" ? "text-emerald-400/80" :
                        line.type === "remove" ? "text-red-400/80" :
                        isHunk ? "text-foreground/30 italic" :
                        "text-foreground/35",
                      )}>
                        {isHunk ? line.content.replace(/@@.*@@/, "").trim() : line.content}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 text-[10px] text-foreground/30">
              <GitPullRequest className="h-3 w-3" />
              <span>No changes to display</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-1 border-t border-foreground/4 bg-foreground/[0.01]">
            <div className="flex items-center gap-1.5">
              <FileCode className="h-2.5 w-2.5 text-foreground/20 shrink-0" />
              <span className="text-[8px] text-foreground/20 font-mono truncate">{path}</span>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(path)}
              className="text-foreground/20 hover:text-foreground/40 transition-colors"
              title="Copy file path"
            >
              <Copy className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
