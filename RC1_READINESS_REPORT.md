# AgenticOS — Release Candidate 1 Readiness Report

**Date:** 2026-05-29
**Audit Type:** Read-only comprehensive review
**Codebase:** AgenticOS (C:\Users\91808\Desktop\AgenticOS\AgenticOS)
**Tests:** 304/304 passing (19 test files)
**Previous Score (Ship Readiness V2):** 7.9/10

---

## SECTION 1 — REAL USER JOURNEY AUDIT

### Methodology
Each journey traced through the event flow: `chat-panel.tsx` → `ExecutionSessionManager` → `ExecutionOrchestrator` → timeline-store → UI rendering. 14+ files read, 4700+ lines analyzed.

### 1.1 Explain Existing Project

| Aspect | Assessment |
|--------|-----------|
| **Path** | user-message → EXECUTION_CREATED → THINKING_STARTED(Routing) → AGENT_ASSIGNED → THINKING_STARTED(Thinking) → PROVIDER_CONNECTING → TOKEN* → PROVIDER_CONNECTED → MESSAGE_COMPLETE → EXECUTION_COMPLETE |
| **UX** | Phase timeline shows "Preparing..." → "Routing" → "Thinking" → "Connecting..." → streaming |
| **Issues** | PhaseTimeline hidden after completion; "Routing" phase may flash too quickly to read |
| **Quality** | GOOD — init session eliminates blank state |

### 1.2 Create New Feature

| Aspect | Assessment |
|--------|-----------|
| **Path** | Same flow but with TOOL_START/COMPLETE, FILE_EDIT events interleaved during streaming |
| **Issues** | ToolCallBlock default-collapsed for non-latest tools (detail buried); FileEditBlock diff shows only `+` lines (no deletions visible); PostWriteVerifier results invisible |
| **Quality** | FAIR |

### 1.3 Refactor Feature

| Aspect | Assessment |
|--------|-----------|
| **Issues** | Same as 1.2. Plus: MAX_ROUNDS=10 limit with no UI warning when hit; AgentExecutor silently stops after limit |
| **Quality** | FAIR |

### 1.4 Debug Failing Code

| Aspect | Assessment |
|--------|-----------|
| **Issues** | Terminal output limited to `max-h-[200px]` with no "Show more" affordance; COMMAND_ERROR shown as red but agent continues (potentially confusing); tool errors in result text show green checkmark with error inside |
| **Quality** | FAIR |

### 1.5 Run Terminal Commands

| Aspect | Assessment |
|--------|-----------|
| **Issues** | COMMAND_START/OUTPUT/COMPLETE UI path marked as dead in AGENTS.md; no fast-path for terminal output (full re-render per event); secret leakage risk (output shown verbatim) |
| **Quality** | FAIR |

### 1.6 Search Workspace

| Aspect | Assessment |
|--------|-----------|
| **Issues** | Tool result truncated to 200 chars (`result.slice(0, 200)` at `ExecutionSessionManager.ts:139`); no "View full result" affordance on ToolCallBlock |
| **Quality** | FAIR |

### 1.7 Multi-File Edit

| Aspect | Assessment |
|--------|-----------|
| **Issues** | Diff shows only additions (`+` prefix for every line); no deletions visualized; PostWriteVerifier results invisible; rapid edits cause many Zustand re-renders (no batching) |
| **Quality** | FAIR |

### 1.8 Long Coding Task

| Aspect | Assessment |
|--------|-----------|
| **Issues** | Soft deadline (60s) logged to console only — no UI indicator; MAX_EVENTS=500 cap silent (old messages dropped without warning); RAF + structural updates cause layout jitter |
| **Quality** | FAIR |

### 1.9 Tool-Heavy Workflow

| Aspect | Assessment |
|--------|-----------|
| **Issues** | Each tool call creates new Map allocation (performance concern); non-latest tools collapsed by default; no tool-call grouping (5 sequential reads shown as 5 separate blocks) |
| **Quality** | FAIR |

### 1.10 Error Recovery Workflow

| Aspect | Assessment |
|--------|-----------|
| **Path** | Provider timeout → `EXECUTION_FAILED` → session status "error" → error message added to agent-store |
| **Issues** | **P0: Cancel leaves dangling "running" sessions** — `cancel()` doesn't finalize `stepByExecId` sessions; these remain "running" in timeline forever. **P1: No retry UX** — after `EXECUTION_FAILED`, user must manually re-type. **P1: Error not in timeline** — error message added to agent-store but not as structured `ExecutionErrorEvent` in timeline events array |
| **Quality** | **POOR** |

