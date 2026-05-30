# FOLDER_TREE_ROOT_CAUSE — Workspace File Tree Empty

## Root Cause: `contain: strict` kills virtualizer height

**File:** `src/components/workspace/file-tree.tsx:901`

The virtualizer scroll container had:
```css
contain: "strict"
```

`contain: strict` = `contain: size layout paint style`. The `size` containment makes the element compute its height based on its **content only** — but since the virtualizer positions children with `position: absolute` + `transform: translateY()`, absolutely-positioned elements don't contribute to the container's intrinsic size. Result: `clientHeight = 0`, virtualizer produces 0 virtual rows.

### Previous Fix Applied (confirmed working)

**Changed to:**
```css
contain: "layout paint style"
```

And added to the outer FileTree wrapper:
```jsx
<div className="flex flex-col h-full min-h-0">
```

And to the scroll container (treeRef div):
```jsx
<div ref={treeRef} className="flex-1 overflow-auto min-h-0" ...>
```

This creates a proper height chain: parent flex container → flex-1 child fills remaining space → `overflow-auto` scroll container has non-zero `clientHeight` → virtualizer produces correct number of rows.

## Data Pipeline (Confirmed Working)

### Step 1: Workspace path exists
- `setRootPath(path)` does NOT modify URL/state beyond the store
- `rootPath` is stored in `workspace-store.ts`, read by file-tree.tsx:596
- **No issue here**

### Step 2: Files are loaded
- `loadFileTree(rootPath)` calls `invoke("list_directory", { path: rootPath })`
- `list_directory` IS registered in Rust (lib.rs:777) ✅
- `read_dir_recursive()` returns nested `Vec<FileEntry>` ✅
- `loadFileTree` returns `FileEntry[]` ✅
- **No issue here**

### Step 3: Store receives files
- Callers correctly call `setFileTree(tree)` after `loadFileTree()`
- Confirmed in: `code-canvas.tsx:257-265`, `code-workspace.tsx:858-878`, `onboarding.tsx:148-155`
- **No issue here**

### Step 4: Virtualizer receives rows
- `const flatTree = useMemo(() => flattenTree(fileTree, expandedPaths), [fileTree, expandedPaths])`
- `flattenTree` produces `FlatNode[]` with correct depth nesting
- `const virtualizer = useVirtualizer({ count: flatTree.length, ... })`
- `count` = `flatTree.length` ✅
- `getScrollElement: () => treeRef.current` ✅
- **No issue here** (after the `contain: strict` → `contain: layout paint style` fix)

### Step 5: UI renders rows
- `virtualizer.getVirtualItems().map(...)` produces `<TreeNode>` for each item
- **No issue here** (after the height fix)

## Logging Gaps

| Step | Is there logging? |
|------|:-:|
| `list_directory` Rust | ❌ |
| `loadFileTree` success | ❌ |
| `loadFileTree` failure | ✅ `console.error("Failed to load file tree via Tauri:", err)` |
| `setFileTree` | ❌ |
| `flattenTree` | ❌ |
| Virtualizer | ❌ (no logging anywhere) |

## Verification Log Points

To verify the tree is loading, add at key points:

1. `loadFileTree` return: `console.log("[loadFileTree] loaded", tree.length, "entries")`
2. `setFileTree` call: `console.log("[setFileTree] setting", tree.length, "entries")`
3. `flattenTree` call: `console.log("[flattenTree] flat:", result.length, "nodes")`
4. Virtualizer render: `console.log("[virtualizer] items:", virtualizer.getVirtualItems().length)`

## Summary

The folder tree rendering bug had **one root cause**: `contain: strict` on the virtualizer scroll container preventing height calculation. The fix (already applied) replaces `contain: strict` with `contain: layout paint style` and ensures the scroll container receives a proper height from the flex layout chain. The data pipeline (list_directory → loadFileTree → setFileTree → flattenTree → virtualizer → render) was verified correct at every step.
