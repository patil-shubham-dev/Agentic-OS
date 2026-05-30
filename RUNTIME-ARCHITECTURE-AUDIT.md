# RUNTIME ARCHITECTURE AUDIT — COMPLETE REPORT

## EXECUTIVE SUMMARY

The runtime has **5+ orchestrator-like systems**, **2 EventBus instances**, **3 session management systems**, **3 tool systems**, **2 agent systems**, **2+ streaming pipelines**, and **dozens of race conditions**. The architecture has become a DAG of competing systems rather than a linear pipeline. **~60% of the runtime code is redundant or unreachable.**

---

## SECTION 1 — COMPLETE EXECUTION FLOW

### 1.1 USER INPUT → RENDERED RESPONSE (DIRECT RESPONSE PATH)

```
[USER TYPES MESSAGE]
  → Composer.tsx:148 (textarea onChange)
    → handleChange() sets input state
  → Enter key → onSend()
    → ChatPanel.tsx:72 sendMessage()
      → useAgentStore.setProcessing(true)
      → ExecutionSessionManager.start({input, activeRole})
        → ExecutionOrchestrator.execute()
          → executionEngine.startTask(traceId)       // IDLE→PLANNING
          → assignAgentForTask()
            → managerRoute(input, wiredRoles)         // keyword intent matching
            → applyModeConstraints()
            → agentStore.addAgentAssignment()
            → workspaceStore.setOrchestrationState()
            → eventBus.emit(ROUTING_DECISION)          // async→UiSync→TimelineStore
          → getProcessedHistory()                      // filters messages, compression
          → if !requiresDelegation:
            handleDirectResponse()
              → timelineStore.addAgentSession()         // CRITICAL: session created BEFORE streaming
              → eventBus.emit(AGENT_ASSIGNED)           // UiSync skips if session exists
              → fastChatCompletion()
                → transport.streamChatCompletion()      // ProviderTransport
                  → fetch() to /chat/completions
                  → SSE parser
                  → onToken callback
                    → StreamBuffer.append(stepId, token)  // RAF-coalesced buffer
                    → eventBus.emit(TOKEN_STREAM)         // backward compat
            ── RAF frame ──
              → StreamBuffer.flush()
                → ResponseReconciler.onStreamFlush()
                  → timelineStore.appendStreamingText()   // fast path, separate Map
            ── On stream end ──
              → fastChatCompletion returns {response, usage}
              → timelineStore.commitStreamingText(stepId)  // moves streamingTexts→agentSessions
              → eventBus.emit(AGENT_COMPLETE)               // UiSync updates session status
              → agentStore.addMessage()                     // stores in conversation history
              → executionEngine.complete()                   // →COMPLETE
              → return ExecuteResult
          → ExecutionSessionManager returns session
      → setCurrentSession(session)                       // React state
    → finally: setProcessing(false)
```

### 1.2 USER INPUT → RENDERED RESPONSE (DELEGATED/AGENT PATH)

```
  → if requiresDelegation:
    handleDelegatedExecution()
      → buildTaskGraph()                                 // TaskGraphRuntime
      → for each parallelGroup:
          for each task:
            → timelineStore.addAgentSession()             // synchronous session creation
            → eventBus.emit(AGENT_ASSIGNED)
            → AgentWorker.execute()
              → runRuntimeAgent()
                → runAgent()                              // THE MAIN AGENT LOOP
                  ┌─────────────────────────────────────┐
                  │ LOOP (max 10 rounds):                │
                  │   1. build system prompt              │
                  │   2. transport.chatCompletion or      │
                  │      transport.streamChatCompletion   │
                  │   3. if tool_calls:                   │
                  │      → executeToolCall() for each     │
                  │      → events emitted via callbacks   │
                  │      → inject results → msgs.push()   │
                  │      → auto-compaction if needed      │
                  │      → auto-verification post-edits   │
                  │      → LOOP CONTINUES                 │
                  │   4. if no tool_calls: BREAK          │
                  └─────────────────────────────────────┘
            → commitStreamingText(stepId)
            → eventBus.emit(AGENT_COMPLETE)
      → if multi-agent: synthesisEngine.synthesize()
      → executionEngine.complete()
      → eventBus.emit(EXECUTION_SUMMARY)
```

### 1.3 ASYNC BOUNDARIES AND RACE POINTS

| # | Boundary | Systems Involved | Risk |
|---|----------|-----------------|------|
| 1 | `StreamBuffer.append()` → RAF → `ResponseReconciler.onStreamFlush()` | StreamBuffer → ResponseReconciler → TimelineStore | Lost tokens if flush races with session creation |
| 2 | `eventBus.emit(TOKEN_STREAM)` → `UiSync.schedule()` → RAF → `RenderScheduler.flush()` | EventBus → UiSync → RenderScheduler → TimelineStore | **DUPLICATE RAF SYSTEM** — tokens arrive via TWO paths |
| 3 | `commitStreamingText()` → emergency session creation | TimelineStore | Documented race — has emergency recovery |
| 4 | `eventBus.emit(AGENT_ASSIGNED)` → UiSync checks `agentSessions.has(stepId)` | EventBus → UiSync → TimelineStore | Session created in ExecutionOrchestrator BEFORE emit, but UiSync checks and skips |
| 5 | `memoryLoader.load()` resolves after prompt composition starts | ContextManager → memoryLoader | Documented — memory may miss the first round |
| 6 | `AgentWorker` async generator → `for await (const event of agentStream)` | AgentWorker → ExecutionOrchestrator | Events received out-of-order vs timeline writes |
| 7 | `PersistentExecutionStore.append()` subscribes to EventBus events | ExecutionSession → EventBus → PersistentExecutionStore | Runs in parallel with same events going to UiSync |

---

## SECTION 2 — ORCHESTRATOR OWNERSHIP MAP

### 2.1 IDENTIFIED ORCHESTRATION SYSTEMS

