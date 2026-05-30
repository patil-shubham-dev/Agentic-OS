# Agent Configuration Runtime Map

## Legend

| Column | Meaning |
|--------|---------|
| **Store** | Where the value is persisted/read from |
| **Runtime Consumer** | Which code path reads this value during execution |
| **Execution Impact** | Whether changing this value changes behavior |
| **Status** | ✅ Working / ⚠️ Partial / ❌ Dead / 🎨 Decorative |

---

## Field-by-Field Map

### General

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `id` | `AgentRoleConfig.id` | None | None — identity only | 🎨 |
| `name` | `AgentRoleConfig.name` | UI only | None | 🎨 |
| `runtimeRole` | `AgentRoleConfig.runtimeRole` → `RoleDefinition.runtimeRole` → routing engine | `manager-routing-engine.ts` selects roles by `RuntimeRole` enum | ✅ Determines which role is selected in routing | ✅ |
| `description` | `AgentRoleConfig.description` | `agent-identity.section.ts` prompt section | ⚠️ Only influences prompt text, no logic branching | ⚠️ |
| `color` | `AgentRoleConfig.color` | UI only | None | 🎨 |
| `icon` | `AgentRoleConfig.icon` | UI only | None | 🎨 |
| `isBuiltIn` | `AgentRoleConfig.isBuiltIn` | UI only | None | 🎨 |
| `isEnabled` | `AgentRoleConfig.isEnabled` | None — not read at runtime | None | ❌ |
| `lastActiveAt` | `AgentRoleConfig.lastActiveAt` | None | None | ❌ |
| `executionCount` | `AgentRoleConfig.executionCount` | None | None | ❌ |
| `maxTokens` | `AgentRoleConfig.maxTokens` | Not read directly — `getEffectiveMaxTokens()` reads from `runtime-token-config.ts` | ⚠️ Role-level maxTokens from registry used via `runtime-token-config.ts`, NOT from user config | ❌ |

### Priority

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `priority` | `AgentRoleConfig.priority` / `RoleDefinition.priority` | **None** — no runtime code reads this field | None | ❌ |

**Files**: `runtime-role-registry.ts:17` (definition), `types/index.ts:211` (schema)

**Expected behavior**: Higher-priority roles should be selected first during routing.

**Actual behavior**: `manager-routing-engine.ts:route()` selects roles via hardcoded intent→role arrays. No priority sorting occurs.

### Provider + Model

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `providerId` | `AgentRoleConfig.providerId` | `runtime-engine.ts:83` → resolves effective provider. `AgentExecutor.ts:57-72` → resolves endpoint/apiKey | ✅ Determines which API is called | ✅ |
| `model` | `AgentRoleConfig.model` | `runtime-engine.ts:97` → resolves effective model. `AgentExecutor.ts:281,325` → passed in `CompletionRequest` | ✅ Sent verbatim to provider API | ✅ |
| `fallbackModel` | `AgentRoleConfig.fallbackModel` | **None** — no consumer | None | ❌ |

**Flow (Provider)**:
```
AgentRoleConfig.providerId
  ↓
runtime-engine.ts:computeGraphRaw() line 83
  effectiveProviderId = role.providerId ?? providers[0]?.id
  ↓
WiredAgent.providerId
  ↓
AgentExecutor.ts:resolveAgentConfig(role) line 57-72
  wired = wiredAgents.find(a => a.runtimeRole === role)
  provider = providers.find(p => p.id === wired.providerId)
  ↓
return { endpoint, apiKey, model, providerId, runtime }
```

**Flow (Model)**:
```
AgentRoleConfig.model
  ↓
runtime-engine.ts:computeGraphRaw() line 97
  effectiveModel = role.model ?? provider?.models[0]?.id ?? ""
  ↓
WiredAgent.model
  ↓
AgentExecutor.ts:
  streamChatCompletion(adapterConfig, { model: agentConfig.model, messages, maxTokens, signal })
    ↓
TransportAdapter → Provider API
```

