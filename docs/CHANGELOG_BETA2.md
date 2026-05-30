# Changelog — Beta-2 Developer Productivity Sprint

## Added
- **Monaco Editor**: syntax highlighting, minimap, bracket matching, folding, multi-cursor, find/replace, format, line numbers, cursor tracking
- **Search Index**: in-memory file content index for instant workspace search, extension filtering, incremental updates
- **Terminal Panel**: multi-session terminal with streaming output, history, cancel, copy, keyboard shortcut (Ctrl+Shift+T)
- **Diagnostics Panel**: problem list with severity icons, click-to-navigate, error/warning counts in toolbar, keyboard shortcut (Ctrl+Shift+.)
- **State Persistence**: open files, cursor position, scroll position saved to localStorage and restored on workspace load
- **Git Indicator**: branch name and changed file count in editor toolbar (polls every 30s)

## Removed
- `editor-panel.tsx` — dead textarea-based editor (zero consumers)

## Changed
- `global-search.tsx` — uses search index instead of sequential Tauri file reads (instant results)
- `code-canvas.tsx` — search index rebuild on fileTree change; state persistence effects
- `code-workspace.tsx` — marker→diagnostics sync, problem badge, git status indicator
- `workspace-store.ts` — added `persistWorkspaceState()` / `restoreWorkspaceState()`
- `command-palette.tsx` — added "Terminal Workspace" command

## Fixed
- TypeScript errors in marker change handler callback (improperly typed parameters)

## Infrastructure
- 0 new runtime abstractions — all features build on existing infrastructure
- 304 tests passing, 0 TypeScript errors, clean build
