import {
  type Span,
  type SpanKind,
  type SpanStatus,
  type SpanContext,
  generateSpanId,
  generateTraceId,
  SpanBuilder,
} from "./TraceTypes"
import { TracePipeline } from "./TracePipeline"
import { TraceStore } from "./TraceStore"

const LOG_PREFIX = "[SpanProcessor]"

export class SpanProcessor {
  private static instance: SpanProcessor
  private pipeline: TracePipeline
  private store: TraceStore
  private activeSpanStack = new Map<string, Span[]>() // traceId -> stack

  private constructor() {
    this.pipeline = TracePipeline.getInstance()
    this.store = TraceStore.getInstance()
  }

  static getInstance(): SpanProcessor {
    if (!SpanProcessor.instance) {
      SpanProcessor.instance = new SpanProcessor()
    }
    return SpanProcessor.instance
  }

  // ── Span Creation ──

  startSpan(
    name: string,
    options?: {
      kind?: SpanKind
      traceId?: string
      parentSpanId?: string | null
      attributes?: Record<string, unknown>
      resource?: Record<string, string>
    },
  ): Span {
    const traceId = options?.traceId ?? generateTraceId()
    const parentSpanId = options?.parentSpanId ?? this.getCurrentSpanId(traceId)
    const spanId = generateSpanId()

    const builder = new SpanBuilder(name, options?.kind ?? "internal")
      .withTraceId(traceId)
      .withSpanId(spanId)
      .withParentSpanId(parentSpanId ?? null)

    if (options?.attributes) {
      builder.withAttributes(options.attributes)
    }
    if (options?.resource) {
      builder.withResource(options.resource)
    }

    const span = builder.build()

    // Push to active stack
    const stack = this.activeSpanStack.get(traceId) ?? []
    stack.push(span)
    this.activeSpanStack.set(traceId, stack)

    // Store
    this.store.addSpan(span)

    // Emit span start event
    this.pipeline.emit({
      type: "span_start",
      traceId,
      spanId,
      parentSpanId: parentSpanId ?? null,
      timestamp: span.startTime,
      priority: "normal",
      runtimePhase: name,
      source: "span-processor",
      payload: { span },
      metadata: {},
    })

    return span
  }

  // ── Span Completion ──

  endSpan(span: Span, status?: SpanStatus, statusMessage?: string): Span {
    const endTime = performance.now()
    const completed: Span = {
      ...span,
      endTime,
      duration: endTime - span.startTime,
      status: status ?? "ok",
      statusMessage,
    }

    // Update in store
    this.store.updateSpan(completed)

    // Pop from active stack
    const stack = this.activeSpanStack.get(span.traceId)
    if (stack) {
      const idx = stack.findIndex((s) => s.spanId === span.spanId)
      if (idx !== -1) {
        stack.splice(idx, 1)
        if (stack.length === 0) {
          this.activeSpanStack.delete(span.traceId)
        }
      }
    }

    // Emit span end event
    this.pipeline.emit({
      type: "span_end",
      traceId: completed.traceId,
      spanId: completed.spanId,
      parentSpanId: completed.parentSpanId,
      timestamp: endTime,
      priority: "normal",
      runtimePhase: completed.name,
      source: "span-processor",
      payload: {
        duration: completed.duration,
        status: completed.status,
        statusMessage: completed.statusMessage,
      },
      metadata: {},
    })

    return completed
  }

  // ── Context Management ──

  getCurrentSpan(traceId: string): Span | null {
    const stack = this.activeSpanStack.get(traceId)
    if (!stack || stack.length === 0) return null
    return stack[stack.length - 1]
  }

  getCurrentSpanId(traceId: string): string | null {
    return this.getCurrentSpan(traceId)?.spanId ?? null
  }

  getSpanContext(traceId: string): SpanContext | null {
    const span = this.getCurrentSpan(traceId)
    if (!span) return null
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      isRemote: false,
    }
  }

  // ── Nested Span Helpers ──

  async trace<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      kind?: SpanKind
      traceId?: string
      attributes?: Record<string, unknown>
    },
  ): Promise<{ result: T; span: Span }> {
    const span = this.startSpan(name, {
      ...options,
      parentSpanId: options?.traceId
        ? this.getCurrentSpanId(options.traceId)
        : this.getCurrentSpanId(""),
    })

    try {
      const result = await fn(span)
      this.endSpan(span, "ok")
      return { result, span }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.endSpan(span, "error", message)
      throw err
    }
  }

  // ── Child Span ──

  createChildSpan(
    parent: Span,
    name: string,
    kind: SpanKind = "internal",
    attributes?: Record<string, unknown>,
  ): Span {
    return this.startSpan(name, {
      kind,
      traceId: parent.traceId,
      parentSpanId: parent.spanId,
      attributes,
    })
  }

  // ── Cleanup ──

  reset(): void {
    this.activeSpanStack.clear()
  }
}

// Re-export for convenience
export { generateSpanId, generateTraceId } from "./TraceTypes"
