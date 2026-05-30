# Tool Execution Failure — Root Cause Analysis

## Actual Failing Layer

**Tauri command registration — Rust backend**

The commands `run_command_stream` and `run_command` are called from TypeScript but are **never registered** in the Tauri Rust backend. This causes the terminal execution pipeline to hang indefinitely.

## Exact File

`src/runtime/terminal/TerminalRuntime.ts` (caller)
`src-tauri/src/lib.rs` (missing registration)

## Exact Lines

**TerminalRuntime.ts:30** — `run()` method:
```ts
const rawResult = await invoke<unknown>("run_command", {
  workingDir: cwd,
  command,
  args: [],
})
```

**TerminalRuntime.ts:73** — `runStream()` method:
```ts
const invokePromise = invoke<number>("run_command_stream", {
  command,
  cwd,
  streamId,
})
```

**src-tauri/src/lib.rs:770-795** — Registered commands (NO `run_command` or `run_command_stream`):
```rust
.invoke_handler(tauri::generate_handler![
    get_app_info,
    check_for_updates,
    send_notification,
    register_context_menu,
    unregister_context_menu,
    is_context_menu_registered,
    list_directory,
    git_status,         // ... git commands ...
    debug_launch,
    debug_stop,
    pty_spawn,
    pty_write,
    pty_resize,
    pty_kill,
    // ❌ run_command — MISSING
    // ❌ run_command_stream — MISSING
])
```

## Root Cause: Terminal Hang (P0)

The `runStream()` async generator (TerminalRuntime.ts:49-97) has a polling loop:

```
1. Set up event listeners for terminal-output:{streamId} and terminal-complete:{streamId}
2. Call invoke("run_command_stream", { command, cwd, streamId })
3. Enter polling loop:
   while (!done || outputQueue.length > 0):
     drain outputQueue
     if not done: wait 25ms
4. Await invokePromise
5. Clean up listeners
6. Yield COMMAND_COMPLETE
```

When `invoke("run_command_stream", ...)` is called with an unregistered command, the Tauri invoke **rejects immediately** (command not found). However:

- The rejection is **never awaited** — `invokePromise` on line 73 is stored but only awaited on line **90**, AFTER the polling loop exits
- The polling loop only exits when `done === true` AND `outputQueue.length === 0`
- `done` is only set to `true` by the `terminal-complete:{streamId}` event listener (line 68-71)
- Since the Tauri command never runs, the event is **never emitted**
- The polling loop runs **forever**, checking every 25ms, consuming CPU indefinitely

**Result**: Every terminal command hangs permanently. The tool execution appears "Running" forever.

## Root Cause: Simple Commands Are Slow (P1)

The `run()` method (TerminalRuntime.ts:23-47) also calls `invoke("run_command", ...)` which is also unregistered. When the Tauri invoke fails, it falls through to the catch... but there's no try/catch around the invoke call in `run()`.

Actually, looking more carefully, the `run()` method has no error handling for the case where the command is not found. The dynamic import of `@tauri-apps/api/core` at line 8-10 wraps every call. If `invoke("run_command", ...)` fails because the command isn't registered, the error propagates up as an unhandled promise rejection. The caller would see a rejection after however long the timeout is.

However, for commands that DO exist (like `list_directory`), there shouldn't be slowness. The 30-40 second delays for simple commands like `ls -la` are a secondary symptom: when the LLM requests `run_command`, the AgentExecutor calls ToolExecutionPipeline → ToolExecutionSandbox → TerminalRuntime.runStream() → hangs forever. The agent times out (30-40 seconds) and reports a failure.

## Reproduction Steps

1. Send any message to the assistant that requires a terminal command
2. Example prompt: "Run `ls -la`"
3. The assistant's response begins streaming
4. The "Running a quick verification" activity appears
5. **Nothing happens** — command never completes
6. After 30-40 seconds, the agent times out

## Fix

**Option A (Recommended)**: Register `run_command_stream` and `run_command` in the Rust backend

Add the following Tauri commands to `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
async fn run_command(
    app_handle: tauri::AppHandle,
    working_dir: String,
    command: String,
    args: Vec<String>,
) -> Result<String, String> {
    use std::process::Command;
    let output = Command::new(if cfg!(target_os = "windows") { "cmd" } else { "sh" })
        .args(if cfg!(target_os = "windows") { &["/C", &command] } else { &["-c", &command] })
        .current_dir(&working_dir)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = if stderr.is_empty() { stdout } else { format!("{}\n{}", stdout, stderr) };
    Ok(combined)
}

#[tauri::command]
async fn run_command_stream(
    app_handle: tauri::AppHandle,
    command: String,
    cwd: Option<String>,
    stream_id: String,
) -> Result<i32, String> {
    // Spawn process, pipe stdout/stderr line by line via app_handle.emit()
    // Emit terminal-output:{stream_id} for each line
    // Emit terminal-complete:{stream_id} with exit code when done
    ...
}
```

Then register them in the invoke_handler:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    run_command,
    run_command_stream,
])
```

**Option B (Quick Fix)**: Add timeout + error handling to `runStream()`

In `TerminalRuntime.ts:73`, wrap the invoke in a try/catch and explicitly set `done = true` on failure:

```ts
invokePromise = invoke<number>("run_command_stream", { ... })
  .catch((err) => {
    console.error("[TerminalRuntime] run_command_stream failed:", err);
    done = true;
    exitCode = -1;
  });
```

Also add a timeout to the polling loop:

```ts
const startTime = Date.now()
const MAX_WAIT = 30_000 // 30s timeout

while (!done || outputQueue.length > 0) {
  if (Date.now() - startTime > MAX_WAIT) {
    console.error("[TerminalRuntime] Command timed out after 30s")
    done = true
    exitCode = -1
    break
  }
  // ... rest of loop
}
```

## Validation

After fix:
1. `invoke("run_command_stream", ...)` fires `terminal-output` and `terminal-complete` events
2. The polling loop receives `done = true` and exits
3. `COMMAND_COMPLETE` event is yielded
4. `ToolExecutionSandbox.executeTerminalTool()` resolves with output
5. Terminal commands complete in normal time (< 1s for simple commands)
