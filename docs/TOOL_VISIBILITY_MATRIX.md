# Tool Visibility Matrix

How built-in tools are exposed to each role through three filtering layers.

---

## Layer 1 — Mode-based filtering

**Code**: `ToolRegistry.getByMode(role)` at [`ToolRegistry.ts:61-63`](../src/runtime/tools/registry/ToolRegistry.ts#L61-L63)

```ts
getByMode(mode: string): AgentTool[] {
  return this.getAll().filter(t =>
    t.supportedModes().includes('*') ||
    t.supportedModes().includes(mode)
  )
}
```

Each built-in tool declares `supportedModes()` via `createAgentTool()` at [`agent-tools.ts:344-347`](../src/lib/agents/agent-tools.ts#L344-L347). Tools with `roles: ["*"]` return `['*']` (universal — visible to all roles). Tools with explicit role arrays return that array verbatim.

**Universal tools** (visible to every role after Layer 1):
| Tool | `roles` field |
|------|---------------|
| `grep_files` | `["*"]` |
| `glob_files` | `["*"]` |
| `read_file` | `["*"]` |
| `run_command` | `["*"]` |
| `run_skill` | `["*"]` |

**Mode-scoped tools** (visible only when mode matches):
| Tool | `roles` (supportedModes) |
|------|--------------------------|
| `write_file` | `["coding", "coder", "design", "runtime"]` |
| `edit_file` | `["coding", "coder", "design", "runtime"]` |
| `launch_browser` | `["browser", "qa", "design"]` |
| `browser_navigate` | `["browser", "qa", "design"]` |
| `browser_screenshot` | `["browser", "qa", "design"]` |
| `browser_click` | `["browser", "qa", "design"]` |
| `browser_fill` | `["browser", "qa", "design"]` |
| `browser_execute_js` | `["browser", "qa", "design"]` |
| `browser_get_title` | `["browser", "qa", "design"]` |
| `browser_get_text` | `["browser", "qa", "design"]` |
| `browser_wait` | `["browser", "qa", "design"]` |
| `browser_close` | `["browser", "qa", "design"]` |
| `design_create_artifact` | `["design"]` |
| `design_add_version` | `["design"]` |
| `design_generate_preview` | `["design"]` |
| `delegate_subtask` | `["manager"]` |

---

## Layer 2 — Capability-based filtering

**Code**: `filterToolsByCapabilities()` at [`AgentExecutor.ts:754-777`](../src/runtime/agents/AgentExecutor.ts#L754-L777)

After mode filtering, tools are checked against the role's capability flags from `AgentRoleConfig.capabilities`. The mapping is hardcoded:

| Tool name | Required capability |
|-----------|-------------------|
| `write_file`, `edit_file` | `coding` |
| `read_file`, `grep_files`, `glob_files` | `fileAccess` |
| `run_command`, `bash` | `toolExecution` |
| `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot` | `browsing` |
| `web_fetch`, `web_search` | `internetAccess` |
| `delegate_task`, `spawn_agent` | `orchestration` |

Tools not in the map (e.g. all `design_*`, `run_skill`, `delegate_subtask`) pass through unfiltered.

> **Note**: Several tools referenced in the capability map (`bash`, `browser_type`, `browser_snapshot`, `web_fetch`, `web_search`, `delegate_task`, `spawn_agent`) do **not** exist as built-in tools in the current `BUILTIN_TOOLS` array at [`agent-tools.ts:30-319`](../src/lib/agents/agent-tools.ts#L30-L319). They may be supplied by MCP or plugin registrations.

---

## Layer 3 — Conversion-layer mode filter (legacy Phase 4)

**Code**: `agentToolsToToolDefsForRole()` at [`agentToolToToolDef.ts:23-33`](../src/runtime/tools/conversion/agentToolToToolDef.ts#L23-L33)

This function applies a second mode-style filter based on role prefix mapping:

```ts
const rolePrefixes = getRolePrefixes(role)
// e.g. "coder" → ["default", "worker", "coder"]
// e.g. "manager" → ["default", "orchestrator", "manager"]
```

It filters tools to those whose `supportedModes()` overlap with the role's prefixes. Tools with no modes declared or with `['*']` pass through.

Currently this function is **not called** in the main `AgentExecutor.executeFull()` path — only `agentToolsToToolDefs()` is used (line 367). It exists as infrastructure for a permission-based layer that can be activated in the future.

---

## Role capability configurations

Each role's capabilities from [`runtime-role-registry.ts`](../src/runtime/runtime-role-registry.ts):

| Role | `coding` | `fileAccess` | `toolExecution` | `browsing` | `internetAccess` | `orchestration` |
|------|----------|-------------|-----------------|------------|-----------------|----------------|
| **manager** | false | true | true | false | false | true |
| **coder** | true | true | true | false | false | false |
| **vision** | false | false | false | true | false | false |
| **research** | false | true | false | false | false | false |
| **runtime** | false | true | true | false | false | false |
| **design** | true | true | false | false | false | false |
| **browser** | false | false | false | true | true | false |
| **qa** | false | true | true | true | false | false |
| **fast-inference** | true | false | false | false | false | false |
| **memory** | false | false | false | false | false | false |

---

## Current Tool → Role Visibility Matrix

**Legend**: ✓ = Visible (passes both Layer 1 and Layer 2) · — = Hidden by Layer 1 (mode) · ⊘ = Hidden by Layer 2 (capability) · ✗ = Hidden by both · **—** = Not a built-in tool (would come from MCP/plugin)

| Tool | manager | coder | vision | research | runtime | design | browser | qa | fast-inference | memory |
|------|---------|-------|--------|----------|---------|--------|---------|----|---------------|--------|
| `write_file` | ✗ | ✓ | ✗ | ✗ | ⊘ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `edit_file` | ✗ | ✓ | ✗ | ✗ | ⊘ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `read_file` | ✓ | ✓ | ⊘ | ✓ | ✓ | ✓ | ⊘ | ✓ | ⊘ | ⊘ |
| `grep_files` | ✓ | ✓ | ⊘ | ✓ | ✓ | ✓ | ⊘ | ✓ | ⊘ | ⊘ |
| `glob_files` | ✓ | ✓ | ⊘ | ✓ | ✓ | ✓ | ⊘ | ✓ | ⊘ | ⊘ |
| `run_command` | ✓ | ✓ | ⊘ | ⊘ | ✓ | ⊘ | ⊘ | ✓ | ⊘ | ⊘ |
| `run_skill` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `delegate_subtask` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `launch_browser` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `browser_navigate` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `browser_screenshot` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `browser_click` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `browser_fill` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `browser_execute_js` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `browser_get_title` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `browser_get_text` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `browser_wait` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `browser_close` | ✗ | ✗ | ✗ | ✗ | ✗ | ⊘ | ✓ | ✓ | ✗ | ✗ |
| `design_create_artifact` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `design_add_version` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `design_generate_preview` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `bash` ** | — | — | — | — | — | — | — | — | — | — |
| `browser_type` ** | — | — | — | — | — | — | — | — | — | — |
| `browser_snapshot` ** | — | — | — | — | — | — | — | — | — | — |
| `web_fetch` ** | — | — | — | — | — | — | — | — | — | — |
| `web_search` ** | — | — | — | — | — | — | — | — | — | — |
| `delegate_task` ** | — | — | — | — | — | — | — | — | — | — |
| `spawn_agent` ** | — | — | — | — | — | — | — | — | — | — |

> **\*\*** Not defined in `BUILTIN_TOOLS` — if registered via MCP/plugin they would follow the same Layer 1 & 2 filtering based on their own `supportedModes()` and `requiredCapabilities()`.

---

## Observability

**Event**: `TOOLS_EXPOSED` emitted at [`AgentExecutor.ts:366`](../src/runtime/agents/AgentExecutor.ts#L366)

```ts
yield {
  type: "TOOLS_EXPOSED",
  executionId: eid,
  role: this.role,
  tools: filteredTools.map(t => t.name),
  timestamp: Date.now()
}
```

This event fires after both Layer 1 (`getByMode`) and Layer 2 (`filterToolsByCapabilities`) have been applied. The `tools` array contains the exact tool names the role receives for the execution round. It is the authoritative trace point for debugging tool visibility.

---

## Summary

1. **`getByMode(role)`** filters by `supportedModes()` — universal (`['*']`) tools pass to all roles; scoped tools pass only if their mode list includes the role.
2. **`filterToolsByCapabilities()`** removes tools whose required capability flag is `false` in the role's config. Tools not in the hardcoded map are unfiltered.
3. **`agentToolsToToolDefsForRole()`** exists as infra but is not currently wired in the main execution path.
4. Only **coder**, **manager**, **qa**, and **runtime** have meaningful tool access after both layers. **Vision**, **memory**, and **fast-inference** see only `run_skill` (and potentially MCP/plugin tools).
5. The `TOOLS_EXPOSED` event provides runtime observability into what each role actually receives.
