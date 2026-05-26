export type AgentKind = "coordinator" | "researcher" | "coder" | "verifier"

export type AgentStatus = "idle" | "busy" | "awaiting_input" | "completed" | "failed"

export type TaskPriority = "low" | "normal" | "high" | "critical"

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "blocked"

export interface AgentCapability {
  name: string
  description: string
  tools: string[]
}

export interface AgentTask {
  id: string
  parentId: string | null
  agentKind: AgentKind
  description: string
  context: string
  status: TaskStatus
  priority: TaskPriority
  dependencies: string[]
  result: string | null
  error: string | null
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  executionId: string | null
  metadata: Record<string, unknown>
}

export interface AgentSpec {
  kind: AgentKind
  name: string
  description: string
  capabilities: AgentCapability[]
  modelPreference: string | null
  maxRetries: number
  timeoutMs: number
}

export interface AgentAssignment {
  taskId: string
  agentKind: AgentKind
  status: AgentStatus
  startedAt: number | null
  completedAt: number | null
}

export interface AgentMessage {
  id: string
  from: AgentKind
  to: AgentKind
  type: "task_assignment" | "task_result" | "status_update" | "request_clarification" | "error_report"
  payload: unknown
  timestamp: number
}

export interface ExecutionReflection {
  executionId: string
  taskId: string
  agentKind: AgentKind
  outcome: "success" | "failure" | "partial"
  summary: string
  lessons: string[]
  suggestions: string[]
  metrics: {
    durationMs: number
    toolCalls: number
    errors: number
    retries: number
  }
}

export interface WorktreeEntry {
  id: string
  agentKind: AgentKind
  taskId: string
  basePath: string
  files: Map<string, string>
  createdAt: number
  lastAccessed: number
}
