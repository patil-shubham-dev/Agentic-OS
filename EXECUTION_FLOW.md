# Execution Flow

## Complete Path: User Input → Final Response

```
USER INPUT
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ ChatPanel.sendMessage()                              │
│  • Sets isProcessing = true                          │
│  • Generates correlationId                           │
│  • Adds user-message event to timeline-store         │
│  • Calls ExecutionSessionManager.start()             │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│ ExecutionSessionManager.start()                      │
│  • Creates ExecutionSession (id, traceId, status)    │
│  • Sets activeSessionId for cancel support           │
│  • Calls Orchestrator.execute() → gets event stream  │
│  • Enters for await...of loop                        │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ ExecutionOrchestrator.execute()                               │
│  • Creates executionId, AbortController                      │
│  ┌─ YIELDS: EXECUTION_CREATED                                │
│  │  { executionId, input, timestamp }                        │
│  ├─ Calls assignAgentForTask()                                │
│  │  → managerRoute() → role selection                        │
│  │  → applyModeConstraints() → constrained decision          │
│  ├─ YIELDS: THINKING_STARTED                                 │
│  │  { executionId, label: "Routing", timestamp }             │
│  │                                                           │
│  ├─ IF validation errors:                                    │
│  │  YIELDS: EXECUTION_FAILED + return                        │
│  │                                                           │
│  ├─ MODE = "FAST":                                           │
│  │  ┌──────────────────────────────────────────────┐         │
│  │  │ handleDirectResponse()                       │         │
│  │  │  • YIELDS: AGENT_ASSIGNED                    │         │
│  │  │  • YIELDS: THINKING_STARTED("Thinking")      │         │
│  │  │  • YIELDS: PROVIDER_CONNECTING               │         │
│  │  │  • Calls fastChatCompletion() with onToken   │         │
│  │  │    → StreamManager.append(stepId, token)     │         │
│  │  │  • YIELDS: PROVIDER_CONNECTED                │         │
│  │  │  • StreamManager.complete(stepId)            │         │
│  │  │  • YIELDS: MESSAGE_COMPLETE                  │         │
│  │  │    or EXECUTION_FAILED (on error)            │         │
│  │  └──────────────────────────────────────────────┘         │
│  │                                                           │
│  └─ MODE = "FULL" or "MULTI":                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │ handleDelegatedExecution()                        │     │
│     │  • For each role in selectedRoles:                │     │
│     │    ┌────────────────────────────────────┐         │     │
│     │    │ AgentExecutor.execute()            │         │     │
│     │    │  • YIELDS: THINKING_STARTED        │         │     │
│     │    │  • Loads memory + workspace ctx    │         │     │
│     │    │  • Assembles system prompt         │         │     │
│     │    │  • Enters chat loop (max 10 rds):  │         │     │
│     │    │    ├─ Stream chat completion        │         │     │
│     │    │    │  → TOKEN events via EventChan  │         │     │
│     │    │    ├─ Tool calls → pipeline.exec()  │         │     │
│     │    │    │  → TOOL_START/COMPLETE events  │         │     │
│     │    │    │  → FILE_EDIT/COMMAND_* events  │         │     │
│     │    │    └─ Context compaction on overflow│         │     │
│     │    │  • YIELDS: MESSAGE_COMPLETE         │         │     │
│     │    └────────────────────────────────────┘         │     │
│     │  • If MULTI + results:                            │     │
│     │    SynthesisEngine.synthesize()                   │     │
│     │    → YIELDS: SYNTHESIS_COMPLETE                   │     │
│     └──────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ YIELDS: EXECUTION_COMPLETE                              │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ ExecutionSessionManager.handleEvent() — for each event       │
│                                                              │
│  Event → Store Mutation Map:                                 │
│  ┌────────────────────┬──────────────────────────────────┐   │
│  │ EXECUTION_CREATED   │ initStepId, bootstrap session    │   │
│  │ AGENT_ASSIGNED      │ addAgentSession, step mapping    │   │
│  │ TOKEN               │ StreamManager.append()           │   │
│  │ MESSAGE_COMPLETE    │ commitStreamingText, status="c"  │   │
│  │ TOOL_START          │ addToolCallToAgent               │   │
│  │ TOOL_COMPLETE       │ updateToolCall                   │   │
│  │ FILE_EDIT           │ addFileEditToAgent               │   │
│  │ COMMAND_START       │ addTerminalToAgent               │   │
│  │ COMMAND_OUTPUT      │ append terminal output           │   │
│  │ COMMAND_COMPLETE    │ update terminal status           │   │
│  │ COMMAND_ERROR       │ update terminal error            │   │
│  │ EXECUTION_FAILED    │ error state, agent-store msg     │   │
│  │ EXECUTION_COMPLETE  │ finalize init sessions           │   │
│  │ SYNTHESIS_COMPLETE  │ agentStore.addMessage()          │   │
│  │ ACTION              │ ledgerStore.addAction()          │   │
│  │ THINKING_* etc.     │ timelineStore.setPhase()         │   │
│  └────────────────────┴──────────────────────────────────┘   │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ timeline-store state change                                  │
│  → React re-renders                                          │
│  → ConversationTimeline reads agentSessions Map              │
│  → AssistantResponse renders per session                     │
│    ├─ ExecutionHeader (role, provider, model, duration)      │
│    ├─ PhaseTimeline (thinking steps with durations)          │
│    ├─ ToolCallBlock (live tool call cards)                   │
│    ├─ TerminalBlock (command output with auto-scroll)        │
│    ├─ FileOpBlock (file read/write operations)               │
│    ├─ FileEditBlock (file edit diffs)                        │
│    ├─ StreamingContent (markdown with syntax highlighting)   │
│    └─ Retry button (on error state)                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Streaming Token Flow

```
Provider SSE stream
  → ProviderTransport.streamChatCompletion()
    → onToken callback
      → AgentExecutor/Orchestrator
        → StreamManager.append(stepId, token)
          → RAF flush callback
            → timelineStore.appendStreamingText(stepId, delta)
              → React re-render (60fps max)
