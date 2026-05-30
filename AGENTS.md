# AgenticOS — Anchored Summary (Execution Ownership Unified)

## Goal
Single execution path: one event protocol, one producer chain, one consumer, one store, one renderer.

## Architecture (Execution Ownership Unified)
- **ExecutionEvent** (`src/runtime/ExecutionEvent.ts`) — 21-event discriminated union, canonical protocol for all execution lifecycle events
- **ExecutionOrchestrator** (`src/runtime/execution/ExecutionOrchestrator.ts`) — sole producer: yields `ExecutionEvent` via async generator; NO direct store writes, NO EventBus emits, NO commitStream calls
- **AgentExecutor** (`src/runtime/agents/AgentExecutor.ts`) — yields `ExecutionEvent` (TOKEN, TOOL_START/COMPLETE, FILE_EDIT, MESSAGE_COMPLETE)
- **StreamManager** (`src/runtime/streaming/StreamManager.ts`) — pure token coalescer: RAF buffer only, emits delta via `flushCallback`, NO store writes, NO session state, NO commitStream
- **ExecutionSessionManager** (`src/runtime/sessions/ExecutionSessionManager.ts`) — **single unified consumer**: `for await...of` loop over Orchestrator's event stream; sole writer to all stores (timeline-store, agent-store)
- **timeline-store** (`src/components/workspace/timeline/timeline-store.ts`) — single source of truth for conversation state; `streamingTexts` fast path + `agentSessions` committed state; single writer (ExecutionSessionManager)
- **EventBus** (`src/runtime/EventBus.ts`) — carries NO execution lifecycle traffic; reserved for UI/theme/plugin/settings events
- **UiSync** (`src/runtime/render-engine/ui-sync.ts`) — stripped of execution handlers; only UI timeline events remain (ROUTING_DECISION, USER_MESSAGE, EXECUTION_SUMMARY, EXECUTION_ERROR)
- **use-render-engine** (`src/runtime/render-engine/use-render-engine.ts`) — no longer starts UiSync; StreamManager flush callback set by ExecutionSessionManager
- **ToolExecutionPipeline** (`src/runtime/tools/execution/ToolExecutionPipeline.ts`) — canonical pipeline with hooks/mapping/permissions
- **RuntimeOS** (`src/runtime/RuntimeOS.ts`) — central aggregator for tools, MCP, permissions, skills, tasks
- **MCPTransport** (`src/runtime/mcp/MCPTransport.ts`) — 4 transports with real I/O (Stdio via Tauri shell, SSE via EventSource, WebSocket, HTTP)

## Event Flow
```
Provider/Executor
    ↓ yields ExecutionEvent
ExecutionOrchestrator (forwards + adds lifecycle events)
    ↓ yields ExecutionEvent (async generator)
ExecutionSessionManager (single consumer)
    ├─ StreamManager flush callback → timelineStore.appendStreamingText (tokens)
    ├─ AGENT_ASSIGNED → timelineStore.addAgentSession
    ├─ TOOL_START → timelineStore.addToolCallToAgent
    ├─ TOOL_COMPLETE → timelineStore.updateToolCall
    ├─ FILE_EDIT → timelineStore.addFileEditToAgent
    ├─ MESSAGE_COMPLETE → StreamManager.complete + commitStreamingText + status=complete
    └─ EXECUTION_FAILED → agent-store.addMessage
```

## Key Fixes Applied
- **3 parallel paths → 1 unified path**: EventBus→UiSync path dead; StreamManager direct-write path dead; Orchestrator direct-write path dead
- **StreamManager**: pure token coalescer; no store imports, no commitStream, no session ownership
- **ExecutionOrchestrator**: no EventBus emits, no timelineStore writes, no commitStream; yields events only
- **UiSync**: execution lifecycle handlers removed (AGENT_COMPLETE, TOOL_START/COMPLETE, FILE_EDIT, COMMAND_*, MODEL_DETECTED, AGENT_ASSIGNED)
- **Loop suppressed**: executor's MESSAGE_COMPLETE suppressed in handleDelegatedExecution; Orchestrator yields its own with stepId
- **stepId added** to AGENT_ASSIGNED and MESSAGE_COMPLETE events for session tracking
- **Synthetic session creation removed** from commitStreamingText (dead code path)
- **committedSteps dedup removed** (commitStream removed entirely)

