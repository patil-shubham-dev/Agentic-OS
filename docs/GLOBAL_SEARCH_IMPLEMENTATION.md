# Global Search — Implementation

## Overview

The Global Search feature (`Ctrl+Shift+F`) provides full-text and filename search across the workspace. It's an overlay panel triggered from `code-canvas.tsx`, built as a standalone component at `src/components/workspace/global-search.tsx`.

## Architecture

### Component: `GlobalSearch`

```
code-canvas.tsx
  └─ Ctrl+Shift+F → setSearchOpen(true)
  └─ <GlobalSearch open onClose onOpenFile />
```

Props:
- `open: boolean` — visibility
- `onClose: () => void` — dismiss
- `onOpenFile: (path: string, line?: number) => void` — navigate to result

### Two Search Modes

**Filename search** — synchronous, in-memory:
1. `flattenFileTree()` walks the `FileEntry[]` tree from workspace store
2. Skips dirs: `node_modules`, `.git`, `dist`, `build`, `coverage`, `vendor`, `.next`, `.cache`, `__pycache__`, all dot-prefixed dirs
3. `String.includes()` match against each filename
4. O(1) — no file I/O

**Content search** — async, batched file reads:
1. Same flat file list from `flattenFileTree()`
2. Skips binary extensions: `.png`, `.jpg`, `.gif`, `.svg`, `.ico`, `.woff`, `.woff2`, `.ttf`, `.eot`, `.map`, `.min.js`, `.min.css`
3. Uses `@tauri-apps/plugin-fs.readTextFile` with fallback to `invoke("read_text_file")`
4. Batches at 10 concurrent reads
5. `String.includes()` per line after split(`\n`)
6. AbortController cancels in-flight search on new query

### State

| State | Type | Description |
|-------|------|-------------|
| `query` | string | Search input |
| `mode` | `"filename" \| "content"` | Search mode toggle |
| `caseSensitive` | boolean | Case-sensitive toggle |
| `results` | `SearchResult[]` | Grouped by file: `{ filePath, fileName, matches: SearchMatch[] }` |
| `searching` | boolean | In-progress flag |
| `status` | string | Status bar text |
| `selectedIndex` | number | Keyboard nav position |
| `hasSearched` | boolean | Show results vs placeholder |

### Rendering

- Flat result list via `useMemo` — `flatResults` converts grouped results into a flat array of `{ type: "file" | "match" }` items for keyboard navigation
- File headers show match count in content mode
- Match lines show line number + trimmed content
- Animated overlay with framer-motion (spring animation, 70vh max height)
- Keyboard navigation: `↑↓` move selection, `Enter` opens, `Esc` closes
- Auto-scroll selected item into view
