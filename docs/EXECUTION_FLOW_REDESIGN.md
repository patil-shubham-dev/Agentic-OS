# EXECUTION FLOW REDESIGN

## Current Architecture

```
User Input
  → ChatPanel.sendMessage()
    → ExecutionSessionManager.start()
      → ExecutionOrchestrator.execute()
        → manager-routing-engine.route()
          → applyModeConstraints() → selectedRoles[]
        → for each role:
          → AGENT_ASSIGNED event (visible)
          → AgentExecutor.execute()
          → MESSAGE_COMPLETE event (visible per agent)
        → EXECUTION_COMPLETE
```

**Problem:** Every agent execution is visible as a separate response. Users see the internal delegation mesh.

## Target Architecture

```
User Input
  → ChatPanel.sendMessage()
    → ExecutionSessionManager.start()
      → ExecutionSessionManager.executeWithVisibility()
        → ExecutionOrchestrator.execute() (HIDDEN)
          → manager-routing-engine.route()
          → for each role (HIDDEN):
            → AgentExecutor.execute()
          → SynthesisEngine.merge() (mandatory)
        → ActivityMapper.convert(executionTrace) → Activity[]
        → yield EXECUTION_ACTIVITY events (not AGENT_ASSIGNED)
        → yield MESSAGE_COMPLETE (single, merged)
```

## Key Changes

### 1. Single Response Mandate

```typescript
// ExecutionSessionManager.ts — new flow
async executeWithVisibility(options: ExecuteOptions): Promise<void> {
  const id = generateId()
  this.activeExecutionId = id

  // Create single placeholder in timeline (no init session visible)
  timelineStore.addPlaceholder(id)

  const eventStream = this.orchestrator.execute(options, {
    // New mode: hide internal agents, produce activities
    visibility: "concealed",
  })

  const activityCollector: Activity[] = []

  for await (const event of eventStream) {
    switch (event.type) {
      case "EXECUTION_ACTIVITY":
        // Expose activity, not agent
        activityCollector.push(event.activity)
        timelineStore.updateActivity(id, event.activity)
        break

      case "TOKEN":
        // Stream via flush callback (unchanged)
        break

      case "MESSAGE_COMPLETE":
        // Single MESSAGE_COMPLETE — the only visible response
        timelineStore.commitResponse(id, event.content)
        break

      case "EXECUTION_ACTIVITY_COMPLETE":
        timelineStore.completeActivity(id, event.activityId)
        break
    }
  }
}
```

### 2. Activity Mapper

Maps internal agent execution to user-facing activities:

```typescript
// src/runtime/execution/ActivityMapper.ts

type ActivityType =
  | "understanding_request"
  | "planning"
  | "searching_files"
  | "reading_files"
  | "analyzing_code"
  | "writing_code"
  | "editing_files"
  | "running_commands"
  | "validating"
  | "finalizing"

interface Activity {
  id: string
  type: ActivityType
  label: string
  status: "pending" | "in_progress" | "completed" | "failed"
  startedAt: number
  completedAt?: number
}

function mapAgentToActivity(agentRole: string, phase: string, context?: string): Activity {
  // Manager planning → "Planning approach"
  // Coder searching → "Searching files"
  // Runtime command → "Running command"
  // QA validation → "Validating result"
  switch (agentRole) {
    case "manager":
      if (phase === "planning") return { type: "planning", label: "Planning approach", ... }
      if (phase === "delegating") return { type: "planning", label: "Coordinating tasks", ... }
    case "coder":
      if (phase === "searching") return { type: "searching_files", label: "Searching workspace", ... }
      if (phase === "reading") return { type: "reading_files", label: "Reading files", ... }
      if (phase === "writing") return { type: "writing_code", label: "Writing code", ... }
      if (phase === "editing") return { type: "editing_files", label: "Editing files", ... }
    case "runtime":
      return { type: "running_commands", label: "Running commands", ... }
    case "qa":
      return { type: "validating", label: "Validating changes", ... }
  }
}
```

### 3. ExecutionOrchestrator Changes

