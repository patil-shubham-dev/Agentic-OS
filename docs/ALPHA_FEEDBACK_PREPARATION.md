# ALPHA FEEDBACK PREPARATION AUDIT

> Architecture frozen. Major features frozen. Core workflows complete.
> Audit only — no implementation.

---

## SECTION 1 — DAILY USAGE SIMULATION

### 1 Day — Single Coding Session

**Timeline:**
| Time | Action | Friction Points |
|------|--------|-----------------|
| 0:00 | Open project via Control Center → pick folder | Root path dependency: no "recent projects" list, no "open recent" |
| 0:02 | File tree loads, scan 7k+ files | Cold start 81ms warm / 410ms detailed — acceptable. No progress indicator during scan. |
| 0:05 | Navigate tree to find source file | Tree is virtualized, fast. But no "reveal active file in tree" auto-scroll. |
| 0:10 | Open file in editor | Custom textarea — no syntax highlighting as-you-type lag, but no Monaco features (intellisense, autocomplete, go-to-def, multi-cursor). Line count/file size shown. |
| 0:15 | Search for function across codebase | `Ctrl+Shift+F` → content search reads files one by one via Tauri. 50+ files: ~2-5s. No progress bar. No search cancellation visible (works in background). |
| 0:20 | Ask AI to fix a bug | Chat panel → type message. Streaming is smooth. Token rendering clean. |
| 0:25 | AI makes file edit | AiChangeOverlay shows diff. Per-hunk Accept/Reject works. File-level Accept All available. |
| 0:30 | Save file | `Ctrl+S`. Save indicator shows briefly. |
| 0:35 | Want to rename a file | F2 in tree works. But no "rename symbol" in editor. |
| 0:40 | Run terminal command | Terminal block appears in chat. Streaming works. But no dedicated terminal panel (docking area is workspace panel, not a persistent terminal). |
| 0:45 | Open second file | Tab opens. `Ctrl+W` closes. Tab bar doesn't show full path — only filename. Two files with same name indistinguishable. |
| 0:50 | Want to compare current file with git HEAD | Go to Git page. See changed files. No inline diff in editor. No "git blame" in gutter. |
| 0:55 | Multitask — switch to browser panel | `Ctrl+Shift+B`. Works. But switching back requires another shortcut. |

**1-Day Score: ~7.5/10**
Main pain: editor is basic, search is slow, git integration is page-level not editor-level, no terminal panel.

---

### 3 Days — Repeated Usage

**New pains emerge:**
1. **Workspace start → no "continue where I left off"** — no restoring previous file tabs, cursor position, or scroll state
2. **Search results not cached** — same search twice takes same time
3. **No multi-project** — must close and reopen workspace to switch projects
4. **No command history in command palette** — `Ctrl+P` shows static command list, no recently used ordering
5. **No file-type filtering in search** — can't limit to `.ts` files only
6. **No git commit quick action** — must navigate to Git page, type message, commit. No `Ctrl+Enter` to commit from within workspace.
7. **No workspace diagnostics** — no TypeScript error reporting inline. Must run `tsc --noEmit` manually.
8. **No problem/marker panel** — no list of errors/warnings across the project
9. **No outline/symbol view** — can't see class/function structure of current file
10. **AI edit not revertible** — after accepting diff, no way to undo via "restore from git" or "revert edit"

**3-Day Score: ~6.5/10**
Main pain: missing developer essentials (diagnostics, outline, git integration, persistent terminal).

---

### 7 Days — Full Workflow, Multiple Sessions

**Systemic pains:**
1. **Performance degradation** — after 50+ conversation turns, timeline store grows. No virtualized conversation rendering below a certain point.
2. **No memory of user preferences** — font size, word wrap, panel layout reset on each new tab or reload
3. **No search indexing** — every content search re-scans files. For a 50k file project, unusable at ~12+ seconds per search.
4. **No multi-workspace tabs** — can't have two projects open side by side
5. **No background indexing** — app doesn't build a search index while idle
6. **No keyboard shortcut customization** — all shortcuts hard-coded
7. **No theme customization beyond what exists** — Palette icon in header suggests design themes but limited
8. **No export/share** — can't export conversation, diff, or terminal output
9. **AI context management requires manual file tagging** — no auto-context based on open files and recent edits
10. **No rate limiting / cost awareness** — no token usage display, no cost tracking per session

