# MOCK EXECUTION FLOWS

Four scenarios showing exactly what users will see after the rearchitecture.

---

## Scenario 1: Simple Question

**User input:** `"hi"`

### Current UX

```
┌──────────────────────────────────────────────┐
│  User: hi                                     │
├──────────────────────────────────────────────┤
│  ┌─ Manager ─────────────────────────────┐   │
│  │  Thinking...                          │   │
│  └───────────────────────────────────────┘   │
│  ┌─ Fast Inference (Nvidia NIM/deepseek) ─┐  │
│  │  Hello! How can I help you today?      │   │
│  └───────────────────────────────────────┘   │
│  ┌─ QA ──────────────────────────────────┐   │
│  │  Hi there! How can I help?            │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

**Problems:** Two responses, agent names, provider/model visible, QA runs unnecessarily.

### Target UX

```
┌──────────────────────────────────────────────┐
│  hi                                ── User ──│
├──────────────────────────────────────────────┤
│                                              │
│  Hello! How can I help you today?            │
│                                              │
│  I can help with:                            │
│  • Writing and debugging code                │
│  • Architecture and design                   │
│  • Research and analysis                     │
│  • Running commands and builds               │
│                                              │
│  What are you working on?                    │
│                                              │
└──────────────────────────────────────────────┘
```

**Execution trace (internal):**

```
User: "hi"
  → ExecutionOrchestrator.execute()
    → classifyIntent("hi") → "conversation" (0.8)
    → No delegation needed (simple chat)
    → handleDirectResponse()
      → SynthesisEngine.merge() → pass through
    → MESSAGE_COMPLETE (single)
```

**What changed:**
- QA execution suppressed for conversation intents
- No agent names shown
- Single response
- No architecture visible

---

## Scenario 2: Code Generation

**User input:** `"Create a React hook that debounces a value"`

### Current UX

```
┌──────────────────────────────────────────────┐
│  User: Create a React hook that debounces...  │
├──────────────────────────────────────────────┤
│  ┌─ Manager ─────────────────────────────┐   │
│  │  Planning approach...                  │   │
│  │  Assigning to Coder...                 │   │
│  └───────────────────────────────────────┘   │
│  ┌─ Coder (Nvidia NIM/deepseek-v4-flash) ─┐  │
│  │  Searching for similar patterns...      │   │
│  │  Writing useDebounce hook...            │   │
│  │  ┌─ run_command ──────────────────┐     │   │
│  │  │  npm test                      │     │   │
│  │  │  [loading...]                  │     │   │
│  │  │  ✓ Passed                      │     │   │
│  │  └───────────────────────────────┘     │   │
│  │  Here's the hook...                    │   │
│  └───────────────────────────────────────┘   │
│  ┌─ QA ─────────────────────────────────┐   │
│  │  Validating...                        │   │
│  │  All tests pass.                      │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Target UX

```
┌──────────────────────────────────────────────┐
│  Create a React hook that debounces a  ── User│
│  value                                       │
├──────────────────────────────────────────────┤
│                                              │
│  ◌ Understanding request        ✓            │
│  ◌ Planning approach            ✓            │
│  ◌ Searching workspace          ✓            │
│  ● Writing code                              │
│                                              │
│  ```tsx                                      │
│  import { useState, useEffect } from 'react' │
│                                              │
│  export function useDebounce<T>(             │
│    value: T,                                 │
│    delay: number = 300                       │
│  ): T {                                      │
│    const [debouncedValue, setDebouncedValue] │
│      = useState<T>(value)                    │
│                                              │
│    useEffect(() => {                         │
│      const timer = setTimeout(() => {        │
│        setDebouncedValue(value)              │
│      }, delay)                               │
│                                              │
│      return () => clearTimeout(timer)        │
│    }, [value, delay])                        │
│                                              │
│    return debouncedValue                     │
│  }                                           │
│  ```                                         │
│                                              │
│  ◌ Validating changes                        │
│  ◌ Finalizing response                       │
│                                              │
│  The hook also includes TypeScript types     │
│  and passes all edge cases:                  │
│                                              │
│  ✓ Instant updates on delay change           │
│  ✓ Cleanup on unmount                        │
│  ✓ Type-safe generic                         │
│                                              │
│  [View file: src/hooks/useDebounce.ts]        │
│                                              │
└──────────────────────────────────────────────┘
```

**Execution trace (internal):**

```
User: "Create a React hook that debounces a value"
  → ExecutionOrchestrator.execute()
    → classifyIntent → "coding" (0.9)
    → Manager routing:
      → Plan: write useDebounce hook
      → Delegate to Coder
    → Coder executes:
      → Activity: Searching workspace ✓
      → Activity: Writing code ✓
      → Command: npm test (live output)
      → Activity: Validating ✓
    → SynthesisEngine.merge()
      → Combine Coder output + test results
      → Produce single clean response
    → MESSAGE_COMPLETE (single)
```

