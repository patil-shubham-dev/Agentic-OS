# Fallback Execution Flow

## 1. Purpose

When the primary model fails during execution — due to a streaming timeout, rate limit, provider error, or any non-abort error — the runtime automatically retries the request using a **configured fallback model** before giving up. This ensures resilience against transient provider failures without requiring user intervention.

## 2. Configuration

Fallback models are defined per-role via the `fallbackModel` property on `AgentRoleConfig`.

```typescript
// packages/shared/src/types.ts:146
interface AgentRoleConfig {
  id: string
  // ...
  fallbackModel?: string   // <-- set in Settings → Roles
  // ...
}
```

At wiring time, `computeGraphRaw()` in `runtime-engine.ts:142` copies this value onto the `WiredAgent`:

```typescript
// runtime-engine.ts:142
wiredAgents.push({
  // ...
  fallbackModel: role.fallbackModel || undefined,
  // ...
})
```

The `WiredAgent` interface (`runtime-engine.ts:16`) carries it as an optional field:

```typescript
// runtime-engine.ts:16
export interface WiredAgent {
  // ...
  fallbackModel?: string
}
```

## 3. Resolution: `resolveFallbackProvider()`

When `AgentExecutor` resolves its config, it calls `resolveFallbackProvider()` (`AgentExecutor.ts:76-84`). This function iterates over all configured providers and returns the first one whose `models[]` array includes a model with an `id` matching the fallback model string.

```typescript
// AgentExecutor.ts:76-84
function resolveFallbackProvider(fallbackModel: string): { endpoint: string; apiKey: string; providerId: string; runtime: string | null } | null {
  const providers = useAppStore.getState().providers ?? []
  for (const p of providers) {
    if (p.models.some(m => m.id === fallbackModel)) {
      return { endpoint: p.baseUrl, apiKey: p.apiKey, providerId: p.id, runtime: p.runtime }
    }
  }
  return null
}
```

The resolved fallback is combined with the primary config in `resolveAgentConfig()` (`AgentExecutor.ts:86-110`). If no provider hosts the fallback model, `fallback` remains `null` and no fallback attempts are made.

## 4. Retry Strategy — `executeFast()` (single-round)

`executeFast()` (`AgentExecutor.ts:137-286`) implements the following decision tree:

```
┌─────────────────────────────────────────────────┐
│              Attempt 1: Primary Streaming        │
│           transport.streamChatCompletion()       │
│             with primary.model, primary.endpoint │
└─────────────────────┬───────────────────────────┘
                      │
              ┌───────┴───────┐
              ▼               ▼
          content ≠ ""    content == ""
              │               │
              │     ┌─────────▼──────────────────────────┐
              │     │   Attempt 2: Fallback Streaming     │
              │     │  (only if fallback config exists)   │
              │     │  emits FALLBACK_ACTIVATED event     │
              │     │  sets usedFallback = true           │
              │     └─────────┬──────────────────────────┘
              │               │
              │       ┌───────┴───────┐
              │       ▼               ▼
              │   content ≠ ""    content == ""
              │       │               │
              │       │     ┌─────────▼──────────────────────────────┐
              │       │     │ Attempt 3: Non-streaming               │
              │       │     │ uses fallback model if usedFallback    │
              │       │     │ otherwise uses primary model           │
              │       │     └─────────┬──────────────────────────────┘
              │       │               │
              │       │       ┌───────┴───────┐
              │       │       ▼               ▼
              │       │   content ≠ ""    content == ""
              │       │       │               │
              │       │       │     ┌─────────▼──────────────────────────┐
              │       │       │     │ Attempt 4: Fallback Non-streaming  │
              │       │       │     │ (only if !usedFallback && fallback)│
              │       │       │     │ (aka the *other* model)            │
              │       │       │     └─────────┬──────────────────────────┘
              │       │       │               │
              │       │       │         content == ""
              │       │       │         (both models exhausted)
              ▼       ▼       ▼               ▼
        ┌──────────────────────────────────────────┐
        │        yield MESSAGE_COMPLETE            │
        │  (content may be empty string → failure) │
        └──────────────────────────────────────────┘
```

**Step-by-step:**

