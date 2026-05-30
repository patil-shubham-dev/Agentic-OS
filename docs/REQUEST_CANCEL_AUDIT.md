# REQUEST CANCEL AUDIT

## The "Request canceled" Error

Screenshot shows:
- Role: Fast-Inference
- Provider: Nvidia NIM
- Model: deepseek-v4-flash
- Error: "Request canceled"
- Later requests succeed

## Root Cause #1 (PRIMARY): Stale `isProcessing` Closure

**File:** `src/components/workspace/chat-panel.tsx:108,144-145,160`

```typescript
const isProcessing = useAgentStore((s) => s.isProcessing)  // line 108 — captured in closure

const sendMessage = useCallback(async () => {
    if (!input.trim() || isProcessing || !canSend) return  // line 145 — reads STALE value
    // ...
    useAgentStore.getState().setProcessing(true)            // line 160 — async update
    const session = await executionSessionManager.start({...})  // line 163
}, [input, activeRole, isProcessing, ...])  // isProcessing in deps, but React updates deps asynchronously
```

**Mechanism:** Zustand's `setProcessing(true)` triggers React re-render. Between the call and re-render, a second click reads `isProcessing = false` from the stale closure. Both calls proceed to `executionSessionManager.start()`. The second call overwrites `ExecutionOrchestrator.currentCtrl` (line 54-55). The first execution is **orphaned** — has no cancel path, runs to completion (or timeout).

**Fix:** Replace closure-captured `isProcessing` with synchronous store read:
```typescript
const sendMessage = useCallback(async () => {
    if (!input.trim() || useAgentStore.getState().isProcessing || !canSend) return
```

## Root Cause #2: Singleton `currentCtrl`

**File:** `src/runtime/execution/ExecutionOrchestrator.ts:31,54-55`

```typescript
private currentCtrl: AbortController | null = null  // SINGLETON — shared across all executions

execute() {
    const ctrl = new AbortController()
    this.currentCtrl = ctrl  // OVERWRITES any previous execution's controller
    // ...
    this.currentCtrl = null  // cleared at end
}

cancel() {
    this.currentCtrl?.abort()  // only cancels the MOST RECENT execution
}
```

**Mechanism:** When `start()` is called twice (Root Cause #1), the second call creates a new AbortController and overwrites `currentCtrl`. The first execution's controller is lost. Neither user Cancel nor `cancelCurrent()` can reach it. The first execution runs until its own timeout kills it.

**Fix:** Track controllers per execution ID: `Map<string, AbortController>`. Store the current execution ID so `cancel()` targets the right one.

## Root Cause #3: No active session guard

**File:** `src/runtime/sessions/ExecutionSessionManager.ts:47-50`

```typescript
async start(options: ExecuteOptions): Promise<ExecutionSession> {
    const id = generateId()
    this.activeSessionId = id  // blindly overwrites previous active session
```

**Mechanism:** No check for existing running session. Second `start()` call silently overwrites `activeSessionId`. Previous execution orphaned.

**Fix:** If `this.activeSessionId` maps to a running session, throw or cancel the previous execution first.

## Root Cause #4: Double `onError` on abort (provider-gateway)

**File:** `packages/providers/src/provider-gateway.ts:1031-1033,1409-1413`

Abort signal listener calls `onError(DOMException("Request cancelled", "AbortError"))`. Then the fetch catch block (triggered by `ctrl.abort()`) calls `onError` AGAIN with the native abort message. Two `EXECUTION_FAILED` events per cancellation.

**Fix:** Add `let errorReported = false` guard.

## Root Cause #5: `onError` + `onDone` both fire (streaming-transport)

**File:** `packages/providers/src/streaming-transport.ts:276-277,463-471`

Abort handler fires `onError`, main loop break fires `onDone` if tokens were received. Both fire for same abort.

**Fix:** Add `let errorReported = false` guard.

## Root Cause #6: Different cancel paths

Two Cancel buttons exist:
- `app-layout.tsx:135` + `AppShell.tsx:67` → `ExecutionOrchestrator.cancelCurrent()` — bypasses session manager, no session state cleanup
- `chat-panel.tsx:186` → `ExecutionSessionManager.cancelCurrent()` — proper session cleanup

**Fix:** Route all Cancel buttons through `ExecutionSessionManager.cancelCurrent()`.

## Root Cause #7: StrictMode double-mount in dev

**File:** `src/main.tsx:125-137`

React 18 StrictMode in development double-mounts the app. First mount's cleanup calls `RuntimeCleanupManager.shutdown()` which aborts all controllers. Aborted execution appears as "Request canceled" even during normal startup.

**Fix:** Ensure `RuntimeCleanupManager.shutdown()` is idempotent and doesn't affect the new mount's controllers.

## Cancel Flow Diagram

```
Second click (stale isProcessing)
  → ExecutionOrchestrator.execute()
    → new AbortController → this.currentCtrl = ctrl2  ← overwrites ctrl1
    → ctrl2.signal → provider

First click (orphaned)
  → ctrl1 still connected to provider
  → No cancel path — ctrl1 is unreachable (this.currentCtrl = ctrl2)
  → Provider continues until: a) model responds, b) timeout kills it
  → If second click was for the same provider/model, ctrl1 may:
    a) Complete normally (response appears from first execution)
    b) Time out with "Agent execution exceeded 120s timeout" → "Request canceled"
    c) Be pre-empted by provider-level connection limit
```

## Error message classification

**File:** `src/runtime/sessions/ExecutionSessionManager.ts:81`

```typescript
session.status = msg.includes("abort") || msg.includes("cancel") ? "cancelled" : "failed"
```

This misclassifies any error containing "abort" as cancellation, including `AbortSignal.timeout()` errors (which contain "abort"). Timeout errors become "cancelled" in the UI.

## Summary

| Root Cause | File:Line | Severity | Effect |
|-----------|-----------|----------|--------|
| Stale isProcessing closure | `chat-panel.tsx:108` | **CRITICAL** | Duplicate execution starts |
| Singleton currentCtrl | `ExecutionOrchestrator.ts:31` | **HIGH** | Orphaned executions |
| No active session guard | `ExecutionSessionManager.ts:47-50` | **HIGH** | Sessions overwritten |
| Double onError (provider-gateway) | `provider-gateway.ts:1031-1033` | **MEDIUM** | Duplicate failure events |
| onError+onDone both fire | `streaming-transport.ts:276-277` | **MEDIUM** | Duplicate events |
| Different cancel paths | Multiple | **MEDIUM** | Inconsistent cleanup |
| StrictMode double-mount | `main.tsx:125-137` | **LOW** | Dev-only cancellations |