---

## SECTION 2 — CLAUDE CODE COMPARISON

| # | Category | AgenticOS | Expected | Gap |
|---|----------|-----------|----------|-----|
| 1 | **First Token Experience** | 6/10 | 9/10 | Missing provider connection visualization, first-token timing display, cancel-while-waiting |
| 2 | **Planning Visibility** | 5/10 | 8/10 | No pre-execution plan preview, no reasoning/rationale display, flat phases (no hierarchy) |
| 3 | **Tool Visibility** | 6/10 | 9/10 | No result streaming, syntax highlighting, timing visualization, or per-tool retry |
| 4 | **Terminal Visibility** | 5/10 | 9/10 | **Display path dead** (marked legacy in AGENTS.md); no ANSI color support; no copy/re-run |
| 5 | **File Operation Visibility** | 7/10 | 9/10 | DiffViewerPanel is feature-rich but offline; inline blocks lack syntax highlighting; no "Open in editor" |
| 6 | **Response Rendering** | 6/10 | 9/10 | Raw text during streaming (formatted only on completion); no images/task-lists/progressive markdown |
| 7 | **Scrolling** | 7/10 | 9/10 | Functional auto-scroll but no "New messages below" chip; runs on every render |
| 8 | **Long Outputs** | 4/10 | 8/10 | Fixed 150-200px max-heights with no "Show X more lines"; no progressive rendering; no pagination |
| 9 | **Cancellation** | 4/10 | 9/10 | Cancel shown as error (no "cancelled" state); no resume/retry; partial output handling unreliable |
| 10 | **Recovery** | 3/10 | 9/10 | No retry buttons; `suggestion` field exists in type but never rendered; no partial failures |

**Weighted Average: 5.3/10** | **Production baseline: 8.8/10**

### Key Gaps vs Claude Code

| Feature | Claude Code | AgenticOS | Impact |
|---------|------------|-----------|--------|
| **Progressive Markdown** | Renders markdown during streaming | Raw text, re-renders on completion | Jarring visual transition |
| **Live terminal output** | Real-time command output streaming | Display path dead (legacy) | Terminals appear static |
| **Tool result streaming** | Results appear incrementally | Appear only on completion | Long waits for tool feedback |
| **Retry on error** | "Try again" button on failures | No retry UI | User frustration |
| **Cancellation state** | "Cancelled" banner + resume | "Error" state, no resume | Confusing UX |
| **Expandable outputs** | "Show X more lines" buttons | Fixed max-height only | Content hidden arbitrarily |

---

## SECTION 3 — PERFORMANCE

### 3.1 Startup Time

| Phase | Details | Impact |
|-------|---------|--------|
| Store initialization | 5+ Zustand stores initialized | Synchronous, negligible |
| Provider resolution | `hydrateProviderRuntimeMetadata()` — ALL providers probed via network in **series** | Blocks boot until all resolve or timeout |
| ContextManager construction | 8+ sub-systems instantiated (ContextWindowResolver, TokenBudgetTracker, Compactor, PromptCompositionEngine, etc.) | Lazy init would be better |
| Tool registry | `RuntimeOS.getInstance().initialize()` populates tool registry | One-time cost |

**Risk:** Provider probing blocks startup for N × timeout_ms if providers are unreachable.

### 3.2 First Token Latency (FTL)

| Source | Measured FTL | Notes |
|--------|-------------|-------|
| Mock tests (ProductionHardening) | ~12ms | Mock provider, no network |
| Real provider (estimated) | 300-2000ms | Network RTT + provider TTFT + context assembly |
| Context assembly overhead | +50-200ms | `assembleSystemPrompt()` + `buildContext()` run before first token |

### 3.3 Completion Latency

| Source | Measured | Notes |
|--------|----------|-------|
| Mock (10 runs avg) | ~120ms | 8 tokens at 1ms/token |
| Real provider (estimated) | 5-60s | Depends on response length + tool execution |

### 3.4 Large Workspace

