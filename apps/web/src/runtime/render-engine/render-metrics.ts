import { RenderScheduler } from "./render-scheduler"
import { StreamBuffer } from "./stream-buffer"

export interface MetricsSnapshot {
  tokensPerSecond: number
  totalTokens: number
  totalFlushes: number
  maxTokensPerFlush: number
  activeBuffers: number
  schedulerQueueDepth: number
  framesDropped: number
  totalSchedulerTasks: number
  activeStepCards: number
  renderFps: number
  lastUpdated: number
}

export class RenderMetrics {
  private static instance: RenderMetrics
  private frameCount = 0
  private lastFpsSample = 0
  private currentFps = 0
  private metricsListeners = new Set<(snapshot: MetricsSnapshot) => void>()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private getActiveStepCardsFn: (() => number) | null = null

  static getInstance(): RenderMetrics {
    if (!RenderMetrics.instance) {
      RenderMetrics.instance = new RenderMetrics()
    }
    return RenderMetrics.instance
  }

  private constructor() {}

  setActiveStepCardsProvider(fn: () => number): void {
    this.getActiveStepCardsFn = fn
  }

  start(): void {
    if (this.intervalId !== null) return

    const trackFps = () => {
      this.frameCount++
      this.trackFpsId = requestAnimationFrame(trackFps)
    }
    this.trackFpsId = requestAnimationFrame(trackFps)

    this.intervalId = setInterval(() => {
      const now = performance.now()
      const elapsed = now - this.lastFpsSample
      this.currentFps = elapsed > 0 ? Math.round((this.frameCount / elapsed) * 1000) : 0
      this.frameCount = 0
      this.lastFpsSample = now

      this.emitMetrics()
    }, 1000)
  }

  private trackFpsId: number | null = null

  private emitMetrics(): void {
    try {
      const streamMetrics = StreamBuffer.getInstance().getMetrics()
      const schedulerMetrics = RenderScheduler.getInstance().getMetrics()

      const snapshot: MetricsSnapshot = {
        tokensPerSecond: streamMetrics.tokensPerSecond,
        totalTokens: streamMetrics.totalTokens,
        totalFlushes: streamMetrics.totalFlushes,
        maxTokensPerFlush: streamMetrics.maxTokensPerFlush,
        activeBuffers: streamMetrics.activeBuffers,
        schedulerQueueDepth: schedulerMetrics.queueDepth,
        framesDropped: schedulerMetrics.framesDropped,
        totalSchedulerTasks: schedulerMetrics.totalTasks,
        activeStepCards: this.getActiveStepCardsFn?.() ?? 0,
        renderFps: this.currentFps,
        lastUpdated: Date.now(),
      }

      for (const listener of this.metricsListeners) {
        try {
          listener(snapshot)
        } catch { /* ignore listener error */ }
      }
    } catch { /* ignore metrics error */ }
  }

  onMetrics(callback: (snapshot: MetricsSnapshot) => void): () => void {
    this.metricsListeners.add(callback)
    return () => this.metricsListeners.delete(callback)
  }

  stop(): void {
    if (this.trackFpsId !== null) {
      cancelAnimationFrame(this.trackFpsId)
      this.trackFpsId = null
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.metricsListeners.clear()
  }
}
