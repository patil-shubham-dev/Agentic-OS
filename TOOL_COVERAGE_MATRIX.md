# TOOL COVERAGE MATRIX — Complete Audit

**Audit Scope:** All 24 built-in tools registered in `src/lib/agents/agent-tools.ts` + all backend features.

## Legend

| Column | Meaning |
|--------|---------|
| Registered | Tool is listed in BUILTIN_TOOLS and registered via registerBuiltinTools() |
| Callable | invoke() will reach a working backend (Rust command, plugin, or TS fallback) |
| Returns Data | Tool execution returns meaningful data (not null/empty/error) |
| Rendered in UI | Tool output is displayed to the user in the chat/composer |
| Used by Agents | Tool is exposed in agent prompt and runtime roles |
| Production Ready | All columns are green — tool works end-to-end in production |

## Agent Tools (24 total)

### ✅ TERMINAL

| Tool | Registered | Callable | Returns Data | Rendered | Agent-Used | Ready | Notes |
|------|:-:|:-:|:-:|:-:|:-:|:-:|-------|
| `run_command` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | FIXED in this sprint — Rust backend now exists |

### ✅ FILE OPERATIONS (via `@tauri-apps/plugin-fs`)

| Tool | Registered | Callable | Returns Data | Rendered | Agent-Used | Ready | Notes |
|------|:-:|:-:|:-:|:-:|:-:|:-:|-------|
| `read_file` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Uses `tauri-plugin-fs.readTextFile()` |
| `write_file` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Uses `tauri-plugin-fs.writeTextFile()` + notifyFileEdited |
| `edit_file` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Reads → edits → writes via plugin-fs |

### ❌ SEARCH

| Tool | Registered | Callable | Returns Data | Rendered | Agent-Used | Ready | Notes |
|------|:-:|:-:|:-:|:-:|:-:|:-:|-------|
| `grep_files` | ✅ | ❌ | ❌ | N/A | ✅ | ❌ | `invoke("grep_files")` — no Rust backend, throws "command not found" |
| `glob_files` | ✅ | ❌ | ❌ | N/A | ✅ | ❌ | `invoke("glob_files")` — no Rust backend, throws "command not found" |

### ❌ BROWSER AUTOMATION (100% dead code)

| Tool | Registered | Callable | Returns Data | Rendered | Agent-Used | Ready | Notes |
|------|:-:|:-:|:-:|:-:|:-:|:-:|-------|
| `launch_browser` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | `invoke("browser_launch")` — no Rust, no Playwright, no puppeteer |
| `browser_navigate` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | 100% dead code |
| `browser_screenshot` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | 100% dead code |
| `browser_click` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | 100% dead code |
| `browser_fill` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | 100% dead code |
| `browser_execute_js` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | 100% dead code |
| `browser_get_title` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | 100% dead code |
| `browser_get_text` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | 100% dead code |
| `browser_wait` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | 100% dead code |
| `browser_close` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | 100% dead code |

### ✅ DESIGN

| Tool | Registered | Callable | Returns Data | Rendered | Agent-Used | Ready | Notes |
|------|:-:|:-:|:-:|:-:|:-:|:-:|-------|
| `design_create_artifact` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Pure TS — adds to DesignStore |
| `design_add_version` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Pure TS — adds to DesignStore |
| `design_generate_preview` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Pure TS — returns HTML string |

### ✅ AGENT COMPOSITION

| Tool | Registered | Callable | Returns Data | Rendered | Agent-Used | Ready | Notes |
|------|:-:|:-:|:-:|:-:|:-:|:-:|-------|
| `delegate_subtask` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Pure TS — calls sub-agent-delegator |
| `run_skill` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Pure TS — calls RuntimeOS.skillExecutor |

## Non-Tool Backend Features

| Feature | Callable | Returns Data | Rendered | Ready | Notes |
|---------|:-:|:-:|:-:|:-:|-------|
| **Folder tree** | ✅ | ✅ | ✅ | ✅ | FIXED — `list_directory` Rust command + virtualizer height fix |
| **Git operations** (10 commands) | ✅ | ✅ | ✅ | ✅ | All 10 Rust commands exist in lib.rs |
| **PTY terminal** | ✅ | ✅ | ✅ | ✅ | 4 Rust commands exist |
| **Workspace search UI** | ✅ | ✅ | ✅ | ✅ | Pure TS in-memory — works on cached files |
| **Symbol search** | ✅ | ✅ | ✅ | ✅ | Pure TS — works on provided symbol list |
| **Command palette** | N/A | N/A | N/A | ✅ | Built-in app feature |

## Summary

| Category | Total | Working | Broken | % Ready |
|----------|-------|---------|--------|---------|
| Agent tools (24) | 24 | 12 | 12 | 50% |
| Terminal | 1 | 1 | 0 | 100% |
| File ops (read/write/edit) | 3 | 3 | 0 | 100% |
| Search (grep/glob) | 2 | 0 | 2 | 0% |
| Browser automation | 10 | 0 | 10 | 0% |
| Design | 3 | 3 | 0 | 100% |
| Agent composition | 2 | 2 | 0 | 100% |
| **Backend features** | 4 | 4 | 0 | 100% |
| Folder tree | 1 | 1 | 0 | 100% |
| Git | 10 | 10 | 0 | 100% |
| PTY | 4 | 4 | 0 | 100% |
| Workspace search UI | 1 | 1 | 0 | 100% |

**Core development workflow: 50% tool coverage.** File ops, terminal, and git work. Search and browser are completely non-functional.