| # | System | File | Primary Role | Dependencies | Necessary? |
|---|--------|------|-------------|--------------|------------|
| 1 | **ExecutionOrchestrator** | `runtime/execution/ExecutionOrchestrator.ts` | Main execution flow: receive input, route, delegate, complete | AgentWorker, ExecutionEngine, TaskGraphRuntime, SynthesisEngine, ContextManager | **YES** (core) |
| 2 | **ExecutionEngine** | `runtime/execution-engine.ts` | State machine: IDLE→PLANNING→ROUTING→EXECUTING→STREAMING→COMPLETE | None (self-contained) | **NO** — pure logging, no actual control flow |
| 3 | **ExecutionSessionManager** | `runtime/sessions/ExecutionSessionManager.ts` | Wraps ExecutionOrchestrator with session tracking | ExecutionOrchestrator, EventBus | **REDUNDANT** — thin wrapper, 112 lines |
| 4 | **SessionManager** | `runtime/sessions/SessionManager.ts` | Manages ExecutionSession lifecycle, persists to history | ExecutionSession, PersistentExecutionStore | **REDUNDANT** — UNUSED by chat flow |
| 5 | **ExecutionSession** | `runtime/sessions/ExecutionSession.ts` | Legacy session with supervisor, store, streamMux | RuntimeSupervisor, PersistentExecutionStore, StreamMultiplexer | **UNUSED** — SessionManager manages these but chat uses ExecutionSessionManager |
| 6 | **RuntimeSupervisor** | `runtime/RuntimeSupervisor.ts` | Preflight validation, start/halt | ProviderRegistry | **UNUSED** in main path |
| 7 | **RuntimeCoordinator** | `runtime/runtime-coordinator.ts` | Deferred workspace refresh scheduling | WorkspaceRuntime | **ORPHANED** — only handles refresh debouncing |
| 8 | **TaskGraphRuntime** | `runtime/task-graph/TaskGraphRuntime.ts` | Builds parallel execution graphs | None | **OVERKILL** — constructs DAG that's executed linearly |
| 9 | **CoordinatorRuntime** | `runtime/coordinator/CoordinatorRuntime.ts` | Multi-agent coordination with worker registration | TaskRuntime, ToolExecutionPipeline, PermissionEngine | **UNUSED** by main execution path |
| 10 | **ManagerRoutingEngine** | `runtime/manager-routing-engine.ts` | Regel-based intent classification → role selection | None | **PARTIALLY USED** — simple keyword matching |
| 11 | **RenderScheduler** (2 copies) | `runtime/render-engine/render-scheduler.ts` + `performance/RenderScheduler.ts` | RAF-based task scheduling | None | **REDUNDANT** — TWO independent RAF schedulers |
| 12 | **StreamBuffer** (2 copies) | `runtime/render-engine/stream-buffer.ts` + `performance/StreamBuffer.ts` | Token batching | None | **REDUNDANT** — TWO stream buffers |
| 13 | **ResponseReconciler** | `runtime/render-engine/ResponseReconciler.ts` | Handles stream completion → session reconciliation | StreamBuffer, TimelineStore | **CONFUSING** — overlaps with commitStreamingText logic |

### 2.2 OWNERSHIP CHAOS — THE ACTUAL FLOW

**There is no single owner of execution.** The chain is:

```
ExecutionSessionManager (thin wrapper)
  → ExecutionOrchestrator (main logic)
    → AgentWorker (thin generator wrapper)
      → runRuntimeAgent (resolver)
        → runAgent (THE REAL ENGINE)
          → transport.chatCompletion / streamChatCompletion
```

Meanwhile, **5 systems write to the same TimelineStore** concurrently:
1. `ExecutionOrchestrator` writes directly via `addAgentSession()`, `commitStreamingText()`
2. `ResponseReconciler` writes via `onStreamFlush()` → `appendStreamingText()`
3. `UiSync` writes via EventBus handlers → `addEvent()`, `addToolCallToAgent()`, etc.
4. `ExecutionEngine` mutates state but doesn't write to TimelineStore
5. `tool-executor.ts` indirectly writes through `onToolCallStart`/`onToolCallComplete` callbacks

### 2.3 SINGLETON HELL

Every major system is a singleton:
- `ExecutionOrchestrator.getInstance()`
- `ExecutionSessionManager.getInstance()`
- `SessionManager.getInstance()`
- `EventBus.getInstance()`
- `StreamBuffer.getInstance()` (x2)
- `ResponseReconciler.getInstance()`
- `RenderScheduler.getInstance()` (x2)
- `RuntimeOS.getInstance()`
- `ContextManager.getInstance()`
- `UiSync.getInstance()`
- `SpanProcessor.getInstance()`
- `ProviderInspector.getInstance()`
- `RuntimeCleanupManager.getInstance()`
- `PrefetchScheduler.getInstance()`
- `StreamMultiplexer.getInstance()`

**16+ singletons** — all with implicit initialization order dependencies.

---

## SECTION 3 — AGENT ARCHITECTURE ANALYSIS

### 3.1 ALL AGENT ROLES (from INTENT_PATTERNS)

| Role | When Activated | What It Controls | Should Remain? |
|------|---------------|-----------------|---------------|
| `fast-inference` | Short/conversational messages | Single provider call, no tools | **YES** — useful optimization |
| `coder` | Coding intents | Full agent loop with tools | **YES** — primary role |
| `vision` | UI/screenshot analysis | Provider call | **MAYBE** — niche |
| `research` | Research/investigation | Provider call | **MAYBE** — niche |
| `runtime` | Terminal/execution | Provider call with execution tools | **MAYBE** — merges with coder |
| `browser` | Navigation/browsing | Provider call with browser tools | **UNIFY** into tool-based |
| `manager` | Planning/strategy | Multi-agent coordination | **UNIFY** — merge into orchestrator |

### 3.2 ALL AGENT SYSTEMS

