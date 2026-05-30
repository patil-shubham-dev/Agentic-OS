# CHAT SIMPLIFICATION MIGRATION

## Overview

Migrate from architecture-exposing chat to Claude Code Desktop-style UX.

## Phases

### Phase 1: Hide Agent Names (1-2 days)

**Goal:** Remove agent, provider, model names from main chat UI. Single response per turn.

**Changes:**

| File | Change | Complexity |
|------|--------|------------|
| `AssistantResponse.tsx` | Remove agent name header | 1 line |
| `conversation-timeline.tsx` | Skip init sessions in turns | 5 lines |
| `ExecutionSessionManager.ts` | Remove init session creation | 10 lines |
| `ExecutionOrchestrator.ts` | Suppress MESSAGE_COMPLETE per-agent, emit single | 15 lines |
| `SynthesisEngine.ts` | Make mandatory for all tasks | 20 lines |

**Result:**
```
Before:  Manager → Fast Inference → QA → 3 responses
After:   [single response]
```

### Phase 2: Activity Timeline (2-3 days)

**Goal:** Replace agent cards with activity items.

**Changes:**

| File | Change | Complexity |
|------|--------|------------|
| `ActivityMapper.ts` | New file: map agent phases to activities | 80 lines |
| `EXECUTION_ACTIVITY` event | New event type | 15 lines |
| `ExecutionOrchestrator.ts` | Yield activities instead of AGENT_ASSIGNED | 30 lines |
| `ActivityTimeline.tsx` | New component: render activity list | 100 lines |
| `conversation-timeline.tsx` | Render ActivityTimeline | 10 lines |
| `ExecutionEvent.ts` | Add EXECUTION_ACTIVITY + ACTIVITY_COMPLETE | 10 lines |

**Result:**
```
Before:  [Manager card] [Coder card] [QA card]
After:   ◌ Planning  ◌ Writing  ◌ Validating
```

### Phase 3: ResponseStream for All Streaming (1 day)

**Goal:** Zero ReactMarkdown cost during streaming. Direct DOM append.

**Changes:**

| File | Change | Complexity |
|------|--------|------------|
| `AssistantResponse.tsx` | Switch import to ResponseStream | 1 line |
| `ResponseStream.tsx` | Ensure handles all content types | 20 lines |
| `streaming-content.tsx` | Demote to completion-only renderer | 10 lines |

**Result:**
```
Before:  10-30ms per frame for markdown parsing
After:   <1ms per frame DOM append
```

### Phase 4: First-Token Fast Path (0.5 day)

**Goal:** First token appears immediately.

**Changes:**

| File | Change | Complexity |
|------|--------|------------|
| `StreamManager.ts` | First token → flushImmediate, not RAF | 3 lines |

**Result:**
```
Before:  First token delayed 0-16ms by RAF
After:   First token flushes synchronously
```

### Phase 5: Remove RAF Batching (1 day)

**Goal:** Continuous token flow, no batching pauses.

**Changes:**

| File | Change | Complexity |
|------|--------|------------|
| `StreamManager.ts` | Replace RAF with sync flush + microtask for bursts | 15 lines |

**Result:**
```
Before:  Tokens arrive in 16ms bursts
After:   Tokens arrive continuously
```

### Phase 6: StreamingBus (2 days)

**Goal:** Bypass Zustand during streaming to avoid React re-renders.

**Changes:**

| File | Change | Complexity |
|------|--------|------------|
| `streaming-bus.ts` | New file: lightweight pub/sub | 50 lines |
| `StreamManager.ts` | Write to StreamingBus instead of callback | 5 lines |
| `ResponseStream.tsx` | Subscribe to StreamingBus | 10 lines |
| `timeline-store.ts` | Keep Zustand for committed state only | 20 lines |

**Result:**
```
Before:  Zustand set() + Map + React reconciliation per batch
After:   Direct callback → DOM append
```

### Phase 7: Terminal Streaming (2-3 days)

**Goal:** Live terminal output inline, no tool cards.

**Changes:**

| File | Change | Complexity |
|------|--------|------------|
| `LiveTerminalOutput.tsx` | New component | 120 lines |
| `COMMAND_ACTIVITY` event | New event type | 10 lines |
| `AgentExecutor.ts` | Yield COMMAND_ACTIVITY instead of TOOL_START for commands | 10 lines |
| `ToolCard.tsx` | Remove command tool card rendering | 5 lines |

