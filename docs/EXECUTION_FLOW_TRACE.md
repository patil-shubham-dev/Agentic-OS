# EXECUTION FLOW TRACE: "hi"

## Expected Flow

```
User Message ("hi")
  → Manager (routing only)
  → Fast Inference (response)
  → Response
  → Complete
```

**Expected:** 1 user message, 1 assistant response, 1 timeline session, ~5-10 store writes.

## Actual Flow (Autonomous Mode)

```
composer.tsx Enter keydown
  → chat-panel.tsx:144 sendMessage
    → agent-store.addMessage("coder", user:"hi")          [store write 1]
    → timeline-store.addEvent(user-message)               [store write 2]
    → agent-store.setProcessing(true)                     [store write 3]
    → ExecutionSessionManager.start({ input:"hi" })
      → StreamManager.setFlushCallback (first call only)
      → ExecutionOrchestrator.execute()
        → EXECUTION_CREATED
          → timeline-store.addAgentSession(init_session)  [store write 4]
        → THINKING_STARTED("Routing")
          → timeline-store.setPhase                        [store write 5]
        → manager-routing-engine.ts classifyIntent("hi") → "conversation"
        → applyModeConstraints("autonomous") → roles = ["fast-inference", "qa"]
        → resolveMode() → "FULL"
        → handleDelegatedExecution(["fast-inference","qa"])

        ═══ ROUND 1: fast-inference ═══
        → AGENT_ASSIGNED(fast-inference, stepId: execId_fast)
          → timeline-store.addAgentSession(fast-inf)       [store write 6]
          → timeline-store.updateAgentSession(init, done)  [store write 7]
        → THINKING_STARTED("Planning")
          → timeline-store.setPhase                        [store write 8]
        → AgentExecutor.FULL execute
          → loadMemory → context assembly → system prompt
          → streamChatCompletion
          → TOKEN events × N → StreamManager → RAF batches
            → timeline-store.appendStreamingText × N       [store writes 9+]
          → AgentExecutor yields MESSAGE_COMPLETE (suppressed by Orchestrator)
        → PROVIDER_CONNECTED
          → timeline-store.setPhase                        [store write 10+?]
        → Orchestrator: StreamManager.complete(stepId_fast)
        → Orchestrator: yields MESSAGE_COMPLETE(fast content)
          → ExecutionSessionManager.handleEvent
            → StreamManager.clearStep
            → timeline-store.commitStreamingText           [store write 11+?]
            → timeline-store.updateAgentSession(complete)  [store write 12+?]

        ═══ ROUND 2: qa ═══   ← UNEXPECTED DUPLICATE
        → AGENT_ASSIGNED(qa, stepId: execId_qa)
          → timeline-store.addAgentSession(qa_session)     [store write 13+?]
        → AgentExecutor.FULL execute (SAME INPUT)
          → streamChatCompletion
          → TOKEN events × N → StreamManager → RAF batches
            → timeline-store.appendStreamingText × N       [store writes 14+?]
          → MESSAGE_COMPLETE (suppressed)
        → Orchestrator: StreamManager.complete(stepId_qa)
        → Orchestrator: yields MESSAGE_COMPLETE(qa content)  ← SECOND RESPONSE
          → timeline-store.commitStreamingText             [store write 15+?]
          → timeline-store.updateAgentSession(complete)    [store write 16+?]

        → EXECUTION_COMPLETE
          → timeline-store.updateAgentSession(init, done)  [store write 17+?]
      → catch → agent-store.setProcessing(false)           [store write ~18+?]
```

**Total store writes:** ~16-30+ (exact count depends on RAF flush cycles)

## Key Findings

### 1. Two agents execute for "hi"
`applyModeConstraints("autonomous")` adds `"qa"` to `["fast-inference"]` because `includeQAByDefault: true`. Result: two complete AgentExecutor.FULL executions.

### 2. No assistant messages in agent-store
`MESSAGE_COMPLETE` handler (line 134-139) only writes to `timeline-store`. Agent-store conversation history does NOT contain assistant responses. Only `EXECUTION_FAILED` and `SYNTHESIS_COMPLETE` handlers write assistant messages to agent-store.

### 3. SynthesisEngine NOT called
`decision.executionStrategy = "single-agent"`, so SynthesisEngine is skipped. Only multi-agent routes trigger synthesis.

### 4. Mode selector not connected
`requestedMode` parameter in `resolveMode()` is never passed from `ChatPanel`. The mode selector UI updates `agentStore.executionMode` (which feeds `applyModeConstraints`), but does NOT control FAST vs FULL mode selection.

### 5. Init session creates extra visual entry
`EXECUTION_CREATED` creates placeholder session. Persists alongside real sessions. `conversation-timeline.tsx` renders all sessions for the turn.

## Store-Write Verification

| Expected writes | Actual writes | Delta |
|----------------|---------------|-------|
| 1 user msg → 1 store | 1 user msg → 1 store | ✅ |
| 1 assistant msg → 1 store | 2 assistant msgs → **0 store** (timeline-only, not agent-store) | ❌ Missing + duplicate without persistence |
| 1 timeline session | 3 timeline sessions (init + fast + qa) | ❌ Triple |
| ~5-10 total writes | ~16-30+ total writes | ❌ 2-3x more than expected |
