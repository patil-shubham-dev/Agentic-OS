# NVIDIA NIM COMPLETION CANCELLATION — ROOT CAUSE REPORT

## Symptom
```
URL        ✓
AUTH       ✓  HTTP 200
COMPLETION ✗  Request canceled after ~15s
```

## Phase 1–10: Complete Trace

### 1. Who Cancels
**File:** `packages/providers/src/streaming-transport.ts` line 286
```javascript
const connectTimeout = setTimeout(() => abortCtrl.abort(), timeoutMs)
```
The `abortCtrl` is owned by `streamingTransportFetch()` (created at line 267). This is a **local** AbortController — distinct from the orchestrator's controller.

### 2. The Timeout
**Origin:** `packages/providers/src/transport-types.ts` line 93
```javascript
streamTimeoutMs: 15_000
```
**Consumed:** `packages/providers/src/streaming-transport.ts` line 262
```javascript
const timeoutMs = options.timeoutMs ?? 15_000
```
**Fires at:** `streaming-transport.ts` line 286 — exactly **15000ms**

### 3. Cancellation Chain
```
User sends message
  → ExecutionOrchestrator.execute()                    [orchestrator.ts:49]
    → handleDirectResponse()                           [orchestrator.ts:143]
      → fastChatCompletion(endpoint, onToken)          [orchestrator.ts:188]
        → ProviderTransport.streamChatCompletion()     [transport.ts:172]
          → streamingTransportFetch(options)           [streaming-transport.ts:267]
            ├── const abortCtrl = new AbortController()
            ├── const timeoutMs = 15000
            ├── setTimeout(() => abortCtrl.abort(), 15000)  ← 🔥 FIRES AT 15s
            ├── await tauriFetch(url, { signal: abortCtrl.signal })  ← CANCELLED
            └── catch: TransportError("CONNECTION_TIMEOUT", "Connection timed out after 15000ms")
```

### 4. Why Auth Passes But Completion Fails
| Request | Endpoint | Timeout | Expected Latency | Result |
|---------|----------|---------|-----------------|--------|
| Auth validation | `GET /v1/models` | 8000ms / 10000ms | <2s (cached list) | ✅ Passes |
| Chat completion | `POST /v1/chat/completions` | **15000ms** | 10-30s (cold start) | ❌ Cancels |

NVIDIA NIM's chat completions endpoint has cold start latency (model loading, GPU queue) that exceeds 15s. The auth validation uses lightweight model list queries that respond instantly.

### 5. All Timeouts at 15000ms
| File | Line | Usage | Relevance |
|------|------|-------|-----------|
| `transport-types.ts` | 93 | `streamTimeoutMs: 15_000` | 🏛 DEFINITION |
| `streaming-transport.ts` | 262 | `timeoutMs = options.timeoutMs ?? 15_000` | 📥 CONSUMED |
| `streaming-transport.ts` | 286 | `setTimeout(() => abortCtrl.abort(), timeoutMs)` | 🔥 **EXACT TRIGGER** |
| `openai-compatible-adapter.ts` | 565 | `AbortSignal.timeout(15000)` | Model discovery (different path) |
| `provider-manager.ts` | 257 | `AbortSignal.timeout(15000)` | Model discovery (different path) |
| `runtime-token-config.ts` | 32 | `STREAM_CONNECTION_TIMEOUT_MS: 15_000` | Mirrored constant (unused) |

### 6. Root Cause Answer

**1. Did NVIDIA return tokens?**  
No. The request was aborted before the server sent any response body. The TCP connection may have established (HTTP response headers partially received), but the SSE stream never began.

**2. Was first token received?**  
No. The first-chunk timeout (30s at `streaming-transport.ts` line 394) never engaged because the connection timeout fired first.

**3. Who owns the AbortController?**  
The local `abortCtrl` inside `streamingTransportFetch()` at `packages/providers/src/streaming-transport.ts:267`.

**4. Who called abort()?**  
The `setTimeout` on line 286 of `streaming-transport.ts` called `abortCtrl.abort()` after 15000ms.

**5. What exact line triggered cancellation?**  
`packages/providers/src/streaming-transport.ts` **line 286**:
```javascript
const connectTimeout = setTimeout(() => abortCtrl.abort(), timeoutMs)
```

**6. What type of bug is this?**  
**Transport timeout bug.** The `streamTimeoutMs` of 15000ms is too aggressive for NVIDIA NIM's cold-start latency. The timeout should be increased (60000ms would match the first-chunk timeout) or made configurable per-provider. File: `packages/providers/src/transport-types.ts:93` — value `15_000`.

### Mitigation (not implementing — audit only)
- Increase `streamTimeoutMs` from 15000 to at least 60000 for NVIDIA NIM
- Or make timeout configurable per-provider in `NvidiaNimAdapter`
- Or switch from `setTimeout` abort to relying on the existing 30s `firstChunkTimeoutMs`
