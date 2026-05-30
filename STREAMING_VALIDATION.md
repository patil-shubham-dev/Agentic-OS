# Streaming Validation

## Protocol Contract

The `run_command_stream` Rust command MUST produce the following event sequence:

```
terminal-output:{streamId}   (zero or more, one per line of stdout/stderr)
terminal-complete:{streamId} (exactly once, with exit code)
```

### Timing Guarantees
- Each `terminal-output` MUST fire as soon as a line is available (line-buffered, not chunk-buffered)
- The poll loop in TypeScript reads at 25ms intervals — Rust emits before any poll cycle
- `terminal-complete` MUST fire after the process exits AND all output lines have been flushed
- No batch delay: the `BufReader.lines()` loop emits one event per line immediately

## Test: npm install

**Command:** `npm install`

**Expected events:**
```
terminal-output:streamId "npm WARN deprecated..."
terminal-output:streamId "added 1 package..."
terminal-complete:streamId 0
```

**Failure modes (pre-fix):**
- ❌ No events at all — command not found
- ❌ No events — invoke never resolves
- ❌ Timeout after 60s — fake exit (TypeScript timeout, not real completion)

**Post-fix:**
- ✅ Each npm log line is a separate event
- ✅ Exit code reflects actual npm exit

## Test: npm run dev

**Command:** `npx vite --host`

**Expected events (long-running process):**
```
terminal-output:streamId "VITE v6.4.2 ready..."
terminal-output:streamId "  ➜ Local: http://localhost:5173/"
terminal-complete:streamId 0       (only on Ctrl+C)
```

**Note:** This is an interactive/long-lived process. The `run_command_stream` waits for process exit. For server processes, kill via task manager or use the PTY path instead.

## Test: cargo build

**Command:** `cargo build 2>&1`

**Expected events:**
```
terminal-output:streamId "Compiling agenticos v2.1.0..."
terminal-output:streamId "    Finished dev profile..."
terminal-complete:streamId 0
```

Each compilation step should appear as a separate event line.

## No-Batching Guarantee

The Rust implementation:

```rust
// Background thread reads one line at a time
std::thread::spawn(move || {
    let reader = BufReader::new(stdout);
    for line in reader.lines() {
        match line {
            Ok(text) => {
                // Emit immediately per line
                let _ = app1.emit(&format!("terminal-output:{}", sid1), &text);
            }
            Err(_) => break,
        }
    }
});
```

- `BufReader::lines()` reads one line at a time from the pipe
- `app.emit()` sends to the Tauri event bus immediately (synchronous channel on the JS side)
- The TypeScript poll loop `setTimeout(resolve, 25)` drains the queue every 25ms
- No artificial buffering or batching at any layer

## Pre-Fix State (this sprint)

Before the Rust fix, streaming was completely non-functional:
- `invoke("run_command_stream")` → "command not found" error
- Event listeners `terminal-output` and `terminal-complete` NEVER fire
- Poll loop spins at 25ms for 60 seconds
- `COMMAND_COMPLETE` yields `{ exitCode: -1 }` with empty output
- Agent receives empty tool result, proceeds with hallucinated/no-op response

## Post-Fix State

Streaming works correctly:
- Commands execute on the shell
- stdout/stderr lines emit as individual events
- Exit code emitted on completion
- TypeScript drains queue and yields events to AgentExecutor
- AgentExecutor yields COMMAND_OUTPUT events to ExecutionSessionManager
- ExecutionSessionManager writes to timeline-store
- UI renders terminal output in AssistantResponse TerminalBlock
