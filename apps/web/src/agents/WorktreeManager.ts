import type { AgentKind, WorktreeEntry } from "./AgentTypes"

export interface WorktreeSnapshot {
  entries: WorktreeEntry[]
}

export class WorktreeManager {
  private entries: Map<string, WorktreeEntry> = new Map()
  private baseDir: string
  private useGitWorktree: boolean
  private gitRoot: string | null = null

  constructor(baseDir: string = ".worktrees", useGitWorktree: boolean = false, gitRoot?: string) {
    this.baseDir = baseDir
    this.useGitWorktree = useGitWorktree
    this.gitRoot = gitRoot ?? null
  }

  setGitRoot(path: string): void {
    this.gitRoot = path
  }

  enableGitWorktrees(enabled: boolean): void {
    this.useGitWorktree = enabled
  }

  async create(agentKind: AgentKind, taskId: string): Promise<WorktreeEntry> {
    const id = `wt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const basePath = `${this.baseDir}/${id}`

    if (this.useGitWorktree && this.gitRoot) {
      try {
        const branchName = `worktree/${id}`
        const result = await this.execGit(`git worktree add -b ${branchName} ${basePath} HEAD`)
        if (result) {
          const entry: WorktreeEntry = {
            id,
            agentKind,
            taskId,
            basePath,
            files: new Map(),
            createdAt: Date.now(),
            lastAccessed: Date.now(),
          }
          this.entries.set(id, entry)
          return entry
        }
      } catch {
        // fall through to in-memory
      }
    }

    const entry: WorktreeEntry = {
      id,
      agentKind,
      taskId,
      basePath,
      files: new Map(),
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    }
    this.entries.set(id, entry)
    return entry
  }

  async removeGitWorktree(id: string): Promise<boolean> {
    const entry = this.entries.get(id)
    if (!entry) return false
    if (this.useGitWorktree && this.gitRoot) {
      try {
        await this.execGit(`git worktree remove ${entry.basePath}`)
      } catch {
        // still remove from map
      }
    }
    return this.entries.delete(id)
  }

  private async execGit(command: string): Promise<string> {
    const cmd = `cd "${this.gitRoot}" && ${command}`
    try {
      const hasNode = typeof (globalThis as any).process?.version === "string"
      if (hasNode) {
        const cp = await new Function('return import("child_process")')() as any
        return cp.execSync(cmd, { encoding: "utf-8", timeout: 10000 }).toString()
      }
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const tauri = await import("@tauri-apps/api/core")
        return await tauri.invoke("exec_command", { command: cmd })
      }
    } catch {
      // fallthrough
    }
    return ""
  }

  get(id: string): WorktreeEntry | undefined {
    const entry = this.entries.get(id)
    if (entry) {
      entry.lastAccessed = Date.now()
    }
    return entry
  }

  getByAgent(agentKind: AgentKind): WorktreeEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.agentKind === agentKind)
  }

  getByTask(taskId: string): WorktreeEntry | undefined {
    return Array.from(this.entries.values()).find((e) => e.taskId === taskId)
  }

  readFile(entryId: string, path: string): string | undefined {
    const entry = this.entries.get(entryId)
    if (!entry) return undefined
    entry.lastAccessed = Date.now()
    return entry.files.get(path)
  }

  writeFile(entryId: string, path: string, content: string): boolean {
    const entry = this.entries.get(entryId)
    if (!entry) return false
    entry.lastAccessed = Date.now()
    entry.files.set(path, content)
    return true
  }

  deleteFile(entryId: string, path: string): boolean {
    const entry = this.entries.get(entryId)
    if (!entry) return false
    entry.lastAccessed = Date.now()
    return entry.files.delete(path)
  }

  listFiles(entryId: string): string[] {
    const entry = this.entries.get(entryId)
    if (!entry) return []
    entry.lastAccessed = Date.now()
    return Array.from(entry.files.keys())
  }

  async remove(id: string): Promise<boolean> {
    return await this.removeGitWorktree(id)
  }

  async removeByTask(taskId: string): Promise<void> {
    const entry = this.getByTask(taskId)
    if (entry) {
      await this.removeGitWorktree(entry.id)
    }
  }

  clear(): void {
    this.entries.clear()
  }

  snapshot(): WorktreeSnapshot {
    return {
      entries: Array.from(this.entries.values()).map((e) => ({
        ...e,
        files: new Map(e.files),
      })),
    }
  }

  restore(snapshot: WorktreeSnapshot): void {
    this.entries.clear()
    for (const entry of snapshot.entries) {
      this.entries.set(entry.id, {
        ...entry,
        files: new Map(entry.files),
      })
    }
  }
}
