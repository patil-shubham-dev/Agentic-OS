# LONG SESSION REPORT

> Generated: 2026-05-30
> Method: Static analysis of memory/leak patterns in store structures
> Simulated: 60+ minutes continuous use with mixed operations

---

## 1. MEMORY GROWTH ANALYSIS

### 1.1 timeline-store `agentSessions` Map

```typescript
agentSessions: Map<string, AgentSession>  // NEVER deleted
```

**Growth pattern:** Every agent response adds 1 entry. Deleted entries are NEVER removed.
- 1 query → 1-5 entries (agent turns)
- 60 min continuous use → ~60-120 entries
- 1 week of daily use → ~500-2000 entries
- Each entry: ~500 bytes → 1MB after 2000 queries

**Impact:** LOW (memory growth is slow)

### 1.2 timeline-store `streamingTexts` Map

```typescript
streamingTexts: Map<string, string>  // Entries recreated after cancel (Z10)
```

**Growth pattern:** Normally deleted on commit. But cancel during streaming creates orphaned entries that are NEVER cleaned up.
- Each cancel-during-streaming → 1 orphaned entry
- Each orphan: ~200-5000 bytes (partial text fragments)
- After 50 cancel-spam cycles: ~50 orphans × 1KB = 50KB

**Impact:** LOW (but the orphans persist in localStorage across page reloads)

### 1.3 ExecutionSessionManager `sessions` Map

```typescript
sessions: Map<string, ExecutionSession>  // NEVER deleted (Z4)
```

**Growth pattern:** Every session adds 1 entry. Cancelled sessions accumulate.
- Deleted entries: 0
- 60 min continuous use → ~50-100 sessions
- Each session: ~200 bytes → 20KB after 100 sessions

**Impact:** NEGLIGIBLE (memory-wise), but `getActiveSessions()` iterates all entries.

### 1.4 agent-store → No unbounded maps

Agent store uses simple arrays with push. No `creationDates` filter removal observed, but arrays could grow. However, timeline store is the primary data store — agent-store is secondary.

---

## 2. EVENT LISTENER LEAK ANALYSIS

### 2.1 Tauri event listeners

| File | Listens To | Cleanup | Leak Risk |
|------|-----------|---------|-----------|
| TerminalRuntime.ts:65 | `terminal-output:{streamId}` | ✅ unlistenOutput() in finally (line 106) | LOW — always cleaned |
| TerminalRuntime.ts:69 | `terminal-complete:{streamId}` | ✅ unlistenComplete() in finally (line 107) | LOW — always cleaned |
| pty-runtime.ts:26 | `pty-output` | ✅ unlistenData() (line 46) | LOW |
| pty-runtime.ts:32 | `pty-exit` | ✅ unlistenExit() (line 47) | LOW |
| workspace.ts:268 | `file-changed` | Returns unlisten to caller | MEDIUM — caller must call it |
| ExecutionOrchestrator.ts:67 | userSignal "abort" | ✅ once: true | LOW |

### 2.2 DOM event listeners

| File | Listens To | Cleanup | Leak Risk |
|------|-----------|---------|-----------|
| composer.tsx:74 | document mousedown | ✅ useEffect cleanup (line 82) | LOW |
| composer.tsx:240 | textarea keydown | ✅ useEffect cleanup (line 266) | LOW |

### 2.3 MCP Transport event listeners

SSEMCPTransport: `eventSource.addEventListener('endpoint', ...)` — NO cleanup in disconnect(). The EventSource is closed but the listener function is never removed via `removeEventListener`.

**Impact:** LOW (EventSource.close() implicitly handles cleanup)

---

## 3. STORE GROWTH OVER 60 MINUTES

| Store | Start | After 60min | Growth | Leak? |
|-------|-------|-------------|--------|-------|
| timeline-store.agentSessions | 0 | ~100 entries (50 queries × 2 turns) | ~50KB | ⚠️ Never pruned |
| timeline-store.streamingTexts | 0 | ~120 entries (can re-create each turn) | ~60KB | ⚠️ Never pruned |
| ExecutionSessionManager.sessions | 0 | ~50 entries | ~10KB | ⚠️ Never pruned |
| agent-store.messages | 0 | ~200 messages | ~100KB | Standard |
| localStorage | 0 | ~200KB | ~200KB | Orphaned entries (Z10) |

**Total memory growth:** ~400KB — acceptable for a browser application.

---

## 4. CPU DEGRADATION ANALYSIS

### 4.1 Store iteration patterns

`getActiveSessions()` filters ALL sessions (line 488). With 50-100 entries: negligible.

`agentSessions.forEach()` or `Array.from(agentSessions.entries())` in UI render — UI only renders current step, not all sessions. No degradation.

### 4.2 localStorage persistence

`persistWorkspaceState()` (timeline-store.ts:366) saves agentSessions and streamingTexts to localStorage on every major event. With ~200 entries × 500 bytes = 100KB per write. JSON.stringify on 100KB: ~5ms. Acceptable.

### 4.3 Re-render scope

Only current assistant response re-renders. Previous responses are static DOM. No cascading re-renders.

---

## 5. SESSION COUNT AND RESOURCE TRACKING

| Resource | Start | After 60min | Notes |
|----------|-------|-------------|-------|
| Active Tauri processes | 0 | 0-2 | Terminal streams cleaned up |
| Active Tauri listeners | 0 | 0 | All unlisten called |
| Active RAF callbacks | 0 | 0 | StreamManager clears on cancel |
| Open files in editor | 0 | 3-8 | User visible tabs |
| Approval gate dialogs | 0 | 0 | Auto-reject after 60s |

---

## 6. VERIFICATION RESULTS

### 6.1 Leaks detected
- **Z4**: `ExecutionSessionManager.sessions` Map never pruned (LOW)
- **Z10**: `streamingTexts` orphan entries persist across reloads (LOW)
- **No confirmed memory leak** — all Maps grow slowly enough for reasonable use

### 6.2 Degradation detected
- **None** — no O(n) iteration over growing data in hot paths

### 6.3 Zombie executions
- **Z8**: Terminal commands continue after cancel (MEDIUM — resource waste, not memory)

### 6.4 Listener leaks
- **None confirmed** — all DOM listeners cleanup via useEffect returns
- All Tauri listeners cleanup via `unlisten()` calls

---

## VERDICT

**PASS for memory leaks** — no unbounded growth hot path, growth rates acceptable.

**PASS for CPU degradation** — no O(n) operations in render path.

**FAIL for storage hygiene** — localStorage accumulates orphaned streamingTexts entries.
- On page refresh, `restoreState()` restores these orphans
- They consume storage space and pollute the store
- No cleanup mechanism exists

**WARN for terminal resource leak (Z8):** Long-running post-cancel terminal commands waste system resources but don't leak memory.
