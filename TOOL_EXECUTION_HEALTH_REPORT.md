# Tool Execution Health Report

## Tool Registry Audit

All builtin tools registered via `registerBuiltinTools()` in `src/lib/agents/agent-tools.ts:404`.

### Terminal Tools

| Tool | Registration | Dispatch | Backend | Status |
|------|:-:|:-:|:-:|:-:|
| `run_command` | ✅ agent-tools.ts:109 | ✅ → `implRunCommand()` | ✅ Rust registered (was missing) |

### File Tools

| Tool | Registration | Dispatch | Backend | Status |
|------|:-:|:-:|:-:|:-:|
| `read` / `read_file` | ✅ agent-tools.ts | ✅ → `implReadFile()` | ✅ `tauri-plugin-fs readTextFile` |
| `write` / `write_file` | ✅ agent-tools.ts | ✅ → `implWriteFile()` | ✅ `tauri-plugin-fs writeTextFile` |
| `edit_file` | ✅ agent-tools.ts | ✅ → `implEditFile()` | ✅ `tauri-plugin-fs read + write` |
| `search` / `grep` / `semantic_search` | ✅ agent-tools.ts | ✅ → `implGrepFiles()` | ❌ `grep_files` command NOT in Rust |
| `glob` | ✅ agent-tools.ts | ✅ → `implGlobFiles()` | ❌ `glob_files` command NOT in Rust |

### Browser Tools

| Tool | Registration | Dispatch | Backend | Status |
|------|:-:|:-:|:-:|:-:|
| `browser_navigate` | ✅ agent-tools.ts | ✅ → `implBrowserNavigate()` | ❌ NOT in Rust |
| `browser_click` | ✅ agent-tools.ts | ✅ → `implBrowserClick()` | ❌ NOT in Rust |
| `browser_fill` | ✅ agent-tools.ts | ✅ → `implBrowserFill()` | ❌ NOT in Rust |
| `browser_close` | ✅ agent-tools.ts | ✅ → `implBrowserClose()` | ❌ NOT in Rust |

### Other Tools

| Tool | Registration | Dispatch | Backend | Status |
|------|:-:|:-:|:-:|:-:|
| `finish` / `complete` | ✅ agent-tools.ts | ✅ → internal | N/A (signal only) |
| `ask_user` / `ask_user_question` | ✅ agent-tools.ts | ✅ → dialog | N/A (in-app dialog) |

## Execution Test Results

### `read_file` — ✅ Works
- Path: `tool-executor.ts:43` → `readTextFile()` → `tauri-plugin-fs`
- Plugin handles file I/O directly, no custom Rust command needed
- Error handling: `catch { throw new Error("File system not available in web mode") }`

### `write_file` — ✅ Works
- Path: `tool-executor.ts:47` → `writeTextFile()` → `tauri-plugin-fs`
- Also calls `notifyFileEdited()` on the workspace store
- Error handling: `catch { throw new Error(...) }`

### `edit_file` — ✅ Works
- Path: `tool-executor.ts:59` → `readTextFile()` → modify → `writeTextFile()`
- Reads current content, applies replacements, writes back
- Supports `old_string`/`new_string` and batch `edits[]`

### `search` / `grep` — ❌ Broken
- Path: `tool-executor.ts:35` → `invoke("grep_files", ...)` → **NOT IN RUST**
- Falls through to `tool.execute()` → pipeline error → `{ isError: true, error: "Tool not found" }`
- No fallback implementation

### `glob` — ❌ Broken
- Path: `tool-executor.ts:39` → `invoke("glob_files", ...)` → **NOT IN RUST**
- Same as grep: no backend at all

### `browser_*` — ❌ All Broken
- All 5 browser commands invoke non-existent Rust commands
- No browser automation backend exists anywhere in the codebase

## Tool Result Propagation (Terminal Working Now)

Before this sprint's fix:
```
AgentExecutor → pipeline.execute("run_command", args)
  → ToolExecutionPipeline.execute()
    → tool.execute(ctx, args)
      → agent-tools dispatch
        → implRunCommand()
          → ToolExecutionSandbox.executeTerminalTool()
            → TerminalRuntime.runStream() → invoke("run_command_stream")
              → ❌ COMMAND NOT FOUND → .catch() sets error
              → 60s timeout → returns empty output
```

After this sprint's fix:
```
AgentExecutor → pipeline.execute("run_command", args)
  → ToolExecutionPipeline.execute()
    → tool.execute(ctx, args)
      → agent-tools dispatch
        → implRunCommand()
          → ToolExecutionSandbox.executeTerminalTool()
            → TerminalRuntime.runStream() → invoke("run_command_stream")
              → ✅ Rust cmd /c <command>
              → stdout lines → terminal-output events
              → exit code → terminal-complete event
              → stream yields OUTPUT_LINE events
              → COMMAND_COMPLETE with real exit code
```

## Summary

| Tool | Function | Status |
|------|----------|--------|
| `run_command` | Terminal execution | ✅ FIXED |
| `read_file` | File reading | ✅ |
| `write_file` | File writing | ✅ |
| `edit_file` | File editing | ✅ |
| `search/grep` | Content search | ❌ Not in Rust |
| `glob` | Pattern search | ❌ Not in Rust |
| `browser_navigate/click/fill/close` | Browser automation | ❌ No backend |

**Critical for workspace recovery:** Only `run_command` was blocking. The file tools (read/write/edit) work via `tauri-plugin-fs`.
