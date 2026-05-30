# RELEASE GATE DECISION

## Question: Can a developer use AgenticOS for daily development work?

**Answer: NO — release blocked.**

---

## Exact Blockers

### BLOCKER 1: No content search (grep_files)
**Impact:** Critical. The most fundamental developer operation.
- Cannot "Find all TODO comments"
- Cannot "Search for all invoke() calls"
- Cannot "Find all React components"
- Cannot "Search for error messages in logs"
- Cannot "Find where function X is defined"
- Every grep_files call from the agent returns an error
- Agent wastes 1-2 extra LLM calls per search failing before falling back to terminal
- Terminal fallback (`findstr`) has poor regex support on Windows

### BLOCKER 2: No file pattern search (glob_files)
**Impact:** High. Agents cannot discover files by pattern.
- Cannot "Find all test files"
- Cannot "Find all README files"
- Cannot "List all .tsx files"
- Every glob_files call returns an error
- File discovery requires terminal fallback (`dir /s`)

### BLOCKER 3: Contingent blocker — search combined with other tasks
**Impact:** High. Compound tasks that require search fail more often.
- "Refactor all components that match pattern X" → search fails → refactor cannot proceed
- "Find and fix all imports of module Y" → search fails → agent guesses
- "Count all lines of code" → no reliable method
- Agent confidence in search-dependent answers is low

### NON-BLOCKERS (can release without, but document as known limitations)

| Issue | Rationale |
|-------|-----------|
| Browser automation broken | Not a core IDE feature. Most devs don't need the agent to browse the web. |
| File history broken | Git provides this. Most devs use git, not file snapshots. |
| File watching broken | Minor inconvenience — user can manually refresh tree. |
| Symbol search limited to current file | Frustrating but not blocking. Agent can read files to find symbols. |
| Memory growth unbounded | Takes hours of continuous use to become noticeable. |

---

## Minimum Fix for Release

### MUST-FIX (release-blocking)
1. **Implement grep_files in TypeScript** — ~2 hours
   - Walk the file tree from workspace-store
   - Read + search each file via `@tauri-apps/plugin-fs.readTextFile()`
   - Return matched lines
   
2. **Implement glob_files in TypeScript** — ~1 hour
   - Walk the file tree from workspace-store
   - Apply picomatch/minimatch pattern matching
   - Return matching file paths

### SHOULD-FIX (strongly recommended but not blocking)
3. **Add timeout to Rust run_command_stream** — ~30 min
   - Prevent orphaned processes from blocking indefinitely
4. **Graceful degredation for failed tools** — ~1 hour
   - Agent should not retry tools that are known to be missing

### NICE-TO-HAVE (post-release)
5. **File watching** via Tauri plugin
6. **File history** snapshot/rollback
7. **Browser automation** (separate sprint)

---

## Decision Tree

```
Can a developer:
1. Open a project?           ✅ YES (folder tree fixed)
2. Search project?            ❌ NO (grep/glob broken — BLOCKER)
3. Read files?                ✅ YES (read_file via plugin-fs)
4. Edit files?                ✅ YES (write/edit_file via plugin-fs)
5. Run commands?              ✅ YES (terminal fixed this sprint)
6. Debug issues?              ⚠️ PARTIAL (terminal works, search broken)
7. Navigate codebase?         ⚠️ PARTIAL (tree works, symbol search limited)

Decision: BLOCKED on #2 (Search)
```

**Fixes applied in this sprint:** ✅ (terminal execution, folder tree, agent completion)
**Fixes needed before release:** ❌ (grep_files, glob_files — search)

---

## Verdict

```
RELEASE READY:  NO
BLOCKER COUNT:  2 (grep_files, glob_files)
NEXT ACTION:    Implement TypeScript-backed grep + glob
ESTIMATED FIX:  2-3 hours
STATUS:         🟡 Two bugs away from shippable
```