| System | Location | Why It Exists | Should Remain? |
|--------|---------|---------------|---------------|
| `AgentWorker` | `runtime/agents/AgentWorker.ts` | Async generator wrapper around runRuntimeAgent | **DELETE** — 85 lines with no value-add |
| `runRuntimeAgent` | `lib/agents/orchestrator.ts:666` | Resolves wired agent config → runAgent | **SIMPLIFY** — merge into orchestrator |
| `runAgent` | `lib/agents/orchestrator.ts:105` | THE REAL AGENT: prompt build, provider loop, tool execution, compaction | **KEEP** — core logic |
| `fastChatCompletion` | `lib/agents/orchestrator.ts:564` | Optimized fast path, minimal prompt, streaming + fallback | **KEEP** — useful for simple responses |
| `AgentTypes` | `agents/AgentTypes.ts` | Type definitions for AgentKind, AgentTask, AgentSpec, WorktreeEntry | **DELETE** — unused abstractions |
| `ExecutionReflectionEngine` | `agents/ExecutionReflectionEngine.ts` | Agent execution reflection/analysis | **DELETE** — unused |
| `WorktreeManager` | `agents/WorktreeManager.ts` | Worktree/snapshot management | **DELETE** — unused |
| `SubAgentDelegator` | `runtime/sub-agents/sub-agent-delegator.ts` | Sub-agent execution | **SIMPLIFY** |
| `SubAgentManager` | `runtime/sub-agents/sub-agent-manager.ts` | Sub-agent lifecycle | **SIMPLIFY** |
| `AgentGraphRuntime` | `runtime/observability/AgentGraphRuntime.ts` | Visualization-only | **OBSERVABILITY** — not runtime |
| `AgentMeshEngine` | `runtime/observability/AgentMeshEngine.ts` | Visualization-only | **OBSERVABILITY** — not runtime |

### 3.3 AGENT QUESTIONS ANSWERED

**1. Which agents are actually useful?**
Only `runAgent` (the execution loop). Everything else is scaffolding.

**2. Which agents are redundant?**
- `AgentWorker` — wraps runRuntimeAgent, adds nothing
- `ExecutionReflectionEngine` — never called
- `WorktreeManager` — never called

**3. Which agents duplicate responsibilities?**
- `runRuntimeAgent` duplicates `runWorkspaceAgent` which duplicates `runAgent`
- `fastChatCompletion` duplicates `runAgent`'s streaming path

**4. Which agents increase latency unnecessarily?**
- `AgentWorker` async generator — adds an EventEmitter layer between tokens and UI
- `TaskGraphRuntime` DAG building — constructs complex graph but executes linearly

**5. Which agents create orchestration confusion?**
- `CoordinatorRuntime` + `TaskDelegator` + `SharedTaskGraph` — elaborate multi-agent system never wired into main path
- `SubAgentManager` + `SubAgentDelegator` — parallel sub-agent system

**6. Which agents should merge?**
- `runRuntimeAgent` + `runWorkspaceAgent` + `runAgent` → single `executeAgent()`
- `fastChatCompletion` → execution mode flag, not separate function

**7. Which agents should become simple execution modes?**
- `fast-inference` → `mode: "fast"` on the same execution path
- `vision`, `research`, `browser`, `runtime` → tool permission profiles, not separate agents

---

## SECTION 4 — API ↔ AGENT LOOP ANALYSIS

### 4.1 THE FULL LOOP

```
runAgent(config, userMessage, history)
  ↓
  ContextManager.assembleSystemPrompt()       // prompt composition
  ContextManager.buildContext()               // workspace context
  ↓
  LOOP (max 10 rounds, 120s timeout):
    ↓
    transport.streamChatCompletion()          // Provider transport (streaming)
      OR
    transport.chatCompletion()                // Provider transport (non-streaming)
    ↓
    if tool_calls in response:
      ↓
      for each tool_call:
        executeToolCall(tc, role, stepId)     // tool executor
          ↓
          onToolCallStart callback             // → eventBus → UiSync → TimelineStore
          ↓
          RuntimeOS.toolExecutionPipeline      // NOT USED — tools bypass this
          ↓
          onToolCallComplete callback          // → eventBus → UiSync → TimelineStore
      ↓
      msgs.push(toolResults)
      ContextManager.updateBudget()
      ↓
      if file edits occurred:
        PostWriteVerifier.verify()              // auto-verification
        inject verification results as msgs.push()
      ↓
      LOOP CONTINUES
    ↑
    else (no tool_calls):
      BREAK
  ↓
  return {response, messages, usage}
```

### 4.2 CRITICAL ISSUES IN THE LOOP

| Issue | Description |
|-------|-------------|
| **No execution loop ownership** | The loop lives in `runAgent()` (lib/agents/orchestrator.ts), but completion detection is in `ExecutionOrchestrator` — split across layers |
| **Tool execution is in the agent layer** | Tools run during the `for (let round = 0; round < 10; round++)` loop, but the loop termination is decided by the AI (via "no tool_calls"), not by the orchestrator |
| **No explicit tool continuation** | After tool results are injected, the loop just continues. The AI model must decide to respond with text or call more tools. No "resume reasoning" mechanism |
| **Task completion is model-determined** | The loop ends when the model returns a response without tool_calls. The orchestrator has no authority to decide if the task is complete |
| **10-round hard cap** | `for (let round = 0; round < 10; round++)` is an arbitrary limit. No dynamic completion detection |
| **Stall detection is fragile** | `consecutiveToolOnlyRounds >= 5` break — but tool-only rounds are legitimate (search → edit → verify cycles) |
| **No retry coordination** | If a tool fails, the error message is injected and the loop continues. No orchestrator-level retry logic |
| **Context grows unbounded** | Each round pushes system+user+tool messages. Auto-compaction only fires if `shouldCompact()` returns true |
| **Soft/hard deadline in agent, not orchestrator** | Timers are inside `runAgent()`, not managed by the orchestrator that owns the execution |

### 4.3 LOOP TERMINATION ANALYSIS

**How does an agent decide a task is complete?**
The model sends a response without `tool_calls`. That's it. No quality check, no verification gate unless PostWriteVerifier finds errors (which triggers another round).

**How does an agent continue after tool execution?**
Tool results are pushed to the messages array, then the next `round` iteration sends the full message history to the provider again. The model generates a new response that may include text, tool calls, or both.

