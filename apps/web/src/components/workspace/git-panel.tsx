import { useState, useEffect } from "react"
import { useWorkspaceStore } from "@/stores/workspace-store"
import * as git from "@/lib/git"
import type { GitStatus, GitCommit } from "@/lib/git"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { GitBranch, GitCommit as GitCommitIcon, RotateCcw, History, Plus, Sparkles, Wand2, Check } from "lucide-react"

const AI_COMMIT_TEMPLATES = [
  "feat: add ",
  "fix: correct ",
  "refactor: simplify ",
  "chore: update ",
  "docs: add ",
  "style: format ",
  "test: add tests for ",
  "perf: improve ",
]

function generateCommitMessage(changes: { path: string; status: string }[]): string {
  if (changes.length === 0) return "chore: minor updates"
  const added = changes.filter((c) => c.status === "A" || c.status === "??")
  const modified = changes.filter((c) => c.status === "M")
  const deleted = changes.filter((c) => c.status === "D")

  const parts: string[] = []
  if (added.length > 0) {
    const files = added.map((c) => c.path.split("/").pop() || c.path).slice(0, 3)
    parts.push(`add ${files.join(", ")}${added.length > 3 ? ` +${added.length - 3} more` : ""}`)
  }
  if (modified.length > 0) {
    const files = modified.map((c) => c.path.split("/").pop() || c.path).slice(0, 3)
    parts.push(`update ${files.join(", ")}${modified.length > 3 ? ` +${modified.length - 3} more` : ""}`)
  }
  if (deleted.length > 0) {
    const files = deleted.map((c) => c.path.split("/").pop() || c.path).slice(0, 2)
    parts.push(`remove ${files.join(", ")}${deleted.length > 2 ? ` +${deleted.length - 2} more` : ""}`)
  }

  const type = added.length > 0 ? "feat" : modified.length > 0 ? "fix" : "chore"
  return `${type}: ${parts.join("; ")}`
}

function summarizeDiff(changes: { path: string; status: string }[]): { path: string; status: string; summary: string }[] {
  return changes.map((c) => {
    const statusLabel =
      c.status === "A" ? "Added" :
      c.status === "M" ? "Modified" :
      c.status === "D" ? "Deleted" :
      c.status === "??" ? "Untracked" :
      c.status === "R" ? "Renamed" : c.status
    return { ...c, summary: `${statusLabel}: ${c.path}` }
  })
}

