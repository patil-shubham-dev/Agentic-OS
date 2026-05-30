# AgenticOS — Runtime Ownership & Dependency Report

> Generated: 2026-05-29
> Method: Static dependency analysis + runtime path tracing
> NOT an implementation document — this is a map of the currently executing system

---

## 1. COMPLETE EXECUTION FLOW: User Message → Response

### Entry Point

```
UID:  ChatPanel.tsx
  User types → onSend(input)
  │
  ├─ agentStore.addMessage(activeRole, { role:"user", content })
  ├─ agentStore.setProcessing(true)
  └─ executionSessionManager.start({ input, activeRole })
```

### Session Layer

```
UID:  ExecutionSessionManager.start()
  │
  ├─ Creates ExecutionSession (thin session wrapper)
  ├─ Emits: EventBus → EXECUTION_STATE_CHANGE (state: "running")
  └─ Calls: ExecutionOrchestrator.execute({ input, activeRole })
```

### Orchestration Layer

```
UID:  ExecutionOrchestrator.execute()
  │
  ACTIVE FILE: src/runtime/execution/ExecutionOrchestrator.ts (557 lines)
  │
  ├─ Creates AbortController (cancellation), traceId
  ├─ startTrace(traceId)
  │
  ├─ Emit: EventBus → USER_MESSAGE
  │   └─ UiSync → timelineStore.addEvent({ type: "user-message" })
  │
  ├─ Read: workspaceRuntime.getState()  → status, wiredAgents, wiredRoles
  ├─ Read: appStore.getState()         → providers[]
  │
  ├─ assignAgentForTask(input, wiredRoles)
  │   ├─ managerRoute(input, roles) → RoutingDecision
  │   │   ACTIVE FILE: src/runtime/manager-routing-engine.ts (220 lines)
  │   │   Rule-based regex intent classification — NO LLM call
  │   ├─ applyModeConstraints() → filtered roles
  │   ├─ agentStore.addAgentAssignment()
  │   ├─ agentStore.addOrchestrationStep()
  │   ├─ workspaceStore.setOrchestrationState("executing"/"analyzing")
  │   └─ Emit: EventBus → ROUTING_DECISION
  │       └─ UiSync → timelineStore.addEvent({ type: "manager-routing" })
  │
  ├─ Validation: runtime initialized? agents configured? manager wired?
  │
  ├─ resolveMode(decision) → FAST | FULL | MULTI
  │
  ├── BRANCH A: FAST (no tools)
  │   └─ handleDirectResponse()
  │       ├─ findWiredAgent → resolve endpoint/apiKey/model
  │       ├─ timelineStore.addAgentSession({ stepId, roleId, ... })
  │       ├─ Emit: EventBus → AGENT_ASSIGNED
  │       ├─ StreamManager.init()
  │       ├─ fastChatCompletion(endpoint, apiKey, model, input, history, signal, onToken)
  │       │   ACTIVE-LEGACY FILE: src/lib/agents/orchestrator.ts (function ~line 564)
  │       │   ProviderTransport.streamChatCompletion/chatCompletion — NO tools
  │       │   onToken(token): streamManager.append(stepId, token)
  │       ├─ commitStream(stepId, content)
  │       ├─ Emit: EventBus → AGENT_COMPLETE
  │       └─ agentStore.addMessage(activeRole, { role: "assistant", content })
  │
  └── BRANCH B: FULL | MULTI (tools enabled)
      └─ handleDelegatedExecution()
          ├─ For each selectedRole:
          │   ├─ resolveAgentConfig(role) → { endpoint, apiKey, model, providerId }
          │   ├─ timelineStore.addAgentSession({ stepId, ... })
          │   ├─ Emit: EventBus → AGENT_ASSIGNED
          │   ├─ Build agentCallbacks:
          │   │   onStreamChunk → StreamManager.append() + TOKEN_STREAM emit
          │   │   onToolCallStart → TOOL_START emit
          │   │   onToolCallComplete → TOOL_COMPLETE emit
          │   │   onFileEdit → FILE_EDIT emit
          │   │   onModelDetected → MODEL_DETECTED emit
          │   ├─ Build roleSpecificInput = input + ContextManager.buildContext()
          │   ├─ AgentExecutor.execute({
          │   │     mode, role, input, history, signal, callbacks
          │   │   })
          │   │   ACTIVE FILE: src/runtime/agents/AgentExecutor.ts (463 lines)
          │   │   ├─ resolveAgentConfig(role)
          │   │   ├─ ContextManager.assembleSystemPrompt()
          │   │   ├─ ContextManager.buildContext()
          │   │   ├─ runtimeOS.toolRegistry.getAllBuiltin() → agentToolsToToolDefs()
          │   │   ├─ LOOP (max 10 rounds):
          │   │   │   ├─ ProviderTransport.streamChatCompletion() with tools
          │   │   │   ├─ If tool_calls:
          │   │   │   │   pipeline.execute(toolName, args, ctx)
          │   │   │   │   PostWriteVerifier.verify()
          │   │   │   │   ContextManager.compact()
          │   │   │   └─ Else: break
          │   │   └─ Return { response, messages, usage, toolCallCount }
          │   ├─ StreamManager.flushImmediate() + commitStream()
          │   ├─ Emit: EventBus → AGENT_COMPLETE
          │   └─ If streamedContent: push to agentResults[]
          │
          ├─ IF MULTI mode + multiple results:
          │   ├─ SynthesisEngine.synthesize(input, agentResults, history)
          │   │   ACTIVE FILE: src/runtime/execution/SynthesisEngine.ts
          │   │   Creates AgentExecutor({ mode:"FULL", role:"manager" })
          │   │   to synthesize all agent outputs into one response
          │
          ├─ Emit: EventBus → EXECUTION_SUMMARY
          │   └─ UiSync → timelineStore.addEvent({ type: "execution-summary" })
          │
          └─ Return ExecuteResult{ success, failures, filesEdited, ... }

### Post-Execution

```
ExecutionSessionManager:
  ├─ session.status = success ? "completed" : "error"
  └─ Emit: EXECUTION_STATE_CHANGE (state: "complete"/"error")

ChatPanel:
  └─ agentStore.setProcessing(false)

UI Re-render:
  ├─ ConversationTimeline reads timelineStore.events + agentSessions
  └─ AssistantResponse per session: streaming text, tools, files, terminals
