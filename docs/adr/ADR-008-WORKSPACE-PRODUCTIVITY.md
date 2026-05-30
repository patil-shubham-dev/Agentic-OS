# ADR-008: Workspace Developer Productivity Features

**Status:** Accepted  
**Date:** 2026-05-29  
**Sprint:** Beta-2 Developer Productivity

## Context
AgenticOS excels at AI orchestration but lacked basic daily development tools: fast search, terminal, diagnostics display, state persistence, git visibility. Users had to switch to VS Code for routine coding tasks.

## Decision
Add developer productivity features by building on existing infrastructure — no new runtime abstractions, no new agent systems, no parallel implementations:

1. **Search** → In-memory `SearchIndex` class with content caching (<512KB per file). Acceptable memory trade-off (est. 250MB for 50k files × 5KB average). Large files skip caching.
2. **Terminal** → UI panel over existing `TerminalRuntime.runStream()` with `AbortController`. No new execution infrastructure.
3. **Diagnostics** → Monaco's `onDidChangeMarkers` → Zustand store → problems panel. No separate LSP process.
4. **Persistence** → `localStorage` with per-workspace keys. No backend/server changes.
5. **Git** → Inline branch/status indicator in toolbar, reusing existing `git.ts` lib and `/git` route.

## Consequences
- **Positive**: All 304 existing tests pass. 0 TypeScript errors. Build clean.
- **Positive**: No new agent abstractions or runtime complexity.
- **Positive**: Instantly usable — no configuration, server, or Tauri plugin changes.
- **Trade-off**: Search index can consume memory for large workspaces (mitigated by <512KB file cache limit).
- **Trade-off**: Diagnostics only for currently open Monaco files — no cross-project reports.

## Compliance
- Architecture frozen: no new abstractions, agent systems, or parallel implementations
- No replacing existing infrastructure
- All 304 tests pass after every phase