```typescript
// New yield types
interface ExecutionActivityEvent {
  type: "EXECUTION_ACTIVITY"
  executionId: string
  activity: Activity
  timestamp: number
}

// Modified execution loop
async *executeWithActivities(options: ExecuteOptions): AsyncGenerator<ExecutionEvent> {
  const executionId = generateId()
  const ctrl = new AbortController()

  // Yield activity instead of AGENT_ASSIGNED
  yield {
    type: "EXECUTION_ACTIVITY",
    executionId,
    activity: {
      type: "understanding_request",
      label: "Understanding request",
      status: "in_progress",
      startedAt: Date.now(),
    },
  }

  // ... routing happens internally ...
  const decision = this.assignAgentForTask(options.input, ...)

  // Map decision to activities
  const activities = ActivityMapper.mapDecision(decision)

  for (const activity of activities) {
    yield { type: "EXECUTION_ACTIVITY", executionId, activity: { ...activity, status: "in_progress" } }
  }

  // Execute agents (HIDDEN — no AGENT_ASSIGNED yielded)
  const results = await this.executeAgentsConcealed(decision.selectedRoles, options, ctrl)

  // Update activities as they complete
  for (const result of results) {
    yield {
      type: "EXECUTION_ACTIVITY_COMPLETE",
      executionId,
      activityId: result.activityId,
      status: result.success ? "completed" : "failed",
    }
  }

  // Merge results into single response (mandatory synthesis)
  const mergedContent = await SynthesisEngine.merge(results)

  yield {
    type: "MESSAGE_COMPLETE",
    executionId,
    stepId: executionId,
    content: mergedContent,
    finishReason: "stop",
  }
}
```

### 4. SynthesisEngine becomes mandatory

Currently SynthesisEngine is only called for multi-agent tasks. It becomes mandatory for ALL tasks:

```typescript
// New: SynthesisEngine.merge()
// Handles:
// 1. Single agent response → pass through (no-op)
// 2. Multi-agent response → merge into coherent answer
// 3. Remove agent markers, role labels, internal state
// 4. Produce clean, single-voice response
```

### 5. Activity → UI Pipeline

```
AgentExecutor phases (internal)
  → ActivityMapper.translate(agentRole, phase, context)
  → ActivityEvent
  → ActivityTimeline component
  → Render: icon + label + status
```

### 6. Removing Init Session

The placeholder init session (`EXECUTION_CREATED` → `addAgentSession(init)`) is removed. The timeline shows:
- User message
- Activity items
- Single response

No empty sessions, no orphaned placeholders.

## Activity Catalog

| Agent Phase | User-Facing Activity | Icon |
|-------------|---------------------|------|
| Manager: routing | Understanding request | `🤔` → `◌` |
| Manager: planning | Building execution plan | `📋` → `◌` |
| Coder: searching | Searching workspace | `🔍` → `◌` |
| Coder: reading | Reading files | `📄` → `◌` |
| Coder: analyzing | Analyzing code | `📊` → `◌` |
| Coder: writing | Writing code | `✏️` → `◌` |
| Coder: editing | Editing files | `📝` → `◌` |
| Runtime: command | Running commands | `💻` → `◌` |
| Runtime: build | Building project | `🔨` → `◌` |
| Runtime: install | Installing dependencies | `📦` → `◌` |
| QA: testing | Running tests | `🧪` → `◌` |
| QA: validating | Validating changes | `✅` → `◌` |
| Vision: analyzing | Analyzing screenshots | `👁️` → `◌` |
| Browser: browsing | Checking web resources | `🌐` → `◌` |
| Final: merging | Preparing response | `✨` → `◌` |
| Final: completed | Complete | `✓` |

## Simple Question Flow (Before vs After)

### Before
```
User: what is 2+2?
→ Manager (Thinking...)
→ Fast Inference: 4
→ QA: 4
```

### After
```
User: what is 2+2?
→ ◌ Understanding request  ✓
→ 4
```

## Code Generation Flow (Before vs After)

### Before
```
User: create a react hook
→ Manager (Planning...)
→ Coder (Writing...)
→ QA (Validating...)
→ [Code response]
```

### After
```
User: create a react hook
→ ◌ Understanding request  ✓
→ ◌ Planning approach      ✓
→ ◌ Writing code            ✓
→ ◌ Validating              ✓
→ ● Finalizing              ◌
→ [Clean code response with inline file]
```