**What changed:**
- Activity timeline replaces agent cards
- Live terminal output for `npm test` (no silent waiting)
- Single response with integrated file card
- No Coder/QA/Manager labels
- Clean code rendering

---

## Scenario 3: Workspace Analysis

**User input:** `"How is the authentication module structured?"`

### Current UX

```
┌──────────────────────────────────────────────┐
│  User: How is the authentication module...    │
├──────────────────────────────────────────────┤
│  ┌─ Manager ─────────────────────────────┐   │
│  │  Analyzing request...                  │   │
│  │  Delegating to Research...             │   │
│  └───────────────────────────────────────┘   │
│  ┌─ Research ────────────────────────────┐   │
│  │  Searching files...                    │   │
│  │  Reading auth provider...              │   │
│  │  Reading hooks...                       │   │
│  │  Analyzing dependencies...             │   │
│  │  Here's the structure:                 │   │
│  │  - AuthProvider.tsx                    │   │
│  │  - useAuth.ts                          │   │
│  │  - auth-guard.ts                       │   │
│  └───────────────────────────────────────┘   │
│  ┌─ Manager (Synthesis) ────────────────┐   │
│  │  Merging results...                    │   │
│  │  Producing final answer...             │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Target UX

```
┌──────────────────────────────────────────────┐
│  How is the authentication module     ── User │
│  structured?                                  │
├──────────────────────────────────────────────┤
│                                              │
│  ◌ Understanding request        ✓            │
│  ◌ Reading auth files           ✓            │
│  ◌ Analyzing dependencies       ✓            │
│  ● Preparing response                        │
│                                              │
│  The authentication module is organized      │
│  around three layers:                        │
│                                              │
│  ## Provider Layer                           │
│  `src/auth/AuthProvider.tsx`                 │
│  React context provider wrapping the app.    │
│  Handles session lifecycle and token refresh.│
│                                              │
│  ## Hook Layer                               │
│  `src/auth/useAuth.ts`                       │
│  Custom hook exposing `user`, `login`,       │
│  `logout`, `isAuthenticated`.                │
│                                              │
│  ## Guard Layer                              │
│  `src/auth/auth-guard.ts`                    │
│  Route protection component. Redirects       │
│  unauthenticated users to login.             │
│                                              │
│  [View directory: src/auth/]                 │
│  [Files found: 12 files, 3 directories]      │
│                                              │
└──────────────────────────────────────────────┘
```

**Execution trace (internal):**

```
User: "How is the authentication module structured?"
  → ExecutionOrchestrator.execute()
    → classifyIntent → "research" (0.85)
    → Manager:
      → Plan: read auth directory, analyze structure
      → Delegate to Research
    → Research executes:
      → Activity: Reading auth files ✓
        → glob_files("src/auth/**/*")
        → read_file("src/auth/AuthProvider.tsx")
        → read_file("src/auth/useAuth.ts")
        → read_file("src/auth/auth-guard.ts")
      → Activity: Analyzing dependencies ✓
        → grep for import patterns
    → SynthesisEngine.merge()
      → Structure analysis into narrative
    → MESSAGE_COMPLETE (single)
```

**What changed:**
- Activities reflect what's happening ("Reading auth files" not "Research")
- File cards are clickable inline
- Summary shows file count naturally
- No Research/Manager labels
- Clean analysis instead of raw file lists

---

## Scenario 4: Complex Multi-Agent Task

**User input:** `"Add a dark mode toggle to the settings page. Update the tailwind config, create a theme provider, add a toggle component, and wire it through the app."`

### Current UX

```
┌──────────────────────────────────────────────┐
│  User: Add a dark mode toggle...              │
├──────────────────────────────────────────────┤
│  ┌─ Manager ─────────────────────────────┐   │
│  │  Building plan...                      │   │
│  │  1. Update tailwind config             │   │
│  │  2. Create ThemeProvider               │   │
│  │  3. Create Toggle component            │   │
│  │  4. Wire through app                   │   │
│  │  Delegating tasks...                   │   │
│  └───────────────────────────────────────┘   │
│  ┌─ Coder ───────────────────────────────┐   │
│  │  Updating tailwind.config.ts...        │   │
│  │  Creating ThemeProvider...             │   │
│  │  Running build...                      │   │
│  │  [build output...]                     │   │
│  │  Error: missing dependency             │   │
│  └───────────────────────────────────────┘   │
│  ┌─ Manager ─────────────────────────────┐   │
│  │  Re-delegating...                      │   │
│  └───────────────────────────────────────┘   │
│  ┌─ Coder (retry) ───────────────────────┐   │
│  │  Fixing dependency...                  │   │
│  │  Creating Toggle component...          │   │
│  │  Running build...                      │   │
│  │  [build output...]                     │   │
│  │  ✓ Build passes                       │   │
│  └───────────────────────────────────────┘   │
│  ┌─ QA ─────────────────────────────────┐   │
│  │  Running tests...                     │   │
│  │  ✓ All tests pass                     │   │
│  └───────────────────────────────────────┘   │
│  ┌─ Manager (Synthesis) ────────────────┐   │
│  │  Merging results...                   │   │
│  │  Final response...                    │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Target UX

