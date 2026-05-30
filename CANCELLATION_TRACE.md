# CANCELLATION TRACE — AgenticOS

> Generated: 2026-05-30
> Scope: Full end-to-end cancellation flow from UI click to process kill
> Coverage: All 10 specified files + discovered dependencies (EventChannel, SynthesisEngine, ToolExecutionSandbox, orchestrator.ts, tool-executor.ts, ToolContext, AgentTool)

---

## TABLE OF CONTENTS

1. [LAYER 1: UI Button → chat-panel.tsx handleCancel](#layer-1-ui-button--chat-paneltsx-handlecancel)
2. [LAYER 2: chat-panel → ExecutionSessionManager.cancel()](#layer-2-chat-panel--executionsessionmanagercancel)
3. [LAYER 3: ExecutionSessionManager → ExecutionOrchestrator.cancel()](#layer-3-executionsessionmanager--executionorchestratorcancel)
4. [LAYER 4: AbortController Chain](#layer-4-abortcontroller-chain)
5. [LAYER 5: AgentExecutor — Signal Propagation](#layer-5-agentexecutor--signal-propagation)
6. [LAYER 6: ToolExecutionPipeline — Signal Checks](#layer-6-toolexecutionpipeline--signal-checks)
7. [LAYER 7: TerminalRuntime — Process Kill Gap](#layer-7-terminalruntime--process-kill-gap)
8. [LAYER 8: StreamManager — Token Orphans](#layer-8-streammanager--token-orphans)
9. [LAYER 9: Timeline Store — Cleanup Completeness](#layer-9-timeline-store--cleanup-completeness)
10. [LAYER 10: Agent Store — Processing State](#layer-10-agent-store--processing-state)
11. [ZOMBIE/ORPHAN REGISTRY](#zombieorphan-registry)
12. [SUMMARY TABLE](#summary-table)

---

## LAYER 1: UI Button → chat-panel.tsx handleCancel

### composer.tsx

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\components\workspace\timeline\conversation\composer.tsx |
| Cancel button | Line 308: onClick={isProcessing || isCancelling ? onCancel : onSend} |
| Button icon (cancel) | Line 323: <Square className="h-3 w-3" /> |
| Button icon (spinner) | Line 321: <Loader2 className="h-3 w-3 animate-spin" /> |
| isCancelling display | Lines 289-291: Red pulsing "Cancelling..." text |

The button has three visual states:
1. **Send** — Not processing, has input, blue button
2. **Cancel (Square)** — isProcessing && !isCancelling, red Square icon
3. **Cancelling (Spinner)** — isCancelling, red spinning Loader2, "Cancelling..." text

### chat-panel.tsx

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\components\workspace\chat-panel.tsx |
| handleCancel | Lines 151-166 |
| currentSession state | Line 97 |
| isCancelling state | Line 98 |
| cancelTimerRef | Line 149 |

**The handleCancel function (Lines 151-166):**
- Line 152: Clears any pending cancel timer
- Line 153: Sets isCancelling = true for UI feedback
- Lines 155-159: Calls executionSessionManager.cancel(id) or ExecutionSessionManager.cancelCurrent()
- Lines 162-165: Sets 800ms timeout to reset isProcessing and isCancelling

**ZOMBIE Z1 — 800ms hard-coded timeout (Lines 162-165):**
The UI resets to "ready" state 800ms after cancel regardless of whether execution actually stopped. If cancellation takes longer (e.g., long-running terminal command), user can send a new message while the old execution is still alive on the backend.

**ZOMBIE Z2 — Stale timeout on unmount (Lines 149-166):**
No useEffect cleanup for cancelTimerRef. If ChatPanel unmounts during the 800ms window, the timeout fires setIsCancelling(false) on a stale component instance.

---

## LAYER 2: chat-panel → ExecutionSessionManager.cancel()

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\runtime\sessions\ExecutionSessionManager.ts |
| cancel() | Lines 422-482 |
| cancelCurrent() | Lines 40-45 |
| Session Map | Line 25 |
| stepByExecId | Line 27 |
| initStepIds | Line 28 |
| sessionToExecId | Line 29 |

### cancel() — Exact Flow

**Phase A — Mark and signal (Lines 422-429):**
- Line 424: Guard — idempotent if session not found or not running
- Line 426: session.status = "cancelled" — synchronous state change
- Line 427: session.completedAt = Date.now()
- Line 429: 	his.orchestrator.cancel() — fires AbortController.abort()

**Phase B — Immediate cleanup via finalize() (Lines 431-455):**
- Line 432: Gets execId from sessionToExecId
- Lines 435-443: If stepId found: clears StreamManager, commits streaming text, marks session cancelled, deletes from stepByExecId
- Lines 445-449: Cleans up initStepIds
- Line 451: Deletes from sessionToExecId
- Line 455: inalize() called

**Phase C — Force-stop timeout (Lines 459-481):**
- 5-second safety net: iterates all sessions, forcefully cleans up any still "running" or "cancelled"

**ZOMBIE Z3 — Race between finalize() and async generator (Lines 455 vs Line 76):**
inalize() runs synchronously in the cancel() call (UI thread). But the async generator or await (const event of eventStream) (line 76) runs in a separate microtask chain. When it resumes, it yields events whose execIds/stepIds were already cleaned up. handleEvent() silently drops them (if (stepId) guards return early).

**ZOMBIE Z4 — Sessions Map never pruned (Lines 25, 484-490):**
No sessions.delete(sessionId) anywhere. Cancelled sessions accumulate unbounded in the Map. getActiveSessions() (line 488) filters for "running" status, but cancelled entries remain in memory.

**ZOMBIE Z13 — Force-stop may find already-cleaned data (Lines 459-481):**
The 5-second force-stop calls 	his.sessionToExecId.get(sid), but inalize() already called 	his.sessionToExecId.delete(sessionId). The force-stop only catches edge cases.


---

## LAYER 3: ExecutionSessionManager → ExecutionOrchestrator.cancel()

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\runtime\execution\ExecutionOrchestrator.ts |
| cancel() | Lines 41-45 |
| cancelCurrent() | Lines 47-49 |
| execute() generator | Lines 51-115 |

### Orchestrator.cancel() (Lines 41-45):

`	ypescript
cancel(): void {
    this.currentCtrl?.abort()                    // Signal propagates to all subscribers
    StreamManager.getInstance().clearAll()       // Nukes all streams + cancels RAF
    this.isExecuting = false
}
`

Called synchronously from ExecutionSessionManager.cancel(). 	his.currentCtrl was set in execute() at line 63 and nulled in the finally block at line 113.

**Race condition in finally (Lines 111-114):**
`	ypescript
} finally {
    this.isExecuting = false
    this.currentCtrl = null
}
`
If cancel() arrives after this runs, currentCtrl?.abort() is a no-op. The session guard in ExecutionSessionManager.cancel() prevents double-processing (line 424 checks status !== "running").

**StreamManager.clearAll() called from cancel() (Line 43):**
This clears ALL stream entries (not just current session). No global "cancelled" flag is set — see Layer 8 for the race with late append() calls.

---

## LAYER 4: AbortController Chain

### Controller Creation (Lines 62-68 of ExecutionOrchestrator.ts):

`	ypescript
const ctrl = new AbortController()
this.currentCtrl = ctrl
if (userSignal) {
    if (userSignal.aborted) ctrl.abort()
    userSignal.addEventListener("abort", () => ctrl.abort(), { once: true })
}
`

### Abort Propagation Paths:

| Path | Line | Signal Usage |
|------|------|-------------|
| handleDirectResponse → astChatCompletion | 199 | ctrl.signal passed to transport |
| handleDirectResponse → onToken callback | 205 | N/A — streamManager.append called for each token |
| handleDelegatedExecution loop check | 252 | if (ctrl.signal.aborted) break |
| handleDelegatedExecution → AgentExecutor | 286 | signal: ctrl.signal |
| handleDelegatedExecution → SynthesisEngine | 321 | ctrl.signal passed to synthesize() |

### handleDirectResponse — Abort path (Lines 198-229):

`	ypescript
try {
    const result = await fastChatCompletion(
        ..., ctrl.signal,                         // signal goes to transport
        (token: string) => {
            streamManager.append(stepId, token)    // tokens arrive even after abort
        },
    )
    // ... normal completion flow
} catch (err) {
    streamManager.complete(stepId)                 // runs when transport rejects
    yield { type: "EXECUTION_FAILED", ... }
}
`

When abort fires:
1. Transport detects abort, rejects promise
2. Catch block runs: streamManager.complete(stepId), yields EXECUTION_FAILED
3. But streamManager.append() may have been called between abort and rejection (tokens in flight)

### handleDelegatedExecution — Abort path (Lines 251-315):

`	ypescript
for (const selectedRole of decision.selectedRoles) {
    if (ctrl.signal.aborted) break                // CHECKED: before each new agent
    try {
        for await (const event of executor.execute()) {
            // NOT CHECKED: no abort check in this inner loop (ZOMBIE Z11)
            yield event
        }
    } catch (e) {
        streamManager.complete(stepId)
        yield { type: "EXECUTION_FAILED", ... }
    }
}
`

---

## LAYER 5: AgentExecutor — Signal Propagation

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\runtime\agents\AgentExecutor.ts |
| Constructor stores signal | Lines 118, 126 |
| execute() entry | Lines 129-135 |

### executeFast() (Lines 137-286):

**Signal passed to transport:**
- Line 176: signal: this.signal in primary streaming call
- Line 210: signal: this.signal in fallback streaming call
- Line 246: signal: this.signal in primary non-streaming call
- Line 263: signal: this.signal in fallback non-streaming call

**ZOMBIE Z5 — EventChannel loop has NO abort check (Lines 194-196, 228-230):**
`	ypescript
for await (const event of channel) {
    yield event                                    // NO abort check!
}
await streamPromise
`
After ctrl.abort() fires, the transport detects it and eventually closes the channel. But events already buffered in the EventChannel continue to be yielded. These stale TOKEN events propagate up to Orchestrator → StreamManager.

### executeFull() (Lines 288-736):

**THE ONLY EXPLICIT ABORT CHECK (Lines 394-395):**
`	ypescript
if (this.signal?.aborted) {
    throw new DOMException("Agent execution aborted", "AbortError")
}
`
Checked at the TOP of each round, before any provider call.

**Signal passed to transport:**
- Line 413: signal: this.signal in primary streaming
- Line 454: signal: this.signal in fallback streaming
- Line 497: signal: this.signal in primary non-streaming
- Line 515: signal: this.signal in fallback non-streaming
- Line 587: signal: this.signal in ToolExecutionPipeline context

**ZOMBIE Z6 — Tool execution loop has NO abort check (Lines 566-678):**
`	ypescript
for (const tc of responseToolCalls) {              // No abort check
    // ... entire tool execution ...
    result = await pipeline.execute(...)
    // ... yields events ...
}
`
All tool calls in the current round complete to completion. Abort only checked at the START of the NEXT round.

### EventChannel — Abort-Unaware Design (src/runtime/streaming/EventChannel.ts)

Full file: Lines 1-49. The EventChannel has **zero abort awareness**:
- Accepts no AbortSignal
- No mechanism to clear buffer atomically
- Pending 
ext() promises resolve with buffered events even after close() is called
- Buffer is drained before sentinel 
ull values are returned

**ZOMBIE Z12 — EventChannel has no abort mechanism:**
After channel.close() is called by the transport's onDone/onError, existing buffer entries are yielded first. There's no way to "cancel" already-buffered events.


---

## LAYER 6: ToolExecutionPipeline — Signal Checks

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\runtime\tools\execution\ToolExecutionPipeline.ts |
| First abort check | Lines 66-68 |
| Second abort check | Lines 107-109 |

### Signal checks (Lines 66-68, 107-109):
`	ypescript
if (ctx.signal?.aborted) {
    return { data: null, error: 'Tool execution aborted', isError: true }
}
`
- Check #1 (line 66): After validation, before pre-hooks
- Check #2 (line 107): After pre-hooks/permissions, before 	ool.execute()

**ZOMBIE Z14 — What is NOT checked:**
- Lines 72-81: During pre-hooks (can be slow/blocking, no cancel)
- Lines 83-101: During permission evaluation (can involve user dialogs)
- Line 111: During 	ool.execute() (the actual tool implementation)
- Lines 113-115: During post-hooks

### Tool Dispatch — Signal Lost (agent-tools.ts Lines 349-398)

For un_command (line 360):
`	ypescript
run_command: async (c, i) => implRunCommand(
    rootPath, c.role ?? 'coder', crypto.randomUUID(),
    String(i.command ?? ''), i.args as string[] | undefined, c.onOutput
),
`

**ZOMBIE Z7 — c.signal NOT passed to implRunCommand:**
The ToolContext c contains c.signal (the AbortSignal), but it's not forwarded. The function signature (tool-executor.ts line 92) has no signal parameter.

### Full chain breakdown (tool-executor.ts → ToolExecutionSandbox → TerminalRuntime):

`
AgentExecutor line 587: signal: this.signal  ← signal in ToolContext
  → ToolExecutionPipeline line 107: ctx.signal?.aborted checked (fine)
    → tool.execute(ctx, input)
      → agent-tools.ts line 360: implRunCommand(rootPath, role, tcId, cmd, args, onOutput)
        → tool-executor.ts line 92-96: ToolExecutionSandbox.executeTerminalTool(...)
          → ToolExecutionSandbox.ts line 159-186: terminalRuntime.runStream(...)
            → TerminalRuntime.ts line 49-111: runStream() — NO SIGNAL PARAMETER
`

The signal is present in the ToolContext but **completely lost** by the time it reaches the terminal runtime.

---

## LAYER 7: TerminalRuntime — Process Kill Gap

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\runtime\terminal\TerminalRuntime.ts |
| unStream() | Lines 49-111 |
| un() | Lines 23-47 |

### TerminalRuntime.runStream() — Complete Abort Blindness

**Signature (Line 49):**
`	ypescript
async *runStream(
    command: string,
    cwd: string | null,
    options?: { stepId?: string; role?: string }
): AsyncGenerator<...>
`
**NO AbortSignal parameter.**

**Internal structure:**
- Lines 65-72: Tauri event listeners (listen)
- Lines 74-82: invoke("run_command_stream", ...) on Tauri backend
- Lines 88-101: Polling loop with 25ms sleep and 60s max timeout

**ZOMBIE Z8 — CRITICAL: No cancellation mechanism for terminal commands**

`	ypescript
while (!done || outputQueue.length > 0) {           // No abort check
    while (outputQueue.length > 0) { ... yield ... }
    if (!done) {
        if (Date.now() - startTime > MAX_TIMEOUT) {  // Only 60s timeout bound
            done = true
        }
        await new Promise((resolve) => setTimeout(resolve, 25))  // Can't be cancelled
    }
}
`

When cancellation fires:
1. The async generator is abandoned by Orchestrator (caught exception)
2. Finally block (lines 105-108): runs unlistenOutput() and unlistenComplete()
3. But the Tauri backend process (un_command_stream) **keeps running** to completion
4. Tauri event emissions continue into the void

**Real-world impact:** 
pm install, make build, git clone — any long-running command continues executing on the backend after the UI shows "cancelled". No mechanism exists to kill the process.

---

## LAYER 8: StreamManager — Token Orphans

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\runtime\streaming\StreamManager.ts |
| ppend() | Lines 33-51 |
| clearAll() | Lines 118-125 |
| clearStep() | Lines 114-116 |

### The Race (append vs clearAll):

**ZOMBIE Z9 — append() recreates streams after clearAll():**

Timeline:
1. ExecutionOrchestrator.cancel() → StreamManager.getInstance().clearAll() (line 118-125)
   - Clears 	his.streams Map
   - Cancels RAF
   - Sets lushScheduled = false

2. AgentExecutor's EventChannel loop yields a TOKEN event
3. Orchestrator's handleDelegatedExecution: StreamManager.getInstance().append(stepId, token)
4. Inside append() (lines 33-51):
   - 	his.streams.get(stepId) returns undefined (was cleared)
   - A NEW StepStream is created: { tokens: [], lastFlushedAt: 0, active: true }
   - Token is pushed into the new stream
   - scheduleFlush() schedules a new RAF callback

5. Flush callback (line 71) calls 	his.flushCallback(stepId, delta)
   - 	imelineStore.appendStreamingText(stepId, text) — creates orphaned entry

**Effect:** Text fragments for already-cancelled steps end up as permanent orphaned data in the timeline store's streamingTexts Map.

### clearAll() missing a global flag (Lines 118-125):
`	ypescript
clearAll(): void {
    this.streams.clear()
    this.flushScheduled = false
    if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId)
        this.rafId = null
    }
}
`
No 	his.cancelled = true flag is set. Subsequent ppend() calls can't distinguish "cancelled" from "never started".

---

## LAYER 9: Timeline Store — Cleanup Completeness

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\components\workspace\timeline\timeline-store.ts |
| ppendStreamingText() | Lines 260-287 |
| commitStreamingText() | Lines 289-304 |
| updateAgentSession() | Lines 225-234 |

### ZOMBIE Z10 — appendStreamingText recreates orphaned entries (Lines 260-287):

`	ypescript
appendStreamingText: (stepId, text) => {
    set((s) => {
        if (!text) return s
        const next = new Map(s.streamingTexts)
        const existing = next.get(stepId) ?? ""      // Creates if deleted
        if (existing.endsWith(text)) return s         // Only dedup guard
        next.set(stepId, existing + text)             // Always writes
        return { streamingTexts: next, ... }
    })
},
`

Even after ExecutionSessionManager.cancel()'s inalize() deleted the stepId from streamingTexts (line 441), late ppendStreamingText calls **recreate the entry**. This text is never committed (commitStreamingText already ran).

### commitStreamingText is safe (Lines 289-304):
`	ypescript
if (liveText === undefined) return s    // Safe: no-op if already deleted
`
No double-commit risk.

### updateAgentSession after cancel (Lines 225-234):
`	ypescript
const existing = next.get(stepId)
if (existing) { next.set(stepId, { ...existing, ...updates }) }
// No else — silent no-op (safe by default, but may mask bugs)
`
Sessions are never deleted from the Map, so this always finds the session.


---

## LAYER 10: Agent Store — Processing State

| Aspect | Details |
|--------|---------|
| File | C:\Users\91808\Desktop\AgenticOS\AgenticOS\src\stores\agent-store.ts |
| setProcessing | Lines 106-107 |
| isProcessing | Line 32, init false at line 72 |

**Simple boolean toggle:**
- Set to 	rue in chat-panel.tsx line 127 (sendMessage)
- Set to alse in chat-panel.tsx line 145 (sendMessage finally block)
- Set to alse in chat-panel.tsx line 163 (800ms cancel timeout)

**No zombie issues** — isProcessing acts as a simple gate. The 800ms timeout force-setting it to false (Z1) is the only concern.

---

## ZOMBIE/ORPHAN REGISTRY

| ID | Severity | File | Lines | Description |
|----|----------|------|-------|-------------|
| **Z1** | **HIGH** | chat-panel.tsx | 162-165 | setProcessing(false) fires 800ms after cancel regardless of actual execution state. User can send new message while backend still running. |
| **Z2** | LOW | chat-panel.tsx | 166 | cancelTimerRef never cleaned up on unmount. Stale setState on dismounted component. |
| **Z3** | MEDIUM | ExecutionSessionManager.ts | 455 vs 76 | inalize() runs synchronously but async generator's for-await loop continues in microtask. Events arrive after cleanup, silently dropped by handleEvent's if (stepId) guards. |
| **Z4** | LOW | ExecutionSessionManager.ts | 25, 484-490 | sessions Map never pruned. Cancelled sessions accumulate unbounded. No sessions.delete() anywhere in codebase. |
| **Z5** | **HIGH** | AgentExecutor.ts | 194-196, 228-230, 438-440, 479-481 | or await (const event of channel) has NO abort check. Events buffered in EventChannel before transport detects abort continue to propagate after cancellation. |
| **Z6** | MEDIUM | AgentExecutor.ts | 566-678 | Tool execution loop (or (const tc of responseToolCalls)) has NO abort check. All tool calls in current round execute to completion even after cancel. |
| **Z7** | **HIGH** | agent-tools.ts | 360 | c.signal (AbortSignal from ToolContext) NOT passed to implRunCommand. Terminal command has no knowledge of cancellation. |
| **Z8** | **CRITICAL** | TerminalRuntime.ts | 49-111 | unStream() has NO AbortSignal parameter, NO abort checks, NO process kill mechanism. Tauri backend process un_command_stream runs to completion or 60s timeout. Events fire into void after unlisten. |
| **Z9** | **HIGH** | StreamManager.ts | 33-51 vs 118-125 | ppend() recreates streams after clearAll() for late tokens. New StepStream entries created for already-cancelled steps. These get flushed to timeline store, creating orphaned text. |
| **Z10** | MEDIUM | timeline-store.ts | 260-287 | ppendStreamingText creates new streamingTexts entries even for stepIds already cleaned up by cancel. Text fragments become permanent orphaned data in persisted localStorage. |
| **Z11** | MEDIUM | ExecutionOrchestrator.ts | 289-299 | or await (const event of executor.execute()) in handleDelegatedExecution has NO abort check. Events from AgentExecutor keep propagating even after cancel. |
| **Z12** | **HIGH** | EventChannel.ts | 1-49 | Zero abort awareness. Buffer + pending promises continue to resolve after cancel signal fires. No mechanism to clear buffer atomically with abort. |
| **Z13** | MEDIUM | ExecutionSessionManager.ts | 459-481 | Force-stop timeout at 5s may find sessionToExecId already cleaned up by inalize(). Only catches edge-case sessions. |
| **Z14** | MEDIUM | ToolExecutionPipeline.ts | 72-81, 83-101, 111, 113-115 | No abort checks during pre-hooks, permission evaluation, actual tool execution, or post-hooks. Only checked before and after these windows. |

---

## SUMMARY TABLE

| Layer | File | Cancel Code Lines | Abort Checked? | Zombies |
|-------|------|-------------------|----------------|---------|
| 1. UI | composer.tsx | 308 | N/A (click prop) | None |
| 1. UI | chat-panel.tsx | 151-166 | N/A (UI state) | **Z1**, **Z2** |
| 2. Session Mgr | ExecutionSessionManager.ts | 422-482 | N/A (delegates) | **Z3**, **Z4**, **Z13** |
| 3. Orchestrator | ExecutionOrchestrator.ts | 41-45, 252, 289-299 | **Line 252** checked | **Z11** |
| 4. Abort Ctrl | ExecutionOrchestrator.ts | 62-68, 103-105 | Signal forwarded | None |
| 5. Agent Exec | AgentExecutor.ts | 394-395 (ONLY) | **Line 394** checked (once/round) | **Z5**, **Z6** |
| 5. EventChannel | EventChannel.ts | — | **NOT checked** | **Z12** |
| 6. Tool Pipeline | ToolExecutionPipeline.ts | 66-68, 107-109 | **Two checks**, gaps exist | **Z14** |
| 6. Tool dispatch | agent-tools.ts | 360 | **Signal NOT forwarded** | **Z7** |
| 7. Terminal | TerminalRuntime.ts | — | **NOT checked** anywhere | **Z8** |
| 7. ToolSandbox | ToolExecutionSandbox.ts | — | **NOT checked** | **Z8** (same chain) |
| 8. Stream Mgr | StreamManager.ts | 114-125 | N/A (token handler) | **Z9** |
| 9. Timeline Store | timeline-store.ts | 289-304 (safe), 260-287 (gap) | N/A (store only) | **Z10** |
| 10. Agent Store | agent-store.ts | 106-107 | N/A (boolean toggle) | None |

---

## CONCRETE BREAKAGE PROOF

### Breaking Scenario 1: Cancel during terminal command

1. User prompts "run npm install" 
2. AgentExecutor dispatches un_command tool
3. ToolExecutionPipeline checks abort (fine, line 107) → 	ool.execute() starts
4. implRunCommand() → ToolExecutionSandbox.executeTerminalTool() → TerminalRuntime.runStream()
5. User clicks cancel button
6. cancel() → ctrl.abort() → StreamManager.clearAll() → finalize() runs in <1ms
7. 
pm install **keeps running** on Tauri backend (Z8)
8. After 800ms, UI shows "ready" (Z1) — user can send new message
9. unStream() loop continues consuming output, no listeners, generators dropped
10. 60s timeout eventually kills it, or it completes naturally (wasting resources)

### Breaking Scenario 2: Cancel during agent streaming

1. AgentExecutor.executeFull() is in round 3 of 10
2. Inside or await (const event of channel) (line 438)
3. User clicks cancel
4. cancel() → ctrl.abort() → StreamManager.clearAll() → finalize() runs
5. EventChannel still has buffered TOKEN events (Z12)
6. The or await loop yields them (Z5)
7. streamManager.append() recreates streams (Z9)
8. Flush callback writes orphaned text to streamingTexts (Z10)
9. handleEvent() receives late TOOL_COMPLETE, COMMAND_COMPLETE — silently dropped

### Breaking Scenario 3: Cancel during tool loop

1. AgentExecutor gets 3 tool calls in a round
2. First tool call finishes
3. User clicks cancel
4. AgentExecutor loop or (const tc of responseToolCalls) is at tool #2 (Z6)
5. Tool #2 executes to completion (no abort check in the loop)
6. Its events (TOOL_START, TOOL_COMPLETE, etc.) are yielded
7. These arrive at handleEvent() but stepId was already cleaned up — silently dropped
8. Round ends, line 394 checks 	his.signal?.aborted → throws DOMException
9. Only tool #3 never starts, but tool #2's output may appear partially

### Proof of Orphaned localStorage Entry

After any cancellation during streaming:
1. Tab A: streamingTexts Map in timeline-store has orphaned entries
2. Key format: exec_12345_coder with partial text fragments
3. These are **never committed** to agentSessions
4. On page refresh, estoreState() (line 177-187) restores these fragments from localStorage
5. They exist in the store but have no corresponding UI element
6. They grow unboundedly over multiple cancel cycles

---

## RECOMMENDED FIXES (Priority Order)

### P0 — Critical (process leak, data corruption):

1. **TerminalRuntime** (Z8): Add AbortSignal parameter to unStream() and un(). Check signal in polling loop. Implement Tauri backend kill mechanism via invoke("kill_command", { streamId }).

2. **EventChannel** (Z12): Add AbortSignal support to constructor. On abort, clear internal buffer immediately and reject all pending promises with AbortError.

3. **StreamManager** (Z9): Add cancelled flag set by clearAll(). ppend() should check this flag and drop tokens without creating new streams.

### P1 — High (unexpected behavior):

4. **AgentExecutor** (Z5, Z6): Add 	his.signal?.aborted check inside or await (const event of channel) loops. Add check in or (const tc of responseToolCalls) loop.

5. **agent-tools.ts** (Z7): Forward ctx.signal to implRunCommand and through to executeTerminalTool.

6. **chat-panel.tsx** (Z1): Instead of 800ms hard-coded timeout, use a promise that resolves when actual execution stops. Add useEffect cleanup for cancelTimerRef (Z2).

### P2 — Medium (resource leaks):

7. **ExecutionSessionManager** (Z4): Add sessions.delete(sessionId) after successful cleanup, or implement TTL/limit-based pruning.

8. **ExecutionOrchestrator** (Z11): Add ctrl.signal.aborted check in the or await (const event of executor.execute()) loop.

9. **ToolExecutionPipeline** (Z14): Add signal checks during pre-hooks, post-hooks, and permission evaluation windows.

