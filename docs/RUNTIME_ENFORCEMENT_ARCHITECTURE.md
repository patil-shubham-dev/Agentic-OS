# Runtime Enforcement Architecture

Three layered enforcement mechanisms enforce model reliability, capability boundaries, and memory access scoping during agent execution. All layers are implemented in `AgentExecutor.ts` and emit structured `ExecutionEvent` values consumed by `ExecutionSessionManager`.

---

## 1. Architecture Overview

| Phase | Layer | File | Purpose |
|-------|-------|------|---------|
| **Phase 2** | Model Fallback | `AgentExecutor.ts:76-84`, `AgentExecutor.ts:131-283` | Retry across models/providers on failure |
| **Phase 3** | Capability Enforcement | `AgentExecutor.ts:362-367`, `AgentExecutor.ts:754-777` | Filter exposed tools by role capabilities |
| **Phase 5** | Memory Scope Enforcement | `AgentExecutor.ts:300-313`, `AgentExecutor.ts:729-752` | Filter memory files by scope before injection |

All three gates are applied within the `AgentExecutor` async generator that yields `ExecutionEvent` values. The executor is invoked by `ExecutionOrchestrator` and consumed by `ExecutionSessionManager` in a single `for await...of` loop.

---

## 2. Enforcement Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      resolveAgentConfig()                           │
│  AgentExecutor.ts:86-110                                            │
│  Reads wiredAgents from WorkspaceRuntime, resolves primary +        │
│  fallback (model, endpoint, apiKey) from AgentRoleConfig            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              AgentExecutor.execute() AsyncGenerator                  │
│  AgentExecutor.ts:129-135                                           │
│  ├─ executeFast() ── single-round chat (FAST mode)                  │
│  └─ executeFull() ── multi-round tool loop (FULL/MULTI mode)        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ Phase 2         │ │ Phase 3         │ │ Phase 5              │
│ Fallback Retry  │ │ Capability      │ │ Memory Scope         │
│ Pipeline        │ │ Tool Filtering  │ │ Filtering            │
│                 │ │                 │ │                      │
│ Try streaming   │ │ filterToolsBy-  │ │ filterMemoryByScope()│
│ primary model   │ │ Capabilities()  │ │ scopeToSources()     │
│   ↓ fail        │ │ maps tool name  │ │                      │
│ Try streaming   │ │ → capability    │ │ "session" → [local]  │
│ fallback model  │ │ e.g. write_file │ │ "project" → [project,│
│   ↓ fail        │ │ → "coding"     │ │   local, rules]      │
│ Try non-stream  │ │                 │ │ "global" → [global,  │
│ primary model   │ │ Filters out     │ │   project, local,    │
│   ↓ fail        │ │ tools for which │ │   rules]             │
│ Try non-stream  │ │ capability is   │ │                      │
│ fallback model  │ │ false           │ │ Memory files with    │
│                 │ │                 │ │ source not in        │
│ FALLBACK_ACTI-  │ │ TOOLS_EXPOSED   │ │ allowed list are     │
│ VATED event     │ │ event carries   │ │ excluded before      │
│ on model switch │ │ final tool list │ │ context assembly     │
└─────────────────┘ └─────────────────┘ └──────────────────────┘
```

---

## 3. Phase 2 — Fallback Model Retry Pipeline

### Model Selection

Each `AgentRoleConfig` stores a `fallbackModel` field:

- **`src/types/index.ts:189`** — `AgentRoleConfig.fallbackModel?: string`
- **`src/runtime/runtime-engine.ts:14`** — `WiredAgent.fallbackModel` threaded from role config into the runtime graph
- **`src/runtime/runtime-engine.ts:134-144`** — `computeGraphRaw()` pushes `fallbackModel` into each `WiredAgent` entry

At execution time, `resolveAgentConfig()` (`AgentExecutor.ts:86-110`) resolves both primary and fallback configurations:

- **`AgentExecutor.ts:76-84`** — `resolveFallbackProvider()` iterates all configured providers and returns the first one whose model list contains the fallback model string
- If no provider hosts the fallback model, fallback is `null` and the pipeline skips fallback attempts

### Retry Order

Both `executeFast()` and `executeFull()` follow an identical four-attempt retry ladder:

```
Attempt 1: primary streaming    (AgentExecutor.ts:171-197 / 408-442)
Attempt 2: fallback streaming   (AgentExecutor.ts:203-235 / 447-486)
Attempt 3: primary non-streaming (AgentExecutor.ts:241-256 / 492-531)
Attempt 4: fallback non-streaming (AgentExecutor.ts:258-279 / 510-528)
```

Each subsequent attempt only fires if the previous one produced zero content and zero tool calls.

### Event Emission

When the pipeline switches to a fallback model:

```typescript
yield { type: "FALLBACK_ACTIVATED", executionId, fromModel, toModel, reason, timestamp }
```

- **`src/runtime/ExecutionEvent.ts:174-181`** — `FallbackActivatedEvent` interface
- Emitted at `AgentExecutor.ts:205` (Fast mode) and `AgentExecutor.ts:449` (Full mode)

---

## 4. Phase 3 — Capability Enforcement

### Tool Filtering

Before entering the tool execution loop in `executeFull()`, the executor filters the available tool set against the role's declared capabilities:

- **`AgentExecutor.ts:362-367`** — Retrieves `roleTools` from `RuntimeOS.toolRegistry.getByMode()`, then passes them through `filterToolsByCapabilities()`
- **`AgentExecutor.ts:754-777`** — `filterToolsByCapabilities()` implementation

### Tool-to-Capability Mapping

Each tool name is mapped to one capability key (`AgentExecutor.ts:755-771`):

| Tool Name | Required Capability |
|-----------|-------------------|
| `write_file` | `coding` |
| `edit_file` | `coding` |
| `read_file` | `fileAccess` |
| `grep_files` | `fileAccess` |
| `glob_files` | `fileAccess` |
| `run_command` | `toolExecution` |
| `bash` | `toolExecution` |
| `browser_navigate` | `browsing` |
| `browser_click` | `browsing` |
| `browser_type` | `browsing` |
| `browser_snapshot` | `browsing` |
| `web_fetch` | `internetAccess` |
| `web_search` | `internetAccess` |
| `delegate_task` | `orchestration` |
| `spawn_agent` | `orchestration` |

If a tool has no entry in the mapping (e.g., `read_file`), it passes through unfiltered. Tools whose required capability is `false` are excluded from the exposed tool list.

After filtering, the executor emits:

```typescript
yield { type: "TOOLS_EXPOSED", executionId, role, tools: filteredTools.map(t => t.name), timestamp }
```

- **`src/runtime/ExecutionEvent.ts:183-189`** — `ToolsExposedEvent` interface
- Emitted at `AgentExecutor.ts:366`

---

## 5. Phase 5 — Memory Scope Enforcement

### Scope Resolution

Each `AgentRoleConfig` carries a `memoryScope` field (`src/types/index.ts:209`):

```typescript
memoryScope: "none" | "session" | "project" | "global"
```

At the start of `executeFull()` (`AgentExecutor.ts:300-313`), the executor reads the memory scope from the role config and loads memory files via `memoryLoader.load()`:

```typescript
const memoryScope = myRoleConfig?.memoryScope ?? "project"
const memoryPromise = rootPath
  ? memoryLoader.load(rootPath).then((memory) => {
      const filtered = this.filterMemoryByScope(memory, memoryScope)
      if (filtered.combined.trim().length > 0) {
        projectRules = filtered.combined.trim()
      }
    })
  : Promise.resolve()
