# STABILITY REPORT — Long-Run Analysis

## Methodology

Code analysis for stability issues across 5 categories: memory growth, hanging sessions, orphan streams, zombie executions, terminal leaks.

---

## 1. Memory Growth Analysis

### Risk Factors

| Component | Risk | Analysis |
|-----------|------|----------|
| **StreamManager** | LOW | RAF-based coalescer, per-step buffers cleared in `complete()` and `clearStep()`. No accumulation. |
| **ExecutionSessionManager** | LOW | Sessions map cleared when status is non-running. `stepByExecId` cleared in MESSAGE_COMPLETE. |
| **timeline-store** | MEDIUM | `agentSessions` map accumulates across conversation (never cleared). `streamingTexts` Map persists. For long conversations (>100 messages), could grow significantly. |
| **agent-store** | MEDIUM | `conversations[role].messages` array grows unbounded. No sliding window or pruning (compression exists but only per-request). |
| **SearchIndex** | LOW | Limited to cached files, 512KB cap per file. Cleared on workspace change. |
| **TerminalRuntime** | LOW | No accumulation — each `runStream()` call creates fresh listeners and queue, cleaned up in `finally`. |

### Estimated Memory Profile (after 100 commands + 50 messages)

| Component | Estimate |
|-----------|----------|
| timeline-store agentSessions | ~500KB |
| agent-store messages | ~2-5MB (depends on response length) |
| SearchIndex cache | ~10-50MB (depends on project size) |
| StreamManager buffers | <10KB (cleared per step) |
| Other | ~1-2MB |
| **Total estimated** | **~13-57MB** |

### Verdict: MEDIUM risk. Timeline store + agent store grow unbounded for long sessions. No session pruning.

---

## 2. Hanging Sessions

### Risk Factors

| Component | Risk | Analysis |
|-----------|------|----------|
| **TerminalRuntime.runStream()** | LOW | NOW SAFE: 60s timeout + .catch() guarantee loop exits. Previously would hang forever (pre-fix). |
| **AgentExecutor** | LOW | 120s hard timeout, AbortSignal checked per tool call. Pipeline has no per-call timeout (relies on 60s RuntimeOS policy). |
| **ExecutionOrchestrator** | LOW | Ctrl.abort() propagated through signal chain. `isExecuting` flag prevents duplicate execution. |
| **ExecutionSessionManager** | LOW | Safety net in catch() finalizes all sessions on error. `activeSessionId` prevents concurrent starts. |
| **EventChannel** | LOW | `.closed` flag checked in AgentExecutor. Promise chain uses `.then(r => { channel.close(); return r })`. |
| **Rust run_command_stream** | MEDIUM | Synchronous `child.wait()` blocks Tauri command thread. If process hangs (e.g., interactive prompt), Rust thread blocks forever. No timeout in Rust. |

### Verdict: LOW overall risk with one caveat — Rust `run_command_stream` has no timeout. If a spawned process hangs (npm install prompting for input), the Rust thread blocks indefinitely. Fix: add a process timeout in Rust.

---

## 3. Orphan Streams

### Risk Factors

| Factor | Risk | Analysis |
|--------|------|----------|
| Event listener cleanup | LOW | `runStream()` uses `try/finally` → both `unlistenOutput()` and `unlistenComplete()` called. |
| Tauri event listeners | LOW | Unlisten functions are proper `UnlistenFn` from `@tauri-apps/api/event`. |
| StreamManager completion | LOW | `clearStep()` called in COMMAND_ERROR, EXECUTION_FAILED, MESSAGE_COMPLETE, and cancel(). |
| Abort propagation | LOW | `ctrl.abort()` → Operator signal → ToolExecutionPipeline checks `signal.aborted`. |
| Rust zombie threads | MEDIUM | `std::thread::spawn` for stdout/stderr readers. If process is killed without proper cleanup, reader threads may block on BufReader until pipe breaks. |

### Verdict: LOW overall risk. TypeScript cleanup is comprehensive. Rust reader threads naturally exit when pipes close on process death.

---

## 4. Zombie Executions

### Risk Factors

| Factor | Risk | Analysis |
|--------|------|----------|
| `isExecuting` flag | LOW | Prevents concurrent execution. Reset in `finally` block. |
| Cancel propagation | LOW | `orchestrator.cancel()` → `ctrl.abort()` → `signal.aborted` checked. |
| Terminal processes on cancel | MEDIUM | `run_command_stream` Rust command has no cancel mechanism. If user cancels a session while a terminal command is running, the Rust `child.wait()` continues. The process WILL complete (it's just orphaned after cancel). |
| PTY cleanup | MEDIUM | `pty_kill` kills child + waits. Called explicitly via `session.kill()`. But no automatic cleanup on app close. |

### Verdict: MEDIUM risk. Terminal commands orphaned on cancel is the main concern. The Rust process will complete (no orphan), but its output is discarded. Fix: pass AbortSignal to Rust or use a timeout.

---

## 5. Terminal Leaks

### Risk Factors

| Factor | Risk | Analysis |
|--------|------|----------|
| Process pipes | LOW | Rust code uses `Stdio::piped()` for stdout/stderr, `Stdio::null()` for stdin. Pipes close on process exit. |
| Thread count | MEDIUM | Each `run_command_stream` spawns 2 background threads (stdout + stderr). For rapid-fire commands, thread churn is high but threads exit when pipes close. Maximum concurrent threads = 2 × concurrent commands. With a 60s timeout and 120s agent timeout, max ~4 concurrent commands × 2 = 8 threads. Acceptable. |
| Rust process table | LOW | `child.wait()` reaps the process. No zombie processes. |
| Command queue | LOW | No queue — commands run sequentially per execution. |

### Verdict: LOW risk. Thread churn is the only concern, but capped by agent timeouts.

---

## 6. Known Critical Stability Issues

| Issue | Severity | Status |
|-------|----------|--------|
| Search tool always fails | HIGH | Unhandled error in agent tool path. Agent may loop retrying. |
| Browser tool always fails | HIGH | Unhandled error. Agent may loop retrying. |
| Rust command no timeout | MEDIUM | Interactive process can block forever. |
| Terminal process orphaned on cancel | MEDIUM | Rust process continues after cancel. |
| agent-store messages unbounded | LOW | Conversation memory grows without pruning. |

## Summary

**Short sessions (<10 min):** ✅ Stable. No known crashes or hangs.
**Medium sessions (10-30 min):** ⚠️ Stable for file ops + terminal. Agent may encounter search errors.
**Long sessions (30-60 min):** ❌ Memory growth from unbounded message history + potential cascading failures when search tools fail repeatedly.
