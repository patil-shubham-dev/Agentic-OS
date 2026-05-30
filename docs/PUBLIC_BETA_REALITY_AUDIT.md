# PUBLIC BETA REALITY AUDIT

**Date:** 2026-05-29  
**Purpose:** Verify whether implemented features are production-ready or merely foundations.  
**Rule:** Brutal honesty. No sugar-coating.

---

## 1. AUTOCOMPLETE — Classification: FOUNDATION (barely)

### What Exists
- Monaco `InlineCompletionsProvider` registered for all languages
- File-internal pattern matching (scans current file for repeated patterns)
- Search index fallback (queries workspace in-memory index)
- AI completion slot (stubbed — always returns `null`)
- Metrics store (tracks suggestions, accepts, latency)

### What Doesn't Work
- **AI completions are completely stubbed.** `requestAiCompletion()` resolves with `null` after 100ms. Comment reads: "For now, AI completions return null." The zero-credit completion feature is dead code.
- **No language server integration.** No semantic tokens, no AST-aware completion. Pure regex/string matching.
- **No cross-file context.** Search index fallback is best-effort, no scoping or import resolution.
- **Completion tracking bug:** Escape reject is never tracked — keyCode check for `Escape` path incorrectly checks for `keyCode === 9` (Tab) instead of `keyCode === 27`.
- **No snippet support.** No `complete` property on completion items.
- **Large file freeze risk.** `findSimilarPatterns` iterates every line on every keystroke. No throttling. Files with >10K lines will freeze.

### Comparison to Cursor
| Metric | Cursor Tab | AgenticOS |
|--------|-----------|-----------|
| AI completions | ✅ Multi-line, project-aware | ❌ Stubbed to `null` |
| Completion latency | <50ms | ~3ms (pattern only) |
| Language awareness | ✅ Full LSP | ❌ Regex only |
| Acceptance rate | ~70% | 0% (no AI to accept) |

### Verdict
**Foundation.** The pattern matcher works for trivial cases (repeated CSS properties, enum values). But without working AI completions, this is a tech demo, not a productivity feature. No professional developer would find it useful.

---

## 2. INLINE AI EDITING — Classification: BETA READY (low confidence)

### What Exists
- Prompt construction: file path + language + full content + selected code + instruction
- Provider resolution via workspace runtime (reads configured coder role)
- API call to OpenAI-compatible endpoint (non-streaming)
- Abort support (wired to regenerate)
- Polished overlay UI: animations, loading skeleton, error state, retry
- Diff viewer: computes hunks, renders add/remove/context lines
- Accept All / Reject All buttons

### What Doesn't Work
- **No streaming.** Uses non-streaming `chatCompletion`. Large edits show skeleton loader for 30+ seconds with no feedback.
- **Hunk-by-hunk accept is a UI illusion.** `InlineDiffViewer` accepts `onAcceptHunk`/`onRejectHunk` props, but `InlineEditOverlay` never passes them. The hunk-level check/X buttons render but do nothing.
- **Diff algorithm is naive.** Custom LCS-style diff finds the first changed block and emits a single hunk. Multi-region edits (changes at top AND bottom) miss the second hunk entirely.
- **No surgical patch application.** Accept replaces selected code with AI output. No hunk-based patching. If AI returns different surrounding context, file breaks.
- **Prompt includes full file content.** No context window management. 8000-line files will exceed model limits silently.

### Comparison to Cursor
| Metric | Cursor Cmd+K | AgenticOS |
|--------|-------------|-----------|
| Streaming | ✅ Yes | ❌ No |
| Hunk-by-hunk accept | ✅ Yes | ❌ UI only, no-op |
| Diff accuracy | ✅ Full LCS/PATIENCE | ❌ Naive single-hunk |
| Context management | ✅ Smart windowing | ❌ Full file dump |

### Verdict
**Beta Ready — barely.** The flow works for the simplest case: select code, type instruction, get replacement. But the hunk-level UI is misleading, there's no streaming feedback, and the diff algorithm is too simple for real refactoring. This will frustrate developers on the second use case that involves multiple changes.

---

## 3. TERMINAL — Classification: FOUNDATION

### What Exists
- xterm.js wrapper with FitAddon and proper theming
- `InteractiveTerminalRuntime` using `@tauri-apps/plugin-shell` `Command.spawn()`
- Multi-tab terminal with split pane support
- Session lifecycle management (kill, cleanup, restart)
- Platform-aware shell selection (cmd.exe on Windows, /bin/bash on Unix)

