# AgenticOS Architecture

## System Overview

AgenticOS is a code-generation agent platform with a **single producer chain → single consumer → single store** execution architecture. All execution data flows through one event protocol, one orchestrator, one session manager, and one UI store.

### Core Principle

> One event protocol. One producer chain. One consumer. One store. One renderer.

No component writes to stores except the designated consumer. No event bus carries execution traffic. No parallel update paths exist.

---

## Directory Layout

```
src/
├── runtime/                    # Core execution engine
│   ├── execution/              # Orchestrator, session manager, synthesis
│   ├── agents/                 # Agent executor (FAST/FULL/MULTI modes)
│   ├── streaming/              # Token coalescer (StreamManager), EventChannel
│   ├── tools/                  # Tool registry, execution pipeline, policies
│   ├── mcp/                    # MCP client, transports, server manager
│   ├── context/                # Context assembly, token budgets, compaction
│   ├── prompting/              # Prompt composition engine, sections
│   ├── skills/                 # Skill execution
│   └── sessions/               # Execution session management
│
├── components/                 # React UI
│   └── workspace/timeline/     # Conversation renderer (sole UI consumer)
│
├── stores/                     # Zustand state stores
│   ├── timeline-store.ts       # SINGLE source of truth for conversation
│   ├── agent-store.ts          # Conversations, assignments, steps
│   ├── app-store.ts            # Providers, roles, agents, MCP servers
│   ├── workspace-store.ts      # File tree, open files
│   └── ledger-store.ts         # Action ledger
│
└── lib/                        # Legacy implementations
    ├── tool-executor.ts        # 21 built-in tool implementations
    └── agent-tools.ts          # Built-in tool definitions + registration

packages/
├── providers/                  # Provider connectivity
│   └── src/
│       ├── provider-gateway.ts # Runtime detection, health cache, validation
│       ├── transport.ts        # ProviderTransport class
│       ├── provider-registry.ts# 17 provider presets
│       └── transport-*.ts      # Adapters, middleware, streaming, errors
│
├── shared/                     # Shared types and constants
└── ui/                         # Shared UI components
```

---

## Ownership Map

| Component | Owns | Writes To |
|-----------|------|-----------|
| `ExecutionOrchestrator` | Event production | Nothing (yields events only) |
| `ExecutionSessionManager` | Event consumption | timeline-store, agent-store, ledger-store |
| `StreamManager` | Token buffering | Nothing (calls flush callback) |
| `AgentExecutor` | Agent chat loop | ledger-store (legacy direct write) |
| `timeline-store` | Conversation state | Nothing (read by UI only) |
| `agent-store` | Agent messages | Nothing (written by ESManager) |

---

## Key Constraints

1. **No direct store writes from Orchestrator** — yields events only
2. **No EventBus for execution traffic** — reserved for UI/theme/plugin/settings
3. **No commitStream from StreamManager** — pure token buffer
4. **Single consumer** — ExecutionSessionManager is the only event stream consumer
5. **Single store** — timeline-store is the single UI source of truth
6. **No synthetic session creation** — all sessions come from EXECUTION_CREATED/AGENT_ASSIGNED

---

## Runtime Modes

6 execution modes defined in `src/runtime/execution-mode.ts`:

| Mode | Auto Tools | Run Tests | Max Retries | Parallel | Research | File Mutations |
|------|-----------|-----------|-------------|----------|----------|---------------|
| autonomous | Yes | Yes | 3 | Yes | No | Yes |
| fastest | Yes | No | 1 | Yes | No | Yes |
| most_accurate | No | Yes | 5 | No | Yes | Yes |
| research_heavy | Yes | No | 3 | Yes | Yes | No |
| human_guided | No | Yes | 3 | No | Yes | Yes |
| safe_mode | No | No | 2 | No | Yes | No |

---

## Agent Modes

- **FAST**: Single-turn chat completion, no tool calling loop
- **FULL**: Multi-turn loop with tool calling (max 10 rounds, 5 tool-only rounds)
- **MULTI**: Multi-agent delegation with SynthesisEngine merging

---

## Startup Sequence

```
useWorkspaceRuntime.initialize()
  Step 0: Loading workspace runtime
  Step 1: Resolve providers → hydrateProviderRuntimeMetadata()
  Step 2: Resolve roles → runtime-role-registry
  Step 3: Wire agents → deriveGraph() → computeGraphWithLogging()
  Step 4: Initialize orchestrator
  Step 5: Runtime ready → subscribe to app-store config changes
  Step 6: scheduleSyncWiredRoles() → agentStore.setWiredRoles()
```
