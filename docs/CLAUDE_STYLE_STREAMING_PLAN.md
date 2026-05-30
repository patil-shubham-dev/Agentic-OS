# CLAUDE-STYLE STREAMING PLAN

## Target

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| First token latency (FTL) | ~12-33ms (mock) + RAF (0-16ms) + React (5-30ms) | <500ms total | Eliminate app-layer overhead |
| Token delivery | Bursty (RAF batches every 16ms) | Continuous, per-token | Remove RAF batching |
| Markdown rendering | Full re-parse per batch | Plain text during stream | ResponseStream |
| UI responsiveness | 10-30ms frame blocking | 60fps (16ms frame budget) | Async markdown |
| Visual jumps | Content shifts during stream | Smooth, stable | Fixed-height containers |

## Pipeline Redesign

### Current
```
Provider SSE → EventChannel → StreamManager (RAF) → TimelineStore (Zustand set) → React re-render → ReactMarkdown → DOM
```

### Target
```
Provider SSE → StreamBuffer (sync flush) → DOM append (ResponseStream)
                                    └→ TimelineStore (debounced, for history only)
```

## Changes

### 1. Remove RAF Batching

**File:** `src/runtime/streaming/StreamManager.ts`

Replace `requestAnimationFrame` with synchronous flush:

```typescript
// Before
append(stepId: string, token: string): void {
  stream.tokens.push(token)
  this.scheduleFlush() // RAF → 0-16ms delay
}

// After
append(stepId: string, token: string): void {
  stream.tokens.push(token)
  this.flushImmediate(stepId) // synchronous
}
```

For high-frequency token bursts (>50 tokens within 5ms), batch using `queueMicrotask` instead of RAF:

```typescript
append(stepId: string, token: string): void {
  stream.tokens.push(token)
  if (stream.tokens.length === 1 && stream.tokenCount < 50) {
    // First token: flush immediately for FTL
    this.flushImmediate(stepId)
  } else if (!this.microtaskScheduled) {
    // Burst: batch via microtask
    this.microtaskScheduled = true
    queueMicrotask(() => this.flush(stepId))
  }
}
```

### 2. First-Token Fast Path

```typescript
append(stepId: string, token: string): void {
  const stream = this.getOrCreateStream(stepId)
  const isFirstToken = stream.tokens.length === 0 && stream.totalTokens === 0

  stream.tokens.push(token)
  stream.totalTokens++

  if (isFirstToken) {
    // FIRST TOKEN: bypass all batching, flush immediately
    const delta = stream.tokens.join("")
    stream.tokens = []
    this.flushCallback(stepId, delta)
    return
  }

  // Subsequent tokens: flush synchronously
  this.flushImmediate(stepId)
}
```

### 3. ResponseStream for ALL Streaming

**File:** `src/components/workspace/timeline/conversation/AssistantResponse.tsx`

```typescript
// Before
import { StreamingContent } from "./streaming-content"
// → ReactMarkdown on every token, full re-parse

// After
import { ResponseStream } from "./response-stream"
// → Direct DOM append during streaming
// → ReactMarkdown only on completion
```

ResponseStream implementation (already exists at `response-stream.tsx`):

```typescript
// Core mechanism:
useEffect(() => {
  if (!isStreaming || !streamingText) return
  const pre = preRef.current
  if (!pre) return
  // Direct DOM append — zero React reconciliation
  const newText = streamingText.slice(lastAppendedLength)
  if (newText) {
    pre.appendChild(document.createTextNode(newText))
    lastAppendedLength = streamingText.length
  }
}, [streamingText, isStreaming])

// On completion:
if (!isStreaming && completedText) {
  // Single ReactMarkdown render
  return <ReactMarkdown>{completedText}</ReactMarkdown>
}
```

### 4. Markdown Rendering Off the Critical Path

```typescript
// During streaming: plain text via DOM append
// On completion: async markdown render

const [rendered, setRendered] = useState<string | null>(null)

useEffect(() => {
  if (isStreaming) return // skip during streaming
  // Defer markdown render to avoid blocking
  const id = requestIdleCallback(() => {
    setRendered(completedText)
  })
  return () => cancelIdleCallback(id)
}, [isStreaming, completedText])

if (isStreaming) {
  return <ResponseStream text={streamingText} />
}

if (!rendered) {
  return <div className="prose-claude">{streamingText}</div>
}

return <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{rendered}</ReactMarkdown>
```

### 5. Zustand Streaming Path Bypass

```typescript
// New: lightweight pub/sub for streaming only
class StreamingBus {
  private listeners = new Map<string, Set<(text: string) => void>>()
  private buffers = new Map<string, string>()

  subscribe(stepId: string, callback: (text: string) => void): () => void {
    if (!this.listeners.has(stepId)) this.listeners.set(stepId, new Set())
    this.listeners.get(stepId)!.add(callback)
    return () => this.listeners.get(stepId)?.delete(callback)
  }

  append(stepId: string, text: string): void {
    const existing = this.buffers.get(stepId) ?? ""
    const updated = existing + text
    this.buffers.set(stepId, updated)
    this.listeners.get(stepId)?.forEach(cb => cb(updated))
  }

  commit(stepId: string): string {
    const text = this.buffers.get(stepId) ?? ""
    this.buffers.delete(stepId)
    this.listeners.delete(stepId)
    return text
  }
}

// Singleton, replacing Zustand streaming path
export const streamingBus = new StreamingBus()
```

ResponseStream subscribes directly to `streamingBus` instead of Zustand:

```typescript
// No Zustand selector needed
// No Map creation
// No React reconciliation
// Direct DOM append
```

### 6. TimelineStore Streaming Path Optimization

If Zustand is kept for streaming, minimize allocations:

```typescript
// Before: new Map() every flush
const next = new Map(s.streamingTexts)
next.set(stepId, text)
return { streamingTexts: next }

// After: useImmer or mutable ref
const streamingTexts = streamingTextsRef.current
streamingTexts.set(stepId, text)
// Only trigger Zustand set() every N flushes or on completion
```

### 7. Connection Timeout Alignment

```typescript
// streaming-transport.ts
// Make timeout configurable per provider
const streamConfig = {
  connectionTimeoutMs: provider === "nvidia-nim" ? 60_000 : 15_000,
  firstChunkTimeoutMs: provider === "nvidia-nim" ? 60_000 : 30_000,
  idleChunkTimeoutMs: 60_000,
}
```

## Performance Budget

| Operation | Budget | Mechanism |
|-----------|--------|-----------|
| First token flush | <1ms overhead | Sync flush, no RAF |
| Per-token append | <0.1ms | DOM appendChild |
| Per-token React | 0ms (bypassed) | ResponseStream |
| Markdown render | 0ms during stream | Deferred to completion |
| Store write | Debounced (every 100ms) | Reduce Zustand calls |
| Frame budget | 16ms (60fps) | No blocking operations |

## Implementation Order

1. **ResponseStream adoption** — Switch AssistantResponse to ResponseStream (1 line change, immediate gain)
2. **First-token fast path** — StreamManager immediate flush on first token (3 lines)
3. **Remove RAF** — Synchronous flush, microtask for bursts (10 lines)
4. **StreamingBus** — Lightweight pub/sub bypassing Zustand during stream (~50 lines)
5. **Deferred markdown** — requestIdleCallback for completion render (~15 lines)
6. **Timeout tuning** — Provider-configurable timeouts (~10 lines)