### What Doesn't Work
- **No PTY.** `Command.spawn()` creates a process with piped stdio, not a pseudo-terminal. `ssh`, `vim`, `less`, `python` REPL, and any TTY-dependent program will misbehave or refuse to run.
- **Resize is a no-op.** `resize()` in `InteractiveTerminalRuntime` is literally a comment: `// no-op -- future: Tauri invoke for PTY resize`. The terminal emulator resizes (FitAddon), but the child process never knows.
- **Two conflicting implementations.** `TerminalRuntime.ts` uses Tauri invoke (`run_command`/`run_command_stream`), while `InteractiveTerminalRuntime.ts` uses the shell plugin. Neither `run_command` nor `run_command_stream` is registered in `lib.rs`. Only the shell plugin path works.
- **Ctrl+C undefined on Windows.** `cmd.exe` receives `\x03` as stdin text, not as a signal. Process termination behavior is unpredictable.
- **No environment propagation.** Shell profile scripts (.bashrc, .zshrc) are not loaded. PATH, virtualenvs, nvm are missing.
- **Split panes are mirrors.** Both panes share the same child process. They're decorative, not independent.
- **`spawnSession` in `useEffect`** has no error handling. If the shell fails to spawn, the error is swallowed silently.

### Comparison to VS Code / Claude Code
| Capability | VS Code Terminal | Claude Code | AgenticOS |
|-----------|-----------------|-------------|-----------|
| PTY | ✅ xterm.js + node-pty | ✅ Native PTY | ❌ Pipe only |
| Resize | ✅ Dynamic | ✅ Native | ❌ No-op |
| Interactive (ssh, vim) | ✅ | ✅ | ❌ Fails |
| Ctrl+C | ✅ | ✅ | ❌ Windows only |
| Shell profile | ✅ Loads .bashrc | ✅ Inherits | ❌ Missing |

### Verdict
**Foundation.** The xterm.js integration is well-done and the UI is polished. But the fundamental lack of a PTY, the no-op resize, and the missing Tauri backend commands make this unusable for any interactive terminal work. Running `npm install` works. Running `ssh`, `vim`, `python`, `node inspect`, or anything TTY-dependent does not.

---

## 4. DEBUGGING — Classification: FOUNDATION (UI mockup)

### What Exists
- Zustand store with breakpoints, call stack, variables, console output schemas
- Debug panel UI: breakpoints list, call stack display, variables inspector, console log
- Monaco editor decorations: red glyphs for breakpoints, yellow highlight for paused line
- Debug controls in UI: Continue, Step Over, Step Into, Step Out

### What Doesn't Work
- **All debug controls are permanently disabled.** Every button has `disabled={true}` hardcoded. They will never do anything in the current state.
- **No debug adapter.** Zero integration with DAP (Debug Adapter Protocol), Node.js inspector, Python debugger, or any runtime.
- **No way to actually break.** `isPaused`, `currentFrame`, `callStack`, `variables` in the store are never set by any code anywhere in the project.
- **`DebugService` is purely visual.** It manages Monaco editor decorations only. No runtime connection.
- **No gutter click handler.** Breakpoints can't be added by clicking in the editor gutter. The `toggleBreakpoint` method exists but nothing calls it.

### Honest Assessment
| Question | Answer |
|----------|--------|
| Can you set a breakpoint? | ❌ No. Gutter handler not wired. |
| Can you pause execution? | ❌ No runtime integration. |
| Can you inspect variables? | ❌ Nothing populates them. |
| Can you step through code? | ❌ Controls are permanently disabled. |
| Is this useful for debugging? | ❌ No. |

### Verdict
**Foundation — and it's generous to call it that.** This is a decorative UI shell. It has the visual appearance of a debug panel but none of the function. The fact that the controls are hardcoded to `disabled` makes this actively misleading. This is the weakest feature in the entire application.

---

## 5. GIT WORKFLOW — Classification: FOUNDATION (broken)

### What Exists
- Git library (`git.ts`): all 10 git operations wrapped as async functions calling Tauri invoke
- Git panel UI: full feature-rich panel with refresh, init, stage all, commit, push/pull, branch switching, file restore, diff viewing, commit history, AI commit message generation
- Git diff viewer: unified diff parser, line number calculation, hunk-level accept/reject toggles