**7-Day Score: ~5.5/10**
Main pain: doesn't scale to large projects, no persistence of user state, no background work.

---

## SECTION 2 — TOP 20 USER COMPLAINTS

| # | Complaint | Severity | Why It's Frustrating | Frequency | Impact |
|---|-----------|----------|---------------------|-----------|--------|
| 1 | **No code intelligence** (IntelliSense, go-to-def, hover info) | **CRITICAL** | Every code edit requires manual typing. No autocomplete, no error checking, no jump-to-definition. | Every file edit | Developer speed reduced by 40-60% vs VS Code/Cursor |
| 2 | **Search is too slow for large projects** | **CRITICAL** | Content search reads files sequentially via Tauri invoke. 10k+ file project takes 30s+. No search index. | 10-20x/day | Blocks flow, encourages not searching |
| 3 | **No workspace diagnostics** | **CRITICAL** | Cannot see TypeScript/build errors inline. Must run external `tsc`. No red squiggles, no problem panel. | Every file save | Cannot catch errors during editing |
| 4 | **No persistent terminal panel** | **HIGH** | Terminal output only appears in chat blocks. No dedicated terminal for running dev servers, build, tests. | Every session | Must context-switch to external terminal |
| 5 | **Git integration is page-level, not editor-level** | **HIGH** | Must navigate away from workspace to `/git` page for any git operation. No inline blame, gutter indicators, or staged-file diff. | 10-20x/day | Repeated context switching |
| 6 | **No file outline / symbol navigation** | **HIGH** | Cannot see function signatures, class structure, or navigate by symbol. Must scroll through entire file. | Every file >200 lines | Wastes time scrolling and reading |
| 7 | **No project state persistence** | **HIGH** | Open files, cursor position, scroll state, panel layout all lost on reload. No "recent projects." | Every app restart | Forces full setup each session |
| 8 | **No multi-project / workspace tabs** | **HIGH** | Can only work on one project at a time. No quick switching between projects. | When context-switching projects | Blocks parallel work |
| 9 | **No undo/redo for AI edits** | **MEDIUM** | After accepting a diff, no way to revert except via git restore. No edit history. | Several times per session | Risk of losing work |
| 10 | **Single-monaco not used for code-canvas** | **MEDIUM** | Monaco is a dependency but code-canvas uses a custom textarea. No intellisense, minimap, bracket matching. | Every file edit | Diminishes core editing experience |
| 11 | **No search & replace across files** | **MEDIUM** | Can search across files but cannot replace. Must open each file and edit manually. | 5-10x/day | Slows refactoring |
| 12 | **No split-view / side-by-side editor** | **MEDIUM** | Cannot view two files side by side. Cannot compare AI edit diff inline with original. | During code review / merge | Makes comparison harder |
| 13 | **No command history in palette** | **MEDIUM** | `Ctrl+P` shows static list. No MRU ordering, no recently used at top. | 20-30x/day | Extra keystrokes finding commands |
| 14 | **No file tree auto-refresh** | **MEDIUM** | External file changes (git checkout, npm install) don't refresh tree. Must press F5 manually. | Several times per session | Tree becomes stale |
| 15 | **No image/asset preview** | **MEDIUM** | Opening a .png/.svg shows nothing useful. No built-in image viewer. | When working with assets | Must open externally |
| 16 | **No keyboard shortcut customization** | **MEDIUM** | All shortcuts are hard-coded. Power users have different muscle memory. | When user expects specific shortcut | Frustrates migration from other tools |
| 17 | **No cost/usage visibility** | **MEDIUM** | No token count, cost estimation, or API usage dashboard. Users can't predict or track spending. | When using paid API providers | Surprise bills |
| 18 | **No file-type grouping in search results** | **LOW** | Search results mix .ts, .css, .json without filtering. For large results, hard to find relevant files. | 5-10x/day | Extra scanning time |
| 19 | **No export/share conversation** | **LOW** | Cannot export chat, share AI conversation, or save terminal output for later reference. | Occasionally | Information trapped in app |
| 20 | **No auto-context for AI** | **LOW** | Must manually tag files as AI context. AI doesn't automatically include open file or related imports. | Every AI interaction | Context not optimal |

---

## SECTION 3 — WORKFLOW SPEED ANALYSIS

### Task Timing Comparison (estimated, in seconds)

