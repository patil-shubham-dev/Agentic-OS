import type { TaskRuntime } from './TaskRuntime'
import type { TaskState } from './Task'

export type CancellationScope = {
  taskId: string
  cascade: boolean
  reason?: string
}

export class TaskCancellation {
  private runtime: TaskRuntime

  constructor(runtime: TaskRuntime) {
    this.runtime = runtime
  }

  cancelTask(taskId: string, reason?: string): boolean {
    return this.runtime.cancel(taskId)
  }

  cancelByParent(parentTaskId: string, reason?: string): string[] {
    const children = this.runtime.getByParent(parentTaskId)
    const cancelled: string[] = []
    for (const child of children) {
      if (this.runtime.cancel(child.id)) {
        cancelled.push(child.id)
      }
    }
    return cancelled
  }

  cancelByType(type: string, reason?: string): string[] {
    const all = this.runtime.getAll()
    const cancelled: string[] = []
    for (const task of all) {
      if (task.type === type && (task.status === 'running' || task.status === 'pending')) {
        if (this.runtime.cancel(task.id)) {
          cancelled.push(task.id)
        }
      }
    }
    return cancelled
  }

  cancelAll(reason?: string): string[] {
    const running = this.runtime.getRunning()
    const pending = this.runtime.getPending()
    const cancelled: string[] = []

    for (const task of [...running, ...pending]) {
      if (this.runtime.cancel(task.id)) {
        cancelled.push(task.id)
      }
    }

    return cancelled
  }

  cancelScoped(scope: CancellationScope): string[] {
    const cancelled = [scope.taskId]
    this.runtime.cancel(scope.taskId)

    if (scope.cascade) {
      const children = this.cancelByParent(scope.taskId, scope.reason)
      cancelled.push(...children)
    }

    return cancelled
  }
}
