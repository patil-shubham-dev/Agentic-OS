# Role Inheritance Model

## 1. Purpose

Roles are the fundamental unit of agent configuration in AgenticOS. Each role defines a complete set of behaviors via capabilities, tools, memory scope, model assignment, and system prompt. The inheritance model provides canonical defaults that can be selectively overridden by users while preserving a clear chain from compile-time definitions to runtime execution.

## 2. Role Definition Hierarchy

### RoleDefinition (hardcoded registry)

File: `src/runtime/runtime-role-registry.ts:5-21`

Ten built-in roles are defined as `RoleDefinition` objects (lines 506–724), registered via `define()` (line 27). This is the source of truth for canonical defaults: temperature, maxTokens, systemPrompt, capabilities, toolPermissions, memoryScope, priority, executionMode, and collaborationTags.

| Role | ID | Line |
|---|---|---|
| Manager | `role-manager` | 506 |
| Coder | `role-coder` | 528 |
| Vision | `role-vision` | 550 |
| Research | `role-research` | 572 |
| Runtime | `role-runtime` | 594 |
| Design | `role-design` | 616 |
| Fast Inference | `role-fast-inference` | 638 |
| Browser | `role-browser` | 660 |
| QA | `role-qa` | 682 |
| Memory | `role-memory` | 704 |

### AgentRoleConfig (zustand store, user-overridable)

File: `src/types/index.ts:180-217`

The `AgentRoleConfig` interface extends the fields from `RoleDefinition` with user-settable properties: `providerId`, `model`, `fallbackModel`, `runtimeState`, `parentRole`, `isBuiltIn`, `isEnabled`, `lastActiveAt`, `executionCount`. Stored in `useAppStore.roleConfigs` (`app-store.ts:50`) and persisted via `settings-store.ts` (serialization at line 16–27, deserialization at line 29–58).

### defToRoleConfig() — conversion at initialization

File: `src/stores/app-store.ts:18-40`

When the app initializes, `initializeDefaultRoles()` (line 174) calls `getDefaultRoles()` (line 42) which maps each `RoleDefinition` through `defToRoleConfig()`:

```typescript
function defToRoleConfig(def: RoleDefinition): AgentRoleConfig
```

This copies all `RoleDefinition` fields — including `capabilities` (spread), `toolPermissions` (spread), `memoryScope` — and adds default user-configurable fields (`systemPromptVersion: 1`, `runtimeState: "idle"`, `isBuiltIn: true`, `isEnabled: true`, `executionCount: 0`). If the store already has existing role configs (e.g. loaded from persistence), they are backfilled rather than replaced (lines 178–183).

### WiredAgent — runtime wiring

File: `src/runtime/runtime-engine.ts:8-18`

After store configs are resolved to providers/models, `computeGraphRaw()` (line 61) produces `WiredAgent[]`. Each `WiredAgent` contains the runtime-resolved pairing: `roleId`, `runtimeRole`, `providerId`, `providerName`, `model`, `temperature`, `fallbackModel`, and `status`. This is the wiring layer that connects abstract role configs to concrete provider endpoints.

## 3. Inheritance Chain

```
RoleDefinition (registry defaults)
    │  runtime-role-registry.ts:5-21, lines 506–724
    │
    ▼
AgentRoleConfig (store, user can override any field)
    │  src/types/index.ts:180-217 | app-store.ts:18-40
    │  persisted via settings-store.ts:16-58
    │
    ▼
computeGraphRaw() → WiredAgent[]
    │  runtime-engine.ts:61-204
    │
    ▼
resolveAgentConfig() → { primary, fallback }
    │  AgentExecutor.ts:86-110
    │
    ▼
AgentExecutor execution
    │  AgentExecutor.ts:112-778
```

### Step-by-step

1. **`RoleDefinition`** — canonical defaults defined in `runtime-role-registry.ts`. Immutable at runtime.
2. **`defToRoleConfig()`** — converts each `RoleDefinition` to `AgentRoleConfig` at app init (`app-store.ts:18-40`). The user can then override any field via the UI (persisted through `settings-store.ts`).
3. **`computeGraphRaw()`** — reads `roleConfigs` from the store, resolves each role to a provider + model, produces `WiredAgent[]` (`runtime-engine.ts:61-204`). This is where `providerId` and `model` are resolved from the store config (lines 84–100).
4. **`resolveAgentConfig()`** — reads `wiredAgents` from `useWorkspaceRuntime`, finds the matching entry by `RuntimeRole`, looks up the provider's `baseUrl`/`apiKey`, and returns a `ResolvedAgentConfig` (`AgentExecutor.ts:86-110`).
5. **`AgentExecutor`** — uses the resolved config for all execution (line 139 for fast mode, line 291 for full mode).

