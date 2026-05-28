export type TaskType = 'local_bash' | 'local_agent' | 'remote_agent' | 'in_process' | 'workflow' | 'monitor'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'

export type TaskState = {
  id: string
  type: TaskType
  status: TaskStatus
  description: string
  priority: TaskPriority
  parentTaskId?: string
  agentId?: string
  toolUseId?: string
  startTime: number
  endTime?: number
  error?: string
  progress: number
  metadata?: Record<string, unknown>
  result?: unknown
}

export type TaskHandle = {
  taskId: string
  type: TaskType
  abort(): void
  onComplete(cb: (result: TaskState) => void): void
  onError(cb: (error: string) => void): void
}

export type TaskDefinition = {
  name: string
  type: TaskType
  execute(state: TaskState, ctx: TaskExecutionContext): Promise<unknown>
  cancel(state: TaskState): Promise<void>
  canRunConcurrently?: boolean
}

export type TaskExecutionContext = {
  signal: AbortSignal
  setProgress: (progress: number) => void
  setMetadata: (meta: Record<string, unknown>) => void
  appendLog: (msg: string) => void
}