### What Doesn't Work
- **Entire Tauri backend is missing.** `lib.rs` registers exactly 7 commands — none of which are git commands. Every single git operation (`git_status`, `git_log`, `git_diff`, `git_commit`, `git_restore`, `git_init`, `git_push`, `git_pull`, `git_branch_list`, `git_checkout`, `git_add`) will throw `"Tauri command not available"` at runtime.
- **Hunk-level accept/reject is visual only.** `GitDiffViewer` tracks accepted/rejected hunks in local React state. No patch is actually applied to disk.
- **No per-file staging.** Only "Stage All" is implemented. Individual file stage/unstage buttons are missing.
- **No staged vs unstaged diff.** Always shows working tree vs HEAD.

### Honest Assessment
| Question | Answer |
|----------|--------|
| Can you stage files? | ❌ Backend missing. |
| Can you commit? | ❌ Backend missing. |
| Can you push/pull? | ❌ Backend missing. |
| Can you view diffs? | ✅ Parses diff text correctly — if it were available. |
| Is this usable? | ❌ No. |

### Verdict
**Foundation — and broken.** The frontend code is surprisingly well-constructed. The diff parser correctly handles unified format. The panel layout is thorough. But without the 11+ Tauri Rust commands in `lib.rs`, this entire feature is dead-on-arrival. Every button click produces an error. Once the backend is added, this could reach Beta Ready quickly. In its current state, it's a facade.

---

## 6. SYMBOL SEARCH — Classification: BETA READY

### What Exists
- Modal UI with search input, keyboard navigation (arrows, Enter, Esc)
- Fuzzy matching (character-by-character in-order match)
- Symbol grouping by kind (functions, methods, classes) with icons/colors
- `onNavigate(line, column)` callback for editor positioning
- Proper empty states and keyboard hints

### What Doesn't Work
- **Current-file only.** Despite the name "Symbol Search," this searches only the current file's symbols. There is no workspace-level symbol search (like VS Code's Ctrl+T).
- **No built-in symbol extraction.** The component receives symbols as a prop. It relies entirely on the parent to call Monaco's `getDocumentSymbols()`. No fallback if parent provides empty array.
- **No virtualization.** For files with 3000+ symbols, the entire list renders. Filtering is O(n) per keystroke.
- **Stale symbols.** If file is edited after symbols are fetched, results are outdated until parent re-fetches.

### Comparison to VS Code
| Capability | VS Code Ctrl+Shift+O | AgenticOS |
|-----------|---------------------|-----------|
| Current file symbols | ✅ | ✅ |
| Workspace symbols (Ctrl+T) | ✅ | ❌ |
| Virtualization | ✅ | ❌ |
| Fuzzy match quality | ✅ Smart acronym | ✅ Basic char match |

### Verdict
**Beta Ready — for current-file search.** The UI is polished, keyboard navigation is correct, and the fuzzy matching works well for its scope. But the name is misleading — this is not a full symbol search. It's a "current file outline" search. True workspace-level symbol search is missing.

---

## 7. 50K FILE WORKSPACE TEST

### Search
- **Indexing:** `SearchIndex` processes in batches of 50 files. For 50K files, that's 1000 batches. Each batch does async I/O (read file up to 512KB). Estimated indexing time: 100K files × 5KB average / 50 files per batch × ~10ms per I/O = ~100 seconds.
- **Memory:** 50K files × 5KB average = 250MB cached content. Acceptable but high.
- **Query time:** Filename search is O(n) on file list. Content search is O(n) on cached content. For 50K files, worst case = scanning 250MB of text. Could take 200-500ms per query.

### Navigation
- **File tree:** Renders all 50K entries? The tree has `MAX_TREE_DEPTH = 5` and `MAX_TREE_ENTRIES = 150` limits for AI context snapshot, but the actual UI tree renders everything. Would freeze.
- **Symbol search:** No virtualization. 3000+ symbols would lag.

### Terminal
- **No impact.** Terminal is independent of file count.

### Autocomplete
- **Pattern matching** iterates current file only. File count doesn't matter. File size does.
- **Search index fallback** queries 250MB index. Latency would be noticeable.

### Verdict
**Not tested with 50K files. Would struggle.** The search index would take ~2 minutes to build and consume 250MB of memory. The file tree UI would freeze. Symbol search would lag on large files. Terminal and inline editing would be unaffected.

---

## 8. PRODUCT SCORE (Re-evaluated)