```

---

## 2. COMPLETE STREAMING FLOW

### Token Production

| Source | Path | File |
|--------|------|------|
| **FULL/MULTI path** | `AgentExecutor.executeFull()` → `ProviderTransport.streamChatCompletion(onToken)` | `AgentExecutor.ts:269-295` |
| **FAST path** | `fastChatCompletion()` → `ProviderTransport.streamChatCompletion(onToken)` | `orchestrator.ts:606-624` |
| **Sub-agent path** | `sub-agent-delegator.ts` → `streamChatCompletion()` standalone function | `sub-agent-delegator.ts:340-355` |

### Token Pipeline

```
Provider sends token via SSE
  │
  └─ onToken(token) callback
      │
      ├─► StreamManager.append(stepId, token)
      │   └─ Pushes to StepStream.tokens[] array
      │   └─ RAF coalesces flushes (~16ms frame)
      │       └─ flush() → joins tokens per stepId
      │           └─ flushCallback(stepId, delta)
      │               └─ timelineStore.appendStreamingText(stepId, delta)
      │                   └─ Zustand streamingTexts Map updated
      │                       └─ React re-render (AssistantResponse via selector)
      │
      └─► EventBus.emit({ type: "TOKEN_STREAM", stepId, token })
          └─ Consumed ONLY by:
              └─ useLiveEditorStream hook (live code-block injection into Monaco)
                  └─ NOT consumed by timeline UI path
```

### Token Completion

```
AgentExecutor completes round
  │
  ├─ StreamManager.flushImmediate() — synchronously flush remaining tokens
  └─ commitStream(stepId, finalContent)
      ├─ StreamManager.complete(stepId) → flushImmediate() + mark inactive
      └─ timelineStore.commitStreamingText(stepId)
          ├─ Moves streamingTexts.get(stepId) → agentSession.streamingText
          ├─ Deletes streamingTexts entry
          └─ Sets streamState = "completed"
              └─ React re-render (UI switches from live streaming to committed text)
```

### ANOMALIES IDENTIFIED

1. **TOKEN_STREAM is emitted but ignored by timeline path** — only `useLiveEditorStream` listens for it. The timeline relies entirely on `StreamManager.append()` → RAF → `appendStreamingText()`.

2. **Double flush before commit** — `ExecutionOrchestrator` calls both `flushImmediate()` AND `commitStream()` which internally calls `flushImmediate()` again. Harmless but redundant.

3. **`appendAgentStreamText` is dead code** — defined in `timeline-store.ts:197-208`, never called anywhere.

4. **Two ProviderTransport instances** — one created at module scope in `AgentExecutor.ts` (for FULL/MULTI) and one in `orchestrator.ts` (for FAST path). Both are stateless singletons so this is a minor redundancy.

---

## 3. COMPLETE TOOL EXECUTION FLOW

### Canonical Path (used by AgentExecutor — FULL/MULTI mode)

```
LLM emits tool_calls in response
  │
  └─ AgentExecutor.executeFull() loop (line 333-425)
      │
      ├─ For each tc in responseToolCalls:
      │   ├─ Parse args from JSON
      │   ├─ onToolCallStart callback (→ TOOL_START event)
      │   │
      │   └─ RuntimeOS.toolExecutionPipeline.execute(name, args, ctx)
      │       ACTIVE FILE: src/runtime/tools/execution/ToolExecutionPipeline.ts (135 lines)
      │       │
      │       ├─ registry.resolve(toolName) → AgentTool
      │       │   ACTIVE FILE: src/runtime/tools/registry/ToolRegistry.ts (86 lines)
      │       │   Tools registered via registerBuiltinTools() in RuntimeOS.init()
      │       │   All built-in tools stored in this.tools Map
      │       │
      │       ├─ validator.validate(tool, input, ctx) — schema check
      │       │   ACTIVE FILE: src/runtime/tools/execution/ToolValidation.ts
      │       │
      │       ├─ pre-hooks (if registered)
      │       │
      │       ├─ permissionEngine.evaluate() — NEW permission system
      │       │   ACTIVE FILE: src/runtime/permissions/PermissionEngine.ts
      │       │
      │       ├─ tool.execute(ctx, input) → ToolResult
      │       │   └─ Dispatches via createAgentTool() in agent-tools.ts
      │       │       ACTIVE FILE: src/lib/agents/agent-tools.ts (function ~line 339)
      │       │       └─ dispatcher[toolName]() → impl*(...) in lib/tool-executor.ts
      │       │           ACTIVE FILE: src/lib/tool-executor.ts (impl functions)
      │       │           └─ Tauri invoke() calls for actual work
      │       │
      │       └─ post-hooks (if registered)
      │           └─ Returns ToolResult{ data, error, isError }
      │
      ├─ onToolCallComplete callback (→ TOOL_COMPLETE event)
      ├─ Detect write_file/edit_file → onFileEdit callback (→ FILE_EDIT event)
      ├─ Push ChatMessage{ role:"tool", content: resultString }
      │
      └─ PostWriteVerifier.verify() for edited files
          ACTIVE FILE: src/runtime/PostWriteVerifier.ts
          └─ Runs npx tsc --noEmit + npx eslint
```

### Bypassed Path (executeToolCall — TEST/TEST ONLY)

```
OLD: lib/tool-executor.ts executeToolCall() (lines 201-286)
  ├─ Tries RuntimeOS pipeline (same as above)
  └─ FALLBACK: ToolExecutionSandbox.assertAllowed() + direct impl dispatch
     LEGACY FILE: src/runtime/tools/ToolExecutionSandbox.ts
     — Only called from tests now. Not in main execution path.