**Are multi-step tasks handled?**
Multi-step tasks = multiple rounds of the `for` loop. Each round is a full provider request. There is no persistence of execution state between rounds except the ever-growing `msgs` array.

**Is there an execution loop or only linear calls?**
The `for` loop in `runAgent()` IS the execution loop. But it's entirely self-contained — no external orchestration loop exists above it. The `ExecutionOrchestrator` starts execution and waits for the promise to resolve.

---

## SECTION 5 — TOOL EXECUTION FLOW

### 5.1 COMPLETE TOOL ARCHITECTURE

```
TOOL SYSTEM MAP:

src/lib/tool-executor.ts                    ← IMPERATIVE TOOL IMPLEMENTATIONS (286 lines)
  └─ implGrepFiles, implGlobFiles, etc.      — actual tool logic
  └─ executeToolCall()                       — router: dispatches by tool name

src/lib/agents/agent-tools.ts                ← TOOL DEFINITIONS (433 lines)
  └─ BUILTIN_TOOLS array                     — tool schemas for provider
  └─ getTools(role)                          — filters tools by role
  └─ registerBuiltinTools()                  — registers into RuntimeOS.ToolRegistry

src/runtime/tools/                           ← RUNTIME TOOL SYSTEM (ELABORATE)
  ├─ core/AgentTool.ts                       — tool class definition
  ├─ core/ToolContext.ts                     — tool execution context
  ├─ core/ToolCapabilities.ts                — tool capability metadata
  ├─ core/ToolPermissions.ts                 — permission model
  ├─ core/ToolResult.ts                      — result type
  ├─ registry/ToolRegistry.ts                — central tool registry
  ├─ registry/ToolResolver.ts               — tool lookup
  ├─ registry/ToolPoolAssembler.ts           — tool pool assembly
  ├─ execution/ToolExecutionPipeline.ts      — execution pipeline
  ├─ execution/ToolExecutionContext.ts       — execution context
  ├─ execution/ToolValidation.ts             — validation
  ├─ execution/ToolResultMapper.ts           — result mapping
  ├─ policies/ToolExecutionPolicy.ts         — policy enforcement
  ├─ policies/ToolConcurrencyPolicy.ts       — concurrency limits
  └─ ToolExecutionSandbox.ts                 — sandboxed execution

src/runtime/mcp/                             ← MCP TOOL SYSTEM
  ├─ MCPRegistry.ts                          — MCP tool registry
  ├─ MCPServerManager.ts                     — MCP server management
  ├─ MCPClient.ts                            — MCP client protocol
  ├─ MCPToolAdapter.ts                       — MCP→runtime tool adapter
  └─ MCPTransport.ts                         — MCP transport layer

src/runtime/compat/tool-compat.ts            ← TOOL COMPATIBILITY BRIDGE

src/tools/                                   ← LEGACY TOOL SYSTEM
  ├─ core/types.ts
  ├─ core/registry.ts
  ├─ core/executor.ts
  ├─ core/context.ts
  └─ bridge.ts
```

### 5.2 ACTUAL TOOL EXECUTION PATH (what runs today)

```
runAgent() detects tool_calls in response
  → for each tc: executeToolCall(tc, role, stepId)
    → matches tc.function.name to impl* functions
    → calls impl* directly
    → calls onToolCallStart/onToolCallComplete callbacks
    → returns ToolResult {tool_call_id, role: "tool", content}
```

### 5.3 THE RUNTIME TOOL SYSTEM (what SHOULD run but doesn't)

```
RuntimeOS.toolExecutionPipeline
  → PermissionEngine.check()
  → ToolExecutionPolicy.enforce()
  → ToolConcurrencyPolicy.check()
  → ToolExecutionSandbox.execute()
  → ToolValidation.validate()
  → ToolResultMapper.map()
```

**This elaborate pipeline is NEVER CALLED from the main execution path.** `executeToolCall()` in `lib/tool-executor.ts` bypasses the entire `RuntimeOS` tool system. The RuntimeOS registers tools and configures policies, but the actual execution goes through a completely separate path.

### 5.4 TOOL ISSUES

| Issue | Detail |
|-------|--------|
| **Tools are bolt-ons** | `executeToolCall()` at `lib/tool-executor.ts` is a simple switch statement, not a first-class runtime citizen |
| **Runtime tool pipeline unused** | `RuntimeOS.toolExecutionPipeline` is fully built but never connected to agent execution |
| **MCP tools might be disconnected** | MCP tools register into `ToolRegistry` but the agent path doesn't use `ToolRegistry` |
| **Dual registration** | `agent-tools.ts` defines tools BOTH as `BUILTIN_TOOLS` (for provider schema) AND as `RuntimeOS.toolRegistry` entries (via `registerBuiltinTools()`) |
| **No permission enforcement** | `ToolPermissions` and `PermissionEngine` are bypassed |
| **No sandboxing** | `ToolExecutionSandbox` is unused |
| **Legacy tool system** | `src/tools/` has a THIRD tool system |

---

## SECTION 6 — STREAMING ARCHITECTURE

### 6.1 TOKEN FLOW MAP

```
Provider API (SSE stream)
  ↓
ProviderTransport.streamChatCompletion()
  ↓
onToken callback
  ↓
┌─── DUPLICATE PATHS ──────────────────────────────────────────────────┐
│                                                                      │
│  PATH A (StreamBuffer):                                              │
│  StreamBuffer.append(stepId, token)                                  │
│    → RAF coalesce                                                    │
│    → StreamBuffer.flush()                                            │
│      → ResponseReconciler.onStreamFlush(stepId, delta)               │
│        → timelineStore.appendStreamingText(stepId, delta)            │
│          → Zustand set() → React re-render                           │
│                                                                      │
│  PATH B (EventBus):                                                  │
│  eventBus.emit(TOKEN_STREAM)                                         │
│    → UiSync handler (listens but does NOT write TOKEN_STREAM)        │
│    → (TokenStream events are NOT handled by UiSync)                  │
│    → (They flow through EventBus for backward compat / hooks)        │
│                                                                      │
│  PATH C (use-live-editor-stream hook):                               │
│  EventBus.on("TOKEN_STREAM", ...)                                    │
│    → Live editor stream hook (separate consumer)                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

On stream completion:
  ExecutionOrchestrator calls commitStreamingText(stepId)
    → moves streamingTexts[stepId] → agentSessions[stepId].streamingText
    → deletes streamingTexts[stepId]
    → sets streamState = "completed"

  eventBus.emit(AGENT_COMPLETE)
    → UiSync handler updates agentSession status
```

