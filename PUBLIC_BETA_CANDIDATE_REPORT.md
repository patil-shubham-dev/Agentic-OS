# PUBLIC BETA CANDIDATE REPORT

**Decision Date:** 2026-05-30
**Candidate:** AgenticOS v2.1.0
**Type:** Desktop AI coding assistant (Tauri + Rust + React)

---

## Final Decision

> **YES — ship to 1000 beta users.**

The core loop works. A developer CAN open a project, search files, edit files, run commands, and get agent assistance. The product is usable for daily development work.

But users will be forgiving. Beta users need to know they're on day-one software.

---

## Workflow Scores

| Workflow | Score | Verdict |
|----------|-------|---------|
| Bug fixing | B- | Search + edit works. Diffs truncated at 200 chars. No diff visibility during streaming. |
| Codebase exploration | B | Agent reads files and builds understanding. 2-3s overhead before first token feels slow. |
| Large refactor | C+ | Search + batch edit works. Risk of partial edits. Tool errors invisible — user can't tell if all files were found. |
| Terminal-driven work | A- | Streaming works. No hangs. No zombie sessions. Output auto-collapses on success (users must click to expand). |
| Daily usage (1hr) | C+ | Core loop reliable. Friction from infinite spinners, invisible tool errors, cancel delays. |
| First-time user | D | 12-20 clicks to first message. Skip leaves dead end. Raw errors in chat. No in-app guidance. |

---

## Top 10 Beta User Complaints (In Order of Frequency)

### 1. "I clicked the button but nothing happened... then 30 seconds later it worked"

**What users will say:** "I typed a message, nothing happened for 10 seconds, I clicked send again, and then it sent twice."

**Why:** The agent has a ~2-3s overhead before the provider even receives the prompt (routing → context assembly → prompt compilation). For local models (Ollama), first token can take 10-30s. The UI shows "Connecting to {provider}..." with no elapsed time, no progress bar, and no "still working" heartbeat.

**Frustration:** 4/5
**Severity:** Medium — functional but feels broken.

### 2. "I tried to cancel but the agent kept going"

**What users will say:** "I clicked cancel, the button changed back, but the agent kept streaming for another 20 seconds. I thought it was stuck."

**Why:** `AbortController.abort()` fires but the provider's HTTP stream handles it asynchronously. The `for-await-of` loop only checks `signal.aborted` BETWEEN chunks. No force-stop timeout on cancellation. Cancel button reverts to send button instantly (100ms transition) with no "cancelling..." state.

**Frustration:** 5/5
**Severity:** High — trust-eroding. Users feel the app ignores their commands.

### 3. "The agent said it ran a command but I saw nothing"

**What users will say:** "The agent said 'Let me check' but nothing appeared in the chat. Did it fail? Is it still running? I have no idea."

**Why:** Tool errors have NO visual representation in the UI. The `ExecutionEvent` type (30 variants) has NO `TOOL_ERROR` event. When `grep_files`, `run_command`, or any tool fails, the error is logged to console only. The user only finds out if the agent happens to mention it. Tool result content is also truncated to 200 chars.

**Frustration:** 5/5
**Severity:** Critical — users can't trust the agent's actions.

### 4. "The loading spinner just kept spinning forever"

**What users will say:** "I opened a project and the file tree showed a loading animation that never stopped. I had to restart the app."

**Why:** Zero timeouts on any loading state. File tree skeleton, snapshot browser, install panel, runtime initialization — every loading state is indefinite. If a Tauri command fails silently or a file operation hangs, the spinner spins forever.

**Frustration:** 5/5
**Severity:** High — requires app restart.

### 5. "I skipped onboarding and now I'm stuck"

**What users will say:** "I clicked 'Skip' during setup, and now the app shows a 'Setup Required' screen with no way forward. I had to delete localStorage to start over."

**Why:** Clicking "Skip onboarding" sets a localStorage flag but creates an empty configuration. No provider, no agent, no models. The chat panel shows a 3-item checklist ("Add a provider" / "Add an API key" / "Configure a manager") but no navigation to settings. User is trapped.

**Frustration:** 5/5
**Severity:** Critical — blocks all usage.

### 6. "I typed a message and it said 'Runtime is still initializing'"

**What users will say:** "The app looked ready. I typed my question, hit send, and got an error. Why show the send button if it's not ready?"

**Why:** The chat input is enabled before the runtime finishes booting. If the user types faster than ~2-3s startup, they hit the uninitialized state. The error is shown as a chat message — no guidance, no "please wait" indicator.

**Frustration:** 4/5
**Severity:** Medium — user confusion on first interaction.

### 7. "The app showed me a scary error message with code in it"

**What users will say:** "Something broke and the app showed me 'TypeError: Cannot read properties of undefined' with a full stack trace. I'm not a developer — what do I do with this?"

**Why:** `SafeErrorBoundary` displays `this.state.error?.message` with 6 lines of stack trace. No friendly message, no recovery options beyond "Reload Panel" or "Open Logs". Root-level crashes show a blank white screen.

