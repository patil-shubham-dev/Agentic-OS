import { useState } from "react"
import type { DiffHunk } from "@/lib/history"
import { cn } from "@/lib/utils"
import { FileCode } from "lucide-react"

interface DiffViewerProps {
  path: string
  hunks: DiffHunk[]
  oldContent: string
  newContent: string
}

export function DiffViewer({ path, hunks, oldContent, newContent }: DiffViewerProps) {
  const [view, setView] = useState<"unified" | "split">("unified")

  const oldLines = oldContent.split("\n")
  const newLines = newContent.split("\n")

  if (hunks.length === 0 && oldContent === newContent) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <FileCode className="h-5 w-5 mr-2" />
        No changes detected
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-medium truncate max-w-[200px]">{path}</span>
        <div className="flex gap-1">
          <button
            onClick={() => setView("unified")}
            className={cn(
              "px-2 py-0.5 text-[10px] rounded transition-colors",
              view === "unified" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Unified
          </button>
          <button
            onClick={() => setView("split")}
            className={cn(
              "px-2 py-0.5 text-[10px] rounded transition-colors",
              view === "split" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Split
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto p-2">
        {view === "unified" ? (
          <pre className="text-[11px] font-mono leading-relaxed">
            {/* Show context lines with hunks */}
            {hunks.length > 0 ? (
              hunks.map((hunk, hi) => (
                <div key={hi}>
                  <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-t">
                    @@ -{hunk.old_start},{hunk.old_count} +{hunk.new_start},{hunk.new_count} @@
                  </div>
                  {hunk.lines.map((line, li) => {
                    const isRemoved = line.startsWith("-")
                    const isAdded = line.startsWith("+")
                    return (
                      <div
                        key={li}
                        className={cn(
                          "px-2",
                          isRemoved && "bg-red-500/10 text-red-600 dark:text-red-400",
                          isAdded && "bg-green-500/10 text-green-600 dark:text-green-400",
                        )}
                      >
                        {line}
                      </div>
                    )
                  })}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-center py-4">No structural differences</div>
            )}
          </pre>
        ) : (
          /* Split view */
          <div className="flex gap-1">
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-t mb-1">Old</div>
              <pre className="text-[11px] font-mono">
                {oldLines.map((line, i) => {
                  const isChanged = newLines[i] !== line
                  return (
                    <div
                      key={i}
                      className={cn(
                        "px-2",
                        isChanged && "bg-red-500/10 text-red-600 dark:text-red-400"
                      )}
                    >
                      {line}
                    </div>
                  )
                })}
              </pre>
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-t mb-1">New</div>
              <pre className="text-[11px] font-mono">
                {newLines.map((line, i) => {
                  const isChanged = oldLines[i] !== line
                  return (
                    <div
                      key={i}
                      className={cn(
                        "px-2",
                        isChanged && "bg-green-500/10 text-green-600 dark:text-green-400"
                      )}
                    >
                      {line}
                    </div>
                  )
                })}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Summary bar */}
      <div className="border-t px-3 py-1 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="text-red-500">-{hunks.reduce((s, h) => s + h.lines.filter(l => l.startsWith("-")).length, 0)}</span>
        <span className="text-green-500">+{hunks.reduce((s, h) => s + h.lines.filter(l => l.startsWith("+")).length, 0)}</span>
        <span>{hunks.length} hunk(s)</span>
      </div>
    </div>
  )
}
