# Memory Scope Enforcement (Phase 5)

## Purpose

Each role in AgenticOS carries a `memoryScope` setting (`"none" | "session" | "project" | "global"`) that determines which [memory files](#memory-file-sources) are injected into the agent's context assembly. Prior to Phase 5, all roles unconditionally received all memory files regardless of sensitivity or relevance.

## Memory File Sources

Defined by `MemoryFile.source` in `memory-types.ts:24`:

| `source` | Path | Purpose |
|---|---|---|
| `"global"` | `~/.agentic-os/CLAUDE.md` | Cross-project knowledge, global conventions |
| `"project"` | `CLAUDE.md` in project root | Project-specific rules and guidelines |
| `"local"` | `CLAUDE.local.md` in project root | Local overrides (session-scoped only) |
| `"rules"` | `.agentic-os/memory/rules/*.md` | Path-scoped rule files (with optional `path_pattern` frontmatter) |

These sources are loaded in priority order (0→3) by `MemoryLoader.load()` in `memory-loader.ts:24-65`.

## Scope → Source Mapping

| `memoryScope` | Sources Included | Typical Use |
|---|---|---|
| `"none"` | *(none — no memory loaded)* | Fast Inference — minimal context overhead |
| `"session"` | `local` only | Worker agents that need only local overrides |
| `"project"` | `project`, `local`, `rules` | Deep-analysis roles that need full project context |
| `"global"` | `global`, `project`, `local`, `rules` | Orchestration/memory roles — full picture |

Implemented by `scopeToSources()` at `AgentExecutor.ts:745-752`.

## Role → `memoryScope` Assignments

From `runtime-role-registry.ts`:

| Role | `memoryScope` | Rationale |
|---|---|---|
| Manager | `global` | Needs full cross-project and project context for orchestration |
| Coder | `session` | Only local overrides; project rules come via delegation context |
| Vision | `session` | Visual analysis rarely needs project-wide memory |
| Research | `project` | Deep codebase analysis requires full project rules |
| Runtime | `session` | Command execution needs minimal memory overhead |
| Design | `session` | UI work uses local conventions, not full project rules |
| Fast Inference | `none` | Max speed, no memory loading |
| Browser | `session` | Web automation needs only local overrides |
| QA | `session` | Testing uses delegated context, not raw project rules |
| Memory | `global` | Full memory access required for context management |

## Implementation

### Entry Point — `executeFull()`

Located at `AgentExecutor.ts:288-341`:

1. Reads `memoryScope` from the agent's role config store (`AgentExecutor.ts:300-302`):
   ```ts
   const myRoleConfig = roleConfigs.find(r => r.runtimeRole === this.role || r.id === this.role)
   const memoryScope = myRoleConfig?.memoryScope ?? "project"
   ```

2. Calls `memoryLoader.load(rootPath)` to load all memory files (`AgentExecutor.ts:307`).

3. Chains `filterMemoryByScope()` to filter the result before passing it as `customInstructions` (`AgentExecutor.ts:308-311`):
   ```ts
   memoryLoader.load(rootPath).then((memory) => {
     const filtered = this.filterMemoryByScope(memory, memoryScope)
     if (filtered.combined.trim().length > 0) {
       projectRules = filtered.combined.trim()
     }
   })
   ```

4. The filtered `projectRules` is injected into `ContextAssemblyInput.customInstructions` (`AgentExecutor.ts:320`), which feeds into system prompt composition.

### Filter Function — `filterMemoryByScope()`

At `AgentExecutor.ts:729-743`:

```ts
private filterMemoryByScope(memory: MemoryLoadResult, scope: string): MemoryLoadResult {
  if (scope === "none") {
    return { files: [], combined: "", rules: [] }
  }
  const allowedSources = this.scopeToSources(scope)
  const filtered = memory.files.filter(f => allowedSources.includes(f.source as any))
  return {
    files: filtered,
    combined: filtered.sort((a, b) => a.priority - b.priority).map(f => f.content).join("\n\n"),
    rules: filtered.filter(f => f.source === "rules"),
  }
}
```

## Execution Path

```
executeFull()                          [AgentExecutor.ts:288]
  │
  ├─ read memoryScope from store       [AgentExecutor.ts:300-302]
  │
  ├─ memoryLoader.load(rootPath)       [AgentExecutor.ts:307]
  │   ├─ DEFAULT_MEMORY_FILES          [memory-loader.ts:5-9]
  │   │   ├─ global  (~/.agentic-os/CLAUDE.md)
  │   │   ├─ project (CLAUDE.md)
  │   │   └─ local   (CLAUDE.local.md)
  │   └─ loadRules (rules/*.md)        [memory-loader.ts:52-58]
  │
  ├─ filterMemoryByScope(memory, scope)[AgentExecutor.ts:308]
  │   └─ scopeToSources(scope)         [AgentExecutor.ts:745-752]
  │
  ├─ customInstructions: projectRules  [AgentExecutor.ts:320]
  │
  └─ ContextAssemblyInput              [AgentExecutor.ts:316-334]
      └─ assembleSystemPrompt()        → system prompt composition
```