| Mechanism | Limit | Notes |
|-----------|-------|-------|
| File tree depth | 5 levels | `MAX_TREE_DEPTH` |
| File tree entries | 150 max | `MAX_TREE_ENTRIES` |
| Context messages | 100 max | Hard limit |
| Auto-compact trigger | 75% of context window | |
| Consecutive compactions | 3 max | Then disabled until reset |

### 3.5 Memory Usage

| Component | Growth | Risk |
|-----------|--------|------|
| `StreamManager.streams` | Unbounded — `clearStep()` never called | **MEMORY LEAK** — inactive entries accumulate |
| `timeline-store.agentSessions` | Unbounded — no cap | Grows with every execution |
| `timeline-store.streamingTexts` | Unbounded — entries only removed by `commitStreamingText()` | Large responses stay in memory |
| `ExecutionSessionManager.stepByExecId` | Unbounded — entries NEVER removed | **MEMORY LEAK** |
| `ExecutionSessionManager.initStepIds` | Cleaned on error paths only | Cleaned in success too (since blocker 3 fix) |
| `events[]` | 500 cap (only capped structure) | ✅ Only bounded structure |

**Critical:** `StreamManager.ts` has a confirmed memory leak — `clearStep()` exists but is never called by the execution flow.

### 3.6 CPU Usage

| Issue | Location | Description |
|-------|----------|-------------|
| Continuous rAF loop | `StreamManager.ts:75-77` | rAF fires at 60fps as long as `streams.size > 0`, even with no pending tokens |
| Fallback: `streams.size > 0` check | Same | Should check for active streams with pending tokens, not just any entries |

### 3.7 Long Session Behavior

| Metric | Result |
|--------|--------|
| 50-iteration stress test | ✅ Passes — no leaks detected (but test resets stores between iterations) |
| Memory growth per iteration | ~0.12MB (test environment) |
| Event consistency | σ=0 across 50 iterations |
| StreamManager leak | ❌ Not detected by test (singleton not reset) |

---

## SECTION 4 — FAILURE TESTING ANALYSIS

### 4.1 Provider Failure

| Scenario | Behavior | OK? |
|----------|----------|-----|
| Wrong API key | `EXECUTION_FAILED` yielded → error message shown | ⚠️ Error type lost (all providers treated same) |
| HTTP 401/403 | `validateProvider` returns specific message | ✅ |
| HTTP 429 (rate limit) | Specific error returned | ✅ |
| Connection timeout | Caught, EXECUTION_FAILED yielded | ✅ |
| Mid-stream error | Treated as success if partial content exists (`onDone` not `onError`) | ❌ Partial success masks failure |
| Provider fallback | Not implemented — one provider failure terminates execution | ❌ |

### 4.2 Stream Failure

| Issue | Location | Severity |
|-------|----------|----------|
| `[DONE]` breaks inner loop only | `provider-gateway.ts:1461` | **HIGH** — potential hang |
| Mid-stream error treated as success | `provider-gateway.ts:1497-1508` | MEDIUM — masks failures |
| SSE parse errors silently dropped | `provider-gateway.ts:1492-1494` | MEDIUM |
| Empty catch on streaming failure in Agent | `AgentExecutor.ts:310-312` | MEDIUM — hides debug info |

### 4.3 Tool Failure

| Issue | Location | Severity |
|-------|----------|----------|
| `pipeline.execute()` throw kills session | `AgentExecutor.ts:389` | MEDIUM — exception propagates to fatal error |
| Tool args JSON parse failure → empty args | `AgentExecutor.ts:355` | MEDIUM — silent, tool receives `{}` |
| PostWriteVerifier error silently swallowed | `AgentExecutor.ts:468` | LOW — verifier is advisory |

### 4.4 Terminal Failure

| Issue | Location | Severity |
|-------|----------|----------|
| `COMMAND_ERROR` silently dropped if stepId missing | `ExecutionSessionManager.ts:187-188` | LOW — guard is correct |
| Terminal display path marked as dead/legacy | `AGENTS.md` | **HIGH** — no UI for terminal events |

### 4.5 Workspace Failure

| Issue | Location | Severity |
|-------|----------|----------|
| Silent fallback on workspace read failure | `ContextManager.ts:119-122` | LOW — returns `{}` gracefully |
| Recursive file tree parsing | `workspace-store.ts:106-168` | LOW — stack overflow risk for deep trees |
| File read failure in tools → session termination | `AgentExecutor.ts:389` | MEDIUM — same as tool throw issue |

