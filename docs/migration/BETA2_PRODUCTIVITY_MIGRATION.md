# Beta-2 Developer Productivity — Migration Notes

## Breaking Changes

- **None.** All changes are additive — no existing APIs, routes, or stores changed.

## Deprecations

- `editor-panel.tsx` has been removed (was a dead textarea-based editor with zero importers). If you had custom code referencing it, use `code-workspace.tsx` (Monaco editor) instead.

## New Dependencies

- `@monaco-editor/react` — already present in project
- `monaco-editor` — already present in project
- No new npm dependencies added

## Store Changes

### `workspace-store.ts`
- Added `persistWorkspaceState()` and `restoreWorkspaceState()` methods
- These are called automatically from `code-canvas.tsx`
- Stores open files list, active file path, cursor/scoll state in `localStorage` under key `agentic-workspace-state` (per-workspace, keyed by `agentic-workspace-root`)

### New Store
- `diagnostics-store.ts` — Zustand store with `setDiagnostics()`, `addDiagnostics()`, `clearDiagnostics()`, and computed `errorCount`/`warningCount`/`infoCount`

## New Components

| Component | File | Purpose |
|-----------|------|---------|
| `TerminalWorkspace` | `terminal-workspace.tsx` | Multi-session terminal panel |
| `DiagnosticsPanel` | `diagnostics-panel.tsx` | Problems list panel |
| `SearchIndex` class | `search-index.ts` | In-memory file content search index |

## New Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | Open/switch to terminal panel |
| `Ctrl+Shift+.` | Toggle problems panel |

## If You See Issues

1. **Search not working** — Ensure you've opened a workspace folder. The index rebuilds automatically when the file tree changes.
2. **Terminal not connecting** — Check that `TerminalRuntime` is initialized. Works only in Tauri mode (web fallback shows errors gracefully).
3. **Diagnostics not showing** — Only works for files currently open in Monaco. Check that TypeScript validation is enabled in Monaco settings.