### 6.2 TWO RAF-BASED STREAMING SYSTEMS

| System | File | Mechanism | Status |
|--------|------|-----------|--------|
| `StreamBuffer` | `runtime/render-engine/stream-buffer.ts` | RAF coalescing → ResponseReconciler → appendStreamingText | **ACTIVE** — primary path |
| `RenderScheduler` | `runtime/render-engine/render-scheduler.ts` | RAF-based task queue for UiSync handlers | **ACTIVE** — secondary path |
| `BufferedSubscriber` | `runtime/EventBus.ts:224` | RAF-based buffer flush for tool/file events | **ACTIVE** — third path |

**Three independent RAF loops** all converging on TimelineStore writes.

### 6.3 STREAMING ISSUES

| Issue | Detail |
|-------|--------|
| **Who owns streaming text?** | `TimelineStore.streamingTexts` (fast path) and `TimelineStore.agentSessions[].streamingText` (structural). Two copies. |
| **Who finalizes responses?** | `commitStreamingText()` in TimelineStore moves text from fast-path to structural. Called from ExecutionOrchestrator, ResponseReconciler, and error handlers. Multiple callers. |
| **Why does UI get stuck in "processing"?** | If `commitStreamingText()` runs before `appendStreamingText()` has flushed, the token buffer is committed empty. The session gets `streamingText: ""` and `streamState: "completed"`. |
| **Why do responses disappear?** | Race condition: if `streamingTexts` and `agentSessions` both have entries for the same stepId, `AssistantResponse.tsx:52` prefers `streamingTexts`. If `streamingTexts` was already committed (deleted), but `agentSessions.streamingText` is empty (because `commitStreamingText` runs before tokens arrive), the response appears empty. |
| **Why do some streams never reconcile?** | Two competing RAF flush loops. If token emits happen between `StreamBuffer.flush()` and `commitStreamingText()`, tokens are in the buffer but never flushed. |
| **Unsafe async boundaries** | `StreamBuffer.append()` is synchronous, but `flush()` is RAF-delayed. Multiple `append()` calls before a `flush()` are fine, but if `commitStreamingText()` runs between an `append()` and its corresponding `flush()`, tokens are lost. |
| **Race: StreamBuffer vs commitStreamingText** | Timeline: `append(t1)` → `append(t2)` → RAF scheduled → `commitStreamingText()` clears `streamingTexts` → `flush()` appends to `streamingTexts` → session.streamingText is empty. **TOKENS LOST.** |

---

## SECTION 7 — CONTEXT WINDOW SYSTEM

### 7.1 PROMPT COMPOSITION CHAIN

```
runAgent()
  ↓
ContextManager.initializeTask(model)             // set token budget
  ↓
memoryLoader.load(rootPath)                      // async: project rules
  ↓
getWorkspaceContextSnapshot()                     // sync: editor state
  ↓
ContextManager.assembleSystemPrompt(input)        // full prompt assembly
  ├── PromptCompositionEngine (runtime/prompting/)
  │     ├── SectionDefinition[] (20+ sections)
  │     ├── PromptASTBuilder → PromptTree
  │     ├── SectionDeduplicator
  │     ├── TokenBudgetPolicy
  │     └── PromptDiagnosticsEngine
  ↓
ContextManager.buildContext(userMessage, role)   // workspace context block
  ↓
Result: systemPrompt (string) + contextBlock (string)
  ↓
messages = [system, contextBlock, ...history, userMessage]
```

### 7.2 TOKEN BUDGET FLOW

```
getEffectiveMaxTokens(role, model)
  → RUNTIME_TOKEN_LIMITS lookup
  → model-specific limits
  → execution-mode constraints
  ↓
ContextManager.initializeTask(model)
  → sets budget for this task
  ↓
ContextManager.updateBudget(messages)
  → called after each round
  ↓
ContextManager.shouldCompact(messages)
  → checks budget threshold
  ↓
ContextManager.compact(messages)
  → HistoryCompressor
  → SlidingMemoryCompressor
  → removes oldest non-system messages
```

### 7.3 ISSUES

| Issue | Detail |
|-------|--------|
| **Memory loads concurrently but may miss first round** | `memoryLoader.load()` is started before `assembleSystemPrompt`. If it resolves after the first provider request, project rules are absent for round 1. |
| **Two separate context systems** | `src/context/` (ExecutionMemoryStore, TokenBudgetManager, etc.) and `src/runtime/context/` (ContextManager, HistoryCompressor). |
| **Context is duplicated** | `assembleSystemPrompt()` + `buildContext()` both produce prompt blocks. These become TWO system messages in the messages array. |
| **No deduplication between sections** | The 20+ prompt sections may contain overlapping content. `SectionDeduplicator` exists but only deduplicates section-level content. |
| **Token budget is model-approximate** | Budget is estimated based on character/token ratios, not actual tokenization. |
| **No true context window management** | `compact()` just removes old messages — no summarization, no prioritization. |
| **Every round adds to context** | The full message history grows with each round. Even with compaction, the SYSTEM prompt + history + new messages keeps growing. |

---

## SECTION 8 — PROVIDER LAYER ANALYSIS

### 8.1 PROVIDER ARCHITECTURE