### 4.6 Context Failure

| Issue | Location | Severity |
|-------|----------|----------|
| 40% message drop with no notification | `Compactor.ts:83-84` | MEDIUM — user not informed |
| Compactor disabled after 3 consecutive | `Compactor.ts:50-52` | LOW — messages grow unmanaged |

### 4.7 Cancellation

| Issue | Location | Severity |
|-------|----------|----------|
| Cancel clears ALL streams (not scoped) | `ExecutionOrchestrator.ts:41` | MEDIUM — affects concurrent sessions |
| Abort listener never removed | `provider-gateway.ts:1396-1401` | LOW — potential listener leak |
| Cancel status detection via string parsing | `ExecutionSessionManager.ts:69` | LOW — fragile |

---

## SECTION 5 — REMAINING DEBT

### Critical

| # | Debt | Location | Effort | Description |
|---|------|----------|--------|-------------|
| C1 | **Cancel leaves dangling "running" sessions** | `ExecutionSessionManager.cancel()` + `stepByExecId` | 1h | Sessions created by AGENT_ASSIGNED are never finalized on cancel. UI shows permanently "running" sessions. Fixed for init sessions but not real sessions |
| C2 | **StreamManager memory leak** | `StreamManager.ts` — `clearStep()` never called | 2h | Inactive streams accumulate in Map indefinitely. `clearStep()` exists but is dead code |
| C3 | **Continuous rAF loop wastes CPU** | `StreamManager.ts:75-77` | 1h | rAF fires at 60fps as long as any stream exists, even with no pending tokens |
| C4 | **stepByExecId Map never cleaned** | `ExecutionSessionManager.ts:27` | 1h | Entries survive indefinitely after execution completes |

### High

| # | Debt | Location | Effort | Description |
|---|------|----------|--------|-------------|
| H1 | **[DONE] breaks inner loop only** | `provider-gateway.ts:1461` | 1h | `break` only exits inner `for` loop, outer `while(true)` continues — potential hang |
| H2 | **No retry UX on failure** | `AssistantResponse.tsx` + chat-panel | 2h | After EXECUTION_FAILED, no "Retry" or "Modify and resend" button |
| H3 | **Tool result truncated (200 chars) permanently** | `ExecutionSessionManager.ts:139` | 1h | No "View full result" affordance on ToolCallBlock |
| H4 | **Terminal display path dead** | Escalation from `AGENTS.md` | 4h | COMMAND_START/OUTPUT/COMPLETE UI rendering was only through EventBus→UiSync which is now stripped |
| H5 | **Mid-stream error treated as success** | `provider-gateway.ts:1497-1508` | 1h | Partial content after read error triggers `onDone` not `onError` |
| H6 | **Unbounded agentSessions Map** | `timeline-store.ts:70` | 1h | Only `events[]` has 500 cap; `agentSessions` grows unbounded |
| H7 | **Compactor drops 40% with no notification** | `Compactor.ts:83-84` | 2h | No event/UI update when conversation history is discarded |

### Medium

| # | Debt | Location | Effort | Description |
|---|------|----------|--------|-------------|
| M1 | **TOKEN event wasted iteration** | `ExecutionOrchestrator` → `ExecutionSessionManager` (no-op) | 1h | TOKEN events yielded but silently ignored — generator overhead for no benefit |
| M2 | **PhaseTimeline hidden after completion** | `AssistantResponse.tsx:84-87` | 1h | Phase history only visible while running; disappears when complete |
| M3 | **Tool throws kill entire session** | `AgentExecutor.ts:389` | 2h | Exception in `pipeline.execute()` propagates to fatal error — should catch and return `isError` |
| M4 | **StreamingTexts Map unbounded** | `timeline-store.ts:72` | 1h | No cap on streaming texts Map entries |
| M5 | **Abort listener not cleaned up** | `provider-gateway.ts:1396-1401` | 1h | `{ once: true }` used but listener not removed if { once } fails |
| M6 | **Error not in timeline events** | `ExecutionSessionManager.ts` EXECUTION_FAILED handler | 1h | Error message added to agent-store but not as structured timeline event |

### Low

