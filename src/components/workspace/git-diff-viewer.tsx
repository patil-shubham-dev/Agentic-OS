import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { FileCode, Check, RotateCcw } from "lucide-react"

interface DiffLine {
  type: "add" | "del" | "context"
  content: string
  oldLineNum?: number
  newLineNum?: number
}

interface Hunk {
  header: string
  lines: DiffLine[]
}

function parseUnifiedDiff(diffContent: string): Hunk[] {
  if (!diffContent) return []
  const lines = diffContent.split("\n")
  const hunks: Hunk[] = []
  let currentHunk: Hunk | null = null

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (currentHunk) hunks.push(currentHunk)
      currentHunk = { header: line, lines: [] }
    } else if (currentHunk) {
      const type = line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "context"
      const content = line.slice(1)
      currentHunk.lines.push({ type, content })
    }
  }
  if (currentHunk) hunks.push(currentHunk)
  return hunks
}

function calculateLineNums(hunks: Hunk[]): Hunk[] {
  let oldLine = 0
  let newLine = 0
  for (const hunk of hunks) {
    const match = hunk.header.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
    if (match) {
      oldLine = parseInt(match[1], 10)
      newLine = parseInt(match[2], 10)
    }
    for (const line of hunk.lines) {
      if (line.type === "del") {
        line.oldLineNum = oldLine++
        line.newLineNum = undefined
      } else if (line.type === "add") {
        line.oldLineNum = undefined
        line.newLineNum = newLine++
      } else {
        line.oldLineNum = oldLine++
        line.newLineNum = newLine++
      }
    }
  }
  return hunks
}

interface GitDiffViewerProps {
  diffContent: string
  filePath: string
}

export function GitDiffViewer({ diffContent, filePath }: GitDiffViewerProps) {
  const [acceptedHunks, setAcceptedHunks] = useState<Set<number>>(new Set())
  const [rejectedHunks, setRejectedHunks] = useState<Set<number>>(new Set())

  const hunks = useMemo(() => {
    const parsed = parseUnifiedDiff(diffContent)
    return calculateLineNums(parsed)
  }, [diffContent])

  if (!diffContent || hunks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <FileCode className="h-5 w-5 mr-2" />
        No diff content available
      </div>
    )
  }

  const addCount = hunks.reduce(
    (s, h) => s + h.lines.filter((l) => l.type === "add").length,
    0,
  )
  const delCount = hunks.reduce(
    (s, h) => s + h.lines.filter((l) => l.type === "del").length,
    0,
  )

  function toggleAcceptHunk(index: number) {
    setAcceptedHunks((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    setRejectedHunks((prev) => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  function toggleRejectHunk(index: number) {
    setRejectedHunks((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    setAcceptedHunks((prev) => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="h-3.5 w-3.5 text-white/40 shrink-0" />
          <span className="text-xs font-medium truncate">{filePath}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
          <span className="text-red-400">-{delCount}</span>
          <span className="text-green-400">+{addCount}</span>
          <span className="text-white/30">{hunks.length} hunk(s)</span>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        <pre className="text-[11px] font-mono leading-[1.6]">
          {hunks.map((hunk, hi) => {
            const isAccepted = acceptedHunks.has(hi)
            const isRejected = rejectedHunks.has(hi)
            return (
              <div key={hi} className="relative group">
                {/* Hunk header */}
                <div className="flex items-center gap-1 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/30 border-b border-white/[0.04]">
                  <span className="flex-1">{hunk.header}</span>
                  {!isAccepted && !isRejected && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleAcceptHunk(hi)}
                        className="rounded p-0.5 text-green-400/60 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                        title="Accept hunk"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => toggleRejectHunk(hi)}
                        className="rounded p-0.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Revert hunk"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {isAccepted && (
                    <span className="text-[9px] text-green-400/60">Accepted</span>
                  )}
                  {isRejected && (
                    <span className="text-[9px] text-red-400/60">Reverted</span>
                  )}
                </div>

                {/* Hunk lines */}
                {hunk.lines.map((line, li) => (
                  <div
                    key={li}
                    className={cn(
                      "flex px-2",
                      line.type === "del" && "bg-red-500/10",
                      line.type === "add" && "bg-green-500/10",
                      (isAccepted || isRejected) && "opacity-40",
                    )}
                  >
                    <span className="w-8 shrink-0 text-right text-[9px] text-white/20 mr-2 select-none">
                      {line.oldLineNum ?? ""}
                    </span>
                    <span className="w-8 shrink-0 text-right text-[9px] text-white/20 mr-2 select-none">
                      {line.newLineNum ?? ""}
                    </span>
                    <span
                      className={cn(
                        "w-4 shrink-0 select-none",
                        line.type === "add" && "text-green-400",
                        line.type === "del" && "text-red-400",
                        line.type === "context" && "text-white/20",
                      )}
                    >
                      {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
                    </span>
                    <span
                      className={cn(
                        "flex-1",
                        line.type === "add" && "text-green-300",
                        line.type === "del" && "text-red-300",
                        line.type === "context" && "text-white/50",
                      )}
                    >
                      {line.content}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </pre>
      </div>
    </div>
  )
}
