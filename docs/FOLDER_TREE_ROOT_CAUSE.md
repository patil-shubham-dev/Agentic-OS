# FOLDER TREE ROOT CAUSE ANALYSIS

## Execution Pipeline

```
Folder Dialog (Tauri open / dialog)
  → code-canvas.tsx:257 openWorkspace()
    → workspace.ts:124 pickWorkspaceFolder()      [1] Tauri dialog + fallback
    → workspace-store.ts:260 setRootPath(folder)   [2] fileTree = []
    → code-canvas.tsx:263 setLoading(true)          [3]
    → workspace.ts:146 loadFileTree(folder)         [4] Tauri list_directory
    → workspace-store.ts:276 setFileTree(tree)      [5] fileTree = tree
    → workspace.ts:256 startWatching(folder)         [6] fails silently
  → React re-render
    → file-tree.tsx:593 fileTree selector
    → file-tree.tsx:827 flattenTree(fileTree, expandedPaths)
    → file-tree.tsx:829 useVirtualizer({ count: flatTree.length })
```

## Data Disappears At

### BREAK #1 (CRITICAL) — `code-workspace.tsx:865`
**File:** `src/components/workspace/code-workspace.tsx:858-876`

```typescript
const { open } = await import("@tauri-apps/plugin-dialog")
const selected = await open({ directory: true, multiple: false })
if (selected) {
    const { setRootPath } = useWorkspaceStore.getState()
    await setRootPath(String(selected))
    await loadFileTree(String(selected))       // tree loaded but DISCARDED
}
```

`loadFileTree()` fetches the complete directory tree from Tauri/Web API into a local variable. `setFileTree(tree)` is **never called**. The workspace store's `fileTree` remains `[]`. The FileTree component renders "Workspace is empty" because `flatTree` has zero nodes.

**Fix:** Add `const tree = await loadFileTree(String(selected)); useWorkspaceStore.getState().setFileTree(tree);`

### BREAK #2 (CRITICAL) — `onboarding.tsx:147-149`
**File:** `src/pages/onboarding.tsx:147-149`

```typescript
if (workspace) {
    useWorkspaceStore.getState().setRootPath(workspace)
}
```

`setRootPath` clears `fileTree` to `[]`. No subsequent `loadFileTree` or `setFileTree` call happens. User navigates to code-canvas → `rootPath` is set → `fileTree` is `[]` → tree shows empty.

**Fix:** Add `const tree = await loadFileTree(workspace); useWorkspaceStore.getState().setFileTree(tree);`

### BREAK #3 (HIGH) — `code-canvas.tsx:257-265`
**File:** `src/pages/code-canvas.tsx:257-265`

```typescript
async function openWorkspace() {
    const folder = await pickWorkspaceFolder()
    if (!folder) return
    setRootPath(folder)
    setLoading(true)
    const tree = await loadFileTree(folder)   // can throw
    setFileTree(tree)                          // skipped on throw
    startWatching(folder)
}
```

No try/catch. If `loadFileTree` throws (Tauri command fails, web API unavailable), `setFileTree` is skipped and `isLoading` remains `true`. Endless loading skeleton.

**Fix:** Add try/catch/finally that resets `isLoading` on error.

### BREAK #4 (MEDIUM) — No "open-folder" listener
**File:** `src-tauri/src/lib.rs:604-612` emits `"open-folder"` event. Zero frontend listeners.

**Fix:** Add `listen("open-folder", ...)` in `code-canvas.tsx` or `App.tsx` that calls `openWorkspace(path)`.

### BREAK #5 (MEDIUM) — `watch_directory` unimplemented
**File:** `src/lib/workspace.ts:256-263` calls `invoke("watch_directory")`. `lib.rs:770-795` does not register this command. Fails silently.

**Fix:** Implement `watch_directory` in Rust or remove the call.