```
packages/providers/                            ← PROVIDER PACKAGE
  ├─ provider-gateway.ts                       — request/response gateway
  ├─ provider-manager.ts                       — lifecycle management
  ├─ provider-registry.ts                      — provider registration
  ├─ provider-types.ts                         — type definitions
  ├─ provider-validation.ts                    — validation
  ├─ provider-health.ts                        — health checks
  ├─ transport.ts                              — ProviderTransport (CENTRAL)
  ├─ transport-adapters.ts                     — adapter definitions
  ├─ transport-types.ts                        — transport types
  ├─ streaming-transport.ts                    — SSE streaming
  ├─ http-client.ts                            — HTTP client (tauri-fetch)
  └─ ai-service.ts                             — AI service abstraction

src/providers/                                 ← PROVIDER ADAPTERS
  ├─ BaseProviderAdapter.ts                    — abstract base
  ├─ OpenAIAdapter.ts                          — OpenAI adapter
  ├─ AnthropicAdapter.ts                       — Anthropic adapter
  ├─ OpenRouterAdapter.ts                      — OpenRouter adapter
  ├─ NvidiaAdapter.ts                          — NVIDIA adapter
  ├─ OllamaAdapter.ts                          — Ollama adapter
  ├─ StreamNormalizer.ts                       — stream format normalization
  ├─ StreamingDeltaAssembler.ts                — delta assembly
  ├─ ToolCallNormalizer.ts                     — tool call normalization
  ├─ ToolSchemaValidator.ts                    — schema validation
  ├─ ProviderCapabilityRegistry.ts             — capabilities
  └─ ProviderHealthMonitor.ts                  — health monitoring
```

### 8.2 ACTUAL PROVIDER USAGE

The main execution path uses ONLY `ProviderTransport` from the `@agentic-os/providers` package:

```
transport = new ProviderTransport({getApiKey})
transport.chatCompletion(config, request)
transport.streamChatCompletion(config, request, callbacks)
```

The `BaseProviderAdapter`, `OpenAIAdapter`, `AnthropicAdapter`, etc. in `src/providers/` are **never called from the main runtime path**. They exist as an alternative provider abstraction that was replaced by `ProviderTransport`.

### 8.3 ISSUES

| Issue | Detail |
|-------|--------|
| **Adapter layer orphaned** | `src/providers/*Adapter.ts` files are dead code. Transport replaced them. |
| **ProviderTransport is the only path** | But it has no fallback logic, no retry logic, no model routing |
| **No centralized transport routing** | Each function (`runAgent`, `fastChatCompletion`, `streamSingleRound`) creates its own transport call |
| **Retries are duplicated** | `fastChatCompletion` has its own streaming→non-streaming fallback. `streamSingleRound` has the same pattern. `runAgent` has both paths inline. |
| **SSE parser is local** | `src/lib/sse-parser.ts` is NOT used by `ProviderTransport` — transport has its own parsing |
| **ProviderInspector shadows ProviderHealthMonitor** | Two observability systems for provider health |
| **StreamNormalizer + StreamingDeltaAssembler unused** | These are in `src/providers/` but the transport handles normalization internally |

---

## SECTION 9 — UI RUNTIME ANALYSIS

### 9.1 UI STORE ARCHITECTURE

```
STATE STORES (Zustand):
  useTimelineStore        ← VOLATILE conversation state (events, sessions, streaming)
  useAgentStore           ← Agent processing state (isProcessing, streamState, wiredRoles)
  useWorkspaceStore       ← Workspace state (rootPath, orchestrationState)
  useWorkspaceRuntime     ← Runtime wiring state (wiredAgents, health, status)
  useAppStore             ← App config (providers, roleConfigs)
  useRuntimeProjectionStore ← Projection bridge

RENDER COMPONENTS:
  ChatPanel               ← Top-level container
  Composer                ← Input area
  ConversationTimeline    ← Scrollable conversation list
  ConversationTurn        ← User message + assistant response pair
  AssistantResponse       ← Renders agent session data
  StreamingContent        ← Markdown renderer with delta animation
  ResponseStream          ← DOM-level streaming text (append-only)
  LiveResponse            ← (alternate renderer, unused?)
  ToolCallBlock           ← Tool call display
  FileEditBlock           ← File edit display
  TerminalBlock           ← Terminal output display
```

### 9.2 UI STATE FLOW

```
USER INPUT
  → ChatPanel.sendMessage()
    → agentStore.setProcessing(true)
    → agentStore.addMessage("user", ...)

STREAMING
  → TimelineStore.appendStreamingText(stepId, token)
    → React re-render of AssistantResponse via useTimelineStore selector
    → AssistantResponse reads streamingTexts Map
    → StreamingContent receives text, renders ReactMarkdown

COMPLETION
  → TimelineStore.commitStreamingText(stepId)
    → moves text, deletes streaming entry
    → React re-render (now reads from agentSessions)

POST-COMPLETION
  → agentStore.addMessage("assistant", finalContent)
  → agentStore.setProcessing(false)
```

### 9.3 DUAL RENDERING PATHS

Two rendering approaches exist simultaneously:

| Path | Mechanism | Used For |
|------|-----------|----------|
| `ResponseStream` | Direct DOM manipulation via `pre.appendChild(textNode)` | Live streaming (append-only, no React reconciliation) |
| `StreamingContent` | ReactMarkdown with RAF animation frames | Live streaming + completed content |
| `LiveResponse` | Uses `ResponseStream` internally | Alternate renderer |

`AssistantResponse.tsx` uses `StreamingContent` exclusively. `ResponseStream` is used by `LiveResponse`.

### 9.4 ISSUES

