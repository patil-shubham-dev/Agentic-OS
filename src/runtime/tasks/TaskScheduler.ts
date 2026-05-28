import { TaskRuntime } from './TaskRuntime'
import type { TaskType, TaskState, TaskPriority } from './Task'

export type ScheduledTask = {
  id: string
  type: TaskType
  description: string
  cronExpression?: string
  intervalMs?: number
  priority: TaskPriority
  nextRunAt: number
  lastRunAt?: number
  repeatCount: number
  maxRepeats?: number
}

export class TaskScheduler {
  private runtime: TaskRuntime
  private scheduled: Map<string, ScheduledTask> = new Map()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(runtime: TaskRuntime) {
    this.runtime = runtime
  }

  schedule(task: Omit<ScheduledTask, 'id' | 'nextRunAt' | 'repeatCount'> & { id?: string }): string {
    const id = task.id ?? `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.scheduled.set(id, {
      ...task,
      id,
      nextRunAt: Date.now() + (task.intervalMs ?? 60_000),
      repeatCount: 0,
    })
    return id
  }

  unschedule(id: string): boolean {
    return this.scheduled.delete(id)
  }

  start(intervalMs: number = 1_000): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async tick(): Promise<void> {
    const now = Date.now()

    for (const [, scheduled] of this.scheduled) {
      if (now < scheduled.nextRunAt) continue
      if (scheduled.maxRepeats !== undefined && scheduled.repeatCount >= scheduled.maxRepeats) {
        this.scheduled.delete(scheduled.id)
        continue
      }

      scheduled.lastRunAt = now
      scheduled.repeatCount++
      scheduled.nextRunAt = now + (scheduled.intervalMs ?? 60_000)

      this.runtime.start(scheduled.type, scheduled.description, {
        priority: scheduled.priority,
      }).catch(() => {})
    }
  }

  getAll(): ScheduledTask[] {
    return [...this.scheduled.values()]
  }

  clear(): void {
    this.scheduled.clear()
  }
}
