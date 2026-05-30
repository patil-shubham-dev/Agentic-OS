# Terminal Streaming — Implementation

## Bugs Fixed

### B1: Tool Name Mismatch

**File**: `src/runtime/agents/AgentExecutor.ts:378`
**Change**: `'execute_command'` → `'run_command'`
**Impact**: `isCommand` is now `true` when the model calls `run_command`. COMMAND_START/COMMAND_OUTPUT/COMMAND_COMPLETE/COMMAND_ERROR events now flow through the ExecutionEvent path.

### B2: Event Ordering Bug

**File**: `src/runtime/agents/AgentExecutor.ts:430-433`
**Change**: Removed `COMMAND_OUTPUT` after `COMMAND_COMPLETE`. Streaming path now emits `COMMAND_OUTPUT` via EventChannel during execution (per-line), and `COMMAND_COMPLETE` only sets final status.
**Impact**: Terminal output is no longer dropped by the ExecutionSessionManager guard (`status !== "running"`).

### B3: EventBus Dead Path

**File**: `src/runtime/terminal/TerminalRuntime.ts`
**Change**: Removed all `this.eventBus.emit()` calls for COMMAND_START/COMMAND_OUTPUT/COMMAND_COMPLETE from both `run()` and `runStream()`.
**Impact**: Removed ~30 lines of dead code. UiSync no longer handles execution events (confirmed in AGENTS.md).

### B4: Sandbox Buffering

**File**: `src/runtime/tools/ToolExecutionSandbox.ts:164-171`
**Change**: Added `onOutput` callback to `ToolSandboxContext`. Each `OUTPUT_LINE` from `runStream()` now calls `onOutput(line)` in addition to collecting into `lines[]`.
**Impact**: Individual output lines are forwarded upstream for real-time rendering, while the full output is still collected for the final tool result.

## Architecture Change: Streaming Path

### New Data Flow (Command Execution)

```
AgentExecutor
  ├─ yields COMMAND_START
  ├─ creates EventChannel
  ├─ sets onOutput on ToolContext → pushes COMMAND_OUTPUT to EventChannel
  ├─ starts pipeline.execute() (background promise)
  ├─ yields COMMAND_OUTPUT events from EventChannel (concurrent iteration)
  ├─ awaits pipeline result
  ├─ yields TOOL_COMPLETE with full result
  └─ yields COMMAND_COMPLETE
         │
         ▼
ExecutionOrchestrator (forwards all events)
         │
         ▼
ExecutionSessionManager
  ├─ COMMAND_START  → addTerminalToAgent (output="", status="running")
  ├─ COMMAND_OUTPUT → append event.output to existing terminal output
  ├─ COMMAND_COMPLETE → status="success", exitCode, durationMs
  └─ COMMAND_ERROR  → status="error", exitCode=1, output=error
         │
         ▼
TimelineStore (zustand) → React re-render
         │
         ▼
TerminalBlock.tsx (scrolls to bottom, shows cursor blink)
```

### EventChannel Pattern (concurrent yield)

```ts
if (isCommand) {
  const channel = new EventChannel()
  const streamCtx: ToolContext = {
    role: this.role,
    signal: this.signal,
    onOutput: (line: string) => {
      if (!channel.closed) {
        channel.push({
          type: "COMMAND_OUTPUT",
          executionId: eid,
          output: line + "\n",
          timestamp: Date.now(),
        })
      }
    },
  }
  const execPromise = pipeline.execute(toolName, args, streamCtx)
    .then((r) => { channel.close(); return r },
          (err) => { channel.close(); throw err })

  for await (const event of channel) {
    yield event  // yields each COMMAND_OUTPUT as it arrives
  }
  result = await execPromise  // waits for completion
}
```

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `src/runtime/tools/core/ToolContext.ts` | Added `onOutput?: (output: string) => void` | +1 |
| `src/runtime/tools/ToolExecutionSandbox.ts` | Added `onOutput` to `ToolSandboxContext`, called on each line | +3 |
| `src/lib/tool-executor.ts` | Added `onOutput` param to `implRunCommand` | +2 |
| `src/lib/agents/agent-tools.ts` | Pass `c.onOutput` to `implRunCommand` | +1 |
| `src/runtime/agents/AgentExecutor.ts` | Fixed tool name, fixed ordering, added streaming path | +36 |
| `src/runtime/terminal/TerminalRuntime.ts` | Removed dead EventBus emissions | -30 |

## Architecture Impact

- **No new abstractions**: Uses existing `EventChannel` (already used for AI token streaming)
- **No new event types**: Reuses existing `COMMAND_OUTPUT` as defined in `ExecutionEvent.ts`
- **No store changes**: TimelineStore already supports incremental terminal output appending
- **No UI changes**: TerminalBlock.tsx already supports reactive updates via React re-render
- **Backward compatible**: Non-command tools execute identically to before

## Failure Handling

| Scenario | Behavior |
|----------|----------|
| Command succeeds | COMMAND_START → (COMMAND_OUTPUT × N) → COMMAND_COMPLETE |
| Command fails (exit code ≠ 0) | COMMAND_START → (COMMAND_OUTPUT × N) → COMMAND_ERROR |
| Tool throws / isError | COMMAND_START → COMMAND_ERROR (with error message) |
| Pipeline aborted | EventChannel closed, execPromise rejects, caught by try/catch |
| Permission denied | Pipeline returns isError before tool executes, COMMAND_ERROR emitted |
| Process crash | Tauri `terminal-complete` fires with non-zero exit code |

## Performance

- **Per-line events**: Each `OUTPUT_LINE` from `runStream()` triggers one `COMMAND_OUTPUT` event → one Zustand store update → one React render
- **EventChannel**: Uses microtask queue — no polling, no RAF batching for terminal output
- **Auto-scroll**: TerminalBlock's useEffect on `terminal.output` scrolls to bottom only during `isRunning`
- **Large output**: Output is accumulated in store as a single string (existing behavior) — no change

## Remaining Limitations

1. **Tauri-only streaming**: The `runStream()` method depends on `@tauri-apps/api/event` listeners. Web fallback is not available — the web version falls back to `run()` (full batch).
2. **No stderr/stdout separation**: All output is concatenated. Stderr is not visually distinguished.
3. **No output truncation for very long commands**: Output grows unbounded in the store.
