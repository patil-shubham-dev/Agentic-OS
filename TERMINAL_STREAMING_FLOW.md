# Terminal Streaming Flow — Current State Audit

## Overview

This document traces the entire terminal execution path from user request to TerminalBlock rendering, identifying where output is buffered, lost, or delayed.

## Full Event Path

```
User Input
  → ExecutionOrchestrator.execute()
  → ExecutionOrchestrator.handleDelegatedExecution()
    → AgentExecutor.execute()
      → ToolExecutionPipeline.execute(toolName, args, ctx)
        → agentTool.execute(ctx, input)                     [agent-tools.ts:349]
          → implRunCommand(rootPath, role, id, cmd, args)    [tool-executor.ts:82]
            → ToolExecutionSandbox.executeTerminalTool()    [sandbox.ts:158]
              → TerminalRuntime.runStream(cmd, cwd)          [terminal.ts:75]
                → Tauri invoke("run_command_stream")          [Tauri backend]
                → eventApi.listen("terminal-output:{id}")     [per-line output]
                → yields OUTPUT_LINE events                   [terminal.ts:123]
              ← collects lines[] into single string           [sandbox.ts:168-170]
            ← returns { content: output }                     [sandbox.ts:176-182]
          ← returns string                                    [tool-executor.ts:85]
        ← returns ToolResult<{ data: string }>                [agent-tools.ts:384-385]
      → AgentExecutor yields TOOL_COMPLETE                    [AgentExecutor.ts:420-428]
      → AgentExecutor yields COMMAND_COMPLETE (BUG: before COMMAND_OUTPUT)
      → AgentExecutor yields COMMAND_OUTPUT (BUG: after COMMAND_COMPLETE)
    → ExecutionOrchestrator forwards event                    [orchestrator.ts:287]
  → ExecutionSessionManager.handleEvent()                     [session.ts:104]
    → COMMAND_START:      addTerminalToAgent                  [session.ts:182-192]
    → COMMAND_OUTPUT:     appends to terminal.output          [session.ts:281-292]
    → COMMAND_COMPLETE:   status="success", exitCode          [session.ts:194-205]
    → COMMAND_ERROR:      status="error", output=error        [session.ts:207-218]
  → timeline-store (zustand)                                  [timeline-store.ts]
  → React re-render
    → AssistantResponse.tsx renders session.terminalOutputs   [assistant.tsx:133]
      → TerminalBlock.tsx renders terminal.output             [terminal-block.tsx:91]
```

## Current State Diagram

```
Model calls tool
  │
  ▼
AgentExecutor: tc.function.name === 'execute_command'?
  │  ← B1: tool name is 'run_command', check fails → isCommand = false
  │
  ▼
TOOL_START yielded ─────────────────────────────────────► SessionManager → TimelineStore
  │
  ▼
pipeline.execute("run_command", ...)
  │
  ▼
sandbox.executeTerminalTool()
  │
  ▼
runStream() ──► EventBus.emit("COMMAND_*") ──► UiSync (DEAD ─ B3)
  │                 collects lines
  ▼
  ← returns single string
  │
  ▼
TOOL_COMPLETE yielded ──────────────────────────────────► SessionManager → TimelineStore
  │
  ▼
COMMAND_COMPLETE yielded ── B2: emitted first ─────────► SessionManager → status="success"
  │
  ▼
COMMAND_OUTPUT yielded ── B2: emitted second ─────────► SessionManager → DROPPED (status ≠ "running")
```

## Bug Details

### B1: Tool Name Mismatch

**File**: `src/runtime/agents/AgentExecutor.ts:378`
**Current**: `const isCommand = tc.function.name === 'execute_command'`
**Actual tool name**: `run_command` (registered at `agent-tools.ts:109`)
**Impact**: `isCommand` is ALWAYS `false`. The entire `if (isCommand)` block (lines 381-433) that emits COMMAND_START/COMPLETE/OUTPUT/ERROR never executes. Terminal display through ExecutionEvent path is completely dead.
**Root cause**: The tool definition was renamed from `execute_command` to `run_command` at some point, but AgentExecutor was not updated.

### B2: Event Ordering Bug

