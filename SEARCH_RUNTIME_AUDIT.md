# SEARCH RUNTIME AUDIT

## Search Paths in AgenticOS

There are FOUR search paths, each with different backends and reliability:

### Path 1: Agent grep_files tool (❌ BROKEN)
- **Entry:** `agent-tools.ts:32` → `tool-executor.ts:35` → `invoke("grep_files", { root, pattern, include })`
- **Backend:** None — no `grep_files` command in `src-tauri/src/lib.rs`
- **Fallback:** None — throws `"Tauri command not available in web mode"`
- **Result:** Agent cannot search file contents. Agent prompts promise this capability but it always fails.

### Path 2: Agent glob_files tool (❌ BROKEN)
- **Entry:** `agent-tools.ts:45` → `tool-executor.ts:39` → `invoke("glob_files", { root, pattern })`
- **Backend:** None — no `glob_files` command in `src-tauri/src/lib.rs`
- **Fallback:** None — throws same error
- **Result:** Agent cannot find files by pattern.

### Path 3: Workspace search UI (⚠️ PARTIAL)
- **Entry:** `global-search.tsx` — UI overlay triggered by Ctrl+P / Cmd+P
- **Backend:** `SearchIndex` class in `search-index.ts` — pure TypeScript in-memory index
- **How it works:**
  - Indexes files from the workspace file tree on load (search-index.ts:100-135)
  - Reads file content via `@tauri-apps/plugin-fs.readTextFile()` (line 238)
  - Caches content up to 512KB per file (line 108)
  - Provides `search()` for filename mode + content mode (lines 161-200)
- **Limitations:**
  - Only indexes files visible in file tree (open workspaces)
  - Large files (>512KB) silently skipped (line 111)
  - Content search is limited to the cache — only searches already-read content
  - Does NOT search gitignored files
  - Slower on large projects (sequential file reads)
- **Fallback:** Second fallback tries `invoke("read_text_file")` which also doesn't exist in Rust — but the primary `plugin-fs` path works.
- **Result:** Works for basic filename search. Content search limited to cached files.

### Path 4: Symbol search UI (✅ WORKS)
- **Entry:** `symbol-search.tsx` — UI for in-file symbol navigation
- **Backend:** Pure fuzzy matching on `currentFileSymbols` prop from parent
- **Backend:** No Tauri commands
- **Result:** Works for symbols, but only for the currently open file.

## Test Results

| Test | Method | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| "Find all TODO comments" | agent grep | File list with line numbers | ❌ Error: "command not available in web mode" | BROKEN |
| "Find all React components" | agent grep | Component name list | ❌ Same error | BROKEN |
| Search by filename (UI) | global-search.tsx | Matching files | ✅ Works for open workspace files | WORKS |
| Search by content (UI) | global-search.tsx | File matches | ⚠️ Only if files are cached | PARTIAL |
| Symbol search | symbol-search.tsx | Symbol list | ✅ Works | WORKS |
| Large project (>1000 files) | agent grep | Results | ❌ Agent errors out | BROKEN |
| Large project (UI search) | global-search.tsx | Results | ⚠️ Slow indexing, partial content | PARTIAL |

## Recommendations for Fix

The search gap is the single biggest blocker for daily development use. Two approaches:

### Option A: TypeScript-backed grep/glob (FAST, NO Rust changes)
Implement grep/glob entirely in TypeScript using the workspace file tree + `tauri-plugin-fs`:

```typescript
// grep_files — pure TS implementation
export async function implGrepFiles(rootPath: string | null, pattern: string, include?: string): Promise<string> {
  const fs = await import("@tauri-apps/plugin-fs")
  const tree = useWorkspaceStore.getState().fileTree
  const files: string[] = []
  const collectFiles = (entries: FileEntry[], basePath: string) => {
    for (const e of entries) {
      if (e.is_dir) collectFiles(e.children, basePath + '\\' + e.name)
      else if (!include || e.name.endsWith(include)) files.push(basePath + '\\' + e.name)
    }
  }
  collectFiles(tree, rootPath ?? '')
  
  const results: string[] = []
  const regex = new RegExp(pattern, 'gi')
  for (const file of files.slice(0, 200)) { // limit to 200 files
    try {
      const content = await fs.readTextFile(file)
      const matches = content.match(regex)
      if (matches) {
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${file}:${i + 1}: ${lines[i].trim().slice(0, 200)}`)
          }
        }
      }
    } catch {}
  }
  return results.join('\n')
}
```

### Option B: Rust ripgrep integration (FASTEST, requires Rust changes)
Add a `grep_files` command to Rust that uses the `grep` or `ripgrep` crate for blazing-fast content search.

**Recommendation:** Option A can be shipped in hours. Option B is a performance optimization for later.
