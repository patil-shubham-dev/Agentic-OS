export type RuntimeState =
  | "Idle"
  | "Planning"
  | "Retrieval"
  | "Executing"
  | "Verifying"
  | "Repairing"
  | "Completed"
  | "Halted"

export type ToolEventLifecycle =
  | "tool_requested"
  | "tool_started"
  | "tool_stream"
  | "tool_completed"
  | "tool_failed"

export type VerificationEventLifecycle =
  | "verification_started"
  | "verification_completed"

export type RepairEventLifecycle =
  | "repair_attempted"
  | "repair_failed"
  | "repair_resolved"

export type EventLifecycle =
  | ToolEventLifecycle
  | VerificationEventLifecycle
  | RepairEventLifecycle

export interface EventMetadata {
  timestamp: number
  stepIndex: number
  executionId: string
  agentId: string
  parentExecutionId: string | null
  source: "user" | "system" | "agent" | "tool"
  eventSequence: number
}

export type TimelineSortKey = [number, number, number, number]

export interface RuntimeEventBase {
  metadata: EventMetadata
}

export interface ToolRequestedEvent extends RuntimeEventBase {
  type: "tool_requested"
  toolName: string
  args: string
}

export interface ToolStartedEvent extends RuntimeEventBase {
  type: "tool_started"
  toolName: string
  toolId: string
}

export interface ToolStreamEvent extends RuntimeEventBase {
  type: "tool_stream"
  toolName: string
  toolId: string
  chunk: string
}

export interface ToolCompletedEvent extends RuntimeEventBase {
  type: "tool_completed"
  toolName: string
  toolId: string
  result: string
  durationMs: number
}

export interface ToolFailedEvent extends RuntimeEventBase {
  type: "tool_failed"
  toolName: string
  toolId: string
  error: string
  durationMs: number
}

export interface VerificationStartedEvent extends RuntimeEventBase {
  type: "verification_started"
  scope: "syntax" | "lsp" | "typecheck" | "test"
}

export interface VerificationCompletedEvent extends RuntimeEventBase {
  type: "verification_completed"
  scope: "syntax" | "lsp" | "typecheck" | "test"
  passed: boolean
  diagnostics: string[]
}

export interface RepairAttemptedEvent extends RuntimeEventBase {
  type: "repair_attempted"
  target: string
  attempt: number
}

export interface RepairFailedEvent extends RuntimeEventBase {
  type: "repair_failed"
  target: string
  error: string
}

export interface RepairResolvedEvent extends RuntimeEventBase {
  type: "repair_resolved"
  target: string
  repairsApplied: number
}

export interface StateTransitionEvent extends RuntimeEventBase {
  type: "state_transition"
  from: RuntimeState
  to: RuntimeState
}

export interface AgentMessageEvent extends RuntimeEventBase {
  type: "agent_message"
  content: string
  role: "user" | "assistant" | "system"
}

export interface StreamDeltaEvent extends RuntimeEventBase {
  type: "stream_delta"
  deltaText: string
  reasoningText: string | null
  finishReason: string | null
}

export interface ExecutionErrorEvent extends RuntimeEventBase {
  type: "execution_error"
  error: string
  recoverable: boolean
}

export interface ExecutionHaltedEvent extends RuntimeEventBase {
  type: "execution_halted"
  reason: string
  reflection: string | null
}

export type RuntimeEvent =
  | ToolRequestedEvent
  | ToolStartedEvent
  | ToolStreamEvent
  | ToolCompletedEvent
  | ToolFailedEvent
  | VerificationStartedEvent
  | VerificationCompletedEvent
  | RepairAttemptedEvent
  | RepairFailedEvent
  | RepairResolvedEvent
  | StateTransitionEvent
  | AgentMessageEvent
  | StreamDeltaEvent
  | ExecutionErrorEvent
  | ExecutionHaltedEvent

export interface ExecutionTrace {
  executionId: string
  agentId: string
  parentExecutionId: string | null
  state: RuntimeState
  startedAt: number
  completedAt: number | null
  events: RuntimeEvent[]
  errorCount: number
  toolCallCount: number
}

export type EventHandler<T extends RuntimeEvent = RuntimeEvent> = (event: T) => void

export const VALID_STATE_TRANSITIONS: Record<RuntimeState, RuntimeState[]> = {
  Idle: ["Planning"],
  Planning: ["Retrieval", "Executing", "Halted"],
  Retrieval: ["Executing", "Planning", "Halted"],
  Executing: ["Verifying", "Repairing", "Completed", "Halted"],
  Verifying: ["Completed", "Repairing", "Halted"],
  Repairing: ["Verifying", "Executing", "Halted", "Completed"],
  Completed: ["Idle"],
  Halted: ["Idle"],
}

export function isValidTransition(from: RuntimeState, to: RuntimeState): boolean {
  return VALID_STATE_TRANSITIONS[from]?.includes(to) ?? false
}

export function computeTimelineSortKey(event: RuntimeEvent): TimelineSortKey {
  const m = event.metadata
  return [m.timestamp, m.stepIndex, sourceOrder(m.source), m.eventSequence]
}

function sourceOrder(source: string): number {
  switch (source) {
    case "user": return 0
    case "system": return 1
    case "agent": return 2
    case "tool": return 3
    default: return 4
  }
}

export function compareTimelineEvents(a: RuntimeEvent, b: RuntimeEvent): number {
  const ka = computeTimelineSortKey(a)
  const kb = computeTimelineSortKey(b)
  for (let i = 0; i < 4; i++) {
    if (ka[i] !== kb[i]) return ka[i] - kb[i]
  }
  return 0
}