export function GitPanel() {
  const rootPath = useWorkspaceStore((s) => s.rootPath)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [commitMsg, setCommitMsg] = useState("")
  const [loading, setLoading] = useState(false)
  const [isRepo, setIsRepo] = useState(true)
  const [message, setMessage] = useState("")
  async function refresh() {
    if (!rootPath) return
    setLoading(true)
    try {
      const s = await git.gitStatus(rootPath)
      setStatus(s)
      setIsRepo(true)
      if (s.changes.length > 0 && !commitMsg) {
        setCommitMsg(generateCommitMessage(s.changes))
      }
    } catch (e) {
      setIsRepo(false)
    }
    try {
      const c = await git.gitLog(rootPath, 10)
      setCommits(c)
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => {
    if (rootPath) refresh()
  }, [rootPath])

  async function handleInit() {
    if (!rootPath) return
    try {
      await git.gitInit(rootPath)
      setMessage("Git repository initialized")
      refresh()
    } catch (e) {
      setMessage(String(e))
    }
  }

  async function handleStageAll() {
    if (!rootPath || !status) return
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      for (const c of status.changes) {
        await invoke<string>("git_add", { workingDir: rootPath, file: c.path })
      }
      setMessage("Staged all changes")
      refresh()
    } catch (e) {
      setMessage(String(e))
    }
  }

  async function handleCommit() {
    if (!rootPath || !commitMsg.trim()) return
    try {
      await git.gitCommit(rootPath, commitMsg)
      setCommitMsg("")
      setMessage("Committed successfully")
      refresh()
    } catch (e) {
      setMessage(String(e))
    }
  }

  async function handleRestore(file: string) {
    if (!rootPath) return
    try {
      await git.gitRestore(rootPath, file)
      setMessage(`Restored ${file}`)
      refresh()
    } catch (e) {
      setMessage(String(e))
    }
  }

  function applyTemplate(tpl: string) {
    const name = status?.changes[0]?.path.split("/").pop() || "file"
    setCommitMsg(tpl + name)
  }

  const statusColor: Record<string, string> = {
    "M": "text-yellow-500",
    "A": "text-green-500",
    "D": "text-red-500",
    "??": "text-blue-500",
  }

  if (!rootPath) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4 text-center">
        <GitBranch className="h-6 w-6 mb-2 mx-auto" />
        <p>Open a workspace to use Git</p>
      </div>
    )
  }

  if (!isRepo) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center space-y-3">
        <GitBranch className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Not a git repository</p>
        <Button size="sm" onClick={handleInit}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Initialize Repository
        </Button>
      </div>
    )
  }

  const changeSummaries = status ? summarizeDiff(status.changes) : []

  return (
    <div className="flex h-full flex-col p-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span className="text-xs font-medium">{status?.branch ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          {status && (status.ahead > 0 || status.behind > 0) && (
            <span className="text-[10px] text-muted-foreground">
              {status.ahead > 0 && `↑${status.ahead} `}
              {status.behind > 0 && `↓${status.behind}`}
            </span>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={refresh} disabled={loading}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Changes */}
      {status && status.changes.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground font-medium">Changes ({status.changes.length})</p>
            <button
              onClick={handleStageAll}
              className="text-[9px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5"
            >
              <Check className="h-2.5 w-2.5" /> Stage All
            </button>
          </div>
          {status.changes.map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded px-2 py-1 text-[11px] hover:bg-accent/50 group">
              <span className={cn("font-mono w-5 shrink-0", statusColor[c.status] || "text-muted-foreground")}>
                {c.status}
              </span>
              <span className="truncate flex-1">{c.path}</span>
              <button
                onClick={() => handleRestore(c.path)}
                className="hidden group-hover:inline text-[10px] text-muted-foreground hover:text-foreground"
              >
                Restore
              </button>
            </div>
          ))}

          {/* AI Summary */}
          <div className="rounded border border-blue-500/20 bg-blue-500/5 p-2">
            <div className="flex items-center gap-1 text-[9px] text-blue-400 font-medium mb-1">
              <Sparkles className="h-2.5 w-2.5" /> AI Summary
            </div>
            <ul className="space-y-0.5">
              {changeSummaries.map((s, i) => (
                <li key={i} className="text-[9px] text-muted-foreground font-mono truncate">
                  {s.summary}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {status && status.changes.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center py-4">No changes</p>
      )}

      {/* AI commit message bar */}
      <div className="space-y-1">
        <div className="flex gap-1">
          <Input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Commit message..."
            className="h-7 text-xs flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") handleCommit() }}
          />
          <Button size="sm" className="h-7 text-xs shrink-0 flex items-center gap-1" onClick={handleCommit} disabled={!commitMsg.trim()}>
            <GitCommitIcon className="h-3 w-3" /> Commit
          </Button>
        </div>

        {/* AI suggestions */}
        {status && status.changes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {AI_COMMIT_TEMPLATES.map((tpl) => (
              <button
                key={tpl}
                onClick={() => applyTemplate(tpl)}
                className="rounded border border-blue-500/10 bg-blue-500/5 px-1.5 py-0.5 text-[9px] text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10 transition-colors font-mono"
              >
                {tpl.trim()}
              </button>
            ))}
            <button
              onClick={() => setCommitMsg(generateCommitMessage(status.changes))}
              className="rounded border border-purple-500/10 bg-purple-500/5 px-1.5 py-0.5 text-[9px] text-purple-400/70 hover:text-purple-400 hover:bg-purple-500/10 transition-colors flex items-center gap-0.5"
            >
              <Wand2 className="h-2.5 w-2.5" /> Auto
            </button>
          </div>
        )}
      </div>

      {/* History */}
      {commits.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <History className="h-3 w-3" /> History
          </p>
          {commits.map((c, i) => (
            <div key={i} className="rounded border px-2 py-1.5">
              <p className="text-[11px] font-medium truncate">{c.message}</p>
              <p className="text-[10px] text-muted-foreground">
                {c.hash.slice(0, 7)} · {c.author}
              </p>
            </div>
          ))}
        </div>
      )}

      {message && (
        <p className="text-[10px] text-green-600 dark:text-green-400">{message}</p>
      )}
    </div>
  )
}