| # | Debt | Location | Effort | Description |
|---|------|----------|--------|-------------|
| L1 | **Soft deadline (60s) console-only** | `AgentExecutor.ts` deadline | 1h | No UI indicator when execution exceeds 60s |
| L2 | **Tool call grouping missing** | `ToolCallBlock` rendering | 3h | Sequential same-type tools should be groupable |
| L3 | **No "New messages below" chip** | `conversation-timeline.tsx` | 1h | Scrolling UX lacks premium notification |
| L4 | **BrowserActionEvent dead code** | `timeline/types.ts` | 1h | Type defined but no event handler or rendering |

**Total estimated effort for critical+high items:** ~17h
**Total estimated effort for all items:** ~32h

---

## SECTION 6 — SHIP DECISION

### Would you ship this publicly?

## NO

### Reasoning

AgenticOS has made substantial progress (304 tests passing, unified execution architecture, 6 ship blockers resolved), but several **user-facing critical issues** prevent a public alpha release:

1. **Cancel leaves sessions permanently "running"** — This is a trust-killer. A user who cancels an execution sees the session remain "running" with pulsing dots forever. This destroys confidence.

2. **Terminal display path is dead** — COMMAND_START/OUTPUT/COMPLETE events are yielded by AgentExecutor but have no rendering path. Users cannot see terminal output live. This is a fundamental feature gap for a coding assistant.

3. **No retry UX** — When any error occurs (provider failure, timeout, tool crash), the user's only option is to re-type their entire query. No "Retry" button. No suggested next steps. This is a basic UX expectation.

4. **TOKEN event wasted iteration** — 28 execution event types are yielded and consumed via generator overhead, but 1/3 produce no side effects. This is an architecture inefficiency that affects long sessions.

5. **Performance regression risk** — The continuous rAF loop and unbounded Map growth (StreamManager, stepByExecId) will cause degraded performance over time. The existing tests don't catch these because they reset state between iterations.

6. **PhaseTimeline hidden after completion** — Users cannot review what the agent did after the response completes. This is a basic transparency feature.

### Comparison to Claude Code

| Dimension | Claude Code | AgenticOS | Gap |
|-----------|------------|-----------|-----|
| Overall UX quality | ~8.8/10 | ~5.3/10 | 3.5 points |
| Retry on failure | ✅ | ❌ | Critical |
| Live terminal display | ✅ | ❌ | Critical |
| Cancel behavior | ✅ Distinct state + resume | ❌ Shows as error | High |
| Progressive rendering | ✅ Markdown during stream | ❌ Raw text then full render | High |
| Expandable outputs | ✅ "Show X more" | ❌ Fixed max-height | Medium |

### Verdict
The architecture is solid. The execution pipeline is correct. The event protocol is well-designed. But the **user-facing polish** and several **critical reliability gaps** make this unsuitable for public alpha. Target the next milestone at ~8.0/10 for a limited beta.

---

## SECTION 7 — RELEASE CHECKLIST

### Alpha Release Checklist

#### Blockers (Must fix before any public release)

- [ ] **Cancel finalizes all sessions** — `ExecutionSessionManager.cancel()` must set `stepByExecId` sessions to "error" with `streamState: "failed"`
- [ ] **Terminal display path** — Re-establish COMMAND_START/OUTPUT/COMPLETE rendering via ExecutionSessionManager → TerminalBlock (or confirm the AGENTS.md note is outdated and verify the path actually works)
- [ ] **Retry button on failure** — Add "Retry" button to `AssistantResponse.tsx` error state that re-queues the same input
- [ ] **StreamManager CPU fix** — Change `streams.size > 0` check to only reschedule rAF when active streams have pending tokens
- [ ] **StreamManager memory fix** — Add `clearStep()` call in `ExecutionSessionManager` after `MESSAGE_COMPLETE` / `EXECUTION_FAILED`
- [ ] **stepByExecId cleanup** — Add cleanup in `EXECUTION_COMPLETE` and `EXECUTION_FAILED` handlers

#### Known Issues (Document for alpha users)

- [ ] Tool results truncated to 200 chars — full result available in agent context but not via UI
- [ ] Phase timeline disappears after response completes
- [ ] FileEditBlock diff shows only additions (`+`), no deletions visualized
- [ ] Non-latest tool calls default-collapsed — detail buried
- [ ] Tool arguments parsed as JSON — malformed args silently become `{}`
- [ ] SSE parse errors silently dropped — no warning counter
- [ ] No "New messages below" scroll indicator
- [ ] MAX_EVENTS=500 cap is silent — old messages dropped without notification

