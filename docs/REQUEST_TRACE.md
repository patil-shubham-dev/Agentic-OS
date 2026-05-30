# REQUEST TRACE — NVIDIA NIM Completion Lifecycle

## Complete Event Sequence for a Cancelled Request

```
T+0ms     [UI] User clicks Send in ChatPanel
            chat-panel.tsx:163 → executionSessionManager.start({ input, activeRole })

T+0ms     [ExecutionSessionManager] Creates session, sets up StreamManager
            ExecutionSessionManager.ts:48-68

T+0ms     [ExecutionOrchestrator] Starts execution
            ExecutionOrchestrator.ts:65  → yields EXECUTION_CREATED { executionId, input }
            ExecutionOrchestrator.ts:70  → yields THINKING_STARTED { label: "Routing" }

T+1ms     [Orchestrator] Routes task
            ExecutionOrchestrator.ts:73  → managerRoute() returns RoutingDecision
            ExecutionOrchestrator.ts:94  → branches to handleDirectResponse()

T+1ms     [Orchestrator] Finds agent, checks provider
            ExecutionOrchestrator.ts:167 → yields AGENT_ASSIGNED { roleId: "manager", stepId }
            ExecutionOrchestrator.ts:184 → yields THINKING_STARTED { label: "Thinking" }
            ExecutionOrchestrator.ts:185 → yields PROVIDER_CONNECTING { model, provider }

T+1ms     [Orchestrator] Calls Provider
            ExecutionOrchestrator.ts:188 → fastChatCompletion(endpoint, onToken)
              → orchestrator.ts:fastChatCompletion()
                → ProviderTransport.streamChatCompletion()
                  → streamingTransportFetch(options)

T+1ms     [Transport] Creates AbortController
            streaming-transport.ts:267 → const abortCtrl = new AbortController()
            streaming-transport.ts:262 → const timeoutMs = options.timeoutMs ?? 15_000
            streaming-transport.ts:286 → setTimeout(() => abortCtrl.abort(), 15000ms)  ← ⏰

T+1ms     [Transport] Sends HTTP request
            streaming-transport.ts:288 → await tauriFetch(url, {
              method: "POST",
              headers: { "Authorization": "Bearer ${apiKey}", "Content-Type": "application/json" },
              body: JSON.stringify({ model, messages, stream: true }),
              signal: abortCtrl.signal
            })

┌─ Connection Wait ─────────────────────────────────────────────┐
│                                                                │
│  T+1ms → T+14999ms                                            │
│  tauriFetch is awaiting HTTP response headers                 │
│  NVIDIA NIM is loading model / GPU cold start / queue wait    │
│  No response bytes received yet                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘

T+15000ms  ⏰ CONNECT TIMEOUT FIRES
            streaming-transport.ts:286 → setTimeout callback fires
              → abortCtrl.abort()  ← 🔥 CANCELLATION

T+15000ms  [Transport] Fetch throws AbortError
            streaming-transport.ts:288 → tauriFetch rejects with AbortError
            streaming-transport.ts:292 → clearTimeout(connectTimeout) — too late

T+15000ms  [Transport] Reports error
            streaming-transport.ts:300-301 → callbacks.onError(
              new TransportError("CONNECTION_TIMEOUT",
                "Connection timed out after 15000ms")
            )

T+15000ms  [Orchestrator] Receives error
            fastChatCompletion catches → AgentResult with error
            ExecutionOrchestrator.ts:210 → content is empty
            ExecutionOrchestrator.ts:214-217 → catch → yields EXECUTION_FAILED

T+15000ms  [ExecutionSessionManager] Handles failure
            ExecutionSessionManager.ts:239 → handles EXECUTION_FAILED
            → adds error assistant message to agent-store
            → sets session status to "failed"

T+15000ms  [UI] Shows error
            ChatPanel → re-renders with error message
            TimelineStore → shows execution failed in timeline

T+15001ms  [SESSION ENDS] session status: "failed", duration: 15001ms
```

## Events Actually Emitted

```
✅ EXECUTION_CREATED     T+0ms
✅ THINKING_STARTED      T+0ms
✅ AGENT_ASSIGNED        T+1ms
✅ THINKING_STARTED      T+1ms
✅ PROVIDER_CONNECTING   T+1ms
❌ PROVIDER_CONNECTED    (never emitted — transport timed out)
❌ MESSAGE_COMPLETE      (never emitted)
❌ EXECUTION_COMPLETE    (never emitted — EXECUTION_FAILED instead)
✅ EXECUTION_FAILED      T+15000ms
```

## Last Emitted Event Before Failure
`PROVIDER_CONNECTING` at T+1ms

## Key State Transitions

| Component | State Change | Time | Trigger |
|-----------|-------------|------|---------|
| ExecutionSessionManager | `running` | T+0ms | start() called |
| StreamManager | flush callback set | T+0ms | First call setup |
| transport abortCtrl | `aborted = false` | T+1ms | Created |
| transport abortCtrl | `aborted = true` | T+15000ms | setTimeout fires |
| fetch promise | pending → rejected | T+15000ms | abortCtrl.abort() |
| fastChatCompletion | streaming → caught | T+15000ms | TransportError thrown |
| Orchestrator | executing → error | T+15000ms | empty content + catch |
| ExecutionSessionManager | running → failed | T+15000ms | EXECUTION_FAILED event |
| UI chat | processing → done | T+15001ms | Promise resolves |
| Session | duration: 15001ms | T+15001ms | Finalized |
