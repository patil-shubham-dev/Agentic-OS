# FINAL RELEASE CHECKLIST

> Generated: 2026-05-30
> Method: Claim verification against actual source code

---

## 1. CORE OPERATIONS

### Terminal execution
- [x] `run_command` + `run_command_stream` registered in Rust (src-tauri/src/lib.rs:409-479)
- [x] 60s timeout in runStream() (TerminalRuntime.ts:85)
- [x] Buttons: send command, see output, cancel — all exist
- [ ] **NOT VERIFIED:** Cancel does NOT kill the backend process (Z8 — CRITICAL)
- [ ] **NOT VERIFIED:** 60s timeout is only guard — no per-command timeout
- [ ] **NOT VERIFIED:** `npm install` with 1000+ packages still running >60s

### Folder tree
- [x] Root cause fixed: `contain:strict` → `contain:layout paint style` (file-tree.tsx:840)
- [x] Scroll container: `flex-1 overflow-auto min-h-0` (file-tree.tsx:898-902)
- [x] Tree renders with files and directories
- [ ] **NOT VERIFIED:** Tree does not auto-refresh after file changes
- [ ] **NOT VERIFIED:** 20-level depth limit is hardcoded — no user control

### Search
- [x] grep_files and glob_files rewritten in TypeScript (search-utils.ts)
- [x] 300-file cap, 500-match cap, 1MB per-file limit
- [x] No Rust backend required
- [ ] **NOT VERIFIED:** Large binary files can hang `readTextFile` (no timeout)
- [ ] **NOT VERIFIED:** Search cannot find files in symlinked directories

### File operations
- [x] read_file, write_file, edit_file all work via tauri-plugin-fs
- [x] Works with Tauri and web fallback modes
- [ ] **NOT VERIFIED:** No permission prompt before file writes
- [ ] **NOT VERIFIED:** Concurrent writes to same file not coordinated

### Git
- [x] Git panel has buttons for all operations
- [x] Commands invoke through Tauri shell
- [ ] **NOT VERIFIED:** NO TIMEOUT on any git operation — buttons can produce infinite spinners
- [ ] **NOT VERIFIED:** Git operations not tested with SSH authentication
- [ ] **NOT VERIFIED:** No error shown for repos without commits

---

## 2. RELIABILITY

### No dead buttons
- [ ] **NOT VERIFIED:** 11 browser automation buttons invoke Tauri commands with NO Rust backend
  - `browser_navigate`, `browser_click`, `browser_fill`, `browser_close`, `browser_screenshot`, `browser_execute_js`, `browser_get_title`, `browser_get_text`, `browser_wait`, `browser_launch`, `browser_get_url`
- [ ] **NOT VERIFIED:** These tools are exposed to the agent — agent can try to use them
- [ ] **NOT VERIFIED:** When used, user sees `"undefined"` error

### No fake AI features
- [x] All LLM integrations go through real provider transports
- [x] No hardcoded responses
- [x] No simulated behaviors

### No raw stack traces in production
- [x] SafeErrorBoundary hides stack traces by default (user must click "Show Details")
- [x] RootErrorBoundary shows only "Something went wrong"
- [x] All catch blocks use `err.message` or `String(err)` — no stack traces
- [ ] **WARN:** "Show Details" in SafeErrorBoundary shows error message but not full stack trace — this is acceptable

### No invisible tool failures
- [x] TOOL_ERROR event added to ExecutionEvent protocol
- [x] ExecutionSessionManager routes TOOL_ERROR to timeline store
- [x] ToolErrorDisplay renders failed tool calls with error message
- [ ] **NOT VERIFIED:** ToolErrorDisplay uses `tc.result` which truncates to "Error: {msg}" — complete error may not be shown
- [ ] **NOT VERIFIED:** Silent failures may still occur for tools that throw before yielding TOOL_START

### No infinite spinners
- [ ] **NOT VERIFIED:** Git operations have NO timeout — infinite spinner possible
- [ ] **NOT VERIFIED:** File tree load has NO timeout — infinite spinner possible
- [ ] **NOT VERIFIED:** MCP connect has NO timeout — infinite spinner possible
- [x] workspace-store.setLoading has 30s auto-reset
- [x] AgentExecutor has 120s hard timeout

### Cancel works
- [x] Cancel button exists and calls ExecutionSessionManager.cancel()
- [x] 800ms cancelling state visible to user
- [x] 5s force-stop timeout
- [ ] **NOT VERIFIED:** Terminal processes CONTINUE after cancel (Z8)
- [ ] **NOT VERIFIED:** Late EventChannel tokens create orphaned store entries (Z9, Z10, Z12)
- [ ] **NOT VERIFIED:** AgentExecutor runs current tool round to completion (Z6)
- [ ] **NOT VERIFIED:** Sessions Map never pruned (Z4)

### Error boundaries work
- [x] RootErrorBoundary catches all unhandled React crashes
- [x] SafeErrorBoundary wraps each route
- [x] SidebarBoundary, WorkspaceBoundary exist for specific sections
- [ ] **NOT VERIFIED:** RootErrorBoundary is in App.tsx — if it fails itself, user sees blank white screen
- [ ] **NOT VERIFIED:** RootErrorBoundary does NOT wrap the error boundary itself (no double-wrapping)

---

## 3. UX VERIFICATION

### Onboarding completes
- [x] Onboarding has 4 steps (welcome, provider, setup, ready)
- [x] Skip button bypasses to main screen
- [x] SetupRequired component has links to Settings
- [ ] **NOT VERIFIED:** Onboarding does NOT validate API key — user can complete with invalid key
- [ ] **NOT VERIFIED:** Skip disables Ollama auto-detect path

### First answer succeeds
- [x] Provider and model configured during onboarding
- [x] First message triggers execution pipeline
- [x] Response streams back to chat
- [ ] **NOT VERIFIED:** If Ollama auto-detected but slow, first query takes >30s with no progress indicator
- [ ] **NOT VERIFIED:** No workspace set → first search returns 0 results with no explanation

### SetupRequired navigation works
- [x] "Add an AI Provider" → /settings
- [x] "Set API Key" → /settings
- [x] "Configure Manager Role" → /agents

---

## SUMMARY

| Category | Passing | Failing | Unknown |
|----------|---------|---------|---------|
| Core operations | 5 | 3 | 4 |
| Reliability | 7 | 4 | 7 |
| UX | 6 | 2 | 3 |
| **Total** | **18** | **9** | **14** |

### Failing items (must fix):
1. CRITICAL: Terminal cancel doesn't kill backend process (Z8)
2. CRITICAL: 11 browser tools show "undefined" with no Rust backend
3. HIGH: Git operations have no timeouts — infinite spinners
4. HIGH: EventChannel has no abort mechanism (Z12)
5. HIGH: StreamManager recreates streams after clearAll (Z9)
6. HIGH: AgentExecutor tool loop runs to completion after cancel (Z6)
7. HIGH: Signal not forwarded to terminal tool execution (Z7)
8. HIGH: 800ms forced UI reset can allow new message while old one still running (Z1)
9. MEDIUM: No validation of API key during onboarding

### Items tested but working:
- Terminal execution (timed, basic)
- Folder tree rendering
- Search (grep/glob)
- File operations
- Error boundaries (basic catch)
- TOOL_ERROR visibility
- Cancel button UI (visual only)
- Onboarding flow (basic)
- Memory leak profile (acceptable)

---

## VERDICT

**NOT READY for release.**

18 passing, 9 failing, 14 untested.

3 CRITICAL, 6 HIGH issues remain.
