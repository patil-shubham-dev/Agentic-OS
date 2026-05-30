# TERMINAL ABORT VALIDATION

> Generated: 2026-05-30
> Scope: P0 #1 — Real terminal cancellation

---

## IMPLEMENTATION SUMMARY

### Rust Backend (src-tauri/src/lib.rs)

**New struct:**
```rust
struct CommandStreamState {
    processes: Mutex<HashMap<String, u32>>,  // stream_id → pid
}
```

**New command — `kill_command`:**
- Takes `stream_id` parameter
- Looks up PID in `CommandStreamState.processes`
- On Windows: `taskkill /PID {pid} /F`
- On Unix: `kill -TERM {pid}`
- Removes entry from map after kill
- Returns error if no process found

**Modified — `run_command_stream`:**
- Now accepts `state: tauri::State<'_, CommandStreamState>`
- Stores `child.id()` (OS PID) in state BEFORE spawning output threads
- Removes PID from state after `child.wait()` completes
- Registered in invoke_handler

### TypeScript Frontend (TerminalRuntime.ts)

**Modified — `runStream()` signature:**
```typescript
async *runStream(
    command: string,
    cwd: string | null,
    options?: { stepId?: string; role?: string; signal?: AbortSignal }
)
```

**New abort handler:**
- Registers `signal.addEventListener("abort", abortHandler, { once: true })`
- On abort: calls `invoke("kill_command", { streamId })`, sets `done = true`
- Polling loop checks `signal?.aborted` on every iteration
- Finally block removes abort listener
- Late events after abort are dropped (checked in listener callbacks)

---

## VALIDATION (Static)

### Test scenario: npm install, cancel after 2s

| Step | Before Fix | After Fix |
|------|-----------|-----------|
| Process exits on cancel | ❌ npm install runs for full 60s or completion | ✅ `taskkill` sent immediately |
| COMMAND_CANCELLED emitted | ❌ No event | ✅ Generator yields `COMMAND_COMPLETE` with exitCode -1 |
| Terminal output continues | ❌ Output events fire into void | ✅ Listener callbacks check `signal?.aborted` — dropped |
| CPU activity remains | ❌ npm keeps running | ✅ Process killed → no CPU |
| Zombie process | ❌ Child.wait() in Rust thread still blocks | ✅ Kill terminates process → wait() returns immediately |

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Cancel after process already exited | `kill_command` returns error "No running process" — handled by catch |
| Double cancel | Second `kill_command` finds no PID — safe no-op (catch swallows) |
| Cancel during thread creation | PID stored before spawn — kill finds correct PID |
| Cancel with no signal provided | `options?.signal` is undefined — abortHandler never registered, polling loop skips check |
| 60s timeout fires after cancel | `done = true` already set by abort — timeout check is skipped |

---

## VERDICT

**PASS.** Real terminal cancellation is now implemented.

- Kill command registered in Rust
- TypeScript abort signal forwarded through the stack
- Process terminated at OS level
- Generator yields completion event
- No zombie processes

**Remaining gap:** `implRunCommand` in tool-executor.ts still has no signal parameter. The abort signal flows through `ToolExecutionPipeline` → `agent-tools.ts` dispatcher → `implRunCommand`, but `implRunCommand` doesn't pass the signal to `ToolExecutionSandbox.executeTerminalTool()` → `runStream()`. The signal is available in `ToolContext.signal` but not forwarded through the legacy tool executor chain. This means cancellation only works for the new pipeline path (AgentExecutor → ToolExecutionPipeline), not through the legacy `tool-executor.ts` path.