```
┌──────────────────────────────────────────────┐
│  Add a dark mode toggle to the settings  User │
│  page. Update the tailwind config, create...  │
├──────────────────────────────────────────────┤
│                                              │
│  ◌ Understanding request           ✓         │
│  ◌ Building execution plan         ✓         │
│    • Update tailwind config                  │
│    • Create ThemeProvider                    │
│    • Create Toggle component                 │
│    • Wire through app                        │
│  ◌ Updating configuration          ✓         │
│  ◌ Writing ThemeProvider           ✓         │
│  ◌ Running build                   ✓         │
│                                              │
│    $ npm run build                           │
│    > agentic-os@1.0.0 build                  │
│    > vite build                              │
│    ✕ ERROR: Missing dependency               │
│    > 'ThemeContext' is not exported           │
│                                              │
│  ◌ Fixing dependency              ✓          │
│  ◌ Writing Toggle component       ✓          │
│  ◌ Running tests                   ✓         │
│                                              │
│    $ npm test                                │
│    > ✓ All 304 tests passed                  │
│                                              │
│  ● Finalizing response                       │
│                                              │
│  Done! Here's what was added:                │
│                                              │
│  ## 1. Tailwind Config Updated               │
│  Added `darkMode: 'class'` strategy.         │
│  [View: tailwind.config.ts]                  │
│                                              │
│  ## 2. ThemeProvider Created                 │
│  Manages dark/light state via React context. │
│  Persists preference to localStorage.        │
│  [View: src/theme/ThemeProvider.tsx]          │
│                                              │
│  ## 3. Toggle Component Created              │
│  Accessible toggle with sun/moon icons.      │
│  Keyboard navigable, ARIA labels.            │
│  [View: src/components/ThemeToggle.tsx]       │
│                                              │
│  ## 4. Wiring Complete                       │
│  App wrapped with ThemeProvider.              │
│  Toggle added to settings page.              │
│  [View: src/App.tsx]                         │
│  [View: src/pages/settings.tsx]              │
│                                              │
└──────────────────────────────────────────────┘
```

**Execution trace (internal):**

```
User: "Add a dark mode toggle..."
  → ExecutionOrchestrator.execute()
    → classifyIntent → "complex" (0.95)
    → Manager:
      → Plan: 4 subtasks identified
      → Activity: Building execution plan ✓
      → Delegate to Coder (Task 1: tailwind config)
      → Delegate to Coder (Task 2: ThemeProvider)
    
    → Coder (Task 1):
      → Activity: Updating configuration ✓
      → Goal: darkMode: 'class'
    
    → Coder (Task 2):
      → Activity: Writing ThemeProvider ✓
      → Build fails → Manager detects
      → Activity: Fixing dependency ✓
      → Re-delegates fix
    
    → Coder (Task 3):
      → Activity: Writing Toggle component ✓
    
    → Coder (Task 4):
      → Activity: Wiring through app ✓
    
    → Manager: verify all tasks complete
    → QA: run tests → Activity: Running tests ✓
    → All tasks ✓ → Activity: Finalizing response
    
    → SynthesisEngine.merge()
      → Merge all results into structured response
      → Include file cards for each change
      → Remove all internal coordination artifacts
    
    → MESSAGE_COMPLETE (single, comprehensive)
```

**What changed:**
- Plan shown as checklist under "Building execution plan"
- Build error shown with live terminal output (not hidden in a tool card)
- Error recovery shown naturally ("Fixing dependency" activity)
- Each file change has a clickable file card
- Single comprehensive response with all changes summarized
- Error → retry → success is a smooth narrative, not internal architecture
- No Manager/Coder/QA labels anywhere
- Build output streams live, not frozen waiting

## Summary Table

| Aspect | Simple Question | Code Gen | Workspace Analysis | Complex Task |
|--------|----------------|----------|-------------------|--------------|
| User sees | 1 response | Activities + response + file card | Activities + analysis + file cards | Plan + activities + live terminal + file cards |
| Internal agents | 0 (direct) | 1 (Coder) | 1 (Research) | 4 (Manager + Coder × 2 + QA) |
| Responses | 1 | 1 | 1 | 1 |
| Activities shown | 1-2 | 4-5 | 3-4 | 8-10 |
| Architecture visible? | No | No | No | No |
| Duplicate responses? | No | No | No | No |
| Live terminal? | No | Yes (if commands run) | No | Yes (build, tests) |
| File cards? | No | Yes | Yes | Yes (multiple) |
