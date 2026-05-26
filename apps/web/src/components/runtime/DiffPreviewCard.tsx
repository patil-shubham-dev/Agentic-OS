import { useState, memo, useMemo } from "react"
import { ChevronDown, ChevronRight, FileCode } from "lucide-react"
import { cn } from "@/lib/utils"

interface DiffLine {
  type: "add" | "remove" | "context"
  content: string
}

interface DiffPreviewCardProps {
  path: string
  additions: number
  deletions: number
  diffContent?: string
  oldContent?: string
  newContent?: string
}

function parseDiff(diffContent: string): DiffLine[] {
  const lines = diffContent.split("\n")
  const parsed: DiffLine[] = []
  for (const line of lines) {
    if (line.startsWith("+")) {
      parsed.push({ type: "add", content: line.slice(1) })
    } else if (line.startsWith("-")) {
      parsed.push({ type: "remove", content: line.slice(1) })
    } else {
      parsed.push({ type: "context", content: line })
    }
  }
  return parsed
}

function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split("\n")
  const newLines = newContent.split("\n")
  const maxLen = Math.max(oldLines.length, newLines.length)
  const result: DiffLine[] = []
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) {
      result.push({ type: "add", content: newLines[i] })
    } else if (i >= newLines.length) {
      result.push({ type: "remove", content: oldLines[i] })
    } else if (oldLines[i] === newLines[i]) {
      result.push({ type: "context", content: oldLines[i] })
    } else {
      result.push({ type: "remove", content: oldLines[i] })
      result.push({ type: "add", content: newLines[i] })
    }
  }
  return result
}

export const DiffPreviewCard = memo(function DiffPreviewCard({
  path,
  additions,
  deletions,
  diffContent,
  oldContent,
  newContent,
}: DiffPreviewCardProps) {
  const [expanded, setExpanded] = useState(false)

  const lines = useMemo(() => {
    if (diffContent) return parseDiff(diffContent)
    if (oldContent && newContent) return computeDiff(oldContent, newContent)
    return []
  }, [diffContent, oldContent, newContent])

  const fileName = path.split("/").pop() || path

  return (
    <div className="rounded-lg border border-white/8 overflow-hidden">
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
          <FileCode className="h-3 w-3 shrink-0 text-blue-400" />
          <span className="text-[11px] font-mono text-white/60 truncate">{fileName}</span>
          <span className="text-[9px] text-white/30 truncate hidden sm:inline">{path}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {additions > 0 && (
            <span className="text-[10px] font-mono text-emerald-400">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-[10px] font-mono text-red-400">-{deletions}</span>
          )}
        </div>
      </button>

      {expanded && lines.length > 0 && (
        <div className="border-t border-white/8 max-h-64 overflow-y-auto">
          <div className="font-mono text-[10px] leading-relaxed">
            {lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "px-3 py-[1px] whitespace-pre",
                  line.type === "add" && "bg-emerald-500/8 text-emerald-300",
                  line.type === "remove" && "bg-red-500/8 text-red-300",
                  line.type === "context" && "text-white/25",
                )}
              >
                <span className="mr-2 select-none text-[8px] opacity-50">
                  {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                </span>
                {line.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && lines.length === 0 && (
        <div className="border-t border-white/8 px-3 py-2 text-[10px] text-white/30">
          No diff content available
        </div>
      )}
    </div>
  )
})
