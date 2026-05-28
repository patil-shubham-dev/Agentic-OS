import { EventBus as RuntimeEventBus } from "../EventBus"

export type RuntimeEventType =
  | "TOKEN_STREAM"
  | "TOOL_START"
  | "TOOL_COMPLETE"
  | "FILE_EDIT"
  | "MODEL_DETECTED"
  | "EXECUTION_STATE_CHANGE"
  | "STEP_CARD_UPDATE"
  | "STREAM_READY"
  | "EXECUTION_COMPLETE"
  | "EXECUTION_ERROR"
  | "DIFF_GENERATED"
  | "ROUTING_DECISION"
  | "AGENT_ASSIGNED"
  | "COMMAND_START"
  | "COMMAND_OUTPUT"
  | "COMMAND_COMPLETE"
  | "BROWSER_ACTION"
  | "AGENT_COMPLETE"
  | "EXECUTION_SUMMARY"
  | "USER_MESSAGE"
  | "SUB_AGENT_START"
  | "SUB_AGENT_COMPLETE"

export interface TokenStreamEvent {
  type: "TOKEN_STREAM"
  stepId: string
  role: string
  token: string
}

export interface ToolStartEvent {
  type: "TOOL_START"
  stepId: string
  role: string
  toolId: string
  toolName: string
  args: string
}

export interface ToolCompleteEvent {
  type: "TOOL_COMPLETE"
  stepId: string
  role: string
  toolId: string
  result: string
  durationMs?: number
}

export interface FileEditEvent {
  type: "FILE_EDIT"
  stepId: string
  role: string
  path: string
  oldContent: string
  newContent: string
  additions: number
  deletions: number
}

export interface ModelDetectedEvent {
  type: "MODEL_DETECTED"
  stepId: string
  modelName: string
}

export interface ExecutionStateChangeEvent {
  type: "EXECUTION_STATE_CHANGE"
  state: string
  stepId?: string
}

export interface StepCardUpdateEvent {
  type: "STEP_CARD_UPDATE"
  stepId: string
  updates: Record<string, unknown>
}

export interface StreamReadyEvent {
  type: "STREAM_READY"
  stepId: string
  role: string
}

export interface ExecutionCompleteEvent {
  type: "EXECUTION_COMPLETE"
  stepId: string
  status: "complete" | "error"
}

export interface ExecutionErrorEvent {
  type: "EXECUTION_ERROR"
  stepId: string
  role: string
  message: string
  suggestion?: string
}

export interface DiffGeneratedEvent {
  type: "DIFF_GENERATED"
  stepId: string
  path: string
  diff: string
}

export interface RoutingDecisionEvent {
  type: "ROUTING_DECISION"
  reasoning: string
  selectedRoles: string[]
  context: string
  timestamp: number
}

export interface AgentAssignedEvent {
  type: "AGENT_ASSIGNED"
  roleId: string
  roleName: string
  modelName?: string
  providerName?: string
  timestamp: number
}

export interface CommandStartEvent {
  type: "COMMAND_START"
  stepId: string
  role: string
  command: string
  timestamp: number
}

export interface CommandOutputEvent {
  type: "COMMAND_OUTPUT"
  stepId: string
  output: string
}

export interface CommandCompleteEvent {
  type: "COMMAND_COMPLETE"
  stepId: string
  exitCode: number
  durationMs: number
}

export interface BrowserActionEvent {
  type: "BROWSER_ACTION"
  stepId: string
  role: string
  action: string
  url?: string
  screenshot?: string
  result?: string
  timestamp: number
}

export interface AgentCompleteEvent {
  type: "AGENT_COMPLETE"
  stepId: string
  role: string
  status: "complete" | "error"
}

export interface ExecutionSummaryEvent {
  type: "EXECUTION_SUMMARY"
  filesEdited: number
  commandsRun: number
  browserActions: number
  durationMs: number
  modelName?: string
  status: "complete" | "error"
}

export interface UserMessageEvent {
  type: "USER_MESSAGE"
  content: string
  timestamp: number
}

export interface SubAgentStartEvent {
  type: "SUB_AGENT_START"
  subAgentType: string
  taskPreview: string
  model: string
  timestamp: number
}

export interface SubAgentCompleteEvent {
  type: "SUB_AGENT_COMPLETE"
  subAgentType: string
  success: boolean
  durationMs: number
  toolCalls: number
  tokensUsed: number
  error?: string
  timestamp: number
}

export type RuntimeEvent =
  | TokenStreamEvent
  | ToolStartEvent
  | ToolCompleteEvent
  | FileEditEvent
  | ModelDetectedEvent
  | ExecutionStateChangeEvent
  | StepCardUpdateEvent
  | StreamReadyEvent
  | ExecutionCompleteEvent
  | ExecutionErrorEvent
  | DiffGeneratedEvent
  | RoutingDecisionEvent
  | AgentAssignedEvent
  | CommandStartEvent
  | CommandOutputEvent
  | CommandCompleteEvent
  | BrowserActionEvent
  | AgentCompleteEvent
  | ExecutionSummaryEvent
  | UserMessageEvent
  | SubAgentStartEvent
  | SubAgentCompleteEvent

export type EventHandler<T extends RuntimeEvent = RuntimeEvent> = (event: T) => void

// Phase 1 compatibility facade: render-engine callers now share the canonical
// runtime singleton instead of maintaining a second disconnected event bus.
export class EventBus {
  static getInstance(): EventBus {
    return RuntimeEventBus.getInstance() as unknown as EventBus
  }

  on<T extends RuntimeEvent>(type: T["type"], handler: EventHandler<T>): () => void {
    return (RuntimeEventBus.getInstance() as any).on(type, handler)
  }

  emit<T extends RuntimeEvent>(event: T): void {
    ;(RuntimeEventBus.getInstance() as any).emit(event)
  }

  off<T extends RuntimeEvent>(type: T["type"], handler: EventHandler<T>): void {
    ;(RuntimeEventBus.getInstance() as any).off(type, handler)
  }

  createBufferedSubscriber<T extends RuntimeEvent>(
    type: T["type"],
    handler: (events: T[]) => void,
    _flushInterval?: number,
  ): () => void {
    return (RuntimeEventBus.getInstance() as any).createBufferedSubscriber(type, handler)
  }

  flushAll(): void {
    ;(RuntimeEventBus.getInstance() as any).flushAll()
  }

  destroy(): void {
    ;(RuntimeEventBus.getInstance() as any).destroy()
  }

  clear(): void {
    ;(RuntimeEventBus.getInstance() as any).clear()
  }
}