**Frustration:** 4/5
**Severity:** Medium — intimidating but recoverable.

### 8. "The agent edited a file wrong and I couldn't see what changed"

**What users will say:** "The agent said it fixed my code but I can't tell what it changed. The diff was cut off after 200 characters."

**Why:** Tool result content is truncated to 200 chars in `ExecutionSessionManager.ts:174` (`event.result?.slice(0, 200)`). Large file diffs are arbitrarily chopped. During streaming, no diff preview is shown at all — user waits blindly until edits are committed.

**Frustration:** 3/5
**Severity:** Medium — reduces trust in edits.

### 9. "Setting up a provider was really confusing"

**What users will say:** "I had to find my API key, paste it, wait for validation, select models from a dropdown, save, then go to a different settings page to assign it to a role. Why can't it just work?"

**Why:** ~12-20 clicks from install to first working message. Provider drawer resets all state on accidental close. Model discovery is blocking (no "enter manually" fallback). No in-chat error guidance when provider configuration is wrong.

**Frustration:** 4/5
**Severity:** High — significant initial barrier.

### 10. "The agent keeps re-running the same failed command"

**What users will say:** "I asked it to search for something and it said 'command not found' three times in a row. It's stuck in a loop."

**Why:** Agent retries failed tools naturally (it's an LLM — it doesn't have persistent memory of which tools failed). No circuit breaker or tool failure cache. Each retry wastes 2-5s + LLM tokens. Users see multiple error cycles.

**Frustration:** 3/5
**Severity:** Medium — wastes time and tokens.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| User sees blank white screen on launch | Low | Critical | Hard refresh fixes it; beta users report it immediately |
| User gets trapped in onboarding | Medium | Critical | Share localStorage reset instructions in first-launch email |
| Tool errors invisible (agent silently fails) | High | High | Frequent in first week; users learn to read agent's response carefully |
| Infinite spinner requires app restart | Low | Medium | Users learn to Ctrl+R to fix |
| Cancel doesn't stop execution quickly | Medium | Medium | Users learn to wait or force-close |
| Provider config lost on accidental drawer close | Medium | Medium | Users re-enter fields; frustration builds over time |

---

## Recommended Beta Communication

### In-app banner (shown on first launch):

> **AgenticOS Public Beta**
> You're among the first 1000 users. Things will break. Here's what to expect:
> - First message takes 2-5s before the agent responds (longer for local models)
> - Click cancel and wait — it takes a moment to stop
> - If a loading spinner doesn't stop: refresh the app
> - Settings can be reset in `Settings → Advanced → Factory Reset`
>
> Report issues: [link to GitHub issues]

### Known issues doc (in app README):

```
KNOWN ISSUES — AGENTICOS PUBLIC BETA

1. No inline diff during streaming edits
2. Tool errors invisible in chat (check console)
3. Cancel delay: 5-30 seconds
4. Skip onboarding creates dead end
5. No file watching (manual refresh needed)
6. Provider drawer state lost on accidental close
7. 200-char truncation on tool results
8. Browser automation not available (future release)
```

---

## Verdict

```
RELEASE TO 1000 BETA USERS:  YES ✓

Core functionality is solid:
├── Terminal execution           ✅ (was broken, now streaming)
├── Folder tree                  ✅ (was broken, now visible)
├── File read/write/edit         ✅
├── Content search (grep/glob)   ✅ (was broken, now works)
├── Git operations               ✅
├── Agent orchestration          ✅
└── Design tools                 ✅

Beta users will complain about:
├── Invisible tool errors        ⚠️ (most common complaint)
├── Onboarding friction          ⚠️ (biggest drop-off point)
├── Cancel not responsive        ⚠️ (most trust-eroding)
├── Infinite spinners            ⚠️ (most frustrating)
└── Raw error messages           ⚠️ (most scary)

These are polish issues, not architecture issues.
Beta expectations match this profile.
```

---

## What to Fix Before Public Launch (not beta)

| Priority | Fix | Effort |
|----------|-----|--------|
| P0 | Add `TOOL_ERROR` event to `ExecutionEvent` + render in chat | 2 hours |
| P0 | Add timeout to all loading states (default: 30s + retry) | 1 day |
| P0 | Fix "Skip onboarding" dead end — redirect to settings | 2 hours |
| P1 | Add cancel force-stop timeout (5s max) | 2 hours |
| P1 | Show elapsed time during "Connecting..." phase | 1 hour |
| P1 | Show friendly error messages (no stack traces) | 1 day |
| P2 | Remove 200-char truncation on tool results | 30 min |
| P2 | Add "cancelling..." state to cancel button | 1 hour |
| P2 | Provider drawer: confirm before closing with unsaved changes | 2 hours |
| P3 | Inline diff during streaming edits | 2-3 days |
| P3 | Tool circuit breaker (don't retry failed tools) | 1 day |
