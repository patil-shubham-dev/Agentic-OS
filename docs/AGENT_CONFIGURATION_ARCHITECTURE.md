# Agent Configuration Architecture — Runtime Behavior

## Section 1 — Role Basics

### Agent Name
- **Stored in**: `AgentRoleConfig.name` (app-store zustand, persisted) / `RoleDefinition.name` (hardcoded registry)
- **Consumed by**: UI only. No runtime component reads `name` for logic decisions.
- **Affects execution?**: No. The routing engine uses `RuntimeRole` enum values, not display names.

### Built-in Badge (`isBuiltIn`)
- **Stored in**: `AgentRoleConfig.isBuiltIn`
- **Affects execution?**: No. Pure UI decoration.

### P1/P2 Priority (`priority: number`)
- **Stored in**: `AgentRoleConfig.priority` / `RoleDefinition.priority`
- **Consumed by**: Not actively consumed. The `manager-routing-engine.ts` selects roles by hardcoded intent→role arrays (e.g., `["coder", "research", "qa", "runtime"]` for multi-agent), not by sorting by priority.
- **Affects execution?**: **No**. Priority is defined per-role in the registry but never read during routing.
- **When evaluated**: Never at runtime. Could be used by a future sort step in `route()`.
- **What happens if disabled**: No effect — it's already inert.

### Idle Status
- **Stored in**: `RoleRuntimeState` (part of `AgentRoleConfig.runtimeState`)
- **Affects execution?**: No. Not read by any runtime component.

### Parent Relationship (`parentRole?: string`)
- **Stored in**: `AgentRoleConfig.parentRole`
- **Consumed by**: Not consumed. Present in schema only.
- **Affects execution?**: **No**. No runtime component traverses parent-child hierarchy.
- **Runtime impact**: Zero. It's a schema affordance for future hierarchical role inheritance.

---

## Section 2 — Provider + Model

### Provider (`providerId?: string`)
- **Stored in**: `AgentRoleConfig.providerId` → `WiredAgent.providerId` (computed by `computeGraphRaw()` in `runtime-engine.ts`)
- **Consumed by**: `resolveAgentConfig()` in `AgentExecutor.ts:57-72` — looks up `wiredAgents` array by role, finds matching `providerId`, then resolves `baseUrl`/`apiKey` from `useAppStore.providers[]`
- **Affects execution?**: **Yes**. If `providerId` is missing, the first provider in the list is used as default (`runtime-engine.ts:83`). If no provider exists, the role remains unwired and cannot execute.
- **Files**: `runtime-engine.ts:59-200`, `AgentExecutor.ts:57-72`, `app-store.ts`

### Model (`model?: string`)
- **Stored in**: `AgentRoleConfig.model` → `WiredAgent.model`
- **Consumed by**: `resolveAgentConfig()` returns `model`, which is passed as `model` in every `CompletionRequest` to `transport.streamChatCompletion()` / `transport.chatCompletion()`
- **Affects execution?**: **Yes**. The model string is sent verbatim to the provider API. If it doesn't match a valid model on the provider, the API call will fail.
- **Default**: First model from the provider's model list (`runtime-engine.ts:97`)

### Fallback Model (`fallbackModel?: string`)
- **Stored in**: `AgentRoleConfig.fallbackModel` — exists in the schema
- **Consumed by**: **No runtime component reads this field.**
- **Affects execution?**: **No**. There is no fallback logic anywhere in the execution path.
- **When is fallback invoked?**: Never. If the primary model fails, the error propagates up and the execution fails.
- **What would trigger fallback**: This would need implementation in `AgentExecutor.ts` — after a model call fails, catch the error and retry with `fallbackModel`. This doesn't exist today.
- **Files involved**: Only the type definition in `types/index.ts:189`. No runtime consumer.

**Full Execution Flow** (for Provider + Model):

```
AgentRoleConfig (app-store)
    ↓ providerId, model
runtime-engine.ts:computeGraphRaw()
    ↓ effectiveProvider = role.providerId ?? providers[0]?.id
    ↓ effectiveModel = role.model ?? provider?.models[0]?.id ?? ""
WiredAgent { runtimeRole, providerId, model }
    ↓
AgentExecutor.ts:resolveAgentConfig(role)
    ↓ finds WiredAgent by role → finds Provider by providerId
    ↓ returns { endpoint, apiKey, model, providerId, runtime }
    ↓
AgentExecutor.ts:executeFull() / executeFast()
    ↓ passes { model, messages, tools, maxTokens, signal } to transport
    ↓   (NOTE: temperature is NOT passed)
transport.streamChatCompletion() / transport.chatCompletion()
    ↓
TransportAdapter.buildCompletionBody()
    ↓ adds model to request body
    ↓   (OpenAI: passes temperature if defined; Anthropic: does NOT pass temperature)
Provider API
    ↓
Response (or error — no fallback if error)
```