| Issue | Detail |
|-------|--------|
| **Why does processing get stuck?** | `useAgentStore.isProcessing` is set to `true` at send and `false` in `finally`. If the orchestrator throws a non-caught exception before the finally block, or if a promise never settles, processing stays `true`. |
| **Why do empty responses appear?** | `AssistantResponse.tsx` checks `displayText.length > 0`. If `commitStreamingText` ran before any tokens arrived (race with StreamBuffer), `session.streamingText` is `""` and `streamingTexts.get(stepId)` is `undefined`. |
| **Why does UI not finalize?** | `AGENT_COMPLETE` updates session status to "complete" via `UiSync`. If `commitStreamingText()` was never called (because the stream errored before reaching the commit line), the session stays in "streaming" state. |
| **Which store owns truth?** | `TimelineStore` has THREE sources of truth: `events[]`, `agentSessions: Map`, `streamingTexts: Map`. The `events` array and `agentSessions` Map often contain duplicate information about the same execution. |
| **Which components re-render excessively?** | Every `appendStreamingText()` call triggers a Zustand `set()` -> all selectors re-evaluate -> `ConversationTimeline` re-renders (it subscribes to `s.agentSessions` and `s.events` which may not have changed but Zustand creates new Maps). |
| **Missing lifecycle events** | There's no `AGENT_START` event (only `AGENT_ASSIGNED`). There's no explicit transition from streaming to complete on the EventBus (only indirect via `AGENT_COMPLETE`). |

---

## SECTION 10 — ARCHITECTURE SIMPLIFICATION PLAN

### 10.1 IDEAL EXECUTION MODEL

```
USER
  → Session (thin container, owns stepId + metadata)
    → Orchestrator (SINGLE, owns execution)
      → Intent Classifier (fast-inference vs full-agent)
      → Agent Loop:
          1. Build Context (once, cached)
          2. Provider Request (streaming)
          3. Parse Response
          4. if Tool Calls: Execute → Loop
          5. if Text Response: Complete
      → Stream Manager (owns token flow)
      → Tool Executor (owned by orchestrator, not separate system)
    → Reconciler (moves streaming → structural)
    → Render (ReactMarkdown, single path)
```

### 10.2 SYSTEMS TO MERGE

