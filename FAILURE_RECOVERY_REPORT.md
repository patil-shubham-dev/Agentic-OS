# FAILURE RECOVERY REPORT

> Generated: 2026-05-30
> Scope: All failure paths with user-facing impact

---

## TESTED SCENARIOS

### 1. Provider Crash

**What happens:** Provider transport throws TransportError during streaming

**User sees:** `"Agent execution exceeded 120s timeout"` or `EXECUTION_FAILED` event with provider error message

**Recovery:** ✅ Automatic 4-attempt fallback chain (streaming→fallback→non-streaming→fallback)

**Retry works:** ✅ User re-submits query

**App restart required:** ❌ No

**Verdict:** ✅ PASS — but error message quality depends on TransportError message

---

### 2. Tool Crash (grep/glob/terminal)

**What happens:** Tool implementation throws or returns `{ isError: true }`

**User sees:** `"Error executing {toolName}: {error}"` — shown inline in chat via TOOL_ERROR event

**Recovery:** ❌ No automatic retry. Agent continues to next tool or next round.

**Retry works:** ✅ Agent may re-invoke the tool in the next round

**App restart required:** ❌ No

**Verdict:** ⚠️ PARTIAL — error is visible but no retry action for the user

---

### 3. Workspace Removal (folder deleted while app is running)

**What happens:** Tauri file operations return `"Failed to create file: ..."` or file tree returns empty

**User sees:** Error in tool result: `"Failed to create file: Error reading directory"`

**Recovery:** ❌ No automatic recovery — user must select a new workspace

**Retry works:** ❌ Will fail again until workspace is re-selected

**App restart required:** ❌ No — user can navigate to workspace picker

**Verdict:** ⚠️ WARN — workspace removal produces ugly error messages with Tauri-native error text

---

### 4. File Permission Denied

**What happens:** Tauri returns permission error from OS

**User sees:** `"Failed to create file: Permission denied"` or `"Failed to rename: Permission denied"`

**Recovery:** ❌ No recovery path — permission is OS-level

**Retry works:** ❌ Will fail again

**Verdict:** ✅ PASS (acceptable — OS permission errors are clear enough)

---

### 5. Network Loss (WiFi disconnects)

**What happens:** Provider transport fails with connection error

**User sees:** `"Connection refused"`, `"Connection timed out"`, or `"DNS resolution failed"`

**Recovery:** ❌ No automatic retry after fallback chain exhausted

**Retry works:** ✅ User re-submits after network restored

**Verdict:** ✅ PASS — error messages are clear

---

### 6. Terminal Crash (process segfaults)

**What happens:** Tauri backend process exits with non-zero code

**User sees:** `"Command execution failed: {error}"` with exit code -1

**Recovery:** ❌ No automatic retry

**Retry works:** ✅ User or agent can re-invoke

**Verdict:** ✅ PASS — error is clear

---

### 7. Model Timeout

**What happens:** Provider transport exceeds AgentExecutor 120s hard timeout

**User sees:** `"Agent execution exceeded 120s timeout"` in chat

**Recovery:** ❌ No automatic retry at this layer

**Retry works:** ✅ User re-submits query

**Verdict:** ✅ PASS — timeout message is clear

---

### 8. Approval Gate Times Out

**What happens:** User doesn't respond to approval dialog for 60s

**User sees:** Dialog disappears silently. Tool result: `"Permission denied by user"`

**Recovery:** ❌ No notification that the request timed out

**Retry works:** ✅ Agent can retry

**Verdict:** ⚠️ CONFUSING — user may think the operation was cancelled, not timed out

---

### 9. Browser Tool Crash (unimplemented backend)

**What happens:** `invoke("browser_navigate")` — no Rust handler registered

**User sees:** `undefined` in chat

**Recovery:** ❌ None

**Retry works:** ❌ Will fail again

**App restart required:** ❌ No — tool was never implemented

**Verdict:** ❌ FAIL — shows "undefined" with no explanation

---

### 10. Root ErrorBoundary Fires

**What happens:** Unhandled exception crashes React component tree

**User sees:** Full-screen "Something went wrong" with "Reload Page" button

**Recovery:** ✅ "Reload Page" button calls window.location.reload()

**Retry works:** ✅ After reload, app state is restored from localStorage

**Verdict:** ✅ PASS — friendly message, single action

---

## SUMMARY MATRIX

| Scenario | Friendly Error? | Recovery Path? | Retry Works? | App Restart Needed? | Verdict |
|----------|----------------|---------------|--------------|-------------------|---------|
| 1. Provider crash | ✅ Yes | ⚠️ Automatic fallback | ✅ Yes | ❌ No | ✅ PASS |
| 2. Tool crash | ✅ Yes (TOOL_ERROR) | ❌ No automatic | ✅ Agent retries | ❌ No | ⚠️ PARTIAL |
| 3. Workspace removed | ⚠️ Ugly Tauri text | ❌ None | ❌ No | ❌ No | ⚠️ WARN |
| 4. Permission denied | ✅ Yes | ❌ None | ❌ No | ❌ No | ✅ PASS |
| 5. Network loss | ✅ Yes | ❌ None (after fallback) | ✅ Yes | ❌ No | ✅ PASS |
| 6. Terminal crash | ✅ Yes | ❌ None | ✅ Yes | ❌ No | ✅ PASS |
| 7. Model timeout | ✅ Yes | ❌ None | ✅ Yes | ❌ No | ✅ PASS |
| 8. Approval timeout | ❌ Silent | ❌ None | ✅ Yes | ❌ No | ⚠️ CONFUSING |
| 9. Browser tool | ❌ "undefined" | ❌ None | ❌ No | ❌ No | ❌ FAIL |
| 10. Root crash | ✅ Yes | ✅ Reload button | ✅ Yes | ⚠️ Page reload | ✅ PASS |

---

## ROOT CAUSES OF FAILURE

### Fatal (must fix before beta):
1. **Browser tools show "undefined"** — 11 commands with no Rust backend, zero error handling in ToolExecutor. These tools are exposed to the agent but always fail. When agent invokes them, user sees literal "undefined" in chat.

### High (trust-eroding):
2. **Approval gate silent timeout** — Dialog disappears with no "Timed out" notification. User may wait for response that never comes.
3. **Workspace removal ugly errors** — Tauri-native error text shown verbatim. Not catastrophic but unprofessional.
4. **No user-facing retry button** — After tool failure, user must manually re-prompt. No "Retry" action on failed tool calls.

### Medium:
5. **"undefined" in 8 of 11 error paths** — `String(undefined)` = `"undefined"` in the UI. Any throw undefined/throw null upstream produces this.
