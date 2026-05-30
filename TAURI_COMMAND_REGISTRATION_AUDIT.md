# Tauri Command Registration Audit

## Audit Date: 2026-05-30
## Source: src-tauri/src/lib.rs

## invoke_handler registered commands (after fix)

Lines 782-810 in lib.rs:

```
get_app_info, check_for_updates, send_notification,
register_context_menu, unregister_context_menu, is_context_menu_registered,
list_directory,
run_command,                  ← NOW REGISTERED
run_command_stream,           ← NOW REGISTERED
git_status, git_log, git_diff, git_commit, git_restore, git_init,
git_push, git_pull, git_branch_list, git_checkout, git_add,
debug_launch, debug_stop,
pty_spawn, pty_write, pty_resize, pty_kill,
```

## Command Name Verification

| TypeScript invoke() string | Rust function | Status |
|---|---|---|
| `"run_command"` | `run_command` | ✅ REGISTERED (was missing) |
| `"run_command_stream"` | `run_command_stream` | ✅ REGISTERED (was missing) |
| `"list_directory"` | `list_directory` | ✅ |
| `"pty_spawn"` | `pty_spawn` | ✅ |
| `"pty_write"` | `pty_write` | ✅ |
| `"pty_kill"` | `pty_kill` | ✅ |
| `"git_status"` | `git_status` | ✅ |
| `"git_log"` | `git_log` | ✅ |
| `"git_diff"` | `git_diff` | ✅ |
| `"git_commit"` | `git_commit` | ✅ |
| `"git_restore"` | `git_restore` | ✅ |
| `"git_init"` | `git_init` | ✅ |
| `"git_push"` | `git_push` | ✅ |
| `"git_pull"` | `git_pull` | ✅ |
| `"git_branch_list"` | `git_branch_list` | ✅ |
| `"git_checkout"` | `git_checkout` | ✅ |
| `"git_add"` | `git_add` | ✅ |
| `"debug_launch"` | `debug_launch` | ✅ |
| `"debug_stop"` | `debug_stop` | ✅ |
| `"browser_navigate"` | **MISSING** | ❌ |
| `"browser_click"` | **MISSING** | ❌ |
| `"browser_fill"` | **MISSING** | ❌ |
| `"browser_close"` | **MISSING** | ❌ |
| `"browser_wait"` | **MISSING** | ❌ |
| `"grep_files"` | **MISSING** | ❌ |
| `"glob_files"` | **MISSING** | ❌ |
| `"save_snapshot"` | **MISSING** | ❌ |
| `"watch_directory"` | **MISSING** | ❌ |
| `"get_install_info"` | **MISSING** | ❌ |
| `"open_install_location"` | **MISSING** | ❌ |
| `"perform_update"` | **MISSING** | ❌ |

## Parameter Name Mapping (camelCase ↔ snake_case)

Tauri v2 auto-converts TypeScript camelCase parameters to Rust snake_case:

| TypeScript call | Rust parameter | Matches? |
|---|---|---|
| `{ workingDir, command, args }` | `working_dir: String, command: String, _args: Vec<String>` | ✅ |
| `{ command, cwd, streamId }` | `command: String, cwd: String, stream_id: String` | ✅ |
| `{ path: rootPath }` | `path: String` | ✅ |
| `{ shell, cwd }` | `shell: String, cwd: String` | ✅ |

## Criticality Assessment

| Command | Impact | Workaround |
|---|---|---|
| `run_command` | Terminal sync execution broken | Fixed ✅ |
| `run_command_stream` | Terminal streaming execution broken | Fixed ✅ |
| `browser_*` | Browser automation tools broken | All 5 browser commands missing; no known workaround |
| `grep_files` | File content search broken | Code uses `tauri-plugin-fs` indirectly, grep is custom |
| `glob_files` | File pattern search broken | Same |
| `save_snapshot` | File history snapshots broken | Partial — falls back to in-memory |
| `watch_directory` | File watcher broken | No fallback |
| `get_install_info` | Install panel broken | No fallback |
| `open_install_location` | Install panel broken | No fallback |
| `perform_update` | Update panel broken | No fallback |

## Provided by Plugins (should work without registration)

| Command | Plugin |
|---|---|
| `read_text_file` | `tauri-plugin-fs` (built-in scoped commands) |
| `write_text_file` | `tauri-plugin-fs` |
| `exists` | `tauri-plugin-fs` |
| `mkdir` | `tauri-plugin-fs` |
| `remove` | `tauri-plugin-fs` |
| `rename` | `tauri-plugin-fs` |

## Summary

**Before fix:** 2 critical commands missing for terminal execution, plus 11 non-terminal commands missing.

**After fix:** 2 critical commands registered. Terminal execution pipeline is now complete end-to-end.

**Remaining gap:** 11 non-terminal commands still missing (browser automation, grep, glob, history snapshots, file watching, install/update panels). These are secondary to the workspace recovery sprint but should be addressed later.