| Attempt | Mode | Model | Condition |
|---------|------|-------|-----------|
| 1 | Streaming (`streamChatCompletion`) | Primary | Always attempted first (`AgentExecutor.ts:171-200`) |
| 2 | Streaming (`streamChatCompletion`) | Fallback | Triggered if `content` is empty AND `fallback` is non-null (`AgentExecutor.ts:203-235`). Emits `FALLBACK_ACTIVATED` event at line 205. |
| 3 | Non-streaming (`chatCompletion`) | If fallback was used → fallback model; else → primary model | Triggered if `content` is still empty (`AgentExecutor.ts:241-279`) |
| 4 | Non-streaming (`chatCompletion`) | The *other* model (primary if fallback was used, fallback if not) | Triggered if non-streaming failed AND the other model hasn't been tried yet (`AgentExecutor.ts:258-275`) |

Key rule: if fallback was used for streaming (attempt 2), it is also used for non-streaming (attempt 3). Attempt 4 only runs when the non-streaming attempt fails and the other model has not yet been tried.

## 5. Retry Strategy — `executeFull()` (multi-round)

`executeFull()` (`AgentExecutor.ts:288-727`) applies the **same per-round pattern** as `executeFast()`. Each round independently follows the same four-attempt structure:

- **Round-local fallback tracking**: Each round has its own `usedFallback` boolean (`AgentExecutor.ts:404`), reset at the top of each round.
- **Independent per-round**: A failed round that uses fallback does **not** switch all subsequent rounds. Each round starts fresh with the primary model.
- **Round loop**: Wrapped in `for (let round = 0; round < MAX_ROUNDS; round++)` (`AgentExecutor.ts:384`), with `MAX_ROUNDS = 10` (`AgentExecutor.ts:45`).

Per-round fallback logic mirrors `executeFast()`:

| Attempt | Lines | Description |
|---------|-------|-------------|
| 1 | 408-444 | Primary streaming |
| 2 | 447-486 | Fallback streaming (if primary produced nothing) — emits `FALLBACK_ACTIVATED` at line 449 |
| 3 | 492-533 | Non-streaming with current model |
| 4 | 510-528 | Non-streaming with the other model (if applicable) |

## 6. Error Classification

The fallback mechanism is triggered by **any error** during streaming or non-streaming calls, with one exception: `AbortError` (from user cancellation) is not caught and propagates up directly.

```typescript
// AgentExecutor.ts:198-200
} catch (err) {
  console.warn("[AgentExecutor] Primary streaming failed:", err)
}
```

No distinction is made between error types — all non-abort errors (timeout, rate limit, auth failure, network error, parse error, etc.) result in the same fallback retry.

**Transport-layer retry (RetryMiddleware)** runs before this fallback logic. The `RetryMiddleware` (`transport-middleware.ts:63-127`) handles HTTP-level retries on the **same model**:

- Retryable codes: `CONNECTION_FAILED`, `CONNECTION_TIMEOUT`, `HEADERS_TIMEOUT`, `FIRST_CHUNK_TIMEOUT`, `IDLE_CHUNK_TIMEOUT`, `RATE_LIMITED`, `PROVIDER_OFFLINE` (`transport-errors.ts:101-113`)
- Uses exponential backoff with configurable `baseRetryDelayMs`, `maxRetryDelayMs`, and `retryJitter` (`transport-middleware.ts:102-109`)
- Respects `AbortSignal` — no retries if already aborted (`transport-middleware.ts:73`)

Only after the transport-layer retries are exhausted does the AgentExecutor fallback logic activate.

## 7. Events

When fallback is activated, a `FALLBACK_ACTIVATED` event is emitted into the execution event stream.

### Event type definition

```typescript
// ExecutionEvent.ts:174-181
export interface FallbackActivatedEvent {
  type: "FALLBACK_ACTIVATED"
  executionId: string
  fromModel: string
  toModel: string
  reason: string
  timestamp: number
}
```

### Emission points

- `executeFast()` — `AgentExecutor.ts:205`
  ```typescript
  yield { type: "FALLBACK_ACTIVATED", executionId: eid, fromModel: primary.model, toModel: fallback.model, reason: "primary streaming failed", timestamp: Date.now() }
  ```
