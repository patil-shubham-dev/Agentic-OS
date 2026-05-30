# CLAUDE CODE STREAMING GAP ANALYSIS

## Target Behavior

| Metric | Claude Code Desktop | AgenticOS Current | Gap |
|--------|-------------------|-------------------|-----|
| First token latency | <500ms (total) | ~12-33ms (mock, no network) + 0-16ms RAF overhead | RAF adds artificial delay |
| Token delivery | Continuous (per-token stdout) | Bursty (RAF batches every 16ms) | 16ms max pause |
| Markdown rendering | Plain text during streaming, render on complete | Full ReactMarkdown re-parse every batch | 10-30ms per frame |
| State management | Direct stdout write | Zustand set() → full React tree re-render | O(n) per batch |
| Code paths | Single | Dual (StreamingContent + ResponseStream) | 2x maintenance |
| Token safety | Atomic | Race conditions with token loss (3 critical bugs) | Data loss risk |

## Pipeline Comparison

```
Claude Code:
  Provider SSE → SSE parser → stdout write (direct, <1ms overhead)

AgenticOS:
  Provider SSE → SSE parser → Adapter → EventChannel (delegated) / Callback (direct)
    → StreamManager (RAF buffer) → TimelineStore (Zustand set)
    → React re-render → ReactMarkdown (full parse) → DOM update
    = 50-100ms overhead per token batch
```

## All Bottlenecks (Ranked)

### P0-CRITICAL

| # | Bottleneck | File:Line | Latency | What Claude Code does |
|---|-----------|-----------|---------|----------------------|
| 1 | ReactMarkdown full re-parse | `streaming-content.tsx:128-146` | 10-30ms per batch | Plain text during streaming |
| 2 | Zustand set() → full React re-render | `timeline-store.ts:260-287` | 3-10ms per batch | No React involved |
| 3 | 3 redundant RAF loops racing | Multiple files | Data loss | Single write path |
| 4 | Token drop on inactive stream race | `StreamManager.ts:39-43` | Data loss | Atomic stdout writes |

### P1-HIGH

| # | Bottleneck | File:Line | Latency | Fix |
|---|-----------|-----------|---------|-----|
| 5 | RAF batching 0-16ms delay | `StreamManager.ts:48-52` | 0-16ms | Synchronous flush |
| 6 | No first-token fast path | `StreamManager.ts:44-45` | 0-16ms (first) | flushImmediate on first token |
| 7 | ResponseStream exists but unused | `AssistantResponse.tsx:160` | 10-30ms (via ReactMarkdown) | Switch import |

### P2-MEDIUM

| # | Bottleneck | File:Line | Latency | Fix |
|---|-----------|-----------|---------|-----|
| 8 | EventChannel microtask latency | `EventChannel.ts:8-48` | 0-1ms | Direct callback |
| 9 | 12k char truncation | `streaming-content.tsx:129-131` | UX | Fixed by #1 |
| 10 | Metrics not surfaced | `timeline-store.ts:62-68` | Observability | Add display |
| 11 | Connection timeout too aggressive | `streaming-transport.ts:262-264` | Cold-start failures | Increase to 60s |

### P3-LOW

| # | Bottleneck | File:Line | Latency | Fix |
|---|-----------|-----------|---------|-----|
| 12 | O(n) dedup string guard | `timeline-store.ts:266` | <0.1ms | Counter-based |
| 13 | Auto-scroll no deps | `conversation-timeline.tsx:28-35` | <1ms | Add deps |

## Perceived Latency Breakdown

```
User presses Enter
  ├── Network round-trip: 200-2000ms (provider-dependent)
  ├── Provider TTFT: 200-5000ms (model-dependent)
  ├── AgenticOS overhead:
  │   ├── Context assembly: 0-500ms (loader + memory)
  │   ├── Prompt composition: 0-200ms (ContextManager)
  │   ├── Stream setup: 0-50ms (AbortController, adapter, fetch)
  │   ├── First token RAF delay: 0-16ms
  │   ├── First token Zustand: 1-3ms
  │   ├── First token ReactMarkdown: 1-30ms (grows with text)
  │   └── First token React reconciliation: 2-8ms
  ├── User sees first character
  ├── Subsequent tokens:
  │   ├── Network: 10-100ms/token (provider speed)
  │   ├── RAF: 16ms (always waits for next frame)
  │   ├── Store + React: 5-15ms (Map + render + markdown)
  │   └── Layout: 0-1ms (auto-scroll)
  └── Total overhead per token batch: 21-132ms
      Claude Code overhead: <1ms
```

## Top 5 Fixes Required

### Fix 1 (Highest ROI) — Switch to ResponseStream during streaming
**Change:** `AssistantResponse.tsx:160` — use `ResponseStream` component instead of `StreamingContent` during streaming phase
**Impact:** Zero ReactMarkdown cost during streaming. Zero React reconciliation for token display. Direct DOM append = <1ms per token batch.
**Lines changed:** 1

### Fix 2 — Synchronous token delivery (remove RAF)
**Change:** `StreamManager.ts:48-52` — replace `requestAnimationFrame` with direct synchronous flush
**Impact:** Zero batching delay. Zero race conditions with commitStreamingText. Eliminates 3 critical token-loss bugs.
**Lines changed:** ~10

### Fix 3 — Replace Zustand streaming path with ref-based pub/sub
**Change:** `timeline-store.ts:260-287` — use `useSyncExternalStore` for streaming path, keep Zustand for committed state
**Impact:** No React reconciliation on token arrival. O(1) per-token.
**Lines changed:** ~30-50

### Fix 4 — First-token fast path
**Change:** `StreamManager.ts:44-45` — if first token (`stream.tokens.length === 0`), call `flushImmediate()` instead of `scheduleFlush()`
**Impact:** First token appears 0ms vs 0-16ms. User perceives instant response.
**Lines changed:** 3

### Fix 5 — Consolidate RAF loops
**Change:** Remove `RenderScheduler` and `BufferedSubscriber` in EventBus. Single flush boundary in `StreamManager`.
**Impact:** No race conditions. No token loss. Single well-defined streaming path.
**Lines changed:** ~50-100

## Immediate ROI

| Fix | Lines Changed | Latency Reduction | Risk |
|-----|--------------|-------------------|------|
| Fix 1: Switch to ResponseStream | 1 | 10-30ms per batch | Low |
| Fix 4: First-token fast path | 3 | 0-16ms (FTL) | Low |
| Fix 2: Remove RAF | ~10 | 0-16ms per batch | Medium |
| Fix 3: Ref-based store | ~30-50 | 3-10ms per batch | Medium |
| Fix 5: Consolidate RAF loops | ~50-100 | Data loss elimination | High |

**Total potential improvement: 13-72ms per token batch, eliminating data loss risk.**
