/**
 * Hierarchical memory loader for Agentic-OS Studio.
 * Loads memory files in order: global → project → local → path-scoped rules.
 * Adapted from Claude Code's CLAUDE.md architecture.
 */

import type { MemoryFile } from "./memory-types"

const DEFAULT_MEMORY_FILES = [
  { path: "~/.agentic-os/CLAUDE.md", source: "global" as const, priority: 0 },
  { path: "CLAUDE.md", source: "project" as const, priority: 1 },
  { path: "CLAUDE.local.md", source: "local" as const, priority: 2 },
]

export interface MemoryLoadResult {
  files: MemoryFile[]
  combined: string
  rules: MemoryFile[]
}

export class MemoryLoader {
  private cachedFiles: Map<string, string> = new Map()
  private cacheDurationMs = 30_000 // 30 second cache
  private lastLoadTime = 0

  async load(projectPath: string): Promise<MemoryLoadResult> {
    const now = Date.now()
    if (now - this.lastLoadTime < this.cacheDurationMs && this.cachedFiles.size > 0) {
      return this.buildResult()
    }

    this.cachedFiles.clear()
    const loaded: MemoryFile[] = []

    for (const def of DEFAULT_MEMORY_FILES) {
      const content = await this.tryRead(resolvePath(def.path, projectPath))
      if (content) {
        loaded.push({ ...def, content })
      }
    }

    // Load path-scoped rules from .agentic-os/memory/rules/
    const rulesDir = `${projectPath}/.agentic-os/memory/rules`
    const rules = await this.loadRules(rulesDir)
    loaded.push(...rules)

    this.cachedFiles = new Map(loaded.map((f) => [f.path, f.content]))
    this.lastLoadTime = now

    return this.buildResult()
  }

  private buildResult(): MemoryLoadResult {
    const files = Array.from(this.cachedFiles.entries()).map(([path, content]) => {
      const def = DEFAULT_MEMORY_FILES.find((d) => resolvePath(d.path, "") === path)
      return {
        path,
        content,
        source: (def?.source ?? "rules") as MemoryFile["source"],
        priority: def?.priority ?? 3,
      } as MemoryFile
    })
    const combined = files
      .sort((a, b) => a.priority - b.priority)
      .map((f) => f.content)
      .join("\n\n")
    const rules = files.filter((f) => f.source === "rules")
    return { files, combined, rules }
  }

  private async loadRules(rulesDir: string): Promise<MemoryFile[]> {
    try {
      // Try to list rule files
      const fs = await import("fs/promises")
      const entries = await fs.readdir(rulesDir).catch(() => [])
      const files: MemoryFile[] = []
      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue
        const content = await fs.readFile(`${rulesDir}/${entry}`, "utf-8").catch(() => "")
        if (!content) continue
        // Parse YAML frontmatter for path pattern
        const pathPattern = this.extractPathPattern(content)
        files.push({
          path: `${rulesDir}/${entry}`,
          source: "rules",
          content,
          priority: 3,
          pathPattern,
        })
      }
      return files
    } catch {
      return []
    }
  }

  private extractPathPattern(content: string): string | undefined {
    const match = content.match(/^---\npath_pattern: (.+)\n---/)
    return match?.[1]
  }

  private async tryRead(path: string): Promise<string | null> {
    try {
      const fs = await import("fs/promises")
      return await fs.readFile(path, "utf-8")
    } catch {
      return null
    }
  }

  invalidateCache(): void {
    this.cachedFiles.clear()
    this.lastLoadTime = 0
  }

  /**
   * Get memory content filtered by file path pattern.
   * Used to inject only relevant rules for a given file being edited.
   */
  getRelevantRules(filePath: string, rules: MemoryFile[]): string {
    return rules
      .filter((r) => r.pathPattern && filePath.match(new RegExp(r.pathPattern.replace(/\*/g, ".*"))))
      .map((r) => r.content)
      .join("\n\n")
  }
}

function resolvePath(path: string, projectPath: string): string {
  if (path.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || ""
    return path.replace("~", home)
  }
  if (path.startsWith("/")) return path
  return `${projectPath}/${path}`
}

export const memoryLoader = new MemoryLoader()
