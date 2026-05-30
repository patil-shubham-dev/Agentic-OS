# Context System

## Overview

The context system manages conversation history, token budgets, system prompt assembly, and context compaction. It ensures the AI agent has the right information within token limits.

---

## Context Sources

1. **Conversation history** — Per-role message arrays from `agent-store`
2. **Workspace state** — Active file, cursor, file tree from `workspace-store`
3. **Project memory** — `.agentic-rules`, memory files from filesystem
4. **System prompts** — Dynamic composition via `PromptCompositionEngine`

---

## History Retrieval

```
ExecutionOrchestrator.getProcessedHistory(activeRole)
  │
  ├─ Reads conversations[activeRole].messages from agent-store
  ├─ Filters out system messages
  │
  ├─ If messages > MAX_CONTEXT_MESSAGES (100):
  │   ├─ summarizeMessages() → CompressedContext
  │   │   Keeps last 6 messages as raw
  │   │   Summarizes older messages by role
  │   │   Respects MAX_HISTORY_TOKENS (32000)
  │   ├─ getMemoryPressure() → percentage
  │   ├─ workspaceRuntime.setMemoryPressure() / setTokenUsage()
  │   └─ compressConversationHistory() → compressed array
  │
  └─ Returns filtered history array
```

---

## Context Building (FULL Mode)

```
AgentExecutor.executeFull()
  │
  ├─ memoryLoader.load(rootPath) → project memory
  ├─ getWorkspaceContextSnapshot() → workspace state
  ├─ ContextManager.assembleSystemPrompt(assemblyInput)
  │     ├─ CapabilityResolver.resolveFromModel()
  │     ├─ PromptRegistry.plan(resolutionContext)
  │     └─ PromptCompositionEngine.compose() → 7 phases
  │
  ├─ ContextManager.buildContext(input, role) → additional context
  │
  └─ Final messages: [systemPrompt, contextBlock, history..., userMessage]
```

---

## Prompt Composition Engine

`PromptCompositionEngine.compose()` proceeds through 7 phases:

1. **Plan** — Execute sections via `PromptRegistry`
2. **Deduplicate** — Remove duplicate sections
3. **Build AST** — Structured prompt tree
4. **Compress** — `SemanticDeduplicator` removes redundancy
5. **Budget enforce** — Trim to token budget
6. **Build trace** — Record composition decisions
7. **Render** — AST → text

---

## Prompt Sections (24 defined)

All in `src/runtime/promoting/sections/`:

| Section | Purpose |
|---------|---------|
| `agent-identity` | Agent role definition |
| `autonomous-behavior` | Autonomous operation rules |
| `behavior-constraints` | Behavioral boundaries |
| `collaboration` | Multi-agent coordination |
| `context-management` | Context handling rules |
| `environment-info` | Environment details |
| `execution-mission` | Mission objective |
| `execution-mode` | Current mode behavior |
| `execution-policy` | Execution rules |
| `execution-process` | Process steps |
| `memory-policy` | Memory management |
| `output-style` | Response format |
| `project-rules` | Project-specific rules |
| `routing-instructions` | Routing guidance |
| `safety-policy` | Safety rules |
| `session-memory` | Session state |
| `streaming-behavior` | Streaming behavior |
| `tools-execution-policy` | Tool usage rules |
| `tools-registry` | Available tools |
| `verification` | Verification rules |
| `workspace-context` | Workspace state |

---

## Token Budget Management

```typescript
interface TokenUsage {
  input: number
  output: number
  total: number
}

interface BudgetState {
  allocated: number
  used: number
  remaining: number
  threshold: number
}
```

- `TokenBudgetTracker` — Per-model budget tracking
- `TokenEstimator` — Rough token estimation (4 chars ≈ 1 token)
- `Compactor` — Automatic message compaction on threshold overflow
- `ContextWindowResolver` — Model-specific context window resolution

---

## During-Execution Context

```
Per Round:
  │
  ├─ Assistant response appended to msgs array
  ├─ Tool messages appended to msgs array
  │
  ├─ If total tokens > threshold:
  │   └─ ContextManager.updateBudget()
  │     └─ Compactor.compress(msgs) → truncated array
  │
  └─ Limits enforced:
      ├─ Max rounds: 10
      ├─ Max tool-only rounds: 5
      └─ Timeout: 120s (60s soft deadline)
```

---

## Memory Management

```typescript
interface MemoryPressure {
  level: number  // 0-100
  status: "ok" | "elevated" | "critical"
}

// In workspace-runtime:
memoryPressure: number  // 0-100
tokenUsage: TokenUsage
```

- `getMemoryPressure(compressed)` → percentage based on token usage vs limits
- `setMemoryPressure()` / `setTokenUsage()` update the workspace runtime store
- UI shows warning when pressure > 75%, critical at > 90%
- Automatic compression when history exceeds `MAX_CONTEXT_MESSAGES` (100)

---

## System Prompt Assembly

```
assemblyInput = {
  role: RuntimeRole
  mode: ExecutionMode
  provider: ProviderInfo
  model: ModelInfo
  capabilities: ModelCapabilities
  workspace: WorkspaceInfo
  environment: EnvironmentInfo
}
  │
  ▼
ContextManager.assembleSystemPrompt(assemblyInput)
  ├─ CapabilityResolver.resolveFromModel(model) → capabilities
  ├─ PromptRegistry.plan(resolutionContext) → section list
  ├─ PromptCompositionEngine.compose(sections) → final prompt
  └─ Returns string
```