---

## Section 3 — Temperature

### Where temperature is stored
- `RoleDefinition.temperature` (registry, per-role defaults)
- `AgentRoleConfig.temperature` (user config, persisted)

Registry defaults:
| Role | Temp |
|------|------|
| Manager | 0.3 |
| Coder | 0.2 |
| Vision | 0.3 |
| Research | 0.4 |
| Runtime | 0.1 |
| Design | 0.5 |
| Fast Inference | 0.5 |
| Browser | 0.2 |
| QA | 0.1 |
| Memory | 0.2 |

### Where temperature is applied
- **`AgentExecutor.ts`** — `executeFast()` and `executeFull()` build `CompletionRequest` objects with `{ model, messages, maxTokens, signal }` but **never include `temperature`**.
- **Files**: `AgentExecutor.ts` lines 128, 159 (fast path) and 281, 325 (full path)

### Which providers respect it
- `OpenAITransportAdapter.buildCompletionBody()` — **passes temperature** if `req.temperature !== undefined` (line 134)
- `GeminiTransportAdapter.buildCompletionBody()` — **passes temperature** in `generationConfig` (line 386)
- `AnthropicTransportAdapter.buildCompletionBody()` — **does NOT pass temperature** (lines 273-297)
- `NvidiaNimAdapter` — the base/adapter extends OpenAI adapter, so it would pass temperature

### Runtime flow
```
AgentRoleConfig.temperature (stored but never read)
    ↓ X
AgentExecutor.ts (skips temperature entirely)
    ↓
CompletionRequest { model, messages, maxTokens, signal, tools }
    ↓  (no temperature field set)
TransportAdapter.buildCompletionBody()
    ↓
Provider API → uses provider's default temperature
```

**Bottom line**: Temperature config has **no runtime effect**. All providers use their own default temperature.

---

## Section 4 — Collaboration Tags

### Definition
`AgentRoleConfig.collaborationTags: string[]` / `RoleDefinition.collaborationTags`

### Tags by role
| Role | Tags |
|------|------|
| Manager | `["orchestration", "planning", "coordination", "routing"]` |
| Coder | `["coding", "debugging", "refactoring", "implementation"]` |
| Vision | `["vision", "ui-analysis", "visual-qa", "screenshot"]` |
| Research | `["research", "analysis", "exploration", "architecture"]` |
| Runtime | `["execution", "terminal", "build", "deployment"]` |
| Design | `["design", "ui", "ux", "frontend", "components"]` |
| Fast Inf. | `["fast", "quick", "simple", "prototyping"]` |
| Browser | `["browser", "web", "automation", "scraping"]` |
| QA | `["testing", "qa", "quality", "verification"]` |
| Memory | `["memory", "context", "knowledge", "continuity"]` |

### Are these only metadata?
**Yes.** They are **metadata only**.

### Do they affect routing?
**No.** The `manager-routing-engine.ts` uses hardcoded intent→role arrays, not collaboration tags. Routing is done via regex pattern matching on user input, classified into 8 intent categories, each with a hardcoded `roles: RuntimeRole[]`.

### Which systems read them?
- **None at runtime.** The only reader would be the UI for display.
- The `collaboration.section.ts` prompt section describes how agents interact but does NOT read `collaborationTags` — it has hardcoded role descriptions.

---

## Section 5 — Capabilities

All 11 capabilities are defined as booleans on `AgentRoleConfig.capabilities` (or `RoleDefinition.capabilities`).

### Cognition

#### Planning
- **Runtime meaning**: None. No runtime check gates planning behavior.
- **Files**: Type only in `types/index.ts`
- **Enforced?**: **Decorative**

#### Reasoning
- **Runtime meaning**: None at role level. The provider's model-level reasoning support is checked via `ROLE_CAPABILITY_REQUIREMENTS` in `ProviderInstance.ts:35-46` (model-level: `supportsReasoning`), but this only affects provider assignment, not role execution.
- **Files**: `ProviderInstance.ts:35-46`
- **Enforced?**: **Partially** — at provider assignment, not at execution time.