**Result:**
```
Before:  [Tool Card: run_command] [loading...] [✓]
After:   $ npm run build [Live output] ✓ Completed in 3.2s
```

### Phase 8: Premium Motion (1 day)

**Goal:** Subtle, purposeful animations.

**Changes:**

| File | Change | Complexity |
|------|--------|------------|
| `MotionController.ts` | New file | 30 lines |
| `animations.css` | New file | 60 lines |
| `ActivityTimeline.tsx` | Add animation classes | 10 lines |
| `ResponseStream.tsx` | Add token fade CSS | 5 lines |

### Phase 9: Diagnostics Panel (1 day)

**Goal:** All architecture details available in developer mode only.

**Changes:**

| File | Change | Complexity |
|------|--------|------------|
| `DiagnosticsPanel.tsx` | New component | 100 lines |
| `AppShell.tsx` | Add toggle, Ctrl+Shift+D | 5 lines |
| `conversation-timeline.tsx` | No architecture details in main view | 5 lines |

## Total Migration Effort

| Phase | Days | Risk | Dependencies |
|-------|------|------|-------------|
| 1. Hide agents | 1-2 | Low | None |
| 2. Activity timeline | 2-3 | Medium | Phase 1 |
| 3. ResponseStream | 1 | Low | None |
| 4. First-token fast path | 0.5 | Low | None |
| 5. Remove RAF | 1 | Medium | StreamingBus (Phase 6) if doing full |
| 6. StreamingBus | 2 | Medium | None |
| 7. Terminal streaming | 2-3 | Medium | Phase 3 |
| 8. Premium motion | 1 | Low | Phase 2 |
| 9. Diagnostics panel | 1 | Low | Phase 1 |
| **Total** | **11.5-14.5 days** | | |

## Parallel Work

Phases 1 and 3 can run in parallel (different files).

Phases 4 and 5 can run in parallel (different changes to same file — merge carefully).

Phases 7 and 8 can run in parallel.

Phase 9 can start after Phase 1.

## Files to Create

```
src/runtime/execution/ActivityMapper.ts       — Phase 2
src/runtime/streaming/streaming-bus.ts         — Phase 6
src/runtime/motion/MotionController.ts         — Phase 8
src/runtime/motion/animations.css              — Phase 8
src/runtime/motion/useTransitionVisibility.ts  — Phase 8
src/runtime/motion/index.ts                   — Phase 8
src/components/workspace/timeline/conversation/ActivityTimeline.tsx — Phase 2
src/components/workspace/timeline/conversation/LiveTerminalOutput.tsx — Phase 7
src/components/workspace/timeline/conversation/DiagnosticsPanel.tsx — Phase 9
```

## Files to Modify

```
src/runtime/ExecutionEvent.ts                  — Phases 2, 7
src/runtime/execution/ExecutionOrchestrator.ts — Phases 1, 2
src/runtime/execution/SynthesisEngine.ts       — Phase 1
src/runtime/sessions/ExecutionSessionManager.ts — Phase 1
src/runtime/streaming/StreamManager.ts         — Phases 4, 5, 6
src/runtime/agents/AgentExecutor.ts            — Phase 7
src/components/workspace/timeline/conversation/AssistantResponse.tsx — Phases 1, 3
src/components/workspace/timeline/conversation/conversation-timeline.tsx — Phases 1, 2
src/components/workspace/timeline/conversation/ResponseStream.tsx — Phase 6
src/components/workspace/timeline/conversation/streaming-content.tsx — Phase 3
src/components/workspace/timeline/timeline-store.ts — Phase 6
src/core/routing/AppShell.tsx                   — Phase 9
```

## Rollback Plan

Each phase is independently revertible:

Phase 1: Restore agent name rendering, re-enable per-agent MESSAGE_COMPLETE.

Phase 2: Switch ActivityTimeline rendering off, fall back to agent cards.

Phase 3: Revert import to StreamingContent.

Phases 4-5: Revert StreamManager to RAF-based scheduling.

Phase 6: Switch ResponseStream back to Zustand subscription.

Phase 7: Re-enable ToolCard rendering for commands.

Phase 9: Remove diagnostics panel toggle.

## Testing

Each phase should maintain 304 tests passing.

New tests needed:
- ActivityMapper maps correctly for all agent roles
- Single response per turn (regression)
- No architecture details in main chat (integration)
- ResponseStream DOM append correctness
- StreamingBus subscribe/unsubscribe lifecycle
- LiveTerminalOutput streaming + completion states