| Task | AgenticOS | Claude Code (CLI) | Cursor | Windsurf |
|------|-----------|-------------------|--------|----------|
| Open project (cold) | 0.4s | 0.1s | 0.5s | 0.5s |
| Find file by name | 0.3s (file tree) | 0.05s (fuzzy) | 0.05s (fuzzy) | 0.05s (fuzzy) |
| Find by content (small project) | 2-5s | 0.5s (ripgrep) | 0.2s (indexed) | 0.3s (indexed) |
| Find by content (50k files) | 30-60s | 1-2s | 0.5s | 0.8s |
| AI edit + review | 8-15s | 3-5s | 2-4s | 3-5s |
| Git status check | 2s (navigate to page) | 0.2s | 0.1s (inline) | 0.1s (inline) |
| Run terminal command | 3-5s (via chat) | 0.1s (in-terminal) | 0.1s (integrated) | 0.1s (integrated) |
| Navigate to symbol | 10-30s (manual scroll) | 0.3s (grep) | 0.1s (LSP) | 0.1s (LSP) |

### Biggest Slowdowns (ranked)

1. **No search index** — 30-60x slower than competitors for content search on large projects
2. **No code intelligence** — every navigation/edit is manual vs LSP-powered flows
3. **No terminal panel** — each command requires scrolling to chat, waiting for execution block, vs instant terminal
4. **Git is page-level** — status/diff/commit each require full page navigation and back
5. **Editor is basic textarea** — no intellisense, minimap, bracket matching, multi-cursor
6. **No keyboard navigation depth** — tree navigation is good, but no quick open (`Ctrl+P` in VS Code), no symbol search

---

## SECTION 4 — POWER USER GAPS

| Feature | Expected By | Current State | Impact | Effort to Add |
|---------|-------------|---------------|--------|---------------|
| **Git branch management** (create, switch, merge, rebase) | Every developer | Only status/diff/commit/page view | HIGH | 1-2 weeks |
| **Workspace indexing** (background search index) | Anyone with >10k files | No index — every search is full scan | CRITICAL | 1 week |
| **Session branching / checkpointing** | Advanced AI users | No concept of conversation branches | MEDIUM | 2-3 weeks |
| **Saved searches** | Anyone searching code regularly | No history, no saved queries | LOW | 2 days |
| **Keyboard-only workflow** | Power users / Vim users | Can navigate tree but not all operations | HIGH | Ongoing |
| **Multi-project support** | Anyone working on multiple repos | Single project at a time | HIGH | 2-3 weeks |
| **Custom keybindings** | Anyone migrating from other editors | Hard-coded only | MEDIUM | 1 week |
| **File outline / symbol tree** | Anyone navigating large files | Not present | HIGH | 1 week |
| **Inline git blame / gutter** | Anyone doing code review | Not present | MEDIUM | 3-5 days |
| **Multi-cursor editing** | Anyone doing repetitive edits | Not present | MEDIUM | 1 week (Monaco built-in) |
| **Problem / error panel** | Anyone writing code | Not present | HIGH | 1 week (Monaco) |
| **Terminal multiplexer** | Anyone running dev servers | Not present | HIGH | 2-3 weeks |
| **Command history / MRU** | Anyone using command palette | Static list only | LOW | 1 day |
| **File comparison (diff)** | Anyone reviewing changes | Git page shows diff, but no arbitrary file diff | MEDIUM | 3 days |
| **Extensions / plugin API** | Anyone wanting custom behavior | MCP exists but no editor extensions | LOW | Months |

---

## SECTION 5 — ALPHA FEEDBACK PREDICTION

### Top 10 Things Alpha Users Will Ask For

1. "Can you add code autocomplete?" — Every developer's first question
2. "Why is search so slow?" — First painful experience with 10k+ file project
3. "Where is the terminal?" — Developers expect a persistent terminal panel
4. "Can I see TypeScript errors?" — No inline diagnostics is a dealbreaker
5. "How do I switch branches?" — Git branching is table stakes
6. "Can I open two files side by side?" — Split editor is expected
7. "Does it have IntelliSense?" — The editor feels basic
8. "Can I undo an AI edit?" — After accepting a bad edit, no way to revert
9. "How do I run the project?" — No integrated task runner or terminal
10. "Can I customize shortcuts?" — Muscle memory from other editors

### Top 10 Things Alpha Users Will Complain About