### Temperature

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `temperature` | `AgentRoleConfig.temperature` / `RoleDefinition.temperature` | **None** — `AgentExecutor.ts` never reads or passes temperature | None | ❌ |

**Files**: `runtime-role-registry.ts` (lines 516, 538, 560, 582, 604, 626, 648, 670, 692, 714), `AgentExecutor.ts` (lines 128, 159, 281, 325)

**Registry values**: Manager=0.3, Coder=0.2, Vision=0.3, Research=0.4, Runtime=0.1, Design=0.5, FastInf=0.5, Browser=0.2, QA=0.1, Memory=0.2

**What actually happens**: All `CompletionRequest` objects in `AgentExecutor.ts` omit `temperature`. Providers use their built-in default temperature.

### Capabilities

| Capability | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `planning` | `AgentRoleConfig.capabilities.planning` | None | None | 🎨 |
| `reasoning` | `AgentRoleConfig.capabilities.reasoning` | `ProviderInstance.ts:35-46` — model-level `supportsReasoning` is checked for provider assignment | ⚠️ Affects which model can be assigned to a role, but the capability flag itself is not checked | ⚠️ |
| `memory` | `AgentRoleConfig.capabilities.memory` | None | None | 🎨 |
| `coding` | `AgentRoleConfig.capabilities.coding` | None | None | 🎨 |
| `browsing` | `AgentRoleConfig.capabilities.browsing` | `execution-mode.ts:183` — mode-level `browserAllowed` filters role from routing | ⚠️ Mode-level filtering works, but `capabilities.browsing` unchecked | ⚠️ |
| `internetAccess` | `AgentRoleConfig.capabilities.internetAccess` | None | None | 🎨 |
| `fileAccess` | `AgentRoleConfig.capabilities.fileAccess` | `execution-mode.ts:179` — mode-level `fileMutationsAllowed` filters roles | ⚠️ Mode-level works, but `capabilities.fileAccess` unchecked | ⚠️ |
| `toolExecution` | `AgentRoleConfig.capabilities.toolExecution` | `AgentExecutor.ts:244-246` — always passes all tools to model regardless of this flag. `ToolExecutionPipeline.ts:83-102` — enforces per-call permissions | ⚠️ All agents get all tools. Per-call permission engine respects mode policies, not this flag. | ⚠️ |
| `orchestration` | `AgentRoleConfig.capabilities.orchestration` | None | None | 🎨 |
| `vision` | `AgentRoleConfig.capabilities.vision` | `ProviderInstance.ts:37` — model-level `supportsVision` checked for provider assignment | ⚠️ Affects model assignment, but capability flag unchecked | ⚠️ |
| `sandboxEscape` | `AgentRoleConfig.capabilities.sandboxEscape` | None | None | 🎨 |

**Key observation**: The 11 capability flags serve as **metadata decorations**. The actual restrictions come from:
1. `execution-mode.ts` — mode-level role filtering (browser, file mutations)
2. `ProviderInstance.ts` — model-level capability requirements (tools, vision, streaming, context)
3. `ToolExecutionPipeline.ts` + `PermissionEngine` — per-tool-call allow/deny/ask

None of these systems read `AgentRoleConfig.capabilities.*`.

### Collaboration Tags

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `collaborationTags` | `AgentRoleConfig.collaborationTags` / `RoleDefinition.collaborationTags` | None | None | 🎨 |

**Files**: `types/index.ts:212`, `runtime-role-registry.ts` (lines 524, 546, 568, 590, 612, 634, 656, 678, 700, 722), `manager-routing-engine.ts` (does NOT read tags)

### Tool Permissions

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `toolPermissions` | `AgentRoleConfig.toolPermissions` / `RoleDefinition.toolPermissions` | None — the `toolPermissions` string array is never read by execution code | None — all wired agents get `registry.getAllBuiltin()` | 🎨 |