#### Memory
- **Runtime meaning**: No capability-level check exists. Memory injection is always attempted if the store has data, regardless of this flag.
- **Files**: `memory-manager.ts`, `session-memory-store.ts`
- **Enforced?**: **Decorative**

### Development

#### Coding
- **Runtime meaning**: None. No runtime check gates code editing. The `code-editor.ts`, `code-workspace.tsx` don't check `capabilities.coding`.
- **Enforced?**: **Decorative**

### Access

#### Browsing
- **Runtime meaning**: Execution mode enforces this — `browserAllowed` filters out `"browser"` role in `execution-mode.ts:183`. But this is mode-level, not capability-level.
- **Files**: `execution-mode.ts:183`
- **Enforced?**: **Partially** — through execution mode constraints, not through the capabilities object.

#### Internet
- **Runtime meaning**: No runtime check.
- **Enforced?**: **Decorative**

#### File Access
- **Runtime meaning**: Execution mode `safe_mode` blocks file writes/edits. But this is mode-level, not capability-level.
- **Files**: `execution-mode.ts:215-225`
- **Enforced?**: **Partially** — through execution mode, not the capabilities object.

### Execution

#### Tools
- **Runtime meaning**: Tool execution is gated by `PermissionEngine`, `PolicyResolver`, and `ApprovalManager`. But there is **no check** that `capabilities.toolExecution` is true — all wired agents get `runtimeOS.toolRegistry.getAllBuiltin()` passed to the model.
- **Files**: `AgentExecutor.ts:244-246`, `ToolExecutionPipeline.ts:83-102`
- **Enforced?**: **Partially** — tool permissions are enforced per-call (allow/deny/ask), but the capability flag itself is ignored.

#### Orchestrate
- **Runtime meaning**: No runtime check for this capability. Orchestration is determined by the routing engine's `executionStrategy`, not by a capability flag.
- **Enforced?**: **Decorative**

### Perception

#### Vision
- **Runtime meaning**: Model-level vision support is checked in `ROLE_CAPABILITY_REQUIREMENTS` for the `vision` role (`supportsVision: true`). But the `capabilities.vision` flag is not checked.
- **Files**: `ProviderInstance.ts:37`
- **Enforced?**: **Partially** — at model assignment, not role capability.

### Security

#### Sandbox
- **Runtime meaning**: No sandbox enforcement exists. The `sandboxEscape` capability is decorative.
- **Files**: None — no sandbox logic references this field.
- **Enforced?**: **Decorative**

### Summary

| Capability | Enforced? | How |
|---|---|---|
| planning | ❌ Decorative | — |
| reasoning | ⚠️ Partial | Model-level `supportsReasoning` checked at provider assignment |
| memory | ❌ Decorative | — |
| coding | ❌ Decorative | — |
| browsing | ⚠️ Partial | Mode-level `browserAllowed` filters role, but `capabilities.browsing` unchecked |
| internet | ❌ Decorative | — |
| fileAccess | ❌ Decorative | Mode-level `safe_mode` blocks writes, but `capabilities.fileAccess` unchecked |
| tools | ⚠️ Partial | Permissions enforced per-tool, but `capabilities.toolExecution` unchecked |
| orchestration | ❌ Decorative | — |
| vision | ⚠️ Partial | Model-level `supportsVision` checked at provider assignment |
| sandbox | ❌ Decorative | — |

---

## Section 6 — Memory Scope

### Memory systems that exist

1. **File-based memory** (`memory-loader.ts`):
   - Loads from `~/.agentic-os/CLAUDE.md` (global), `CLAUDE.md` (project), `CLAUDE.local.md` (local), `.agentic-os/memory/rules/*.md` (rules)
   - Priority-ordered: 0 (global) → 1 (project) → 2 (local) → 3 (rules)
   - Results combined into single `memory.combined` string

2. **Session memory store** (`session-memory-store.ts`):
   - Zustand store: `useSessionMemoryStore`
   - Stores structured session data: title, currentState, taskSpecification, filesAndFunctions, workflow, errors, learnings, keyResults, worklog
   - Provides `toPromptBlock()` for injection into prompt