```

## Cancellation Flow

```
UI Cancel Button
  → ExecutionSessionManager.cancel(sessionId)
    → Orchestrator.cancel()
      → AbortController.abort()
      → StreamManager.clearAll()
    → session.status = "cancelled"
    → Finalize stepByExecId sessions:
      → StreamManager.clearStep(stepId)
      → timelineStore.commitStreamingText(stepId)
      → timelineStore.updateAgentSession(stepId, "complete", "cancelled")
      → timelineStore.streamingTexts.delete(stepId)
    → Finalize initStepId sessions
    → Clear maps (stepByExecId, initStepIds, sessionToExecId)

Async aftermath:
  → Generator detects abort → yields EXECUTION_FAILED
  → Handler detects "cancelled" → skips error display
  → for-await loop ends → session.status preserved as "cancelled"
```

---

## Events (27 types)

| Event | Producer | Consumer Action |
|-------|----------|----------------|
| `EXECUTION_CREATED` | Orchestrator | Init session, step mapping |
| `AGENT_ASSIGNED` | Orchestrator | Agent session creation |
| `THINKING_STARTED` | Orchestrator/Executor | Phase display |
| `THINKING_UPDATE` | Executor | Phase update |
| `PLAN_CREATED` | Orchestrator | Phase display |
| `PLAN_UPDATED` | Orchestrator | Phase update |
| `TOOL_START` | Executor | Tool call card |
| `TOOL_PROGRESS` | Executor | Tool progress update |
| `TOOL_COMPLETE` | Executor | Tool result display |
| `FILE_READ` | Executor | File operation card |
| `FILE_WRITE` | Executor | File operation card |
| `FILE_EDIT` | Executor | File edit diff |
| `CONTEXT_LOADING` | Executor | Phase: Loading |
| `CONTEXT_READY` | Executor | Phase: Ready |
| `PROVIDER_CONNECTING` | Orchestrator/Executor | Phase: Connecting |
| `PROVIDER_CONNECTED` | Orchestrator/Executor | Phase: Connected |
| `TOKEN` | Executor | StreamManager buffer |
| `MESSAGE_UPDATE` | Executor | Ignored |
| `MESSAGE_COMPLETE` | Orchestrator/Executor | Commit text, status=complete |
| `EXECUTION_COMPLETE` | Orchestrator | Finalize init sessions |
| `EXECUTION_FAILED` | Orchestrator/Executor | Error state, partial content preserved |
| `COMMAND_START` | Executor | Terminal card |
| `COMMAND_OUTPUT` | Executor | Append to terminal output |
| `COMMAND_COMPLETE` | Executor | Terminal success status |
| `COMMAND_ERROR` | Executor | Terminal error status |
| `ACTION` | Executor | Ledger entry |
| `SYNTHESIS_COMPLETE` | Orchestrator | Agent-store message |

---

## Store Ownership (Write Access)

| Store | Written By | Read By |
|-------|-----------|---------|
| timeline-store | ExecutionSessionManager ONLY | React UI |
| agent-store | ExecutionSessionManager + AgentExecutor (legacy) | Executor (history) + UI |
| ledger-store | ExecutionSessionManager + AgentExecutor (legacy) | UI |
| app-store | UI settings pages | Runtime engine |
| workspace-store | UI + Tauri backend | Context system |
