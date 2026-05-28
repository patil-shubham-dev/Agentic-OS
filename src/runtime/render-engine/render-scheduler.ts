export type RenderPriority = "high" | "medium" | "low"

export interface SchedulerTask {
  id: string
  fn: () => void
  priority: RenderPriority
  timestamp: number
}

export class RenderScheduler {
  private queue: SchedulerTask[] = []
  private frameId: number | null = null
  private isFlushing = false
  private metrics = {
    framesDropped: 0,
    lastFrameAt: 0,
    tasksPerFrame: 0,
    totalTasks: 0,
  }

  private static instance: RenderScheduler

  static getInstance(): RenderScheduler {
    if (!RenderScheduler.instance) {
      RenderScheduler.instance = new RenderScheduler()
    }
    return RenderScheduler.instance
  }

  schedule(id: string, fn: () => void, priority: RenderPriority = "medium"): void {
    this.queue.push({ id, fn, priority, timestamp: performance.now() })
    this.queue.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.priority] - order[b.priority]
    })
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.frameId !== null || this.isFlushing) return
    this.frameId = requestAnimationFrame(() => this.flush())
  }

  private flush(): void {
    this.frameId = null
    this.isFlushing = true

    const now = performance.now()
    if (now - this.metrics.lastFrameAt > 50) {
      this.metrics.framesDropped++
    }
    this.metrics.lastFrameAt = now

    const batch = this.queue.splice(0, Math.min(this.queue.length, 8))
    this.metrics.tasksPerFrame = batch.length
    this.metrics.totalTasks += batch.length

    for (const task of batch) {
      try {
        task.fn()
      } catch (e) {
        console.error(`[RenderScheduler] task "${task.id}" failed:`, e)
      }
    }

    this.isFlushing = false

    if (this.queue.length > 0) {
      this.scheduleFlush()
    }
  }

  cancel(id: string): void {
    this.queue = this.queue.filter((t) => t.id !== id)
  }

  cancelAll(): void {
    this.queue = []
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }

  getMetrics() {
    return { ...this.metrics, queueDepth: this.queue.length }
  }
}