3. **History compression** (`memory-manager.ts`, `HistoryCompressor.ts`):
   - `summarizeMessages()` — keeps last 6 messages raw, summarizes older ones as `<<< summary >>>`
   - `getMemoryPressure()` — token budget percentage

### `memoryScope` field

- **Stored in**: `AgentRoleConfig.memoryScope` / `RoleDefinition.memoryScope`
- **Values**: `"none"` | `"session"` | `"project"` | `"global"`
- **Runtime consumer**: **None.** No runtime component reads `memoryScope` to decide what to inject.
- **Affects execution?**: **No.** The `memoryScope` field exists in the schema but is never consulted.
- **What context is actually injected**: `ContextManager.assembleSystemPrompt()` always creates a `ResolutionContext` that includes `memorySummary` (from the memory loader) and `projectRules` (from CLAUDE.md). The `session-memory.section.ts` and `memory-policy.section.ts` prompt sections always render based on data availability, not `memoryScope`.

**Execution flow**:

```
AgentExecutor.ts:executeFull()
    ↓
memoryLoader.load(rootPath) → memory.combined string
    ↓  (always loaded, regardless of memoryScope)
ContextManager.assembleSystemPrompt(assemblyInput)
    ↓
ResolutionContext { ..., memorySummary, projectRules, ... }
    ↓  (no memoryScope check)
PromptCompositionEngine
    ↓  (always renders memory-related sections if data available)
session-memory.section.ts (priority 80)
memory-policy.section.ts (priority 82)
    ↓
System prompt with memory injected
```

**Bottom line**: Memory scope setting is decorative. Memory is always loaded and injected regardless of the `memoryScope` value.

---

## Section 7 — System Prompt

### Prompt systems that currently exist

There are **2 prompt systems**, one active:

| System | Active? | Description |
|---|---|---|
| Section-based composition engine | ✅ **Active** | 21 registered sections, `PromptCompositionEngine` |
| Hardcoded role prompts | ⚠️ Fallback | Strings in `runtime-role-registry.ts`, used if section engine fails |

### Active system

**Prompt source**:
1. `ContextManager.assembleSystemPrompt(input)` → creates `ResolutionContext` → calls `PromptCompositionEngine.buildPrompt(context)`
2. Engine runs 7 phases: execute sections → deduplicate → build AST → compress → enforce budget → build trace → serialize

**21 sections** (ordered by priority):
- `agent-identity.section.ts` (pri 10) — role identity, custom instructions
- `safety-policy.section.ts` (pri 15)
- `execution-mission.section.ts` (pri 20)
- `execution-process.section.ts` (pri 25)
- `execution-mode.section.ts` (pri 30)
- `execution-policy.section.ts` (pri 35)
- `behavior-constraints.section.ts` (pri 40)
- `project-rules.section.ts` (pri 45)
- `workspace-context.section.ts` (pri 50)
- `verification.section.ts` (pri 55)
- `tools-registry.section.ts` (pri 60) — conditional on `hasTools`
- `tools-execution-policy.section.ts` (pri 62)
- `collaboration.section.ts` (pri 65) — conditional on `isMultiAgent`
- `environment-info.section.ts` (pri 70)
- `output-style.section.ts` (pri 75)
- `session-memory.section.ts` (pri 80)
- `memory-policy.section.ts` (pri 82)
- `routing-instructions.section.ts` (pri 83)
- `streaming-behavior.section.ts` (pri 84)
- `autonomous-behavior.section.ts` (pri 85) — conditional on `isAutonomous`
- `context-management.section.ts` (pri 90)

**Prompt inheritance**: Not implemented. Each role gets the full composition regardless of parent relationship. The `parentRole` field in `AgentRoleConfig` is unused.

**Agent prompt overrides**: Not implemented. The `systemPrompt` field on `AgentRoleConfig` is stored but not consulted by the composition engine. Individual sections can accept custom instructions through `ResolutionContext.customInstructions` (which comes from CLAUDE.md files, not role config).

### Which files generate final prompts

```
AgentExecutor.ts:executeFull()
    ↓ (line 222)
ContextManager.assembleSystemPrompt(assemblyInput)
    ↓ (src/runtime/context/ContextManager.ts:125-161)
    creates ResolutionContext from ContextAssemblyInput
    ↓
PromptCompositionEngine.buildPrompt(context)
    ↓ (src/runtime/prompting/composition/PromptCompositionEngine.ts)
    iterates all 21 sections from PromptRegistry
    calls section.build(context) for each
    ↓
AST → serialized system prompt string
    ↓
AgentExecutor.ts (line 231-232)
    systemPrompt → ChatMessage { role: "system", content: systemPrompt }
    ↓
    Sent to provider as first message
```