1. "Editor is a textarea — feels like Notepad" — Visual/functional gap vs VS Code
2. "I waited 30 seconds for search" — Search performance is the #1 bottleneck
3. "I have to go to a separate page for git" — Git feels bolted on
4. "My open files disappeared after restart" — No state persistence
5. "I can't find the function definition" — No LSP/go-to-definition
6. "The AI changed a file and I can't undo" — No edit history
7. "I keep pressing Ctrl+P expecting quick open" — Different from VS Code muscle memory
8. "No error messages when I type wrong code" — No diagnostics
9. "I need two projects open at once" — No multi-project
10. "Can't see my dev server output" — No terminal panel

### Top 10 Things Alpha Users Will Praise

1. "AI streaming is fast and smooth" — Token rendering and streaming architecture is solid
2. "Diff view is clean" — AiChangeOverlay with per-hunk Accept/Reject
3. "Keyboard shortcuts work well" — Many shortcuts already implemented
4. "File tree is responsive with large projects" — Virtualization works
5. "Onboarding was painless" — Good first-run experience
6. "Global search has useful mode switching" — Filename vs content toggle
7. "Command palette is well organized" — Categories and fuzzy match
8. "The multi-agent execution is impressive" — Orchestration with Manager/Delegator
9. "Error boundaries prevent crashes" — Graceful error handling
10. "Design and feel is cohesive" — Consistent dark theme, animations

---

## SECTION 6 — LOWEST EFFORT / HIGHEST IMPACT

### 1-Day Fixes (Estimated ~4-6 hours each)

| # | Fix | Impact | Effort | Score |
|---|-----|--------|--------|-------|
| 1 | **Add search indexing** — build a simple `SearchIndex` that pre-computes filename/content index on workspace load, stores in memory, updates on file changes | **BIG** | 1 day | 9/10 |
| 2 | **Save/restore open files & cursor position** — persist `openFiles`, `activeFilePath`, cursor position to localStorage | **MEDIUM** | 0.5 day | 8/10 |
| 3 | **Command palette MRU ordering** — track recently used commands, show them at top | **SMALL** | 0.5 day | 7/10 |
| 4 | **Quick file open** — replace file-tree focus with a `Ctrl+P` quick open that fuzzy-matches file paths | **BIG** | 1 day | 8/10 |
| 5 | **Search result file-type filter** — add dropdown to filter content search by extension (.ts, .tsx, .css, etc.) | **SMALL** | 0.5 day | 6/10 |
| 6 | **File tree auto-refresh** — poll for file changes or use Tauri watcher events to trigger re-scan | **MEDIUM** | 1 day | 7/10 |
| 7 | **Search progress indicator** — show file count, estimated time, cancel button more prominently | **SMALL** | 0.5 day | 6/10 |
| 8 | **Git quick-commit from workspace** — add commit message input + commit button in workspace header | **BIG** | 1 day | 7/10 |

### 3-Day Fixes (Estimated ~12-18 hours each)

| # | Fix | Impact | Effort | Score |
|---|-----|--------|--------|-------|
| 1 | **Integrate Monaco editor for code-canvas** — Monaco is already a dependency. Replace custom textarea with Monaco. Instantly adds IntelliSense, multi-cursor, minimap, bracket matching, go-to-definition. | **TRANSFORMATIVE** | 2-3 days | 10/10 |
| 2 | **Add file outline panel** — tree view of functions/classes/variables in current file, parsed from AST | **HIGH** | 2-3 days | 9/10 |
| 3 | **Inline git blame + gutter indicators** — show author/date for each line, changed/added markers in gutter | **HIGH** | 2-3 days | 8/10 |
| 4 | **Add editor split-view** — side-by-side editor for comparing files or AI diff with original | **HIGH** | 2-3 days | 8/10 |
| 5 | **Add recent projects list** — persist last 10 opened projects in localStorage, show on Control Center | **MEDIUM** | 1-2 days | 7/10 |
| 6 | **Search & replace across files** — add replace mode to GlobalSearch, with preview and batch apply | **MEDIUM** | 2-3 days | 7/10 |
| 7 | **Custom keyboard shortcuts UI** — settings panel to remap all actions | **MEDIUM** | 2-3 days | 7/10 |

### 1-Week Fixes (Estimated ~30-40 hours each)