```

### Permission Systems — TWO IN PARALLEL

| System | Files | Used By | Status |
|--------|-------|---------|--------|
| `PermissionEngine` | `permissions/PermissionEngine.ts` | `ToolExecutionPipeline` | **ACTIVE** |
| `ToolExecutionSandbox` | `tools/ToolExecutionSandbox.ts` | `implRunCommand()`, old fallback | **LEGACY** |

### Tool Result Mapping — BYPASSED

| Component | Status | Note |
|-----------|--------|------|
| `ToolResultMapper.toBlockParam()` | **INSTANTIATED, NEVER CALLED** | Results formatted inline in AgentExecutor |
| `ToolResultMapper.toSystemMessage()` | **INSTANTIATED, NEVER CALLED** | |
| `ToolResultMapper.truncateForTokenBudget()` | **INSTANTIATED, NEVER CALLED** | |

---

## 4. COMPLETE CONTEXT / PROMPT COMPOSITION FLOW

### Entry Point

```
AgentExecutor.executeFull() (line 179)
  │
  ├─ memoryLoader.load(rootPath)
  │   ACTIVE FILE: src/runtime/project-memory/memory-loader.ts
  │   Reads: CLAUDE.md, CLAUDE.local.md, .agentic-os/memory/rules/*.md
  │
  ├─ getWorkspaceContextSnapshot()
  │   Reads from workspace-store: active file, cursor, selection, open files
  │
  └─ ContextManager.assembleSystemPrompt(input)
      ACTIVE FILE: src/runtime/context/ContextManager.ts
      │
      ├─ CapabilityResolver.resolveFromModel(model)
      │   ACTIVE FILE: src/runtime/prompting/providers/CapabilityResolver.ts
      │
      ├─ defaultContext() → ResolutionContext
      │   Sets: role, mode, provider, capabilities, memory, etc.
      │
      ├─ readWorkspaceContext() → merges workspace snapshot
      │
      ├─ promptRegistry.plan(ctx) → ordered plan
      │   ACTIVE FILE: src/runtime/prompting/registry/PromptRegistry.ts
      │   └─ PromptExecutionPlanner.evaluateWhen() for each section
      │       ACTIVE: src/runtime/prompting/planner/PromptExecutionPlanner.ts
      │
      └─ compositionEngine.compose(plan, ctx) → final prompt text
          ACTIVE FILE: src/runtime/prompting/composition/PromptCompositionEngine.ts
          │
          ├─ Phase 1: Execute 22 sections
          │   (SectionCache + section.compute(ctx) → string)
          ├─ Phase 2: SectionDeduplicator
          ├─ Phase 3: PromptASTBuilder → build tree
          ├─ Phase 4: PromptCompressionEngine
          ├─ Phase 5: TokenBudgetPolicy.applyBudget()
          ├─ Phase 6: PromptTrace diagnostics
          └─ Phase 7: astToString() → serialized prompt
```

### The 22 Prompt Sections

All defined in `src/runtime/prompting/sections/index.ts`. **ACTIVE.**

| Priority | Section | Category |
|----------|---------|----------|
| 0 | agent-identity | core |
| 1 | safety-policy | safety |
| 2 | execution-mission | mission |
| 3 | execution-process | process |
| 4 | execution-mode | mode |
| 5 | execution-policy | policy |
| 6 | behavior-constraints | constraints |
| 7 | project-rules | rules |
| 8 | workspace-context | workspace |
| 9 | verification | verification |
| 10 | tools-registry | tools |
| 11 | tools-execution-policy | tools |
| 12 | collaboration | collaboration |
| 13 | environment-info | env |
| 14 | output-style | output |
| 15 | session-memory | memory |
| 16 | memory-policy | memory |
| 17 | routing-instructions | routing |
| 18 | streaming-behavior | streaming |
| 19 | autonomous-behavior | autonomous |
| 20 | context-management | context |

### Supporting Context Infrastructure

| File | Status | Role |
|------|--------|------|
| `runtime/context/ContextWindowResolver.ts` | ACTIVE | Model→window mapping (128K/200K/1M) |
| `runtime/context/TokenBudgetTracker.ts` | ACTIVE | Per-task token budget tracking |
| `runtime/context/TokenEstimator.ts` | ACTIVE | Token estimation (rough + usage) |
| `runtime/context/Compactor.ts` | ACTIVE | 4 compaction strategies |
| `runtime/context/context-types.ts` | ACTIVE | Type definitions |
| `runtime/context/WorkspaceIndex.ts` | ACTIVE | File search within store |
| `runtime/context/HistoryCompressor.ts` | LEGACY | 15-line wrapper around memory-manager |
| `runtime/memory-manager.ts` | LEGACY | Old summarization (summarizeMessages) |
| `runtime/runtime-token-config.ts` | ACTIVE | Central token limit configuration |
| `runtime/runtime-role-registry.ts` | ACTIVE | Role definitions + system prompts |
| `runtime/execution-mode.ts` | ACTIVE | 6 execution modes |

### DEAD Context System

| File | Status | Role |
|------|--------|------|
| `src/context/TokenBudgetManager.ts` | **DEAD** | Fixed-ratio budget, ZERO imports |
| `src/context/SlidingMemoryCompressor.ts` | **DEAD** | Head/tail compression, ZERO imports |
| `src/context/SemanticSearchIndex.ts` | **DEAD** | TF-IDF search, ZERO imports |
| `src/context/WorkspaceIndexer.ts` | **DEAD** | File indexer, ZERO imports |
| `src/context/WorkspaceChunker.ts` | **DEAD** | File chunker, ZERO imports |
| `src/context/RetrievalEngine.ts` | **DEAD** | Retrieval, ZERO imports |
| `src/context/ASTSummarizer.ts` | **DEAD** | Regex AST parser, ZERO imports |
| `src/context/DependencyGraph.ts` | **DEAD** | Import dependency graph, ZERO imports |
| `src/context/ExecutionMemoryStore.ts` | **DEAD** | Three-tier memory, ZERO imports |
| `src/context/index.ts` | **DEAD** | Barrel export for the above |

---

## 5. COMPLETE PROVIDER REQUEST FLOW

### Provider Transport Instances

| Instance | Created In | Used By | Config Source |
|----------|-----------|---------|--------------|
| `ProviderTransport` singleton | `AgentExecutor.ts:50-59` (module scope) | `AgentExecutor.executeFast()`, `executeFull()` | `useAppStore` getApiKey callback |
| `ProviderTransport` singleton | `orchestrator.ts:65` (module scope) | `fastChatCompletion()`, `runAgent()` | `useAppStore` getApiKey callback |
| `streamChatCompletion` standalone | External `@agentic-os/providers` package | `sub-agent-delegator.ts` | Direct args (endpoint, apiKey) |

### Request Flow (Canonical — AgentExecutor)

```
AgentExecutor.executeFull()
  │
  ├─ resolveAgentConfig(role):
  │   ├─ workspaceRuntime.getState().wiredAgents → find by role
  │   └─ appStore.getState().providers → find by providerId
  │
  ├─ Build messages: [systemPrompt, contextBlock?, history..., userMessage]
  │
  └─ LOOP (max 10):
      │
      ├─ getEffectiveMaxTokens(role, model) → clamp output
      │
      ├─ Streaming path:
      │   transport.streamChatCompletion(
      │     { baseUrl, apiKey, runtime, providerId, providerName },
      │     { model, messages, tools: toolDefs, maxTokens, signal },
      │     { onToken, onToolCallsComplete, onError, onDone }
      │   )
      │   → onToken: responseContent += token
      │   → onToolCallsComplete: responseToolCalls = mapped tool calls
      │
      ├─ Fallback path (if no content from streaming):
      │   transport.chatCompletion(
      │     { baseUrl, apiKey, runtime, providerId, providerName },
      │     { model, messages, tools: toolDefs, maxTokens, signal }
      │   )
      │   → result.content, result.toolCalls, result.usage
      │
      └─ Process response (tool execution, compaction, etc.)
```

---

## 6. COMPLETE UI RENDERING FLOW

### Boot

```
App.tsx
  └─ useRenderEngine() hook
      ACTIVE FILE: src/runtime/render-engine/use-render-engine.ts
      ├─ initStreamManager()
      │   ACTIVE FILE: src/runtime/streaming/StreamManager.ts
      └─ UiSync.getInstance().start()
          ACTIVE FILE: src/runtime/render-engine/ui-sync.ts
          └─ Registers 15+ event handlers on EventBus
```

### Data Flow

```
ExecutionOrchestrator / StreamManager / AgentExecutor
  │
  ├──✗ Direct Zustand writes:
  │   - timelineStore.addAgentSession()
  │   - timelineStore.appendStreamingText() (via StreamManager RAF)
  │   - timelineStore.commitStreamingText()
  │
  └──✗ EventBus.emit()
      │
      └── EventBus (CANONICAL SINGLETON)
          ACTIVE FILE: src/runtime/EventBus.ts
          │ (accessed through render-engine/event-bus.ts facade)
          │
          └── UiSync (15 listeners):
              ├─ USER_MESSAGE → addEvent
              ├─ ROUTING_DECISION → addEvent
              ├─ AGENT_ASSIGNED → addAgentSession (GUARDED: skip if exists)
              ├─ AGENT_COMPLETE → updateAgentSession
              ├─ TOOL_START → addToolCallToAgent
              ├─ TOOL_COMPLETE → updateToolCall
              ├─ FILE_EDIT → addFileEditToAgent
              ├─ COMMAND_START → addTerminalToAgent
              ├─ COMMAND_OUTPUT → update terminal output
              ├─ COMMAND_COMPLETE → update terminal status
              ├─ MODEL_DETECTED → updateAgentSession
              ├─ EXECUTION_ERROR → addEvent
              └─ EXECUTION_SUMMARY → addEvent
              │
              └─ queueMicrotask(() => timelineStore.getState().method())
                  │
                  └── useTimelineStore (Zustand)
                      │
                      └── React selectors fire:
                          ├─ ConversationTimeline: s.events, s.agentSessions
                          └─ AssistantResponse: s.agentSessions.get(id),
                                                  s.streamingTexts.get(id)
```

### UI Components

| Component | Status | Reads From |
|-----------|--------|-----------|
| `conversation-timeline.tsx` | ACTIVE | timelineStore.events, agentSessions |
| `AssistantResponse.tsx` | ACTIVE | timelineStore streamingTexts + agentSessions |
| `streaming-content.tsx` | ACTIVE | Text prop (ReactMarkdown + RAF reveal) |
| `ToolCallBlock.tsx` | ACTIVE | ToolCallRecord |
| `FileEditBlock.tsx` | ACTIVE | FileEditRecord |
| `TerminalBlock.tsx` | ACTIVE | TerminalRecord |
| `use-live-editor-stream.ts` | ACTIVE | TOKEN_STREAM events (live code injection) |
| `RuntimeHealthPanel.tsx` | ACTIVE | Multiple stores + diagnostics (dev only) |

---

## 7. AGENT OWNERSHIP MAP

### Who Creates What

```
RuntimeOS constructor — creates ALL of these on first getInstance():
  ├─ ToolRegistry (this.toolRegistry)
  ├─ ToolResolver (this.toolResolver)
  ├─ ToolPoolAssembler (this.toolPoolAssembler)
  ├─ PermissionEngine (this.permissionEngine)
  ├─ ToolExecutionPipeline (this.toolExecutionPipeline)
  ├─ ToolExecutionPolicy (this.toolExecutionPolicy)
  ├─ ToolConcurrencyPolicy (this.toolConcurrencyPolicy)
  ├─ MCPRegistry (this.mcpRegistry)
  ├─ MCPServerManager (this.mcpServerManager)
  ├─ SkillRegistry / SkillLoader / SkillExecutor
  ├─ TaskRuntime (this.taskRuntime)                        ← LEGACY
  ├─ TaskScheduler (this.taskScheduler)                    ← DEAD
  ├─ TaskCancellation (this.taskCancellation)              ← LEGACY
  ├─ CoordinatorRuntime (this.coordinator)                 ← LEGACY
  ├─ TaskDelegator (this.taskDelegator)                    ← LEGACY
  ├─ SharedTaskGraph (this.sharedTaskGraph)                ← LEGACY
  ├─ PluginRegistry / PluginLifecycle / PluginLoader
  └─ Registers shutdown hook

RuntimeOS.initialize():
  ├─ registerBuiltinTools() — registers 21 AgentTool instances
  ├─ Connects MCP servers (if configured)
  └─ registerCoordinatorWorkers() — registers 7 workers       ← LEGACY

ExecutionOrchestrator (singleton via getInstance()):
  ├─ initStreamManager() called during first instantiation
  └─ Executes via AgentExecutor (created per-execution)

useRenderEngine() hook:
  └─ UiSync (singleton via getInstance())
  └─ initStreamManager() (idempotent)
```

### Agent Communication

```
AgentExecutor calls:
  ├─ RuntimeOS.getInstance() → toolRegistry, toolExecutionPipeline
  ├─ ContextManager.getInstance() → assembleSystemPrompt, buildContext, compact
  ├─ StreamManager.getInstance() → append, complete
  ├─ EventBus (render-engine facade) → emit events
  ├─ useTimelineStore → addAgentSession (direct)
  ├─ useAgentStore → addMessage (direct)
  ├─ useLedgerStore → addAction (direct)
  └─ PostWriteVerifier → verify (direct)
```

---

## 8. STATE OWNERSHIP MAP

### Zustand Stores

| Store | Status | Owns | Volatility | Direct Writes From |
|-------|--------|------|-----------|-------------------|
| **timeline-store** | PRIMARY | `events[]`, `agentSessions: Map`, `streamingTexts: Map`, `sessionOrder`, `collapsedSections`, `streamingMetrics` | VOLATILE (cleared on restart) | `ExecutionOrchestrator`, `StreamManager`, `UiSync` |
| **agent-store** | ACTIVE | `conversations: Map<Role, Message[]>`, `taskQueue`, `isProcessing`, `abortController`, `executionMode`, `agentAssignments` | PERSISTED in memory | `ExecutionOrchestrator`, `ChatPanel`, `ManagerRoute` |
| **app-store** | ACTIVE | `providers[]`, `agents[]`, `roleMappings`, `mcpServerConfigs` | PERSISTED | Settings UI, Provider UI |
| **workspace-store** | ACTIVE | `openFiles[]`, `activeFile`, `orchestrationState`, `cursor/selection`, `fileTree` | PERSISTED | File explorer, Code editor, `ExecutionOrchestrator` |
| **ledger-store** | ACTIVE | `entries: LedgerEntry[]` | VOLATILE | `AgentExecutor`, `executeToolCall` |

### Key Overlap

**timeline-store** and **agent-store** both hold assistant response data. They serve different purposes:
- `timeline-store` = VOLATILE UI state (streaming text, session lifecycle, tool calls visible in UI)
- `agent-store` = PERSISTED conversation history (used for LLM context building in `getProcessedHistory()`)

This dual storage is intentional but a potential synchronization risk.

---

## 9. EVENT OWNERSHIP MAP

### Event Bus Architecture

There is ONLY ONE physical EventBus singleton:

```
src/runtime/EventBus.ts     ← CANONICAL (has middleware, traces, persistence)
src/runtime/render-engine/event-bus.ts  ← COMPATIBILITY FACADE
    - All methods delegate to canonical bus via as any casts
    - Defines its OWN event type system (SCREAMING_SNAKE_CASE)
    - All production code imports from this facade
```

### Actual Events Flowing During Execution

| Event | Emitted By | Consumed By | Purpose |
|-------|-----------|-------------|---------|
| `USER_MESSAGE` | `ExecutionOrchestrator.execute()` | UiSync → timelineStore | Display user input in timeline |
| `ROUTING_DECISION` | `assignAgentForTask()` | UiSync → timelineStore | Show which roles selected |
| `AGENT_ASSIGNED` | `handleDirectResponse()` / `handleDelegatedExecution()` | UiSync → timelineStore | Create agent session card |
| `AGENT_COMPLETE` | Both handlers after execution | UiSync → timelineStore | Update session status |
| `TOKEN_STREAM` | Both handlers per-token | `useLiveEditorStream` ONLY | Live code injection |
| `TOOL_START` | `agentCallbacks.onToolCallStart` | UiSync → timelineStore | Show running tool |
| `TOOL_COMPLETE` | `agentCallbacks.onToolCallComplete` | UiSync → timelineStore | Show tool result |
| `FILE_EDIT` | `agentCallbacks.onFileEdit` | UiSync → timelineStore | Show file edit block |
| `COMMAND_START` | Via EventBus | UiSync → timelineStore | Show terminal block |
| `COMMAND_OUTPUT` | Via EventBus | UiSync → timelineStore | Live terminal output |
| `COMMAND_COMPLETE` | Via EventBus | UiSync → timelineStore | Terminal completion status |
| `MODEL_DETECTED` | `agentCallbacks.onModelDetected` | UiSync → timelineStore | Show model name |
| `EXECUTION_ERROR` | Error path | UiSync → timelineStore | Show error in timeline |
| `EXECUTION_SUMMARY` | Finalize step | UiSync → timelineStore | Show summary card |
| `EXECUTION_STATE_CHANGE` | `ExecutionSessionManager` | (none subscribed in main UI) | Session lifecycle tracking |

### Events NEVER Emitted (but types exist for them)

| Type | Defined In | Status |
|------|-----------|--------|
| `tool_requested` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `tool_started` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `tool_completed` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `tool_failed` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `stream_delta` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `verification_started` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `verification_completed` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `repair_attempted` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `repair_failed` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `repair_resolved` | `RuntimeTypes.ts` | **DEAD** — never emitted |
| `execution_halted` | `RuntimeTypes.ts` | **DEAD** — never emitted |

---

## 10. FILE-BY-FILE CLASSIFICATION: ACTIVE / LEGACY / DEAD

### ACTIVE (executed in production path)

| File | Reason |
|------|--------|
| `src/runtime/execution/ExecutionOrchestrator.ts` | Canonical orchestrator — called per-message |
| `src/runtime/agents/AgentExecutor.ts` | Canonical agent — FULL/MULTI execution |
| `src/runtime/streaming/StreamManager.ts` | RAF-coalesced streaming buffer |
| `src/runtime/streaming/ToolCallAssembler.ts` | Tool call assembly from streaming delta |
| `src/runtime/sessions/ExecutionSessionManager.ts` | Session wrapper — called per-message |
| `src/runtime/manager-routing-engine.ts` | Intent classification — called per-message |
| `src/runtime/render-engine/event-bus.ts` | Event bus facade — all events go through this |
| `src/runtime/render-engine/ui-sync.ts` | Event → Zustand bridge — started at boot |
| `src/runtime/render-engine/use-render-engine.ts` | Bootstrapper — called from App.tsx |
| `src/runtime/render-engine/render-metrics.ts` | FPS/metrics tracking — started at boot |
| `src/runtime/EventBus.ts` | Canonical event bus singleton |
| `src/runtime/workspace-runtime.ts` | Runtime state store |
| `src/runtime/runtime-engine.ts` | Provider-wiring graph computation |
| `src/runtime/runtime-token-config.ts` | Token limit configuration |
| `src/runtime/runtime-role-registry.ts` | Role definitions + system prompts |
| `src/runtime/execution-mode.ts` | 6 execution mode configs |
| `src/runtime/execution/SynthesisEngine.ts` | MULTI-mode response synthesis |
| `src/runtime/context/ContextManager.ts` | Central prompt composition orchestrator |
| `src/runtime/context/ContextWindowResolver.ts` | Model→context-window mapping |
| `src/runtime/context/TokenBudgetTracker.ts` | Per-round token budget |
| `src/runtime/context/TokenEstimator.ts` | Token counting |
| `src/runtime/context/Compactor.ts` | Context compaction (4 strategies) |
| `src/runtime/context/context-types.ts` | Type definitions |
| `src/runtime/context/WorkspaceIndex.ts` | File search utility |
| `src/runtime/PostWriteVerifier.ts` | Post-edit typecheck/lint |
| `src/runtime/project-memory/memory-loader.ts` | CLAUDE.md loading |
| `src/runtime/RuntimeOS.ts` | DI container + tool registry |
| `src/runtime/tools/execution/ToolExecutionPipeline.ts` | Tool execution pipeline |
| `src/runtime/tools/execution/ToolValidation.ts` | Schema validation |
| `src/runtime/tools/execution/ToolExecutionContext.ts` | Hook types |
| `src/runtime/tools/core/AgentTool.ts` | Tool interface + buildTool |
| `src/runtime/tools/core/ToolContext.ts` | Context type |
| `src/runtime/tools/core/ToolResult.ts` | Result type |
| `src/runtime/tools/core/ToolPermissions.ts` | Permission types |
| `src/runtime/tools/core/ToolCapabilities.ts` | Capability types |
| `src/runtime/tools/registry/ToolRegistry.ts` | Central tool catalog |
| `src/runtime/tools/registry/ToolResolver.ts` | Tool resolution |
| `src/runtime/tools/registry/ToolPoolAssembler.ts` | Tool pool assembly |
| `src/runtime/tools/conversion/agentToolToToolDef.ts` | AgentTool → ToolDef conversion |
| `src/runtime/tools/policies/ToolExecutionPolicy.ts` | Execution policy |
| `src/runtime/tools/policies/ToolConcurrencyPolicy.ts` | Concurrency policy |
| `src/runtime/permissions/PermissionEngine.ts` | New permission system (used by pipeline) |
| `src/runtime/permissions/PolicyResolver.ts` | Policy resolution |
| `src/runtime/permissions/ApprovalManager.ts` | User approval management |
| `src/runtime/mcp/MCPRegistry.ts` | MCP connection registry |
| `src/runtime/mcp/MCPServerManager.ts` | MCP server lifecycle |
| `src/runtime/mcp/MCPClient.ts` | MCP client connection |
| `src/runtime/mcp/MCPToolAdapter.ts` | MCP → AgentTool conversion |
| `src/runtime/skills/SkillRegistry.ts` | Skill storage |
| `src/runtime/skills/SkillLoader.ts` | Skill loading |
| `src/runtime/skills/SkillExecutor.ts` | Skill execution |
| `src/runtime/plugins/PluginRegistry.ts` | Plugin storage |
| `src/runtime/plugins/PluginLifecycle.ts` | Plugin lifecycle hooks |
| `src/runtime/plugins/PluginLoader.ts` | Plugin loading |
| `src/runtime/telemetry/SpanProcessor.ts` | Execution trace spans |
| `src/runtime/observability/ProviderInspector.ts` | Provider diagnostics |
| `src/runtime/runtime-diagnostics.ts` | Store mutation tracking (dev) |
| `src/runtime/RuntimeCleanupManager.ts` | Graceful shutdown orchestration |
| `src/runtime/runtime-coordinator.ts` | Workspace refresh coordination |
| `src/lib/agents/agent-tools.ts` | Built-in tool definitions + registration |
| `src/lib/execution-trace.ts` | Execution tracing |
| `src/stores/agent-store.ts` | Agent conversation history |
| `src/stores/app-store.ts` | App configuration |
| `src/stores/workspace-store.ts` | Workspace state |
| `src/stores/ledger-store.ts` | Action logging |
| ALL UI components listed in Section 6 | Active rendering |

### LEGACY (reachable but not primary / being replaced)

| File | Why Still Reachable | Migration Target |
|------|---------------------|------------------|
| `src/lib/agents/orchestrator.ts` | `fastChatCompletion()` used by FAST path (`ExecutionOrchestrator` line 258) | Replace `fastChatCompletion()` with `AgentExecutor.executeFast()` |
| `src/lib/agents/orchestrator.ts` (runAgent, runRuntimeAgent) | Only called by `AgentWorker.ts` (DEAD) | Can be deleted when AgentWorker is removed |
| `src/lib/tool-executor.ts` (executeToolCall function) | Only called from tests now | Delete function; keep impl functions |
| `src/lib/tool-executor.ts` (impl functions) | Called by `agent-tools.ts` and `sub-agent-delegator.ts` | Keep until tool registration absorbs impls |
| `src/runtime/tools/ToolExecutionSandbox.ts` | `executeTerminalTool()` called by `implRunCommand()` | Migrate terminal execution to pipeline |
| `src/runtime/execution-engine.ts` | Read by `execution-debug-panel.tsx` + approval methods used by `ToolExecutionSandbox` | Replace approval methods in ToolExecutionSandbox |
| `src/runtime/RuntimeSupervisor.ts` | Reachable through `ExecutionSession.ts` (old session) | Not created by new `ExecutionSessionManager` |
| `src/runtime/coordinator/CoordinatorRuntime.ts` | Instantiated by `RuntimeOS` constructor | Remove from RuntimeOS + delete |
| `src/runtime/coordinator/SharedTaskGraph.ts` | Instantiated by `RuntimeOS` constructor | Remove from RuntimeOS + delete |
| `src/runtime/coordinator/TaskDelegator.ts` | Instantiated by `RuntimeOS` constructor | Remove from RuntimeOS + delete |
| `src/runtime/coordinator/WorkerAgent.ts` | Instantiated by CoordinatorRuntime | Delete with coordinator stack |
| `src/runtime/tasks/TaskRuntime.ts` | Instantiated by `RuntimeOS`, wired to 5 consumers | Remove from RuntimeOS + delete |
| `src/runtime/tasks/TaskCancellation.ts` | Instantiated by `RuntimeOS`, called only in shutdown | Delete with task system |
| `src/runtime/tasks/TaskGraph.ts` | Used only by coordinator stack | Delete with coordinator stack |
| `src/runtime/context/HistoryCompressor.ts` | 15-line wrapper around memory-manager | Replace with Compactor calls |
| `src/runtime/memory-manager.ts` | Old summarization (summarizeMessages) | Replace with ContextManager compaction |
| `src/runtime/sub-agents/sub-agent-delegator.ts` | ACTIVE but uses LEGACY import pattern (standalone provider functions) | Migrate to AgentExecutor |
| `src/runtime/RuntimeTypes.ts` | Event types NEVER emitted; state machine types used by old code | Remove event types; keep state transitions |
| `src/runtime/render-engine/render-metrics.ts` | Metric types reference old StreamBuffer/RenderScheduler | Already simplified — keep |

### DEAD (unreachable — zero production imports)

| File | Why Dead | Notes |
|------|----------|-------|
| `src/runtime/agents/AgentWorker.ts` | ZERO imports anywhere | No barrel export, no direct import |
| `src/runtime/tasks/TaskScheduler.ts` | ZERO callers of `start()` or `schedule()` | Instantiated, `stop()` called in shutdown (no-op) |
| `src/runtime/task-graph/TaskGraphRuntime.ts` | ZERO imports anywhere | Not in any barrel export |
| `src/runtime/runtime-inspector.tsx` | ZERO imports from production code | Debug UI component, only in dev |
| `src/runtime/compat/compat-layer.test.ts` | Test file | Pre-existing errors |
| `src/runtime/prompting/tests/PromptCompositionEngine.test.ts` | Test file | Pre-existing errors |
| `src/context/TokenBudgetManager.ts` | ZERO imports from runtime | Superseded by `runtime/context/` |
| `src/context/SlidingMemoryCompressor.ts` | ZERO imports from runtime | Superseded |
| `src/context/SemanticSearchIndex.ts` | ZERO imports from runtime | Superseded |
| `src/context/WorkspaceIndexer.ts` | ZERO imports from runtime | Superseded |
| `src/context/WorkspaceChunker.ts` | ZERO imports from runtime | Superseded |
| `src/context/RetrievalEngine.ts` | ZERO imports from runtime | Superseded |
| `src/context/ASTSummarizer.ts` | ZERO imports from runtime | Superseded |
| `src/context/DependencyGraph.ts` | ZERO imports from runtime | Superseded |
| `src/context/ExecutionMemoryStore.ts` | ZERO imports from runtime | Superseded |
| `src/context/index.ts` | ZERO imports from runtime | Barrel for the above |
| Most provider adapter files (see Section 10a) | ZERO local imports | See provider section below |

---

## 10a. PROVIDER FILE ANALYSIS

### `src/providers/` — All Files

| File | Local Imports | Status |
|------|--------------|--------|
| `OpenAIAdapter.ts` | ZERO | DEAD (app code) — used only for package build |
| `AnthropicAdapter.ts` | ZERO | DEAD (app code) |
| `OpenRouterAdapter.ts` | ZERO | DEAD (app code) |
| `NvidiaAdapter.ts` | ZERO | DEAD (app code) |
| `OllamaAdapter.ts` | ZERO | DEAD (app code) |
| `BaseProviderAdapter.ts` | 5 internal imports | LEGACY — internal base class |
| `StreamNormalizer.ts` | ZERO | DEAD (app code) |
| `ToolCallNormalizer.ts` | ZERO | DEAD (app code) |
| `StreamingDeltaAssembler.ts` | ZERO | DEAD (app code) |
| `ToolSchemaValidator.ts` | ZERO | DEAD (app code) |
| `ProviderCapabilityRegistry.ts` | 1 import (BaseProviderAdapter) | LEGACY — imported by `UnifiedProviderService.ts` |
| `ProviderHealthMonitor.ts` | 0 internal deps | LEGACY — imported by `UnifiedProviderService.ts` |
| `index.ts` | Re-exports all above | ACTIVE as barrel — but no one imports from `@/providers` |

**Conclusion**: All local provider adapters are DEAD in application code. They're likely implementation files for the `@agentic-os/providers` npm package. All production code imports from the external package, not from `@/providers`. Only `ProviderCapabilityRegistry` and `ProviderHealthMonitor` have external consumers (`UnifiedProviderService.ts`).

---

## 11. DELETION SAFETY REPORT

### ☑ SAFE TO DELETE (0 migration needed)

These files have ZERO importers in production code. Remove them immediately.

| File | Reason |
|------|--------|
| `src/runtime/agents/AgentWorker.ts` | No imports anywhere |
| `src/runtime/tasks/TaskScheduler.ts` | No callers of any method |
| `src/runtime/task-graph/TaskGraphRuntime.ts` | No imports anywhere |
| `src/context/TokenBudgetManager.ts` | No imports from runtime |
| `src/context/SlidingMemoryCompressor.ts` | No imports from runtime |
| `src/context/SemanticSearchIndex.ts` | No imports from runtime |
| `src/context/WorkspaceIndexer.ts` | No imports from runtime |
| `src/context/WorkspaceChunker.ts` | No imports from runtime |
| `src/context/RetrievalEngine.ts` | No imports from runtime |
| `src/context/ASTSummarizer.ts` | No imports from runtime |
| `src/context/DependencyGraph.ts` | No imports from runtime |
| `src/context/ExecutionMemoryStore.ts` | No imports from runtime |
| `src/context/index.ts` | Barrel for the above dead files |
| `src/runtime/RuntimeTypes.ts` (event types section) | Events never emitted (keep state machine types if used) |
| `src/providers/OpenAIAdapter.ts` | Not imported locally |
| `src/providers/AnthropicAdapter.ts` | Not imported locally |
| `src/providers/OpenRouterAdapter.ts` | Not imported locally |
| `src/providers/NvidiaAdapter.ts` | Not imported locally |
| `src/providers/OllamaAdapter.ts` | Not imported locally |
| `src/providers/StreamNormalizer.ts` | Not imported locally |
| `src/providers/ToolCallNormalizer.ts` | Not imported locally |
| `src/providers/StreamingDeltaAssembler.ts` | Not imported locally |
| `src/providers/ToolSchemaValidator.ts` | Not imported locally |

### ⚠️ NEEDS MIGRATION FIRST

These files are still referenced but can be deleted after small targeted migrations.

| File | Migration Required | Effort |
|------|-------------------|--------|
| `src/runtime/execution-engine.ts` | Replace `executionEngine.requireApproval()`/`grantApproval()`/`denyApproval()` calls in `ToolExecutionSandbox.ts` (~5 lines) with PermissionEngine calls | **Small** |
| `src/runtime/RuntimeSupervisor.ts` | Already unreachable — `ExecutionSession` (which creates it) is old path not used by new `ExecutionSessionManager`. Verify `ExecutionSession.ts` is truly dead. | **Verify only** |
| `src/runtime/coordinator/CoordinatorRuntime.ts` | Remove from `RuntimeOS.ts` constructor + `registerCoordinatorWorkers()` | **Small** |
| `src/runtime/coordinator/SharedTaskGraph.ts` | Remove from `RuntimeOS.ts` constructor | **Small** |
| `src/runtime/coordinator/TaskDelegator.ts` | Remove from `RuntimeOS.ts` constructor | **Small** |
| `src/runtime/coordinator/WorkerAgent.ts` | Will be deleted with CoordinatorRuntime | **Small** |
| `src/runtime/tasks/TaskRuntime.ts` | Remove from `RuntimeOS.ts` constructor + all 5 wiring points | **Medium** — affects CoordinatorRuntime, TaskDelegator, SharedTaskGraph, TaskScheduler, TaskCancellation |
| `src/runtime/tasks/TaskCancellation.ts` | Replace `RuntimeOS.shutdown()` call with direct cleanup | **Small** |
| `src/runtime/tasks/TaskGraph.ts` | Will be deleted with coordinator stack | **Small** |
| `src/lib/agents/orchestrator.ts` (fastChatCompletion) | Replace `ExecutionOrchestrator.handleDirectResponse()` call with `AgentExecutor.executeFast()` | **Small-Medium** — needs to wire callbacks properly |
| `src/lib/tool-executor.ts` (executeToolCall func) | No production callers — just remove the export | **Small** |
| `src/lib/tool-executor.ts` (impl functions) | Keep — still used by `agent-tools.ts` and `sub-agent-delegator.ts` | **No migration needed** |
| `src/runtime/tools/ToolExecutionSandbox.ts` | Migrate `executeTerminalTool()` to pipeline; replace approval methods with PermissionEngine | **Medium** |
| `src/runtime/context/HistoryCompressor.ts` | Replace single usage in `ExecutionOrchestrator.getProcessedHistory()` with direct Compactor call | **Small** |
| `src/runtime/memory-manager.ts` | Replace `summarizeMessages()` in `HistoryCompressor` with ContextManager compaction | **Small** |
| `src/runtime/sub-agents/sub-agent-delegator.ts` | Migrate provider call from standalone functions to AgentExecutor | **Medium** — significant logic lives here |
| `src/runtime/RuntimeTypes.ts` (state machine types) | Verify which types are used by `EventProjectionStore.ts` and `RuntimeHealthPanel.tsx` | **Small** |
| `src/agents/ExecutionReflectionEngine.ts` | Check if anything still imports it | **Verify only** |

### ❌ CANNOT DELETE YET

These files are active in the production path. They are the canonical implementations.

| File | Why |
|------|-----|
| `src/runtime/execution/ExecutionOrchestrator.ts` | Canonical orchestrator |
| `src/runtime/agents/AgentExecutor.ts` | Canonical agent executor |
| `src/runtime/streaming/StreamManager.ts` | Canonical streaming pipeline |
| `src/runtime/RuntimeOS.ts` | DI container + tool services |
| `src/runtime/tools/execution/ToolExecutionPipeline.ts` | Canonical tool pipeline |
| `src/runtime/tools/registry/ToolRegistry.ts` | Canonical tool catalog |
| `src/lib/agents/agent-tools.ts` | Built-in tool definitions + registration |
| `src/runtime/context/ContextManager.ts` | Canonical prompt composition |
| ALL prompting/ files in `src/runtime/prompting/` | Active 22-section prompt composition |
| ALL store files (agent-store, app-store, workspace-store, timeline-store, ledger-store) | Active Zustand state |
| ALL UI component files listed in Section 6 | Active rendering |
| `src/runtime/EventBus.ts` | Canonical event bus |
| `src/runtime/render-engine/event-bus.ts` | Active facade (all code imports from here) |
| `src/runtime/render-engine/ui-sync.ts` | Active event→store bridge |
| `src/runtime/render-engine/use-render-engine.ts` | Active bootstrapper |
| `src/runtime/sessions/ExecutionSessionManager.ts` | Active session wrapper |
| `src/runtime/permissions/PermissionEngine.ts` | Active permission system |
| `src/runtime/PostWriteVerifier.ts` | Active post-edit verification |

---

## APPENDIX: LEGACY DEAD WEIGHT IN RuntimeOS CONSTRUCTOR

The `RuntimeOS.ts` constructor creates **7 unnecessary objects** on every startup:

```typescript
// Lines 89-95 of RuntimeOS.ts — ALL LEGACY/DEAD
this.taskRuntime = new TaskRuntime()                          // LEGACY
this.taskScheduler = new TaskScheduler(this.taskRuntime)      // DEAD
this.taskCancellation = new TaskCancellation(this.taskRuntime) // LEGACY
this.coordinator = new CoordinatorRuntime(...)                // LEGACY
this.taskDelegator = new TaskDelegator(...)                   // LEGACY
this.sharedTaskGraph = new SharedTaskGraph(...)               // LEGACY
```

And `registerCoordinatorWorkers()` (line 142) creates 7 `WorkerAgent` instances.

These 14+ objects are constructed, wired, and warmed up on every app startup but **never executed**. Removing them would:
- Reduce memory allocation by ~14 class instances
- Remove 7+ files from the import graph
- Eliminate dead constructor chains

---

## END OF REPORT
