import type { FileEntry } from "@/types"

export interface IndexedFile {
  path: string
  name: string
  extension: string
  size: number
  cachedContent: string | null
}

export interface SearchQuery {
  query: string
  mode: "filename" | "content"
  caseSensitive: boolean
  extension?: string
  maxResults?: number
}

export interface SearchResult {
  filePath: string
  fileName: string
  matches: Array<{ line: number; lineContent: string; column?: number }>
  matchCount: number
}

const MAX_CACHED_FILE_SIZE = 512 * 1024
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", "vendor", ".next", ".cache", "__pycache__"])
const SKIP_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map", ".min.js", ".min.css"])

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith(".")
}

function shouldSkipFile(name: string): boolean {
  const lower = name.toLowerCase()
  for (const ext of SKIP_EXTENSIONS) {
    if (lower.endsWith(ext)) return true
  }
  return false
}

function flattenFileTree(entries: FileEntry[], basePath = ""): FileEntry[] {
  const result: FileEntry[] = []
  for (const entry of entries) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name
    if (entry.is_dir) {
      if (shouldSkipDir(entry.name)) continue
      result.push(...flattenFileTree(entry.children, entryPath))
    } else {
      result.push({ ...entry, path: entryPath })
    }
  }
  return result
}

export class SearchIndex {
  private files: IndexedFile[] = []
  private ready = false
  private scanning = false

  get isReady(): boolean {
    return this.ready
  }

  get totalFiles(): number {
    return this.files.length
  }

  get totalCached(): number {
    return this.files.filter((f) => f.cachedContent !== null).length
  }

  async initialize(entries: FileEntry[], rootPath: string | null): Promise<void> {
    this.scanning = true
    this.files = []

    const flat = flattenFileTree(entries)
    const batchSize = 50

    for (let i = 0; i < flat.length; i += batchSize) {
      const batch = flat.slice(i, i + batchSize)
      const indexed = await Promise.all(
        batch.map(async (entry) => {
          const ext = entry.name.split(".").pop()?.toLowerCase() ?? ""
          const file: IndexedFile = {
            path: entry.path,
            name: entry.name,
            extension: ext,
            size: entry.size ?? 0,
            cachedContent: null,
          }
          if (!shouldSkipFile(entry.name) && entry.size !== undefined && entry.size <= MAX_CACHED_FILE_SIZE && entry.size > 0) {
            try {
              const fullPath = rootPath ? `${rootPath}\\${entry.path.replace(/\//g, "\\")}` : entry.path
              const content = await readFileContent(fullPath)
              file.cachedContent = content
            } catch {
              // skip unreadable files
            }
          }
          return file
        }),
      )
      this.files.push(...indexed)
    }

    this.ready = true
    this.scanning = false
  }

  async reindexFile(path: string, rootPath: string | null): Promise<void> {
    const idx = this.files.findIndex((f) => f.path === path)
    if (idx === -1) return

    const file = this.files[idx]
    if (shouldSkipFile(file.name)) return

    try {
      const fullPath = rootPath ? `${rootPath}\\${path.replace(/\//g, "\\")}` : path
      const content = await readFileContent(fullPath)
      if (file.size <= MAX_CACHED_FILE_SIZE) {
        file.cachedContent = content
      }
    } catch {
      file.cachedContent = null
    }
  }

  addFile(path: string, name: string, size: number): void {
    if (this.files.some((f) => f.path === path)) return
    const ext = name.split(".").pop()?.toLowerCase() ?? ""
    this.files.push({
      path,
      name,
      extension: ext,
      size,
      cachedContent: null,
    })
  }

  removeFile(path: string): void {
    const idx = this.files.findIndex((f) => f.path === path)
    if (idx !== -1) {
      this.files.splice(idx, 1)
    }
  }

  renameFile(oldPath: string, newPath: string, newName: string): void {
    const file = this.files.find((f) => f.path === oldPath)
    if (file) {
      file.path = newPath
      file.name = newName
      file.extension = newName.split(".").pop()?.toLowerCase() ?? ""
    }
  }

  search(query: SearchQuery): SearchResult[] {
    if (!query.query.trim()) return []

    const needle = query.caseSensitive ? query.query.trim() : query.query.trim().toLowerCase()
    const results: SearchResult[] = []
    const maxResults = query.maxResults ?? 200
    let resultsCount = 0

    if (query.mode === "filename") {
      for (const file of this.files) {
        if (resultsCount >= maxResults) break
        if (query.extension && file.extension !== query.extension) continue
        const name = query.caseSensitive ? file.name : file.name.toLowerCase()
        if (name.includes(needle)) {
          results.push({
            filePath: file.path,
            fileName: file.name,
            matches: [],
            matchCount: 0,
          })
          resultsCount++
        }
      }
      return results
    }

    for (const file of this.files) {
      if (resultsCount >= maxResults) break
      if (query.extension && file.extension !== query.extension) continue
      if (shouldSkipFile(file.name)) continue

      const content = file.cachedContent
      if (content === null) continue

      const lines = content.split("\n")
      const fileMatches: Array<{ line: number; lineContent: string; column?: number }> = []

      for (let ln = 0; ln < lines.length; ln++) {
        const line = lines[ln]
        const haystack = query.caseSensitive ? line : line.toLowerCase()
        const col = haystack.indexOf(needle)
        if (col !== -1) {
          fileMatches.push({ line: ln + 1, lineContent: line.trim(), column: col + 1 })
        }
      }

      if (fileMatches.length > 0) {
        results.push({
          filePath: file.path,
          fileName: file.name,
          matches: fileMatches,
          matchCount: fileMatches.length,
        })
        resultsCount++
      }
    }

    return results
  }

  getFileCount(): number {
    return this.files.length
  }

  getStats(): { totalFiles: number; cachedFiles: number; memoryEstimateKB: number } {
    const memEstimate = this.files.reduce((sum, f) => sum + (f.cachedContent?.length ?? 0), 0)
    return {
      totalFiles: this.files.length,
      cachedFiles: this.files.filter((f) => f.cachedContent !== null).length,
      memoryEstimateKB: Math.round(memEstimate / 1024),
    }
  }

  destroy(): void {
    this.files = []
    this.ready = false
  }
}

export const workspaceIndex = new SearchIndex()

async function readFileContent(path: string): Promise<string> {
  try {
    const fs = await import("@tauri-apps/plugin-fs")
    return await fs.readTextFile(path)
  } catch {
    try {
      const core = await import("@tauri-apps/api/core")
      return String(await core.invoke("read_text_file", { path }))
    } catch {
      throw new Error("Cannot read file")
    }
  }
}