**File**: `src/runtime/agents/AgentExecutor.ts:430-433`
**Current code**:
```ts
if (isCommand) {
  yield { type: "COMMAND_COMPLETE", ... }  // line 431 — sets status="success"
  yield { type: "COMMAND_OUTPUT", output: resultContent, ... }  // line 432
}
```
**Consumer** (`ExecutionSessionManager.ts:287`):
```ts
if (coLastIdx < 0 || coSession.terminalOutputs[coLastIdx].status !== "running") break;
```
**Impact**: `COMMAND_COMPLETE` sets terminal status to `"success"`, then `COMMAND_OUTPUT` is checked against `status !== "running"` and DROPPED. Terminal output is never rendered.
**Fix**: Emit `COMMAND_OUTPUT` before `COMMAND_COMPLETE`.

### B3: EventBus Dead Path

**File**: `src/runtime/terminal/TerminalRuntime.ts:86-141`
**Current**: `runStream()` emits `COMMAND_START`, `COMMAND_OUTPUT`, `COMMAND_COMPLETE` to `EventBus`.
**Status**: As documented in `AGENTS.md`, UiSync no longer handles execution events. These EventBus emissions are dead code.
**Impact**: Even though the underlying terminal streaming infrastructure at the Tauri level works (per-line events via `terminal-output:{id}`), the rendering path was broken when UiSync was stripped of execution handlers.
**Note**: The async generator from `runStream()` is consumed correctly by `ToolExecutionSandbox`, but the EventBus emissions are vestigial.

### B4: Buffering in Sandbox

**File**: `src/runtime/tools/ToolExecutionSandbox.ts:158-183`
**Current**: `executeTerminalTool()` iterates `runStream()` but pushes all lines into `lines[]` and returns them as a single string after the command completes.
**Impact**: Even with B1 and B2 fixed, output would only appear all-at-once after command completion. No real-time streaming.
**Available infrastructure**: `runStream()` already yields individual `OUTPUT_LINE` events per-line. The sandbox just needs to forward them.

## Working Paths

The following paths function correctly and are NOT affected:
- **TOOL_START / TOOL_COMPLETE / TOOL_PROGRESS**: These are emitted for ALL tools (not just commands) and are properly consumed by SessionManager → TimelineStore → StepCard.
- **FILE_EDIT**: Emitted for write_file/edit_file tools, properly consumed.
- **StreamManager / TOKEN streaming**: AI token streaming works correctly via `StreamManager.append` → `timelineStore.appendStreamingText` → React re-render.
- **ExecutionSessionManager.cancel()**: Properly cancels via AbortController and finalizes sessions.

## Files Involved

| File | Role | Lines |
|------|------|-------|
| `src/runtime/agents/AgentExecutor.ts` | Primary producer of COMMAND_* events | 369-433 |
| `src/runtime/tools/execution/ToolExecutionPipeline.ts` | Tool execution orchestration | 42-127 |
| `src/lib/agents/agent-tools.ts` | Tool definitions, run_command execute | 349-391 |
| `src/lib/tool-executor.ts` | implRunCommand bridge | 82-86 |
| `src/runtime/tools/ToolExecutionSandbox.ts` | Terminal sandbox, buffering collector | 158-183 |
| `src/runtime/terminal/TerminalRuntime.ts` | Tauri streaming backend | 75-144 |
| `src/runtime/execution/ExecutionOrchestrator.ts` | Event forwarding | 278-288 |
| `src/runtime/sessions/ExecutionSessionManager.ts` | Event consumer → timeline store | 182-292 |
| `src/components/workspace/timeline/timeline-store.ts` | Zustand store (terminalOutputs) | 364-376 |
| `src/components/workspace/timeline/conversation/TerminalBlock.tsx` | Terminal UI renderer | 11-100 |
| `src/components/workspace/timeline/conversation/AssistantResponse.tsx` | Session renderer | 133-134 |

## Performance Baseline (Current)

| Command | Renders at | Streaming | Notes |
|---------|-----------|-----------|-------|
| `echo test` | After completion | No | B1 + B2 prevent display entirely |
| `npm install` | After completion | No | All output batched by sandbox |
| `git status` | After completion | No | Same as above |
| 1000+ line output | After completion | No | Buffered in sandbox, large single string |
| `ping -t 1.1.1.1` | After completion | No | Continuous output lost; only final result shown |
| Cancelled command | N/A | N/A | AbortController works but no terminal display |

## Summary

Terminal streaming is currently broken at **three independent points**:
1. **B1**: `isCommand` never true (tool name mismatch)
2. **B2**: COMMAND_COMPLETE emitted before COMMAND_OUTPUT (output dropped)
3. **B4**: Sandbox buffers all output (no real-time streaming)

These bugs compound: fixing only B1 or B2 would not restore streaming. All three must be fixed. Additionally, B3 (EventBus dead path) should be cleaned up during implementation.
