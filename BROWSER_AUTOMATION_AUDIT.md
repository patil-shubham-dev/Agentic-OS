# BROWSER AUTOMATION AUDIT

## Verdict: 100% dead code. Zero browser automation exists.

Despite having:
- **780 lines** of browser workspace UI (`browser-workspace.tsx`)
- **289 lines** of browser automation step wrappers (`browser-automation.ts`)
- **53 lines** of browser invoke API (`browser.ts`)
- **10 registered agent tools** for browser operations
- **A full browser store** (`browser-store.ts`)

**There is no browser automation backend anywhere in the codebase.**

## Investigation Results

### Check 1: Rust backend
- `src-tauri/src/lib.rs`: **Zero** browser-related commands
- `src-tauri/Cargo.toml`: **No** Playwright, Puppeteer, Chromium, WebKit, or headless browser dependencies
- Rust binary has no browser capability at all

### Check 2: Playwright/Puppeteer
- `package.json`: **No** `playwright`, `puppeteer`, `puppeteer-core`, `chromium`, or `selenium` dependencies
- `node_modules`: No Playwright/Puppeteer binary installed
- No TypeScript wrapper for headless browsing exists
- No child-process-based browser launch

### Check 3: Tauri shell plugin (potential alternative)
- `@tauri-apps/plugin-shell` IS registered in `lib.rs:588`
- But `src/lib/browser.ts` does NOT use it — it calls `invoke("browser_*")` which hits non-existent commands
- The shell plugin could theoretically launch a browser binary, but there's no code that does this

### Check 4: What the code TRIES to do

The call chain (all broken):

```
Agent tool               → tool-executor.ts         → browser.ts            → Rust
────────────────────────────────────────────────────────────────────────────────────
launch_browser(url)      → implLaunchBrowser()      → invoke("browser_launch")    ❌
browser_navigate(sid,url)→ implBrowserNavigate()    → invoke("browser_navigate")  ❌
browser_click(sid,sel)   → implBrowserClick()        → invoke("browser_click")    ❌
browser_fill(sid,sel,val)→ implBrowserFill()        → invoke("browser_fill")     ❌
browser_screenshot(sid)  → implBrowserScreenshot()    → invoke("browser_screenshot") ❌
browser_execute_js(sid)  → implBrowserExecuteJs()    → invoke("browser_execute_js") ❌
browser_get_title(sid)   → implBrowserGetTitle()     → invoke("browser_get_title") ❌
browser_get_text(sid)    → implBrowserGetText()      → invoke("browser_get_text")  ❌
browser_wait(sid,...)    → implBrowserWait()         → invoke("browser_wait")     ❌
browser_close(sid)       → implBrowserClose()        → invoke("browser_close")    ❌
```

The browser-automation.ts layer adds retry logic (2 retries, 500ms delay) but retrying a command that will never exist doesn't help.

## User Impact

When an agent attempts to use browser tools:

1. Agent calls `launch_browser("https://example.com")`
2. Pipeline dispatches to `implLaunchBrowser()`
3. `invoke("browser_launch", { url })` → throws "command not found"
4. ToolExecutionPipeline catches → returns `{ isError: true, error: "Tauri command "browser_launch" not available in web mode" }`
5. Tool result shows error in conversation
6. Agent may retry or proceed without browser data

This is **silently bad** — the agent doesn't know the browser backend doesn't exist. It tries, fails, and the error is shown to the user. There's no graceful degradation.

## Estimated Implementation Effort

Building a real browser automation backend requires:

| Option | Effort | Complexity | Notes |
|--------|--------|-----------|-------|
| TypeScript puppeteer wrapper | 2-3 days | Medium | Build Chromium via CI; complex to bundle |
| Tauri plugin for headless browsing | 1-2 weeks | High | Custom Rust + C++ bridge |
| Use @tauri-apps/plugin-shell to launch puppeteer | 3-5 days | Medium | Requires bundling puppeteer-core |
| Headless Chrome via DevTools Protocol | 1 week | High | Direct WebSocket communication |

**Recommendation:** Given the scope of remaining backend gaps, browser automation should be a separate sprint. It's not critical for IDE-like workspace operations.

## Files Involved (All Dead Code)

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/browser.ts` | 53 | Low-level invoke wrappers |
| `src/lib/tool-executor.ts` (browser section) | 48 | Agent tool implementations |
| `src/lib/agents/agent-tools.ts` (browser section) | 130 | Tool registrations + prompts |
| `src/stores/browser-store.ts` | 53 | Zustand state (works fine in isolation) |
| `src/components/workspace/browser/browser-automation.ts` | 289 | Step tracking + retry wrappers |
| `src/components/workspace/browser/browser-workspace.tsx` | 798 | Full browser workspace UI |
| `src/components/workspace/browser/browser-activity-stream.tsx` | ~100 | Activity log display |
| TOTAL | ~1471 | Lines of dead code |

**All 1471 lines are unreachable because the Tauri backend doesn't exist.**
