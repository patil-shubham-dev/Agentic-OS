# Settings ↔ Workspace Bridge

## Architecture Overview

```
Settings (Control Plane)
   ├── Providers & Models
   ├── Role Assignments
   ├── Security Rules
   └── System Prompts
            ↓
      Role Router
            ↓
Workspace Runtime (Execution Plane)
            ↓
   Agent Collaboration
            ↓
     Tool Execution
            ↓
  Final Response + File Changes
```

## Core Concept

The **Settings page** acts as the **Control Plane** — it defines all configuration: providers, API keys, available models, role-to-model mappings, security policies, and system prompts.

The **Workspace page** acts as the **Runtime/Execution Plane** — it dynamically consumes these settings at runtime to orchestrate one or more models working together in real time.

This separation ensures that configuration is centralized and decoupled from execution logic.

## Implementation

### Runtime Modules (`apps/web/src/lib/runtime/`)

| Module | File | Responsibility |
|---|---|---|
| **Settings Loader** | `settings-loader.ts` | Loads provider configs, role assignments, security toggles from the database via API routes |
| **Role Router** | `role-router.ts` | Reads role assignments, loads the correct provider+model, applies role-specific system prompts, and dispatches requests |
| **Agent Orchestrator** | `agent-orchestrator.ts` | Coordinates multi-agent collaboration: manager delegates tasks to specialist roles, consolidates results |
| **Inter-Agent Bus** | `inter-agent-bus.ts` | Structured messaging layer between agents (`{ from, to, task, result }`) |
| **Tool Registry** | `tool-registry.ts` | Shared set of tools (read/write files, terminal, search, web, etc.) usable by all agents |
| **Security Guard** | `security-guard.ts` | Enforces security policies before allowing tool execution (terminal, filesystem, browser, approval) |
| **System Prompt Loader** | `system-prompt-loader.ts` | Loads role-specific system prompts from the database or filesystem |

### Data Flow

1. **Settings** page writes configuration into Supabase tables (`provider_configs`, `provider_models`, `role_assignments`, `security_settings`, `system_prompts`)
2. **Workspace** loads the configuration via `settings-loader.ts` on startup
3. **Role Router** (`role-router.ts`) maps each agent role to the correct provider+model
4. **Agent Orchestrator** (`agent-orchestrator.ts`) manages multi-agent collaboration
5. **Tools** and **Security** are enforced through the shared registry and guard

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/settings/providers` | GET/POST | List/Create provider configs |
| `/api/settings/providers/:id` | PATCH/DELETE | Update/Delete provider |
| `/api/settings/providers/:id/test` | POST | Test connection |
| `/api/settings/providers/:id/discover-models` | POST/GET | Discover available models |
| `/api/settings/roles` | GET/POST | Read/Write role assignments |
| `/api/settings/security` | GET/POST | Read/Write security settings |
| `/api/chat` | POST | Chat endpoint (uses role router) |
| `/api/tools/execute` | POST | Execute a tool via the tool registry |

## Database Schema

Tables (Supabase):
- `provider_configs` — Provider endpoint, API key, metadata
- `provider_models` — Cached model lists per provider
- `role_assignments` — Which model powers each role
- `security_settings` — Terminal, filesystem, browser, approval toggles
- `system_prompts` — Role-specific prompt templates