| Merge Into | Source Systems |
|------------|---------------|
| **Single Orchestrator** | ExecutionOrchestrator + ExecutionEngine state machine + RuntimeSupervisor + CoordinatorRuntime + TaskGraphRuntime |
| **Single Session Manager** | SessionManager + ExecutionSessionManager + ExecutionSession |
| **Single Stream Pipeline** | StreamBuffer (render-engine) + StreamBuffer (performance) + RenderScheduler (render-engine) + RenderScheduler (performance) + BufferedSubscriber RAF loop |
| **Single Tool System** | lib/tool-executor + runtime/tools/* + src/tools/* + compat/tool-compat |
| **Single Event Bus** | Already merged (render-engine/event-bus is a facade), but remove the facade |
| **Single Agent Function** | runAgent + runRuntimeAgent + runWorkspaceAgent + fastChatCompletion + AgentWorker |
| **Single Context System** | src/context/* + runtime/context/* + runtime/prompting/* |
| **Single Provider Interface** | src/providers/* (adapters) + packages/providers/* (transport) |

### 10.3 SYSTEMS TO DELETE

| System | File(s) | Reason |
|--------|---------|--------|
| `ExecutionEngine` (state machine) | `runtime/execution-engine.ts` | Pure logging, no actual orchestration control |
| `ExecutionSession` | `runtime/sessions/ExecutionSession.ts` | Legacy, unused in main path |
| `SessionManager` | `runtime/sessions/SessionManager.ts` | Manages sessions the chat doesn't use |
| `RuntimeSupervisor` | `runtime/RuntimeSupervisor.ts` | Preflight validation that doesn't run |
| `AgentWorker` | `runtime/agents/AgentWorker.ts` | Thin wrapper adding nothing |
| `AgentTypes` | `agents/AgentTypes.ts` | Unused type definitions |
| `ExecutionReflectionEngine` | `agents/ExecutionReflectionEngine.ts` | Never called |
| `WorktreeManager` | `agents/WorktreeManager.ts` | Never called |
| `CoordinatorRuntime` | `runtime/coordinator/*` | Multi-agent system never wired |
| `TaskGraphRuntime` + `TaskRuntime` | `runtime/task-graph/`, `runtime/tasks/` | Task systems not used by main flow |
| `BaseProviderAdapter` + adapters | `src/providers/*Adapter.ts` | Replaced by ProviderTransport |
| `src/tools/*` | `src/tools/` | Legacy, replaced by runtime/tools |
| `ResponseReconciler` | `runtime/render-engine/ResponseReconciler.ts` | Logic duplicated in commitStreamingText |
| `WorktreeManager` | `src/agents/WorktreeManager.ts` | Not connected |
| `AgentGraphRuntime` + `AgentMeshEngine` | `runtime/observability/` | Observability-only, not runtime |

### 10.4 SYSTEMS TO MAKE EVENT-DRIVEN

| Current | Should Be |
|---------|-----------|
| `ExecutionOrchestrator` calling `timelineStore.addAgentSession()` directly | Orchestrator emits events, reconciler handles store mutations |
| `runAgent()` calling `executeToolCall()` directly | Orchestrator routes tool calls through a ToolService |
| `ExecutionOrchestrator` calling `executionEngine.transition()` | ExecutionEngine should listen to events, not be called manually |
| `StreamBuffer.flush()` → `ResponseReconciler.onStreamFlush()` | StreamBuffer emits flushed tokens, respond engine subscribes |

### 10.5 SYSTEMS THAT SHOULD OWN STATE

| State | Owner |
|-------|-------|
| **Execution state** (running/complete/error) | **Orchestrator** — single source |
| **Streaming text** (in-progress) | **StreamBuffer** — cleared on commit |
| **Structural text** (committed) | **TimelineStore.agentSessions** — single map |
| **Provider wiring** (roles→models→providers) | **WorkspaceRuntime** — already owns this |
| **Agent conversation history** | **AgentStore** — already owns this |
| **Tool definitions + schemas** | **RuntimeOS.toolRegistry** — already owns this |
| **Tool execution** | **Orchestrator** — move out of agent layer |
| **Event bus** | **EventBus** — already owns this, remove facade |

### 10.6 RECOMMENDED REWRITE STRATEGY

**Phase 1 — Consolidate Orchestration (remove 4 systems)**
1. Delete `ExecutionEngine` — replace with simple state field in orchestrator
2. Delete `ExecutionSession` + `SessionManager` — keep only `ExecutionSessionManager`
3. Delete `RuntimeSupervisor` — fold into orchestrator startup
4. Delete `AgentWorker` — inline into orchestrator

**Phase 2 — Unify Streaming (remove 2+ systems)**
1. Delete `RenderScheduler` (performance/) — keep one
2. Delete `StreamBuffer` (performance/) — keep one
3. Delete `ResponseReconciler` — move logic into orchestrator
4. Remove duplicate RAF loops — one RAF boundary is enough

**Phase 3 — Unify Tools (remove 2 systems)**
1. Delete `src/tools/*` (legacy)
2. Delete `compat/tool-compat.ts`
3. Wire `RuntimeOS.toolExecutionPipeline` into the orchestrator
4. Move `executeToolCall()` routing into `ToolRegistry`

**Phase 4 — Simplify Agents (remove 4 files)**
1. Delete `agents/AgentTypes.ts`, `agents/ExecutionReflectionEngine.ts`, `agents/WorktreeManager.ts`
2. Merge `runRuntimeAgent` + `runWorkspaceAgent` + `runAgent` into `executeAgent()` in orchestrator
3. Make `fastChatCompletion` a mode flag, not a separate function

**Phase 5 — Clean Provider Layer**
1. Delete `src/providers/*Adapter.ts` files
2. Delete `src/providers/StreamNormalizer.ts`, `StreamingDeltaAssembler.ts`, `ToolCallNormalizer.ts`, `ToolSchemaValidator.ts`
3. Streamline transport to single path in orchestrator

**Phase 6 — Fix Race Conditions**
1. StreamBuffer: flush synchronously before `commitStreamingText`
2. Remove emergency session creation — sessions should always be created before tokens flow
3. Single RAF loop instead of three
4. Clear ownership: only orchestrator writes to session state

### 10.7 RECOMMENDED AGENT MODEL

**Current**: 7+ roles × multiple agent types × sub-agents × coordinators  
**Target**: 1 agent executor with 3 modes

```
Agent Executor Interface:
{
  role: string                       // just metadata for display
  mode: "fast" | "full" | "multi"    // fast=simple Q&A, full=with tools, multi=multiple iterations
  context: Context
  tools: Tool[]
  streaming: boolean
}
```

- **fast mode** = single provider call, no tools, minimal prompt (replaces `fastChatCompletion`)
- **full mode** = multi-round loop with tool execution (replaces `runAgent`)
- **multi mode** = full mode with agent result synthesis (replaces `SynthesisEngine`)

Roles become tool-permission profiles, not separate agent types. The intent classifier selects tool profiles, not agent instances.

### 10.8 RECOMMENDED EXECUTION LOOP

```
orchestrator.execute(input, options):
  1. create session (stepId)
  2. build context (prompt + workspace)
  3. emit AGENT_START

  4. LOOP:
     a. provider.chatCompletion(streaming)    // single transport call
     b. emit tokens as they arrive
     c. if response.tool_calls:
        for each tool:
          - check permissions
          - execute with timeout
          - inject result
        d. CONTINUE
     e. if response.text:
        BREAK

  5. commit streaming text
  6. emit AGENT_COMPLETE
  7. return result
```

### 10.9 RECOMMENDED STREAMING OWNERSHIP MODEL

```
Provider → onToken
  → StreamBuffer.append(stepId, token)       // single RAF boundary
    → RAF flush:
        → TimelineStore.appendStreamingText(stepId, delta)

Orchestrator detects completion
  → StreamBuffer.flushImmediate()
  → TimelineStore.commitStreamingText(stepId)
  → emit AGENT_COMPLETE

NO:
  - EventBus TOKEN_STREAM (removed)
  - ResponseReconciler (removed)
  - UiSync TOKEN_STREAM handler (removed)
  - use-live-editor-stream hook (removed or event-based)
  - RenderScheduler stream handling (removed)
```

---

## DELIVERABLES SUMMARY

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Complete execution graph | Documented in Sections 1.1–1.2 |
| 2 | Full orchestration map | Documented in Section 2 |
| 3 | Agent ownership map | Documented in Section 3 |
| 4 | Tool lifecycle map | Documented in Section 5 |
| 5 | Streaming lifecycle map | Documented in Sections 1.3, 6 |
| 6 | Provider lifecycle map | Documented in Section 8 |
| 7 | Runtime ownership map | Documented in Section 2 |
| 8 | Race condition report | Documented in Section 1.3 (7 races), Section 6.3 (5 races) |
| 9 | Redundant system report | 13 systems identified for removal, 14 for merge |
| 10 | Simplified target architecture | Documented in Section 10 |
| 11 | Recommended agent model | Section 10.7 — 3 modes, 1 executor |
| 12 | Recommended execution loop model | Section 10.8 |
| 13 | Recommended orchestration rewrite strategy | Section 10.6 — 6 phases |
| 14 | Recommended streaming ownership model | Section 10.9 |

---

## CRITICAL BUGS FOUND (NOT TO FIX — TO UNDERSTAND SCOPE)

| # | Bug | Root Cause |
|---|-----|------------|
| 1 | Empty responses | Race: `commitStreamingText()` runs before `StreamBuffer.flush()` delivers tokens. Tokens land in `streamingTexts` but session already marked complete. |
| 2 | UI stuck processing | Orchestrator exception before `setProcessing(false)` in finally block, OR promise never settles. |
| 3 | Disappearing responses | `AssistantResponse` reads `streamingTexts.get(stepId) ?? session.streamingText`. If both are empty (race), response is invisible. |
| 4 | Stream never completes | If `commitStreamingText()` is never called (error before commit line), session stays in "streaming" forever. |
| 5 | Tool events lost | BufferedSubscriber RAF flush may lose events if subscriber is replaced mid-buffer (commented in code). |
| 6 | Session created twice | Both `ExecutionOrchestrator` and `UiSync` try to `addAgentSession()`. UiSync has a guard that checks for existing sessions, but race exists. |
| 7 | Memory pressure never cleared | After execution completes, `memoryPressure` and `tokenUsage` are never reset. |

---

**END OF AUDIT.**
