import type { TaskType, TaskState, TaskPriority } from './Task'

const TASK_ID_PREFIXES: Record<string, string> = {
  local_bash: 'b',
  local_agent: 'a',
  remote_agent: 'r',
  in_process: 't',
  workflow: 'w',
  monitor: 'm',
}

function getTaskIdPrefix(type: TaskType): string {
  return TASK_ID_PREFIXES[type] ?? 'x'
}

export function generateTaskId(type: TaskType): string {
  const prefix = getTaskIdPrefix(type)
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}${random}`
}

export function createTaskState(
  id: string,
  type: TaskType,
  description: string,
  options?: {
    priority?: TaskPriority
    parentTaskId?: string
    agentId?: string
    toolUseId?: string
  },
): TaskState {
  return {
    id,
    type,
    status: 'pending',
    description,
    priority: options?.priority ?? 'normal',
    parentTaskId: options?.parentTaskId,
    agentId: options?.agentId,
    toolUseId: options?.toolUseId,
    startTime: Date.now(),
    progress: 0,
  }
}