**Actual enforcement path** (does NOT use `toolPermissions` from config):
```
AgentExecutor.ts:244-246
  allTools = runtimeOS.toolRegistry.getAllBuiltin()  // no role filtering
    ↓
ToolExecutionPipeline.execute(toolCall)
  tool.permissions(input) → PermissionResult
    ↓
PermissionEngine.evaluate(result, context)
  PolicyResolver.resolveWithMode(mode, toolName)
    ↓
allow | deny | ask
```

### Memory Scope

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `memoryScope` | `AgentRoleConfig.memoryScope` / `RoleDefinition.memoryScope` | None — memory is always loaded and injected | None — changing scope does not change behavior | ❌ |

**Files**: `types/index.ts:210`, `runtime-role-registry.ts` (lines 522, 544, 566, 588, 610, 632, 654, 676, 698, 720), `AgentExecutor.ts:190-196` (always loads memory), `ContextManager.ts:125-161` (always builds resolution context with memorySummary)

### System Prompt

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `systemPrompt` (on AgentRoleConfig) | `AgentRoleConfig.systemPrompt` | None — `ContextManager.assembleSystemPrompt()` builds prompt from sections, does NOT read this field | None — field is schema-only, not injected | ❌ |
| `systemPromptVersion` | `AgentRoleConfig.systemPromptVersion` | None | None | ❌ |
| `runtimeState` | `AgentRoleConfig.runtimeState` | None | None | ❌ |

**Active prompt system**: `PromptCompositionEngine` (21 sections) called via `ContextManager.assembleSystemPrompt()` → `AgentExecutor.ts:222`

**Fallback prompt system**: `getSystemPromptForRole()` in `runtime-role-registry.ts:802-821` — returns hardcoded prompt strings if ContextManager fails.

### Execution Mode

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `executionMode` | `agent-store.ts:executionMode` | `ExecutionOrchestrator.ts:120-122` → `applyModeConstraints()`. `execution-mode.ts:171-204` → filters roles | ✅ Changes role selection and permission policies | ✅ |

### Parent Relationship

| Field | Store | Runtime Consumer | Execution Impact | Status |
|---|---|---|---|---|
| `parentRole` | `AgentRoleConfig.parentRole` | None | None | ❌ |

---

## Runtime Impact Summary

### Settings that actually affect execution

| Setting | How |
|---|---|
| `runtimeRole` | Determines which role slot the agent occupies in routing |
| `providerId` | Determines which API endpoint is called |
| `model` | Determines which model string is sent to the API |
| `executionMode` (not agent-level) | Filters roles, changes permission policies |

### Settings with partial/no effect

| Setting | Issue |
|---|---|
| `temperature` | Stored in config, never passed to API calls |
| `fallbackModel` | Schema only, no fallback implementation |
| `capabilities.*` | Never read by enforcement code |
| `toolPermissions` | Never read — all agents get all tools |
| `collaborationTags` | Never read by routing |
| `memoryScope` | Memory always loaded regardless of scope |
| `systemPrompt` | Section engine overrides this field |
| `parentRole` | No hierarchy traversal |
| `priority` | No priority-based routing |
| `isEnabled` | Never read |

### Enforcement layers (what actually works)

```
Layer 1: Execution Mode (execution-mode.ts)
  → Role filtering: browserAllowed, fileMutationsAllowed, includeQAByDefault
  → Permission policies: autoExecuteTools, requiresApproval

Layer 2: Provider Assignment (ProviderInstance.ts)
  → Model capability requirements: supportsTools, supportsVision, supportsStreaming, maxContext

Layer 3: Tool Execution (ToolExecutionPipeline.ts + PermissionEngine)
  → Per-call: allow/deny/ask based on mode policies

Layer 4: Prompt Injection (PromptCompositionEngine)
  → 21 sections compose system prompt
  → Conditional sections: isMultiAgent, isAutonomous, hasTools
```

None of these enforcement layers read from `AgentRoleConfig.capabilities` or `AgentRoleConfig.toolPermissions`.