## Remaining Legacy
- **AgentExecutor** writes to `useLedgerStore.addAction()` directly (line 473) — should be ExecutionEvent.EXECUTION_ACTION
- **Terminal output display** (COMMAND_START/OUTPUT/COMPLETE) — events not in ExecutionEvent yet; was only through EventBus→UiSync which is now dead
- **SynthesisEngine** — called directly from Orchestrator; writes to agent-store directly
- **EventBus** — still has listener infrastructure for execution types but no code emits them
- **ExecutionHeader.tsx**, **ToolCallBlock.tsx** — no longer imported; dead code (kept for reference)
- **LiveResponse.tsx** — superseded by AssistantResponse; no longer imported

## Chat Simplification Sprint (May 2026)
### Completed
- **AssistantResponse.tsx** — fully simplified: no ExecutionHeader, no PhaseTimeline, no tool call cards, no InlineActivity/InlineActivityComplete, no execution summary. Single activity indicator with human labels, content renders immediately on first token.
- **Activity labels** — `getActivityLabel()` maps internal phase names to human language ("Reading files", "Searching project", "Running command"). Only ONE activity shown at a time, hidden once text streams.
- **TerminalBlock.tsx** — human label mode: shows "Running command"/"Command complete"/"Command failed" by default. Raw `$ command` only visible on expand. Click to expand/collapse.
- **Metadata removed** from normal chat flow: Running/Complete/Error status, durations, exit codes, line counts, step IDs, tool names, phase history, execution summaries.
- **Claude-style context assembly** — confirmed existing in `src/runtime/context/ContextManager.ts` (section-based system with 21 sections covering recent conversation, summary, retrieval, workspace layers). No new module needed.
- **Typograph** — `prose-claude` CSS class already present (15px, 1.65 line-height, rgba color system). Streaming uses append-only DOM for O(1) token rendering.
- **Build**: 0 TS errors, 3229 Vite modules, clean production build.

### Key Files Modified
| File | Change |
|------|--------|
| `src/components/workspace/timeline/conversation/AssistantResponse.tsx` | 204 lines, simplified from 262. Removed ExecutionHeader, PhaseTimeline, InlineActivity, ToolCallBlock, execution summary, search/web tool cards. Added `getActivityLabel()` |
| `src/components/workspace/timeline/conversation/TerminalBlock.tsx` | 133 lines, simplified from 155. Human labels by default, raw command on expand, removed exit code/duration from collapsed view |
| `src/components/workspace/timeline/conversation/ExecutionHeader.tsx` | Dead code (no longer imported) |

## Verification
- [x] TypeScript: 0 compilation errors
- [x] Tests: 279/279 passing, 16/16 test files
- [x] Build: clean (vite build) — 3229 modules

## Remaining Active Files
| Directory | Files | Status |
|-----------|-------|--------|
| `src/runtime/execution/` | ExecutionOrchestrator, ExecutionSessionManager, StepManager, SynthesisEngine | ACTIVE |
| `src/runtime/agents/` | AgentExecutor, AgentResolver | ACTIVE |
| `src/runtime/streaming/` | StreamManager | ACTIVE |
| `src/runtime/mcp/` | MCPRegistry, MCPServerManager, MCPClient, MCPToolAdapter, MCPTransport | ACTIVE |
| `src/runtime/tools/` | execution/ToolExecutionPipeline, registry/ToolRegistry, core/AgentTool | ACTIVE |
| `src/runtime/prompting/` | PromptCompositionEngine, compiler, compression, budget, dedup, tracer | ACTIVE |
| `src/runtime/RuntimeOS.ts` | Central hub | ACTIVE |
| `src/runtime/render-engine/` | ui-sync.ts, use-render-engine.ts | STRIPPED (no execution role) |
| `src/lib/tool-executor.ts` | 21 impl* functions | LEGACY |
| `src/lib/agents/agent-tools.ts` | registerBuiltinTools | LEGACY |