## 4. `parentRole?: string`

Defined in `AgentRoleConfig` (`src/types/index.ts:210`), present in the shared schema (`packages/shared/src/types.ts:167`), and rendered in the UI (`src/components/settings/roles-tab.tsx:443-444`).

**Current status**: Schema-only. The `parentRole` field is stored and displayed (a role can show its parent badge and a role-dependency graph can render parent-child edges), but no runtime inheritance merging is implemented. Each role's config is used as-is from the store without traversing the parent chain. The role hierarchy tree (`src/components/settings/agents/role-hierarchy-tree.tsx`) and dependency graph (`src/components/settings/agents/role-dependency-graph.tsx`) render the relationship visually, but execution does not propagate fields from parent to child.

**Future use**: When implemented, a role with `parentRole: "role-coder"` would inherit all fields from the Coder definition unless explicitly overridden, enabling composable role configurations without duplicating shared settings (system prompt fragments, tool permissions, capability sets).

## 5. Field Propagation Table

| Field | RoleDefinition | AgentRoleConfig | WiredAgent | resolveAgentConfig |
|---|---|---|---|---|
| `id` | ✓ (line 6) | ✓ (line 181) | ✓ as `roleId` (line 9) | — |
| `runtimeRole` | ✓ (line 7) | ✓ optional (line 183) | ✓ (line 10) | ✓ (lookup key, line 90) |
| `providerId` | — | ✓ (line 187) | ✓ (line 12) | ✓ (line 92) |
| `model` | — | ✓ (line 188) | ✓ (line 14) | ✓ (line 97) |
| `fallbackModel` | — | ✓ (line 189) | ✓ (line 16) | resolved separately via `resolveFallbackProvider()` (line 76) |
| `temperature` | ✓ (line 12) | ✓ (line 190) | ✓ (line 15) | ✓ (line 100) |
| `capabilities` | ✓ (line 15) | ✓ (line 195–207) | — | ✓ (filtered in AgentExecutor) |
| `memoryScope` | ✓ (line 17) | ✓ (line 209) | — | ✓ (filtered in AgentExecutor) |
| `systemPrompt` | ✓ (line 14) | ✓ (line 192) | — | ✓ (via ContextManager at `runtime-role-registry.ts:802-821`) |
| `toolPermissions` | ✓ (line 16) | ✓ (line 208) | — | ✓ (via ToolRegistry) |

## 6. Runtime Resolution

### `computeGraphRaw()` — the wiring engine

File: `src/runtime/runtime-engine.ts:61-204`

This is the central function that maps role configs to providers/models. The algorithm:

1. Iterates each `AgentRoleConfig` from the store (line 72)
2. Skips disabled roles (lines 73–82)
3. Resolves `effectiveProviderId`: `role.providerId ?? providers[0]?.id` (line 85)
4. Resolves `effectiveModel`: `role.model ?? provider.models[0]?.id ?? ""` (line 99)
5. Produces a `WiredAgent` with the resolved pair (lines 134–144)
6. Collects diagnostics for missing providers, missing models, or disabled roles (lines 146–152)
7. Returns a `RuntimeGraph` containing `wiredAgents[]`, health status, and diagnostics (lines 192–203)

### `resolveAgentConfig()` — execution-time resolution

File: `src/runtime/agents/AgentExecutor.ts:86-110`

Called at execution start (fast path: line 139, full path: line 291):

1. Reads `wiredAgents` from `useWorkspaceRuntime` (line 87)
2. Finds the wired agent matching the requested `RuntimeRole` (line 90)
3. Looks up the provider to get `baseUrl` and `apiKey` (line 92)
4. Constructs `ResolvedAgentConfig` with endpoint, model, temperature (lines 94–101)
5. Optionally resolves fallback provider/model (lines 102–108)