---

## Section 8 — Tool Permissions

### `orchestrate`, `delegate`, `review`, `plan`

**Stored in**: `RoleDefinition.toolPermissions` (registry) / `AgentRoleConfig.toolPermissions` (user config)

Per-role values:
| Role | Permissions |
|------|------------|
| Manager | `["orchestrate", "delegate", "review", "plan"]` |
| Coder | `["read", "write", "edit", "grep", "glob", "execute"]` |
| Others | Role-specific tool names |

### Are permissions enforced?

**No, not the `toolPermissions` array.** These strings are decorative. The actual enforcement happens at a different layer:

- **What IS enforced**: `ToolExecutionPipeline.execute()` calls `tool.permissions(input)`, then `PermissionEngine.evaluate()` which checks against execution mode policies (allow/deny/ask).

- **What is NOT enforced**: The `toolPermissions` array on AgentRoleConfig is never read by `ToolExecutionPipeline`, `PermissionEngine`, or any runtime code that gates tool access.

- **What actually happens**: All wired agents get `runtimeOS.toolRegistry.getAllBuiltin()` — the full tool list — passed to the model in the `CompletionRequest`. The model can call any tool. The only gating is at per-call execution via `PermissionEngine`, which checks mode-based policies, not role-based `toolPermissions`.

### Actual execution path

```
AgentExecutor.ts:244-246
    runtimeOS.toolRegistry.getAllBuiltin() → all tools (no role filtering)
    ↓
model receives all tool definitions (regardless of toolPermissions)
    ↓
model sends tool call
    ↓
ToolExecutionPipeline.execute(toolCall)
    ↓ line 84
tool.permissions(input) → PermissionResult
    ↓ line 90
PermissionEngine.evaluate(result, context)
    ↓
PolicyResolver.resolveWithMode(mode, toolName)
    ↓
Mode-based policy: allow | deny | ask
    ↓
If deny → return error
If ask → ApprovalManager.requestApproval(prompt)
If allow → execute tool
```

**Note**: `PermissionContext` includes `role`, but this is not matched against `toolPermissions`. It's available for future use.

---

## Section 9 — Real vs Decorative

| Feature | Fully Working | Partially Working | UI Only / Decorative |
|---|---|---|---|
| Agent name | | | ✅ Display only |
| Built-in badge | | | ✅ Display only |
| Priority (P1/P2) | | | ✅ Decorative — not read |
| Idle status | | | ✅ Display only |
| Parent relationship | | | ✅ Schema only |
| Provider selection | ✅ Determines API endpoint | | |
| Model selection | ✅ Sent to provider API | | |
| Fallback model | | | ✅ Schema only — no consumer |
| Temperature | | | ✅ Stored, never passed to API |
| System prompt | ✅ Section engine builds it | | |
| Capabilities — planning | | | ✅ Decorative |
| Capabilities — reasoning | | ⚠️ Model-level checked | |
| Capabilities — memory | | | ✅ Decorative |
| Capabilities — coding | | | ✅ Decorative |
| Capabilities — browsing | | ⚠️ Mode-level filtered | |
| Capabilities — internet | | | ✅ Decorative |
| Capabilities — fileAccess | | ⚠️ Mode-level in safe_mode | |
| Capabilities — tools | | ⚠️ Per-call permission engine | ✅ Flag itself ignored |
| Capabilities — orchestration | | | ✅ Decorative |
| Capabilities — vision | | ⚠️ Model-level checked | |
| Capabilities — sandbox | | | ✅ Decorative |
| Tool permissions list | | | ✅ Decorative — all agents get all tools |
| Collaboration tags | | | ✅ Metadata only |
| Memory scope | | | ✅ Decorative — memory always injected |
| Agent system prompt override | | | ✅ Schema only — not read |
| Execution mode | ✅ Affects routing + permissions | | |
| Provider assignment per role | ✅ Determines wiring | | |

**Counter**: 0 fully working runtime enforcement for config fields designed to control agent behavior. The fields that DO work (provider, model, execution mode) work through separate channels, not through the capabilities/permissions system.