#### Polish Items (Before alpha)

- [ ] PhaseTimeline: keep visible (collapsed) after completion so user can review
- [ ] ToolCallBlock: syntax highlighting for args/result
- [ ] StreamingContent: move toward progressive markdown rendering during stream
- [ ] TerminalBlock: add live streaming output (if path works), ANSI color support
- [ ] TerminalBlock: add "Show N more lines" button for long output
- [ ] FileOpBlock: add "Show N more lines" button for long file content
- [ ] Conversation timeline: add "New messages below" chip when scrolled up
- [ ] ExecutionHeader: show first-token latency in UI
- [ ] Cancel button: change composer cancel to also cancel via `ExecutionSessionManager.cancel()`
- [ ] Session timeout: add "Still working..." after 60s

#### Documentation Gaps

- [ ] No user-facing README for AgenticOS
- [ ] No architecture documentation (AGENTS.md is developer-only)
- [ ] No troubleshooting guide for provider setup
- [ ] No known issues page
- [ ] No contributing guide
- [ ] No API documentation for the event protocol

#### Onboarding Gaps

- [ ] First-launch experience: no welcome screen or getting-started flow
- [ ] Provider configuration: no guided setup wizard
- [ ] No example prompts or quick-start commands
- [ ] No keyboard shortcut reference
- [ ] No settings explanation (execution modes, provider priority, etc.)

---

## FINAL OUTPUT

### Final Score: 5.8/10

Breakdown:
- Architecture: 8/10 (solid foundation, well-designed event protocol)
- Streaming UX: 5/10 (no progressive markdown, dead terminal path)
- Tool/File UX: 6/10 (basic rendering, truncated results)
- Reliability: 5/10 (2 memory leaks, cancel bug, no retry)
- Polish: 5/10 (functional but far from premium)
- Documentation: 3/10 (developer-only, no user-facing docs)

### Top 10 Remaining Issues

| # | Issue | Severity | Est. Effort |
|---|-------|----------|-------------|
| 1 | Cancel leaves dangling sessions | **CRITICAL** | 1h |
| 2 | StreamManager memory leak (clearStep never called) | **CRITICAL** | 2h |
| 3 | Continuous rAF loop (CPU waste) | **CRITICAL** | 1h |
| 4 | stepByExecId Map never cleaned | **CRITICAL** | 1h |
| 5 | Terminal display path dead | CRITICAL | 4h |
| 6 | No retry UX on failure | HIGH | 2h |
| 7 | [DONE] breaks inner loop only (potential hang) | HIGH | 1h |
| 8 | Mid-stream error treated as success | HIGH | 1h |
| 9 | Unbounded agentSessions Map | HIGH | 1h |
| 10 | Compactor drops 40% with no notification | HIGH | 2h |

### Recommended Next Milestone

**Beta-1** — Target: 8.0/10

Focus on:
1. Fix all 6 critical issues (C1-C4, H4, H2) — ~11h
2. Fix top 3 high issues (H1, H3, H5) — ~3h
3. Add 5 polish items (PhaseTimeline persistence, syntax highlighting, terminal live output, "Show more" buttons, scrolling chip) — ~12h
4. Write alpha documentation (README, troubleshooting, known issues) — ~6h

**Estimated path to Beta-1:** ~32h of implementation work

### Estimated Path to 8.5/10

To reach 8.5/10 from current 5.8/10:
- Fix all Critical/High items (17h)
- Add retry + cancel UX (4h)
- Add progressive markdown rendering (8h)
- Add terminal ANSI + live output (6h)
- Add "Show X more" across all output types (4h)
- Add provider fallback on failure (4h)
- Documentation + onboarding (8h)

**Total: ~51h**

### Estimated Path to 9/10

To reach 9/10 (competitive with Claude Code Desktop):
- All above (51h)
- Add tool result streaming (6h)
- Add plan preview before execution (8h)
- Add structured reasoning block (4h)
- Add tool-call grouping (4h)
- Add provider fallback chain (8h)
- Add "Resume after cancel" (4h)
- Add session timeline history browsing (4h)
- Add comprehensive integration tests for all failure modes (8h)

**Total: ~97h**

---

*Report generated 2026-05-29. Read-only audit — no code was modified.*
