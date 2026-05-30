# BETA LAUNCH DECISION

> Generated: 2026-05-30
> Phase 7 of the Final Beta Launch Validation Sprint

---

## QUESTION

Would you personally deploy this build to:

- 100 users?
- 1000 users?
- 5000 users?

---

## ANSWER: 100 USERS

### YES

**Why:** The core loop works. A motivated early adopter who runs `npm install`, opens a project, and asks "explain this code" or "find where the API is defined" will get a working answer within seconds. The Terminal, Search, File operations, and Git all function for common cases. Errors are visible (not silently swallowed). The cancel button visually responds. Onboarding completes in ~10 seconds for Ollama users.

**Trust baseline:** A technical user on a local network with Ollama or a configured API key can productively use the tool for single-query tasks. The refactoring / multi-file edit / agent-orchestration workflows will occasionally surprise them, but the core loop is sound.

**Top 3 risks they will encounter within 48 hours:**
1. Cancel doesn't kill terminal processes — `npm install` keeps running on the backend after cancel
2. "undefined" error when agent tries to use browser tools — confusing but non-fatal
3. Git operations with no timeout — SSH host key prompt produces an infinite spinner

**Will they give up?** No — the first experience is fast enough and the core features work well enough that technical users will tolerate rough edges.

**Will they tweet complaints?** Yes — "Just tried AgenticOS, cancelled a build command, but npm install kept running for 60s. Still, the search and edit are great." — net positive.

---

## ANSWER: 1000 USERS

### NO

**Why:** The scaling from 100 to 1000 users crosses a reliability threshold. With 100 users, most edge cases don't manifest. With 1000 users, every race condition and missing timeout produces a visible failure within the first week.

**What will break at 1000 users:**
1. **Terminal process leak (Z8):** 100 users × 3 cancellation events/day × 60s process lifespan = 3000 process-seconds/day of wasted system resources. Users will notice their `tmp` filling up with abandoned processes.
2. **Infinite spinner reputation:** One Reddit post saying "Git push hung forever" will create a perception that the entire tool is unreliable, even though file operations work fine.
3. **"undefined" errors:** User posts screenshot of "undefined" in chat → comment thread calls the project "pre-alpha vaporware" → trust destroyed.
4. **Approval gate silent timeout:** Users waiting for responses that never arrive → "the tool just stops working sometimes" → support tickets flood in.
5. **No retry button:** Users see tool failure with no action → frustration → churn.

**The math:**
- 18 passing checks out of 41 = 44% passing rate
- 9 known failing items × 1000 users = 9000 failure events
- Each failure event = 1 user who loses trust
- Even 1% of users publicly complaining = 10 negative posts
- In the current AI tool landscape (Claude Code, Cursor, VS Code Copilot), negative posts spread fast

**Will they give up?** Yes — the majority of 1000 users will give up within their first hour if they hit an infinite spinner or an "undefined" error. The first impression is critical, and at 1000 users, the chance that SOMEONE hits each failure mode approaches 100%.

**Will they tweet complaints?** Yes — and these will reach a wider audience. The complaints won't be "npm install keeps running after cancel" — they'll be "AgenticOS is broken" with a screenshot of the spinner.

---

## ANSWER: 5000 USERS

### NO

**Why:** See 1000 users, but worse. At 5000 users, project monitoring tools (Reddit, HN, Twitter) will surface every failure. The "undefined" browser tool error alone will be screenshot'd and shared across every platform.

**Additional risks at 5000:**
- Storage growth from orphaned `streamingTexts` entries → users with 100+ conversations see degraded localStorage performance
- Session accumulation → `getActiveSessions()` iterating 500+ entries (UI responsiveness may degrade)
- Support: 5000 users × 3 issues/user × 5 minutes/issue = 416 engineering hours to respond = 2 months of full-time support
- Perceived quality: In a market where Claude Code and Copilot are polished products, shipping with 9 known failures signals "rushed" and "unserious"

---

## WHAT MUST BE FIXED BEFORE ANY LAUNCH

### P0 — Must fix before 100 users:

1. **Terminal abort mechanism (Z8):** Add `invoke("kill_command")` to the Rust backend. Check `signal.aborted` in TerminalRuntime polling loop. This is the single biggest trust-killer because cancelled operations should feel final.
2. **Hide browser tools (11 commands):** Either remove them from the tool registry, or register them with a proper error message ("Browser automation is not yet available"). The current "undefined" error is the worst possible user experience — it looks like a bug, not a missing feature.

### P1 — Must fix before 1000 users:

3. **Git timeouts:** Add 30s timeout to all git operations. Wrap `invoke()` calls in `withTimeout(30000)`.
4. **EventChannel abort (Z12):** Add `AbortSignal` to EventChannel constructor. Clear buffer and reject pending promises on abort.
5. **StreamManager cancellation guard (Z9):** Add `this.cancelled` flag to StreamManager. `append()` checks this flag and drops tokens during cancellation.
6. **Tool loop abort (Z6):** Add `signal.aborted` check in `for (const tc of responseToolCalls)` in AgentExecutor.
7. **Signal forwarding to terminal (Z7):** Pass `ctx.signal` through `implRunCommand` → `executeTerminalTool` → `runStream()`.
8. **Validation in onboarding:** Test the API key or Ollama connection before marking setup as complete.

### P2 — Must fix before 5000 users:

9. **Sessions Map pruning (Z4):** Delete entries from `ExecutionSessionManager.sessions` after successful cleanup.
10. **Approval gate timeout notification:** Show a "Request timed out" toast instead of silently dismissing.
11. **Retry button on tool failures:** Add a "Retry" action next to failed tool calls in the chat UI.
12. **Per-operation timeouts on file reads:** Add 10s timeout to `readTextFile` calls in search-utils.

---

## FINAL RECOMMENDATION

| Tactic | Users | Verdict |
|--------|-------|---------|
| **Private alpha** (invite-only) | 10-50 | ✅ **SHIP NOW** |
| **Closed beta** (signup) | 100 | ✅ **SHIP with 2 P0 fixes** (terminal abort + hide browser tools) |
| **Public beta** (open to all) | 1000 | ❌ **BLOCKED — fix all P0+P1 first** |
| **General availability** | 5000+ | ❌ **BLOCKED — fix all P0+P1+P2** |

### What I would personally do:

1. Fix P0 items (terminal abort + hide browser tools) — **2 days of engineering**
2. Fix P1 items (git timeouts, EventChannel abort, StreamManager guard, tool loop abort, signal forwarding, onboarding validation) — **3-4 days of engineering**
3. Launch closed beta to 100 users — **week 1**
4. Fix P2 items based on beta feedback — **week 2-3**
5. Open public beta to 1000+ users — **week 4**

**Total time to public beta: ~4 weeks of targeted engineering.**

**Current blockers:**
- Terminal backend: Need `invoke("kill_command")` in Rust + `signal.aborted` check in TypeScript
- Browser tools: Need tool registry filter or proper error handler
- Git: Need `withTimeout(30000)` wrapper on all invocations
- StreamManager/EventChannel: Need ~50 lines of abort-protection code
- AgentExecutor: Need ~10 lines of abort checks in inner loops
- Signal forwarding: Need ~5 lines of parameter passing

**Total estimated P0+P1 effort: ~60 hours (1.5 weeks).**
