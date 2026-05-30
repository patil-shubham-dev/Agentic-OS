# Streaming System

## Overview

The streaming system delivers AI model tokens from provider to UI in real-time. It uses a buffered RAF-based architecture for efficient rendering regardless of token delivery rate.

---

## Token Flow

```
Provider SSE Stream
    │
    ▼
ProviderTransport.streamChatCompletion()
    │  (SSE parser, chunk decoder)
    │
    ▼ onToken(token)
AgentExecutor or Orchestrator (handleDirectResponse)
    │
    ├─ Via EventChannel (AgentExecutor):
    │   channel.push({ type: "TOKEN", executionId, token })
    │     → for await...of yields TOKEN event
    │     → Orchestrator forwards to StreamManager.append()
    │
    └─ Direct (Orchestrator handleDirectResponse):
          StreamManager.append(stepId, token)
              │
              ▼
        StreamManager (RAF Token Coalescer)
              │  Buffers tokens per stepId
              │  Schedules requestAnimationFrame
              │
              ▼ (on next frame)
        StreamManager.flush()
              │  Concatenates buffered tokens
              │  Calls flushCallback(stepId, delta)
              │
              ▼
        timelineStore.appendStreamingText(stepId, delta)
              │  FAST PATH: Updates streamingTexts Map
              │  (NOT agentSessions — separate map)
              │  Dedup guard: checks endsWith
              │  Updates metrics: tokensPerSecond, FTL
              │
              ▼
        React re-render
              │  UI reads streamingTexts Map
              │  AssistantResponse displays via StreamingContent
              │
              ▼ (on MESSAGE_COMPLETE)
        timelineStore.commitStreamingText(stepId)
              │  Moves text: streamingTexts → agentSession.streamingText
              │  Deletes from streamingTexts Map
              │  Sets streamState = "completed"
```

---

## StreamManager Architecture

```
StreamManager (singleton)
  │
  ├─ streams: Map<string, StepStream>
  │     StepStream = {
  │       tokens: string[]           // Pending tokens
  │       lastFlushedAt: number      // Performance timestamp
  │       active: boolean            // Accepting new tokens
  │     }
  │
  ├─ raftId: number | null           // Pending RAF handle
  ├─ flushScheduled: boolean         // RAF already scheduled
  ├─ flushCallback: (stepId, delta) => void  // Store writer
  │
  ├─ append(stepId, token): void
  │     Creates stream if missing
  │     Drops tokens if stream inactive (with warning + counter)
  │     Schedules RAF flush
  │
  ├─ flush(): void
  │     Called via requestAnimationFrame
  │     Processes all streams with pending tokens
  │     Concatenates batch → calls flushCallback
  │     Cleans up inactive streams with no tokens
  │     Reschedules if active streams with pending tokens remain
  │
  ├─ complete(stepId): void
  │     Flushes immediately
  │     Marks stream as inactive
  │
  ├─ clearStep(stepId): void
  │     Removes stream entirely from Map
  │
  ├─ clearAll(): void
  │     Clears all streams
  │     Cancels pending RAF
  │
  └─ flushImmediate(): void
        Cancels pending RAF
        Flushes synchronously
```

---

## Fast Path vs Commit Path

### Fast Path (per token)

`appendStreamingText(stepId, text)`:
- Updates `streamingTexts` Map directly
- Dedup guard: only appends if not already ending with the text
- Updates `streamingMetrics` (tokensPerSecond, firstTokenLatency)
- UI reads `streamingTexts` for live display
- **Does NOT touch agentSessions** — avoids React re-render of full session objects

### Commit Path (on complete)

`commitStreamingText(stepId)`:
- Moves text from `streamingTexts` → `agentSession.streamingText`
- Deletes from `streamingTexts`
- Sets `streamState = "completed"`
- Sets `completedAt` timestamp
- UI switches to reading `agentSession.streamingText`

---

## EventChannel Bridge

`EventChannel` (`src/runtime/streaming/EventChannel.ts`) bridges push-based provider callbacks to async iteration:

```typescript
class EventChannel implements AsyncIterable<ExecutionEvent> {
  private buffer: ExecutionEvent[] = []
  private resolveQueue: Array<(result: IteratorResult<ExecutionEvent>) => void> = []

  push(event: ExecutionEvent): void {
    // If someone is waiting, resolve them
    // Otherwise buffer the event
  }

  close(): void {
    // Signal end of stream
  }

  [Symbol.asyncIterator](): AsyncIterator<ExecutionEvent> {
    // Pull from buffer when available
    // Wait via Promise if buffer empty
  }
}
```

Used by `AgentExecutor` to convert:
```
ProviderTransport stream callbacks
  → EventChannel.push()
    → for await (const event of channel)
      → yields TOKEN events
      → yields MESSAGE_COMPLETE
```

---

## Stream Completion

```
MESSAGE_COMPLETE arrives
  ├─ StreamManager.clearStep(stepId) — remove stream
  ├─ timelineStore.commitStreamingText(stepId) — finalize text
  ├─ timelineStore.updateAgentSession(stepId, { status: "complete" })
  └─ stepByExecId map entry deleted
```

---

## Stream Error (Mid-Stream Failure)

```
Provider read error with partial content
  → callbacks.onError(error) — NOT onDone
  → Orchestrator/Executor catch → yields EXECUTION_FAILED
  → ExecutionSessionManager handleEvent(EXECUTION_FAILED):
    ├─ StreamManager.clearStep(stepId)
    ├─ commitStreamingText(stepId)
    ├─ timelineStore.updateAgentSession(stepId, { status: "error", streamState: "failed" })
    └─ Partial content preserved from streamingTexts
```

---

## Cancellation

```
Cancel button
  → ExecutionSessionManager.cancel(sessionId)
    → Orchestrator.cancel()
      → AbortController.abort()
      → StreamManager.clearAll()
    → Finalize step:
      ├─ StreamManager.clearStep(stepId)
      ├─ timelineStore.commitStreamingText(stepId)
      ├─ timelineStore.updateAgentSession(stepId, "complete", "cancelled")
      └─ timelineStore.streamingTexts.delete(stepId)
```

---

## Performance Characteristics

- **Max UI update rate**: 60fps (via requestAnimationFrame)
- **Token granularity**: Provider-dependent (typically 1-4 characters per token)
- **Batching**: All tokens received between RAF frames are flushed together
- **Dropped tokens**: Counted and warned when stream is inactive
- **Memory**: Streams auto-cleaned on completion/error/cancellation

---

## Diagnostics

```typescript
interface StreamingMetrics {
  tokensReceived: number
  tokensPerSecond: number
  lastTokenTimestamp: number
  firstTokenLatency: number  // Time to first token
  totalLatency: number       // Total streaming time
}

interface StreamState {
  activeStreams: number      // streams.size
  pendingTokens: number     // Total buffered tokens
  droppedTokenCount: number  // Cumulative dropped tokens
}
```
