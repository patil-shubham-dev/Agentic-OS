import { TaskGraph } from '../tasks/TaskGraph'
import type { TaskRuntime } from '../tasks/TaskRuntime'
import type { TaskState } from '../tasks/Task'

export class SharedTaskGraph {
  private graph: TaskGraph
  private taskRuntime: TaskRuntime
  private globalState: Map<string, unknown> = new Map()

  constructor(taskRuntime: TaskRuntime) {
    this.graph = new TaskGraph()
    this.taskRuntime = taskRuntime
  }

  getGraph(): TaskGraph { return this.graph }

  setGlobalState(key: string, value: unknown): void {
    this.globalState.set(key, value)
  }

  getGlobalState(key: string): unknown {
    return this.globalState.get(key)
  }

  getAllGlobalState(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of this.globalState) {
      result[key] = value
    }
    return result
  }

  getTaskStates(): TaskState[] {
    return this.taskRuntime.getAll()
  }

  getCompletedTasks(): TaskState[] {
    return this.taskRuntime.getByStatus('completed')
  }

  getFailedTasks(): TaskState[] {
    return this.taskRuntime.getByStatus('failed')
  }

  summarize(): { totalTasks: number; completed: number; failed: number; running: number; dagLevels: number } {
    return {
      totalTasks: this.taskRuntime.getAll().length,
      completed: this.taskRuntime.getByStatus('completed').length,
      failed: this.taskRuntime.getByStatus('failed').length,
      running: this.taskRuntime.getRunning().length,
      dagLevels: this.graph.getExecutionOrder().length,
    }
  }

  clear(): void {
    this.graph.clear()
    this.globalState.clear()
  }
}