```

### Source Filtering

- **`AgentExecutor.ts:729-743`** — `filterMemoryByScope()` filters `MemoryFile[]` entries by `source` field against an allowed list derived from scope
- **`AgentExecutor.ts:745-752`** — `scopeToSources()` maps scope to allowed sources:

| Scope | Allowed Sources |
|-------|----------------|
| `"none"` | `[]` (all memory excluded) |
| `"session"` | `["local"]` — `CLAUDE.local.md` only |
| `"project"` | `["project", "local", "rules"]` — project, local, and path-scoped rules |
| `"global"` | `["global", "project", "local", "rules"]` — all memory |

### Memory File Sources

Memory files are loaded by `MemoryLoader` (`src/runtime/project-memory/memory-loader.ts:5-9`) from four sources defined in `MemoryFile.source` (`src/runtime/project-memory/memory-types.ts:24`):

| Source | Path | Priority |
|--------|------|----------|
| `global` | `~/.agentic-os/CLAUDE.md` | 0 |
| `project` | `{project}/CLAUDE.md` | 1 |
| `local` | `{project}/CLAUDE.local.md` | 2 |
| `rules` | `{project}/.agentic-os/memory/rules/*.md` | 3 |

### Injection

The filtered memory content (`filtered.combined`) is passed as `customInstructions` into `ContextAssemblyInput` (`AgentExecutor.ts:320`), which feeds into `ContextManager.assembleSystemPrompt()` to produce the final system prompt for the model.