| # | Fix | Impact | Effort | Score |
|---|-----|--------|--------|-------|
| 1 | **Add persistent terminal panel** — dedicated terminal tab in workspace panel with Tauri pty, shell integration | **TRANSFORMATIVE** | 1 week | 10/10 |
| 2 | **Full Monaco integration** (if not done in 3-day) — includes LSP, diagnostics, problem panel, formatting | **TRANSFORMATIVE** | 1 week | 10/10 |
| 3 | **Background search index** — build persistent search index using Tauri SQLite or JSON file, update on file changes | **BIG** | 1 week | 9/10 |
| 4 | **Git branch management UI** — create, switch, merge, rebase branches from git page or command palette | **HIGH** | 1 week | 8/10 |
| 5 | **AI edit history / undo** — track all AI edits, allow rollback to any previous version per file | **HIGH** | 1 week | 8/10 |
| 6 | **Multi-project workspace** — tabbed project switcher, each project has own file tree/state | **HIGH** | 1 week | 8/10 |

---

## SECTION 7 — ROAD TO 9.5/10

### Current Score: ~9.0 (as stated)

### Gap Analysis
The 9.0 → 9.5 gap is not about architecture or features. It's about **workflow speed**, **polish**, and **developer essentials**.

### Requirements for 9.5/10

| Area | Current State | Target State | Improvement |
|------|---------------|--------------|-------------|
| **Search** | 30s+ for 50k files, no index | <1s for any project size | Add search index |
| **Code editing** | Custom textarea | Full Monaco with LSP | Integrate Monaco properly |
| **Terminal** | Chat blocks only | Persistent terminal panel | Add terminal tab |
| **Git** | Page-level only | Editor-level + inline | Inline indicators + quick actions |
| **Diagnostics** | None | Live errors + problem panel | Monaco LSP integration |
| **Navigation** | Tree + scroll | Outline + fuzzy + go-to-def | Monaco LSP + outline |
| **Persistence** | None on reload | Full state restore (tabs, cursor, scroll) | localStorage state machine |
| **Performance (large projects)** | Degrades with scale | Works smoothly at 100k files | Search index, virtualized timeline |
| **Undo AI edits** | Not possible | Full edit history with rollback | AI edit journal |
| **Keyboard UX** | Good coverage, no customization | All actions reachable, customizable | Settings UI for keybindings |

### Score After Each Improvement

| After | Score | Key Improvement |
|-------|-------|-----------------|
| Current | 9.0 | Working product with good AI features |
| + Search index | 9.1 | Search drops from 30s to <1s |
| + Monaco editor | 9.2 | Code intelligence, multi-cursor, minimap |
| + Terminal panel | 9.3 | Developer can run dev server inline |
| + Git inline | 9.35 | Blame, gutter, quick commit |
| + Diagnostics/Problems | 9.4 | See errors during editing |
| + State persistence | 9.42 | Open files restored on restart |
| + File outline | 9.44 | Navigate classes, functions |
| + AI edit undo | 9.46 | Rollback any AI change |
| + Split editor | 9.48 | Side-by-side editing |
| + Custom keybindings | 9.49 | Adapt to user muscle memory |
| + Polish pass | 9.50 | Animations, micro-interactions, edge cases |

### Final Recommendation: What to Build Next After Real Alpha Feedback Arrives

**Phase 1 (Week 1-2) — Address the top 3 complaints:**
1. **Monaco editor** — replaces textarea, delivers IntelliSense, multi-cursor, minimap, diagnostics (addresses complaints #1, #4, #8)
2. **Search index** — makes content search instant (addresses complaint #2)
3. **Terminal panel** — persistent shell in workspace (addresses complaint #3)

**Phase 2 (Week 3-4) — Deepen existing workflows:**
4. **Git inline** — blame, gutter, quick commit from workspace
5. **State persistence** — restore all workspace state on reload
6. **File outline** — symbol navigation tree

**Phase 3 (Week 5-6) — Polish for public Beta:**
7. **AI edit history** — safe revert of any AI change
8. **Custom keybindings** — settings UI for shortcuts
9. **Split editor** — side-by-side comparison

**Never build (unless alpha feedback demands it):**
- Multi-project support (too complex, niche)
- Plugin/extension API (months of work, pre-mature)
- Session branching (too niche for v1)
- Multi-cursor in custom editor (solved by Monaco)

### Key Metric to Track
After each phase, measure: **"Time from idea to code change"** — the time between having an idea and seeing the change in the editor. Target: sub-5 seconds for file open + edit + save cycle.
