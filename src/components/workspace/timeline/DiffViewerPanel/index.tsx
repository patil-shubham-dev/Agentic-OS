import { useState, useMemo, memo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  FileCode, Check, X, ChevronDown, ChevronRight,
  FilePlus, FileMinus, Eye, EyeOff,
} from "lucide-react"
import type { FileEditRecord } from "../step-card"

interface DiffViewerPanelProps {
  fileEdits: FileEditRecord[]
  onAccept?: (filePath: string) => void
  onReject?: (filePath: string) => void
  onAcceptAll?: () => void
  onRejectAll?: () => void
  className?: string
}

type DiffView = "unified" | "split"
type FileStatus = "pending" | "accepted" | "rejected"

function computeFileStatus(additions: number, deletions: number): { label: string; color: string; Icon: typeof FilePlus } {
  if (additions > 0 && deletions === 0) return { label: "Created", color: "text-emerald-400", Icon: FilePlus }
  if (additions === 0 && deletions > 0) return { label: "Deleted", color: "text-red-400", Icon: FileMinus }
  if (additions > 0 && deletions > 0) return { label: "Modified", color: "text-blue-400", Icon: FileCode }
  return { label: "No changes", color: "text-white/30", Icon: FileCode }
}

const FileDiffCard = memo(function FileDiffCard({
  edit,
  status,
  view,
  onAccept,
  onReject,
  onViewToggle,
}: {
  edit: FileEditRecord
  status: FileStatus
  view: DiffView
  onAccept: () => void
  onReject: () => void
  onViewToggle: () => void
}) {
  const { label: actionLabel, color, Icon } = computeFileStatus(edit.additions, edit.deletions)
  const [expanded, setExpanded] = useState(true)

  // Parse diff hunks from diffContent
  const lines = useMemo(() => {
    if (edit.diffContent) return edit.diffContent.split("\n")
    return []
  }, [edit.diffContent])

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      status === "accepted" ? "border-emerald-500/20 bg-emerald-500/[0.02]" :
      status === "rejected" ? "border-red-500/15 bg-red-500/[0.02]" :
      "border-white/[0.06] bg-white/[0.02]",
    )}>
      {/* File header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-white/20 hover:text-white/50 transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
          <span className="text-[11px] font-mono font-medium text-white/70 truncate">
            {edit.path}
          </span>
          <span className={cn("text-[9px] font-medium", color)}>{actionLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[9px]">
            {edit.additions > 0 && <span className="text-emerald-400">+{edit.additions}</span>}
            {edit.deletions > 0 && <span className="text-red-400">-{edit.deletions}</span>}
          </span>
          {/* Accept/Reject buttons */}
          {status === "pending" && (
            <div className="flex items-center gap-1">
              <button
                onClick={onAccept}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                title="Accept this file change"
              >
                <Check className="h-3 w-3" />
                <span>Accept</span>
              </button>
              <button
                onClick={onReject}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Reject this file change"
              >
                <X className="h-3 w-3" />
                <span>Reject</span>
              </button>
            </div>
          )}
          {status === "accepted" && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400/60">
              <Check className="h-3 w-3" /> Accepted
            </span>
          )}
          {status === "rejected" && (
            <span className="flex items-center gap-1 text-[9px] text-red-400/60">
              <X className="h-3 w-3" /> Rejected
            </span>
          )}
          <button
            onClick={onViewToggle}
            className="rounded-md p-1 text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-all"
            title={`Switch to ${view === "unified" ? "split" : "unified"} view`}
          >
            {view === "unified" ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Diff content */}
      <AnimatePresence initial={false}>
        {expanded && lines.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-white/[0.04]"
          >
            <div className="overflow-x-auto">
              <pre className="px-3 py-2 text-[10px] font-mono leading-relaxed">
                {lines.map((line, i) => {
                  let lineColor = "text-white/50"
                  let bgColor = "transparent"
                  let prefix = " "

                  if (line.startsWith("+")) {
                    lineColor = "text-emerald-300"
                    bgColor = "rgba(52,211,153,0.04)"
                    prefix = "+"
                  } else if (line.startsWith("-")) {
                    lineColor = "text-red-300"
                    bgColor = "rgba(248,113,113,0.04)"
                    prefix = "-"
                  } else if (line.startsWith("@@")) {
                    lineColor = "text-cyan-400"
                    prefix = "@"
                  } else if (line.startsWith("diff --git") || line.startsWith("index") || line.startsWith("---") || line.startsWith("+++")) {
                    lineColor = "text-white/20"
                    prefix = ""
                  }

                  return (
                    <div
                      key={i}
                      className="flex"
                      style={{ backgroundColor: bgColor }}
                    >
                      <span className="w-8 shrink-0 text-right text-[9px] text-white/15 select-none">{i + 1}</span>
                      <span className="w-4 shrink-0 text-center text-[9px] select-none" style={{ color: line.startsWith("+") ? "rgba(52,211,153,0.4)" : line.startsWith("-") ? "rgba(248,113,113,0.4)" : "transparent" }}>
                        {prefix}
                      </span>
                      <span className={cn("flex-1", lineColor)}>{line}</span>
                    </div>
                  )
                })}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

export const DiffViewerPanel = memo(function DiffViewerPanel({
  fileEdits,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  className,
}: DiffViewerPanelProps) {
  const [view, setView] = useState<DiffView>("unified")
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatus>>({})
  const [expandedAll, setExpandedAll] = useState(true)

  const handleAccept = useCallback((filePath: string) => {
    setFileStatuses((prev) => ({ ...prev, [filePath]: "accepted" }))
    onAccept?.(filePath)
  }, [onAccept])

  const handleReject = useCallback((filePath: string) => {
    setFileStatuses((prev) => ({ ...prev, [filePath]: "rejected" }))
    onReject?.(filePath)
  }, [onReject])

  const handleAcceptAll = useCallback(() => {
    const allStatuses: Record<string, FileStatus> = {}
    for (const edit of fileEdits) {
      allStatuses[edit.path] = "accepted"
    }
    setFileStatuses(allStatuses)
    onAcceptAll?.()
  }, [fileEdits, onAcceptAll])

  const handleRejectAll = useCallback(() => {
    const allStatuses: Record<string, FileStatus> = {}
    for (const edit of fileEdits) {
      allStatuses[edit.path] = "rejected"
    }
    setFileStatuses(allStatuses)
    onRejectAll?.()
  }, [fileEdits, onRejectAll])

  const pendingCount = fileEdits.filter((e) => !fileStatuses[e.path] || fileStatuses[e.path] === "pending").length

  if (fileEdits.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <FileCode className="h-10 w-10 text-white/10 mb-3" />
        <p className="text-xs text-white/30">No file changes to review</p>
        <p className="text-[10px] text-white/20 mt-1">File edits from agent responses will appear here</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-white/50">
            {fileEdits.length} file{fileEdits.length !== 1 ? "s" : ""}
          </span>
          {pendingCount > 0 && (
            <span className="text-[9px] text-blue-400/60">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {pendingCount > 0 && (
            <>
              <button
                onClick={handleAcceptAll}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
              >
                <Check className="h-3 w-3" />
                <span>Accept All</span>
              </button>
              <button
                onClick={handleRejectAll}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <X className="h-3 w-3" />
                <span>Reject All</span>
              </button>
            </>
          )}
          <button
            onClick={() => setView(view === "unified" ? "split" : "unified")}
            className="rounded-md px-1.5 py-1 text-[9px] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
          >
            {view === "unified" ? "Split" : "Unified"}
          </button>
        </div>
      </div>

      {/* Diff list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {fileEdits.map((edit) => (
          <FileDiffCard
            key={edit.path}
            edit={edit}
            status={fileStatuses[edit.path] || "pending"}
            view={view}
            onAccept={() => handleAccept(edit.path)}
            onReject={() => handleReject(edit.path)}
            onViewToggle={() => setView(view === "unified" ? "split" : "unified")}
          />
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/[0.04] bg-white/[0.01]">
        <span className="text-[9px] text-white/20">
          {fileEdits.reduce((s, e) => s + e.additions, 0)} additions · {fileEdits.reduce((s, e) => s + e.deletions, 0)} deletions
        </span>
        <span className="text-[9px] text-white/20">
          {fileEdits.filter((e) => fileStatuses[e.path] === "accepted").length} accepted · {fileEdits.filter((e) => fileStatuses[e.path] === "rejected").length} rejected
        </span>
      </div>
    </div>
  )
})
