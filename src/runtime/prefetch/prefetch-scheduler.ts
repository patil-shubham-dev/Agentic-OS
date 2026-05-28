type Priority = "low" | "medium" | "high"

interface PrefetchTask {
  id: string
  priority: Priority
  execute: () => Promise<void>
  label: string
}

export class PrefetchScheduler {
  private pending: PrefetchTask[] = []
  private inFlight = new Set<string>()
  private running = false
  private maxConcurrent = 2
  private idleCallbackId: number | null = null

  private static instance: PrefetchScheduler

  static getInstance(): PrefetchScheduler {
    if (!PrefetchScheduler.instance) {
      PrefetchScheduler.instance = new PrefetchScheduler()
    }
    return PrefetchScheduler.instance
  }

  enqueue(task: PrefetchTask): void {
    this.pending.push(task)
    this.pending.sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 }
      return rank[a.priority] - rank[b.priority]
    })
    this.schedule()
  }

  private schedule(): void {
    if (this.running) return
    this.running = true

    const useIdle = typeof requestIdleCallback !== "undefined"
    if (useIdle) {
      this.idleCallbackId = requestIdleCallback((deadline) => {
        this.processBatch(deadline.timeRemaining())
        this.running = false
        if (this.pending.length > 0) this.schedule()
      }, { timeout: 2000 })
    } else {
      setTimeout(() => {
        this.processBatch(10)
        this.running = false
        if (this.pending.length > 0) this.schedule()
      }, 50)
    }
  }

  private processBatch(timeBudgetMs: number): void {
    const start = performance.now()

    while (this.pending.length > 0 && this.inFlight.size < this.maxConcurrent) {
      const task = this.pending.shift()!
      if (this.inFlight.has(task.id)) continue

      this.inFlight.add(task.id)
      task.execute().finally(() => {
        this.inFlight.delete(task.id)
      })

      if (performance.now() - start > timeBudgetMs) break
    }
  }

  cancel(id?: string): void {
    if (id) {
      this.pending = this.pending.filter((t) => t.id !== id)
    } else {
      this.pending = []
      if (this.idleCallbackId !== null) {
        cancelIdleCallback(this.idleCallbackId)
        this.idleCallbackId = null
      }
      this.running = false
    }
  }

  get pendingCount(): number {
    return this.pending.length
  }
}
