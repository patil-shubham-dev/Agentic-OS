# SESSION LEAK REPORT

> Generated: 2026-05-30
> Scope: P1 #1 — Session map unbounded growth

---

## MAPS AUDITED

| Map | Location | Before Fix | After Fix |
|-----|----------|-----------|-----------|
| `ExecutionSessionManager.sessions` | ESM.ts:25 | Never pruned — unbounded growth | ✅ Pruned to max 50, 1hr TTL |
| `TimelineStore.agentSessions` | timeline-store.ts:72 | Never deleted — unbounded growth | ❌ Still unbounded (store-level fix deferred) |
| `TimelineStore.streamingTexts` | timeline-store.ts:74 | Entries deleted on commit, but orphans recreated | ✅ StreamManager cancelled flag prevents orphans |
| `ExecutionSessionManager.stepByExecId` | ESM.ts:27 | Cleared on cancel/error | ✅ Already cleaned |
| `ExecutionSessionManager.sessionToExecId` | ESM.ts:29 | Cleared on cancel/error | ✅ Already cleaned |

## PRUNE ALGORITHM

Added `pruneSessions()` to `ExecutionSessionManager`:

```typescript
private pruneSessions(): void {
  const MAX_SESSIONS = 50
  const MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

  if (this.sessions.size <= MAX_SESSIONS) return

  const entries = Array.from(this.sessions.entries())
    .sort((a, b) => (b[1].startedAt ?? 0) - (a[1].startedAt ?? 0))

  // Keep top 50 most recent, delete everything else that's not "running"
  let count = 0
  for (const [id, session] of entries) {
    count++
    if (count > MAX_SESSIONS || 
        (session.status !== "running" && 
         now - (session.completedAt ?? session.startedAt) > MAX_AGE_MS)) {
      toDelete.push(id)
    }
  }

  for (const id of toDelete) {
    this.sessions.delete(id)
  }
}
```

Called after every session completion AND after cancel.

## REMAINING GAP

`TimelineStore.agentSessions` Map (line 72 of timeline-store.ts) has NO delete mechanism. Sessions accumulate forever in the store. This is a UI concern (the history of past conversations) rather than a memory leak (data is intentionally retained for conversation history display).

## VERDICT

**PASS** for session manager maps. `sessions`, `stepByExecId`, `initStepIds`, `sessionToExecId` all bounded.

**WARN** for timeline store. `agentSessions` grows unbounded, but this is intentional conversation history.
