# DUPLICATE RESPONSE ROOT CAUSE ANALYSIS

## Execution Trace for "hi" in Autonomous Mode

```
User: "hi"
  → composer.tsx:141 onKeyDown Enter
  → chat-panel.tsx:144 sendMessage()

Timeline:
  1. agent-store.addMessage("coder", { role:"user", content:"hi" })
  2. timeline-store.addEvent({ type:"user-message", content:"hi" })
  3. agent-store.setProcessing(true)
  4. ExecutionSessionManager.start({ input:"hi", role:"coder" })

  5. EXECUTION_CREATED event → timeline-store.addAgentSession(init_session)
  6. manager-routing-engine.ts route("hi")
     → classifyIntent("hi") → "conversation" (0.8)
     → selectedRoles = ["fast-inference"]
     → requiresDelegation = true

  7. applyModeConstraints("autonomous", ["fast-inference"])
     → includeQAByDefault = true  ← ROOT CAUSE
     → selectedRoles = ["fast-inference", "qa"]

  8. handleDelegatedExecution(["fast-inference", "qa"])

  ═══ ROUND 1: fast-inference ═══
  9.  AGENT_ASSIGNED(fast-inference) → timeline-store.addAgentSession(fast-inf)
  10. AgentExecutor.FULL:
      → load memory, assemble system prompt
      → streamChatCompletion with FAST_CHAT_PROMPT
      → TOKEN events → StreamManager → timeline-store.appendStreamingText
      → MESSAGE_COMPLETE (suppressed by Orchestrator at line 283-286)
  11. Orchestrator yields MESSAGE_COMPLETE(fast-inference content)
      → timeline-store.commitStreamingText(fast-inf session)
      → timeline-store.updateAgentSession(fast-inf, complete)

  ═══ ROUND 2: qa ═══              ← UNEXPECTED
  12. AGENT_ASSIGNED(qa) → timeline-store.addAgentSession(qa_session)
  13. AgentExecutor.FULL (same input "hi", full context):
      → load memory, assemble system prompt AGAIN
      → streamChatCompletion with QA_PROMPT
      → TOKEN events → StreamManager
      → MESSAGE_COMPLETE (suppressed)
  14. Orchestrator yields MESSAGE_COMPLETE(qa content)
      → timeline-store.commitStreamingText(qa session)
      → timeline-store.updateAgentSession(qa, complete)

  15. EXECUTION_COMPLETE → timeline-store.updateAgentSession(init, complete)

Result: TWO assistant responses visible in UI
```

## Root Cause #1: Mode constraints add QA for ALL intents

**File:** `src/runtime/execution-mode.ts:186-188`
**Severity:** HIGH

```typescript
if (config.includeQAByDefault && !roles.includes("qa")) {
    roles.push("qa")
}
```

`includeQAByDefault` is `true` for `"autonomous"` mode. It adds QA to EVERY delegation regardless of intent. For a conversational "hi", QA should not run. The fix: filter by intent category — only add QA when the route's `intentCategory` is not `"conversation"`.

## Root Cause #2: Init session persists

**File:** `src/runtime/sessions/ExecutionSessionManager.ts:294-317`
**Severity:** MEDIUM

`EXECUTION_CREATED` creates a placeholder session. `AGENT_ASSIGNED` marks it "complete" but does not delete it. `conversation-timeline.tsx:124-131` renders all sessions with the same `correlationId`, including the empty init session. Fix: remove the init session from `agentSessions` when `AGENT_ASSIGNED` fires.

## Root Cause #3: Assistant responses not persisted to agent-store

**File:** `src/runtime/sessions/ExecutionSessionManager.ts:134-139`
**Severity:** MEDIUM

`MESSAGE_COMPLETE` handler only writes to `timeline-store`. Agent-store conversation history loses all assistant responses. Compare:
- `EXECUTION_FAILED` handler → calls `addMessage` ✅
- `SYNTHESIS_COMPLETE` handler → calls `addMessage` ✅
- `MESSAGE_COMPLETE` handler → does NOT call `addMessage` ❌

Fix: Add `useAgentStore.getState().addMessage(...)` in the MESSAGE_COMPLETE case.
