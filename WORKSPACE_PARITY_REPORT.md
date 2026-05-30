# WORKSPACE PARITY REPORT — AgenticOS vs Competitors

## Comparison Scope

Only categories relevant to daily development workflow:
- File search (content + filename)
- Terminal
- File editing
- Workspace understanding
- Project navigation

---

## Comparison Matrix

| Feature | AgenticOS | Claude Code Desktop | Cursor | Windsurf |
|---------|-----------|-------------------|--------|----------|
| **Content search (grep)** | ❌ Broken | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| **Filename search (glob)** | ❌ Broken | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| **Semantic search** | ❌ Not implemented | ❌ Not implemented | ✅ AI-powered | ✅ AI-powered |
| **Symbol search** | ✅ (current file only) | ✅ (project-wide) | ✅ (project-wide) | ✅ (project-wide) |
| **Terminal execution** | ✅ [Was broken, fixed] | ✅ | ✅ | ✅ |
| **Terminal streaming** | ✅ [Was broken, fixed] | ✅ | ✅ | ✅ |
| **File read** | ✅ | ✅ | ✅ | ✅ |
| **File write** | ✅ | ✅ | ✅ | ✅ |
| **File edit (targeted)** | ✅ (old_string/new_string) | ✅ (similar) | ✅ (similar) | ✅ (similar) |
| **Undo/revert** | ✅ (via git) | ✅ (via git + native) | ✅ (via git + native) | ✅ (via git + native) |
| **Project tree** | ✅ [Was broken, fixed] | ✅ | ✅ | ✅ |
| **File watching** | ❌ Broken | ✅ | ✅ | ✅ |
| **File history** | ❌ Broken | ✅ | ✅ | ✅ |
| **Multi-file editing** | ✅ (agent-driven) | ✅ (agent-driven) | ✅ (agent-driven) | ✅ (agent-driven) |
| **Agent reasoning** | ✅ | ✅ | ✅ | ✅ |
| **Browser automation** | ❌ 100% dead code | ❌ Not included | ❌ Not included | ❌ Not included |
| **Web search** | ✅ (agent tool) | ✅ (agent tool) | ✅ (agent tool) | ✅ (agent tool) |

---

## Gap Analysis

### Critical Gaps (blocking daily use)

| Gap | Impact | Difficulty to Fix |
|-----|--------|------------------|
| **No content search** | Agent cannot find TODOs, function definitions, error messages, or any text pattern in the codebase | EASY — TypeScript fallback using plugin-fs (hours) |
| **No filename search** | Agent cannot find files by pattern. Must use terminal `dir` or `find` | EASY — TypeScript fallback using workspace tree (hours) |

### Moderate Gaps (degraded experience)

| Gap | Impact | Difficulty |
|-----|--------|-----------|
| **No file watching** | File tree doesn't auto-refresh on external changes | MEDIUM — Need `watch_directory` Rust command |
| **No file history** | Cannot snapshot/rollback files | MEDIUM — Need `save_snapshot` Rust commands |
| **No project-wide symbol search** | Symbol search limited to current file | HARD — Requires language server (LSP) integration |

### Acceptable Gaps (nice-to-have)

| Gap | Impact | Difficulty |
|-----|--------|-----------|
| **No browser automation** | Not needed for IDE work | HARD — entire browser system to build |
| **No semantic search** | Most IDEs don't have this | HARD — requires vector embeddings |

---

## Parity Assessment

| Competitor | File parity | Terminal parity | Edit parity | Search parity | Overall |
|------------|:-:|:-:|:-:|:-:|:-:|
| **Claude Code Desktop** | ⚠️ (no file watching) | ✅ | ✅ | ❌ | **~60%** |
| **Cursor** | ⚠️ (no file watching) | ✅ | ✅ | ❌ | **~55%** |
| **Windsurf** | ⚠️ (no file watching) | ✅ | ✅ | ❌ | **~55%** |

**To reach parity with Claude Code Desktop, 2 things are needed:**
1. Implement grep/glob in TypeScript (hours)
2. Implement file watching (days)

Without search parity, AgenticOS is **not a credible competitor** for daily development work despite having strong terminal, file editing, and git capabilities.
