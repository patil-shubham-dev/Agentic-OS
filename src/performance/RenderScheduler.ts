export interface ScheduledWork {
  id: string
  priority: "high" | "normal" | "low"
  execute: () => void
  estimatedDurationMs: number
}

const FRAME_BUDGET_MS = 10
const IDLE_BUDGET_MS = 5

export class RenderScheduler {
  private queue: ScheduledWork[] = []
  private rafId: number | null = null
  private idleCallbackId: number | null = null
  private isRunning = false
  private lastFrameTime = 0
  private frameCount = 0
  private droppedFrames = 0

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.lastFrameTime = performance.now()
    this.scheduleFrame()
  }

  stop(): void {
    this.isRunning = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.idleCallbackId !== null) {
      cancelIdleCallback(this.idleCallbackId)
      this.idleCallbackId = null
    }
  }

  enqueue(work: ScheduledWork): void {
    this.queue.push(work)
    this.queue.sort((a, b) => {
      const order = { high: 0, normal: 1, low: 2 }
      return order[a.priority] - order[b.priority]
    })
  }

  dequeue(id: string): void {
    this.queue = this.queue.filter((w) => w.id !== id)
  }

  getMetrics(): { fps: number; droppedFrames: number; queueSize: number } {
    return {
      fps: this.frameCount > 0 ? Math.round(this.frameCount / ((performance.now() - this.lastFrameTime) / 1000)) : 0,
      droppedFrames: this.droppedFrames,
      queueSize: this.queue.length,
    }
  }

  private scheduleFrame(): void {
    if (!this.isRunning) return
    this.rafId = requestAnimationFrame((timestamp) => {
      this.processFrame(timestamp)
      this.scheduleFrame()
    })
  }

  private processFrame(timestamp: number): void {
    const elapsed = timestamp - this.lastFrameTime
    if (elapsed > 16.67 * 1.5) {
      this.droppedFrames++
    }
    this.lastFrameTime = timestamp
    this.frameCount++

    const frameStart = performance.now()
    let budgetRemaining = FRAME_BUDGET_MS

    while (this.queue.length > 0 && budgetRemaining > 0) {
      const work = this.queue[0]
      if (work.estimatedDurationMs > budgetRemaining) {
        if (work.priority === "high") {
          this.queue.shift()
          try { work.execute() } catch { /* ignore scheduler work error */ }
          budgetRemaining -= work.estimatedDurationMs
        }
        break
      }

      this.queue.shift()
      const workStart = performance.now()
      try { work.execute() } catch { /* ignore scheduler work error */ }
      const workDuration = performance.now() - workStart
      budgetRemaining -= workDuration
    }

    const frameDuration = performance.now() - frameStart
    if (frameDuration < FRAME_BUDGET_MS && this.queue.length > 0) {
      this.scheduleIdle(frameDuration)
    }
  }

  private scheduleIdle(usedMs: number): void {
    if (typeof requestIdleCallback !== "undefined") {
      this.idleCallbackId = requestIdleCallback((deadline) => {
        let budget = Math.min(deadline.timeRemaining(), IDLE_BUDGET_MS)
        while (this.queue.length > 0 && budget > 0) {
          const work = this.queue[0]
          if (work.estimatedDurationMs > budget) break
          this.queue.shift()
          const ws = performance.now()
          try { work.execute() } catch { /* ignore idle work error */ }
          budget -= performance.now() - ws
        }
        this.idleCallbackId = null
      })
    }
  }

  clear(): void {
    this.queue = []
  }
}