- `executeFull()` — `AgentExecutor.ts:449`
  ```typescript
  yield { type: "FALLBACK_ACTIVATED", executionId: eid, fromModel: primary.model, toModel: fallback.model, reason: "primary streaming failed", timestamp: Date.now() }
  ```

The event is part of the `ExecutionEvent` discriminated union (`ExecutionEvent.ts:274-304`) and is available for UI display through the standard event protocol. The `reason` field currently always reads `"primary streaming failed"`, but the structure supports different reasons.

## 8. ASCII Decision Tree

```
                                    ┌────────────┐
                                    │  Request   │
                                    └─────┬──────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │  RetryMiddleware       │
                              │  (transport-level,     │
                              │   same model)          │
                              │  up to maxRetries      │
                              └───────────┬───────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │ Attempt 1: Primary     │
                              │ Streaming              │
                              └───────────┬───────────┘
                                          │
                                  ┌───────┴───────┐
                                  │               │
                                  ▼               ▼
                              SUCCESS          FAIL / NO CONTENT
                                  │               │
                                  │     ┌─────────▼─────────────────┐
                                  │     │ fallback configured?      │
                                  │     └─────────┬─────────────────┘
                                  │          ┌────┴────┐
                                  │          │         │
                                  │          ▼         ▼
                                  │        YES        NO
                                  │          │         │
                                  │     ┌─────▼──┐     │
                                  │     │ Emit   │     │
                                  │     │FALLBACK│     │
                                  │     │ACTIVAT.│     │
                                  │     └─────┬──┘     │
                                  │           │         │
                                  │     ┌─────▼──────┐ │
                                  │     │ Attempt 2:  │ │
                                  │     │ Fallback    │ │
                                  │     │ Streaming   │ │
                                  │     └─────┬──────┘ │
                                  │           │         │
                                  │     ┌─────┴──┐      │
                                  │     ▼        ▼      │
                                  │  SUCCESS    FAIL    │
                                  │     │        │      │
                                  │     │   ┌────▼───┐ │
                                  │     │   │Attempt │ │
                                  │     │   │3: Non- │ │
                                  │     │   │stream  │ │
                                  │     │   │(current│ │
                                  │     │   │ model) │ │
                                  │     │   └───┬────┘ │
                                  │     │   ┌───┴───┐  │
                                  │     │   ▼       ▼  │
                                  │     │ SUCCESS  FAIL│
                                  │     │   │    ┌──▼──┴──┐
                                  │     │   │    │Attempt │
                                  │     │   │    │4: Non- │
                                  │     │   │    │stream  │
                                  │     │   │    │(other  │
                                  │     │   │    │ model) │
                                  │     │   │    └───┬───┘
                                  │     │   │    ┌───┴───┐
                                  │     │   │    ▼       ▼
                                  │     │   │  SUCCESS  FAIL
                                  │     │   │    │       │
                                  ▼     ▼   ▼    ▼       ▼
                              ┌──────────────────────────────┐
                              │     MESSAGE_COMPLETE         │
                              │  (content may be empty → err)│
                              └──────────────────────────────┘
```

## 9. Files Involved

| File | Purpose |
|------|---------|
| `src/runtime/agents/AgentExecutor.ts` | Core fallback logic: `executeFast()` (lines 137-286) and `executeFull()` (lines 288-727). Contains `resolveFallbackProvider()` (lines 76-84) and `resolveAgentConfig()` (lines 86-110). |
| `src/runtime/runtime-engine.ts` | Wiring: `computeGraphRaw()` copies `fallbackModel` from `AgentRoleConfig` to `WiredAgent` (line 142). `WiredAgent` interface declaration (line 8). |
| `src/runtime/ExecutionEvent.ts` | `FallbackActivatedEvent` interface (lines 174-181). `FALLBACK_ACTIVATED` included in `ExecutionEventType` union (line 30) and `ExecutionEvent` discriminated union (line 302). |
| `packages/shared/src/types.ts` | `AgentRoleConfig.fallbackModel` field (line 146). |
| `packages/providers/src/transport-middleware.ts` | `RetryMiddleware` (lines 63-127) — transport-level retries before fallback logic. |
| `packages/providers/src/transport-errors.ts` | Error classification (`classifyNetworkError`, `classifyHttpError`) and `isRetryable()` determining which errors trigger transport retry (lines 42-114). |
