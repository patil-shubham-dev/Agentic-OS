# Capability Enforcement Matrix

> Phase 3 — Runtime capability gating for AgenticOS role-based execution.

## Purpose

`AgentRoleConfig.capabilities` defines 11 boolean flags that gate runtime behavior. Tools, context assembly, and execution paths are filtered based on what the role is allowed to do. The enforcement layer sits inside `AgentExecutor` and fires after the mode-level tool filter (`toolRegistry.getByMode()`), providing a second, role-specific authorization gate.

The capability model flows from registry definitions through `defToRoleConfig()` in `app-store.ts:18-40` where `capabilities: { ...def.capabilities }` is deep-copied from the hardcoded `RoleDefinition` into each agent's mutable `AgentRoleConfig`.

## Capability Flags

Defined in `src/types/index.ts:195-207`:

| Flag | Type | Description |
|---|---|---|
| `coding` | `boolean` | Writing/editing code files |
| `browsing` | `boolean` | Automating browser interactions |
| `planning` | `boolean` | Creating task plans |
| `memory` | `boolean` | Accessing stored session/project memory |
| `fileAccess` | `boolean` | Reading/writing files in workspace |
| `internetAccess` | `boolean` | Accessing external network/web |
| `toolExecution` | `boolean` | Executing shell commands |
| `sandboxEscape` | `boolean` | Elevated permissions |
| `vision` | `boolean` | Analyzing images/screenshots |
| `reasoning` | `boolean` | Advanced reasoning models |
| `orchestration` | `boolean` | Multi-agent coordination |

## Tool → Capability Mapping

The mapping is hardcoded in `AgentExecutor.ts:755-770` within `filterToolsByCapabilities()`:

| Tool Name | Required Capability |
|---|---|
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

Tools not listed in the map (no required capability) pass through unfiltered.

## Implementation

### Entry point — `AgentExecutor.ts:361-366`

```typescript
// ── Phase 3: Filter tools by role capabilities ──
const runtimeOS = RuntimeOS.getInstance()
const roleTools = runtimeOS.toolRegistry.getByMode(this.role)
const capabilities = myRoleConfig?.capabilities
const filteredTools = capabilities ? this.filterToolsByCapabilities(roleTools, capabilities) : roleTools
```

**Pipeline order:**
1. `toolRegistry.getByMode(this.role)` — first-pass filter by execution mode (`AgentExecutor.ts:363`)
2. `filterToolsByCapabilities()` — second-pass filter by role capabilities (`AgentExecutor.ts:365`)
3. `TOOLS_EXPOSED` event emitted with post-filtering tool list (`AgentExecutor.ts:366`)

### Core filter — `AgentExecutor.ts:754-777`

```typescript
private filterToolsByCapabilities(tools: AgentTool[], capabilities: AgentRoleConfig["capabilities"]): AgentTool[] {
  const toolCapabilityMap: Record<string, keyof typeof capabilities> = {
    write_file: "coding",
    edit_file: "coding",
    read_file: "fileAccess",
    grep_files: "fileAccess",
    glob_files: "fileAccess",
    run_command: "toolExecution",
    bash: "toolExecution",
    browser_navigate: "browsing",
    browser_click: "browsing",
    browser_type: "browsing",
    browser_snapshot: "browsing",
    web_fetch: "internetAccess",
    web_search: "internetAccess",
    delegate_task: "orchestration",
    spawn_agent: "orchestration",
  }
  return tools.filter(t => {
    const required = toolCapabilityMap[t.name]
    if (!required) return true
    return capabilities[required] === true
  })
}
```

A tool is **removed** if its name exists in `toolCapabilityMap` AND the corresponding capability flag on the role is `false`. Tools with no entry in the map are always allowed.

## Role → Capability Assignment

Defined in `src/runtime/runtime-role-registry.ts` (lines 516–724, one `define()` block per role). All 11 flags are set per role, but the six that directly gate tool access are shown below for clarity:

| Role | File | `coding` | `browsing` | `toolExecution` | `fileAccess` | `internetAccess` | `orchestration` |
|---|---|---|---|---|---|---|---|
| Manager | `runtime-role-registry.ts:516` | N | N | Y | Y | N | Y |
| Coder | `runtime-role-registry.ts:538` | Y | N | Y | Y | N | N |
| Vision | `runtime-role-registry.ts:560` | N | Y | N | N | N | N |
| Research | `runtime-role-registry.ts:582` | N | N | N | Y | N | N |
| Runtime | `runtime-role-registry.ts:604` | N | N | Y | Y | N | N |
| Design | `runtime-role-registry.ts:626` | Y | N | N | Y | N | N |
| Fast Inference | `runtime-role-registry.ts:648` | Y | N | N | N | N | N |
| Browser | `runtime-role-registry.ts:670` | N | Y | N | N | Y | N |
| QA | `runtime-role-registry.ts:692` | N | Y | Y | Y | N | N |
| Memory | `runtime-role-registry.ts:714` | N | N | N | N | N | N |

The remaining flags (`planning`, `memory`, `sandboxEscape`, `vision`, `reasoning`) are set per role but do not currently gate specific tools in `toolCapabilityMap`.

## Observability

After capability filtering, the `TOOLS_EXPOSED` event is yielded from the executor's async generator at `AgentExecutor.ts:366`:

```typescript
yield { type: "TOOLS_EXPOSED", executionId: eid, role: this.role, tools: filteredTools.map(t => t.name), timestamp: Date.now() }
```

The event type is defined in `ExecutionEvent.ts:183-189`:

```typescript
export interface ToolsExposedEvent {
  type: "TOOLS_EXPOSED"
  executionId: string
  role: string
  tools: string[]
  timestamp: number
}
```

This enables observability tooling (UI, logging, tracing) to see exactly which tools each agent was granted after all filtering layers have been applied.
