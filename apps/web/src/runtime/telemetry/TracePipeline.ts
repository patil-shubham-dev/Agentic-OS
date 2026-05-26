import {
  type TraceableEvent,
  type TraceEventHandler,
  type TraceMiddleware,
  type TraceFilter,
  type EventPriority,
  generateTraceId,
  generateSpanId,
} from "./TraceTypes"

const MAX_QUEUE_SIZE = 10_000
const DRAIN_THRESHOLD = 8_000
const LOG_PREFIX = "[TracePipeline]"

export class TracePipeline {
  private static instance: TracePipeline
  private middlewares: TraceMiddleware[] = []
  private handlers = new Map<string, Set<TraceEventHandler>>()
  private globalHandlers = new Set<TraceEventHandler>()

  // Backpressure queue
  private queue: TraceableEvent[] = []
  private draining = false
  private dropped = 0

  // Metrics
  private totalProcessed = 0
  private totalDropped = 0
  private peakQueueSize = 0
  private processingTimeMs = 0
  private processingCount = 0

  // Injection
  private defaultTraceId = ""
  private defaultSpanId = ""

  private constructor() {
    this.defaultTraceId = generateTraceId()
    this.defaultSpanId = generateSpanId()
  }

  static getInstance(): TracePipeline {
    if (!TracePipeline.instance) {
      TracePipeline.instance = new TracePipeline()
    }
    return TracePipeline.instance
  }

  // ── Middleware ──

  use(middleware: TraceMiddleware): () => void {
    this.middlewares.push(middleware)
    return () => {
      const idx = this.middlewares.indexOf(middleware)
      if (idx !== -1) this.middlewares.splice(idx, 1)
    }
  }

  // ── Event Subscription ──

  on(type: string, handler: TraceEventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => {
      this.handlers.get(type)?.delete(handler)
      if (this.handlers.get(type)?.size === 0) {
        this.handlers.delete(type)
      }
    }
  }

  onAny(handler: TraceEventHandler): () => void {
    this.globalHandlers.add(handler)
    return () => this.globalHandlers.delete(handler)
  }

  off(type: string, handler: TraceEventHandler): void {
    this.handlers.get(type)?.delete(handler)
    if (this.handlers.get(type)?.size === 0) {
      this.handlers.delete(type)
    }
  }

  // ── Event Emission ──

  emit(event: TraceableEvent): boolean {
    const t0 = performance.now()

    // Backpressure: drop if queue is full
    if (this.queue.length >= MAX_QUEUE_SIZE && event.priority !== "critical") {
      this.totalDropped++
      this.dropped++
      if (this.dropped % 100 === 0) {
        console.warn(`${LOG_PREFIX} Dropped ${this.dropped} events (queue full)`)
      }
      return false
    }

    // Auto-inject trace context if missing
    const enriched = this.injectTraceContext(event)

    // Run middleware pipeline
    let processed = this.runPreMiddleware(enriched)
    if (processed === null) {
      return false // Middleware dropped the event
    }

    // Enqueue
    this.queue.push(processed)
    if (this.queue.length > this.peakQueueSize) {
      this.peakQueueSize = this.queue.length
    }

    this.totalProcessed++
    this.processingTimeMs += performance.now() - t0
    this.processingCount++

    // Schedule drain if not already draining
    if (!this.draining) {
      this.draining = true
      queueMicrotask(() => this.drain())
    }

    return true
  }

  // ── Batch Emission ──

  emitBatch(events: TraceableEvent[]): number {
    let emitted = 0
    for (const event of events) {
      if (this.emit(event)) emitted++
    }
    return emitted
  }

  // ── Drain ──

  private drain(): void {
    const batch = this.queue.slice(0, DRAIN_THRESHOLD)
    this.queue = this.queue.slice(DRAIN_THRESHOLD)

    for (const event of batch) {
      try {
        // Notify type-specific handlers
        const typeHandlers = this.handlers.get(event.type)
        if (typeHandlers) {
          for (const handler of typeHandlers) {
            handler(event)
          }
        }

        // Notify global handlers
        for (const handler of this.globalHandlers) {
          handler(event)
        }

        // Run post-middleware
        this.runPostMiddleware(event)
      } catch (err) {
        console.error(`${LOG_PREFIX} Handler error for "${event.type}":`, err)
        this.runPostMiddleware(event, err instanceof Error ? err : new Error(String(err)))
      }
    }

    if (this.queue.length > 0) {
      queueMicrotask(() => this.drain())
    } else {
      this.draining = false
    }
  }

  // ── Middleware Pipeline ──

  private runPreMiddleware(event: TraceableEvent): TraceableEvent | null {
    let current = event
    for (const mw of this.middlewares) {
      if (mw.pre) {
        const result = mw.pre(current)
        if (result === null) return null // Drop
        current = result
      }
    }
    return current
  }

  private runPostMiddleware(event: TraceableEvent, error?: Error): void {
    for (const mw of this.middlewares) {
      try {
        mw.post?.(event, error)
      } catch (e) {
        console.error(`${LOG_PREFIX} Middleware "${mw.name}" post-hook error:`, e)
      }
    }
  }

  // ── Trace Context Injection ──

  private injectTraceContext(event: TraceableEvent): TraceableEvent {
    return {
      ...event,
      traceId: event.traceId || this.defaultTraceId,
      spanId: event.spanId || generateSpanId(),
      parentSpanId: event.parentSpanId ?? null,
      timestamp: event.timestamp || performance.now(),
      priority: event.priority || "normal",
    }
  }

  // ── Replay ──

  replay(events: TraceableEvent[]): void {
    for (const event of events) {
      // Bypass queue, middleware, and backpressure for replay
      const typeHandlers = this.handlers.get(event.type)
      if (typeHandlers) {
        for (const handler of typeHandlers) {
          try {
            handler(event)
          } catch (err) {
            console.error(`${LOG_PREFIX} Replay handler error for "${event.type}":`, err)
          }
        }
      }
      for (const handler of this.globalHandlers) {
        try {
          handler(event)
        } catch (err) {
          console.error(`${LOG_PREFIX} Replay global handler error:`, err)
        }
      }
    }
  }

  // ── State ──

  flush(): void {
    if (this.draining) return
    this.draining = true
    this.drain()
  }

  clear(): void {
    this.queue = []
    this.dropped = 0
    this.handlers.clear()
    this.globalHandlers.clear()
    this.middlewares = []
  }

  getQueueLength(): number {
    return this.queue.length
  }

  getMetrics(): TracePipelineMetrics {
    return {
      totalProcessed: this.totalProcessed,
      totalDropped: this.totalDropped,
      peakQueueSize: this.peakQueueSize,
      avgProcessingTimeMs: this.processingCount > 0
        ? this.processingTimeMs / this.processingCount
        : 0,
      queueLength: this.queue.length,
      handlerCount: this.getTotalHandlerCount(),
    }
  }

  private getTotalHandlerCount(): number {
    let count = this.globalHandlers.size
    for (const handlers of this.handlers.values()) {
      count += handlers.size
    }
    return count
  }

  setDefaultTraceContext(traceId: string, spanId: string): void {
    this.defaultTraceId = traceId
    this.defaultSpanId = spanId
  }
}

export interface TracePipelineMetrics {
  totalProcessed: number
  totalDropped: number
  peakQueueSize: number
  avgProcessingTimeMs: number
  queueLength: number
  handlerCount: number
}
