# Runtime Architecture

## Overview

The runtime is the core execution engine. It manages the full lifecycle from user input to final response, including provider communication, tool execution, streaming, and state management.

---

## Key Components

### ExecutionOrchestrator (`src/runtime/execution/ExecutionOrchestrator.ts`)

**Pattern**: Singleton

**Entry**: `execute(options: ExecuteOptions): AsyncGenerator<ExecutionEvent>`

**Responsibilities**:
- Creates execution ID and AbortController
- Routes user input via `managerRoute()` (role selection)
- Applies mode constraints from `execution-mode.ts`
- Routes to `handleDirectResponse()` (FAST mode) or `handleDelegatedExecution()` (FULL/MULTI mode)
- Yields the complete event steam (21 event types)
- **Never** writes to stores directly

**ExecuteOptions**:
```typescript
interface ExecuteOptions {
  input: string                    // User's message
  activeRole: RuntimeRole          // Current role
  correlationId?: string           // Turn correlation
  mode?: AgentModeOption           // "fast" | "full" | "multi"
  signal?: AbortSignal             // External abort signal
}
```

### ExecutionSessionManager (`src/runtime/sessions/ExecutionSessionManager.ts`)

**Pattern**: Singleton

**Entry**: `start(options: ExecuteOptions): Promise<ExecutionSession>`

**Responsibilities**:
- Creates and tracks `ExecutionSession` records
- Sets up `StreamManager.flushCallback` to `timelineStore.appendStreamingText()`
- Consumes the complete Orchestrator event stream via `for await...of`
- Maps every event type to store mutations
- Handles cancellation (finalizes all timeline sessions with "cancelled" state)
- Error recovery: catch block finalizes all pending sessions

**Event handler dispatch** (27 event cases):
- `EXECUTION_CREATED`: Creates init bootstrap session in timeline
- `AGENT_ASSIGNED`: Creates real agent session, finalizes init session
- `TOKEN`: Forwarded to StreamManager (token coalescing)
- `MESSAGE_COMPLETE`: Finalize stream, commit text, clear step
- `TOOL_START/COMPLETE`: Add/update tool calls in timeline
- `FILE_EDIT/READ/WRITE`: Add file operations to timeline
- `COMMAND_START/OUTPUT/COMPLETE/ERROR`: Terminal output management
- `EXECUTION_FAILED`: Set error state, preserve partial content
- `EXECUTION_COMPLETE`: Finalize init sessions
- `SYNTHESIS_COMPLETE`: Add synthesized message to agent store

### AgentExecutor (`src/runtime/agents/AgentExecutor.ts`)

**Pattern**: Instance per agent call

**Entry**: `execute(): AsyncGenerator<ExecutionEvent>`

**Modes**:
- **FAST**: Single-turn streaming chat completion, no tool loop
- **FULL**: Multi-turn loop (max 10 rounds) with:
  - System prompt composition via `ContextManager`
  - Tool calling loop with `ToolExecutionPipeline`
  - Context compaction on overflow
  - PostWriteVerifier after file edits
  - 120s timeout, 60s soft deadline

### StreamManager (`src/runtime/streaming/StreamManager.ts`)

**Pattern**: Singleton, pure token coalescer

**Key methods**:
- `append(stepId, token)`: Buffer token, schedule RAF flush
- `complete(stepId)`: Flush immediately, mark inactive
- `clearStep(stepId)`: Remove stream entirely
- `clearAll()`: Remove all streams, cancel pending RAF
- `flushImmediate()`: Synchronous flush of all pending tokens

**Design**: Uses `requestAnimationFrame` for batched UI updates (60fps max). No store imports, no session state.

---

## Execution Flow

```
User Input
  → ExecutionSessionManager.start()
    → Orchestrator.execute() yields EXECUTION_CREATED
    → Route input → managerRoute() → role selection
    → HandleDirectResponse() or HandleDelegatedExecution()
      → Provider streaming (tokens via StreamManager)
      → Tool execution loop (FULL mode only)
      → MESSAGE_COMPLETE or EXECUTION_FAILED
    → EXECUTION_COMPLETE
  → Event stream consumed by handleEvent() → store mutations
  → React re-renders UI from timeline-store
```

---

## Runtime Modes

| Mode | Max Retries | Parallel Agents | Auto-Execute | Run Tests | Research | File Ops |
|------|-----------|----------------|-------------|-----------|----------|---------|
| autonomous | 3 | Yes | Yes | Yes | No | Yes |
| fastest | 1 | Yes | Yes | No | No | Yes |
| most_accurate | 5 | No | No | Yes | Yes | Yes |
| research_heavy | 3 | Yes | Yes | No | Yes | No |
| human_guided | 3 | No | No | Yes | Yes | Yes |
| safe_mode | 2 | No | No | No | Yes | No |

---

## Cancellation

```
UI cancel button
  → ExecutionSessionManager.cancel(sessionId)
    → Orchestrator.cancel() → AbortController.abort()
    → StreamManager.clearAll()
    → Finalize all timeline sessions (status="complete", streamState="cancelled")
    → Clear step maps, StreamManager step ownership
    → streamingTexts cleaned up
  → Agent's generator catch → EXECUTION_FAILED event
    → Handler detects "cancelled" → skips error display
  → for-await loop ends → session.status preserved as "cancelled"
```

---

## Retry

- **Agent-level**: `handleDelegatedExecution()` catches per-role errors, increments failures counter
- **Mode-level**: `getMaxRetries()` returns retry limit per execution mode (1-5)
- **Transport-level**: `RetryMiddleware` handles transient network failures
- **UI-level**: Retry button in AssistantResponse error state re-sends original input

---

## ExecuteOptions Interface

```typescript
interface ExecuteOptions {
  input: string
  activeRole: RuntimeRole
  correlationId?: string
  mode?: "fast" | "full" | "multi"
  signal?: AbortSignal
}
```