| Category | Previous Score | Reality-Adjusted Score | Notes |
|----------|---------------|----------------------|-------|
| **Editor** | 8 | 7 | Monaco works great. But no autocomplete, no inline AI. |
| **Search** | 7 | 6 | Index works, but no semantic, no symbol search. |
| **Terminal** | 8 | **4** | No PTY, resize no-op, conflicting impls. Cannot ssh/vim/repl. |
| **Autocomplete** | 6 | **2** | AI completions stubbed. Pattern matching only. Regression from "autocomplete" to "basic word completion." |
| **Inline Editing** | 7 | **5** | Flow works for simple case. No streaming. Hunk accept is fake. |
| **Debugging** | 4 | **1** | UI shell only. All controls disabled. Zero debugging capability. |
| **Git** | 6 | **2** | Entire backend missing from lib.rs. Every operation throws. |
| **AI Workflows** | 9 | 9 | Multi-agent orchestration is genuinely best-in-class. |
| **Overall** | 7.5 | **4.5** | Polished UI shell. Broken backends. |

---

## 9. THE 100 DEVELOPER TEST

### What They Would Praise
1. **Multi-agent orchestration** — the manager→specialist routing is genuinely unique and impressive
2. **Execution transparency** — 28 event types, phase timeline, tool call cards with durations
3. **Provider flexibility** — 17+ providers, bring your own key, no vendor lock-in
4. **UI polish** — Monaco editor is well-integrated, animations are smooth, dark theme is cohesive
5. **Open source** — self-hosted, no subscription

### What They Would Complain About
1. **"The terminal doesn't work."** First thing a developer does is open a terminal. They'd try `npm install` — works. Then `ssh` — fails. Then `vim` — fails. Then `python` — fails. "This isn't a real terminal."
2. **"The autocomplete only gives me word matches."** They'd type code and get no useful AI suggestions. "I thought this was 2026."
3. **"Git doesn't work."** They'd try to stage and commit. Every button throws an error. "The entire git feature is fake."
4. **"The debugger does nothing."** They'd click "Start Debugging" and nothing happens. Controls are greyed out. "Why is this here?"

### What Would Cause Them to Uninstall
1. **Terminal is non-functional for real work** — #1 reason. Developers cannot work without a real terminal.
2. **Git backend missing** — #2 reason. Every git operation fails. This is a dealbreaker.
3. **Autocomplete is useless** — #3 reason. After Cursor/Windsurf/Claude Code, zero-value autocomplete is a downgrade.
4. **Debugger is a mockup** — #4 reason. Clicking the debug button and seeing permanently disabled controls erodes trust.
5. **Combined effect** — the gap between the polished UI and the non-functional backends creates a strong impression of "vaporware" or "fake it till you make it." Developers will not trust the product.

---

## 10. FINAL VERDICT: NOT PUBLIC BETA READY

The Closed Beta Blocker Elimination Sprint **resolved the UI-level blockers** but **did not resolve the backend-level blockers**.

### What Actually Got Built
| Feature | UI | Backend | Verdict |
|---------|----|---------|---------|
| Interactive Terminal | ✅ xterm.js, tabs, splits | ❌ No PTY, no resize, missing Tauri commands | Foundation |
| Autocomplete | ✅ Monaco provider registered | ❌ AI completions stubbed to null | Foundation |
| Inline AI Editing | ✅ Overlay, diff viewer, animations | ⚠️ Works for simple single-block edits | Beta Ready (low) |
| Debugging | ✅ Panel, store, decorations | ❌ All controls disabled, no runtime | Foundation |
| Git | ✅ Full panel, diff parser | ❌ **Entire Tauri backend missing** | Foundation (broken) |
| Symbol Search | ✅ Modal, fuzzy, keyboard nav | ⚠️ Current-file only | Beta Ready |

### What Must Be Done for Public Beta
1. **Terminal:** Add PTY support (node-pty or Tauri sidecar). Wire resize to child process. Resolve conflicting `TerminalRuntime` vs `InteractiveTerminalRuntime` implementations. Remove dead code.
2. **Autocomplete:** Wire `requestAiCompletion()` to actual provider. Add LSP integration for semantic completions. Fix the Escape tracking keyCode bug.
3. **Git:** Register all 11+ Tauri commands in `src-tauri/src/lib.rs`. Wire hunk accept to actual patch application.
4. **Debugging:** Either implement DAP integration or remove the permanently disabled controls. A mockup debugger hurts more than no debugger.
5. **Inline Editing:** Replace naive diff with proper patience/pyre-diff. Wire hunk-by-hunk accept callbacks. Add streaming for long edits.

### Current State Assessment
```
UI Polish:          ██████████ 9/10
Backend Completeness: ██░░░░░░░░ 2/10
Developer Trust:     ██░░░░░░░░ 2/10
Public Beta Ready:   ❌ NO
```
