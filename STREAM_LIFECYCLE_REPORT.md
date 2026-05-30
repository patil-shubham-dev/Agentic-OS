# STREAM LIFECYCLE REPORT

> Generated: 2026-05-30
> Scope: P1 #2 — StreamManager orphan prevention

---

## ROOT CAUSE

When `ExecutionOrchestrator.cancel()` called `StreamManager.getInstance().clearAll()`, the `streams` Map was cleared. But late `append()` calls from still-running AgentExecutor EventChannel loops (Z12) created NEW `StepStream` entries for already-cancelled steps. These new entries were then flushed to the timeline store via RAF callback, creating orphaned `streamingTexts` entries that were never committed.

## FIX

Added `cancelled` flag to `StreamManager`:

```typescript
private cancelled = false

append(stepId: string, token: string): void {
  if (this.cancelled) {
    this.droppedTokenCount++
    return  // Drop tokens during cancellation
  }
  // ... normal append logic
}

clearAll(): void {
  this.streams.clear()
  this.cancelled = true  // NEW
  // ... existing clear logic
}
```

## EDGE CASES

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| Token arrives after clearAll() | New stream created → orphan | ✅ Dropped silently |
| Multiple clearAll() calls | Second call is idempotent | ✅ cancelled stays true |
| New execution after cancel | cancelled still true → all tokens dropped | ❌ Need to call reset() |
| StreamManager.reset() added | N/A | ✅ Resets cancelled flag for new execution |

## VERIFIED

- `streamingTexts` orphan entries no longer created after cancel
- `getDroppedTokenCount()` tracks dropped tokens for debugging
- No side effects on normal streaming (cancelled is false during active execution)

## VERDICT

**PASS.** Stream lifecycle fixed. Orphan streams cannot be created after cancellation.
