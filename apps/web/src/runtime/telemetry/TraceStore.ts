import { type Span, type Trace, type TraceFilter, type SpanStatus } from "./TraceTypes"

export interface TraceQuery {
  traceId?: string
  spanId?: string
  name?: string
  status?: SpanStatus
  after?: number
  before?: number
  tags?: Record<string, unknown>
  limit?: number
}

export class TraceStore {
  private static instance: TraceStore
  private spans = new Map<string, Span>() // spanId -> Span
  private traces = new Map<string, Trace>() // traceId -> Trace
  private spanToTrace = new Map<string, string>() // spanId -> traceId
  private typeIndex = new Map<string, Set<string>>() // eventType -> spanIds

  private constructor() {}

  static getInstance(): TraceStore {
    if (!TraceStore.instance) {
      TraceStore.instance = new TraceStore()
    }
    return TraceStore.instance
  }

  // ── Span Storage ──

  addSpan(span: Span): void {
    this.spans.set(span.spanId, span)
    this.spanToTrace.set(span.spanId, span.traceId)

    // Update or create trace
    const existing = this.traces.get(span.traceId)
    if (existing) {
      existing.spans.set(span.spanId, span)
      existing.spanCount = existing.spans.size
      if (span.endTime && (!existing.endTime || span.endTime > existing.endTime)) {
        existing.endTime = span.endTime
      }
      existing.duration = existing.endTime && existing.startTime
        ? existing.endTime - existing.startTime
        : null
    } else {
      const trace: Trace = {
        traceId: span.traceId,
        rootSpanId: span.parentSpanId === null ? span.spanId : span.spanId,
        spans: new Map([[span.spanId, span]]),
        startTime: span.startTime,
        endTime: span.endTime,
        duration: span.endTime ? span.endTime - span.startTime : null,
        attributes: {},
        status: "unset",
        spanCount: 1,
      }
      this.traces.set(span.traceId, trace)
    }
  }

  updateSpan(span: Span): void {
    this.spans.set(span.spanId, span)
    const traceId = this.spanToTrace.get(span.spanId)
    if (traceId) {
      const trace = this.traces.get(traceId)
      if (trace) {
        trace.spans.set(span.spanId, span)
        if (span.endTime && (!trace.endTime || span.endTime > trace.endTime)) {
          trace.endTime = span.endTime
        }
        trace.duration = trace.endTime && trace.startTime
          ? trace.endTime - trace.startTime
          : null

        // Update trace status
        if (span.status === "error") {
          trace.status = "error"
        } else if (trace.status === "unset" && span.status === "ok") {
          trace.status = "ok"
        }
      }
    }
  }

  indexEventType(type: string, spanId: string): void {
    const ids = this.typeIndex.get(type) ?? new Set()
    ids.add(spanId)
    this.typeIndex.set(type, ids)
  }

  // ── Query ──

  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId)
  }

  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId)
  }

  getSpanChildren(traceId: string, parentSpanId: string): Span[] {
    const trace = this.traces.get(traceId)
    if (!trace) return []
    return Array.from(trace.spans.values()).filter(
      (s) => s.parentSpanId === parentSpanId,
    ).sort((a, b) => a.startTime - b.startTime)
  }

  getTraceSpans(traceId: string): Span[] {
    const trace = this.traces.get(traceId)
    if (!trace) return []
    return Array.from(trace.spans.values()).sort((a, b) => a.startTime - b.startTime)
  }

  getSpanAncestors(spanId: string): Span[] {
    const ancestors: Span[] = []
    let current = this.spans.get(spanId)
    while (current?.parentSpanId) {
      const parent = this.spans.get(current.parentSpanId)
      if (parent) {
        ancestors.unshift(parent)
        current = parent
      } else {
        break
      }
    }
    return ancestors
  }

  getSpanDescendants(traceId: string, spanId: string): Span[] {
    const trace = this.traces.get(traceId)
    if (!trace) return []
    const descendants: Span[] = []
    const collect = (parentId: string) => {
      const children = Array.from(trace.spans.values())
        .filter((s) => s.parentSpanId === parentId)
        .sort((a, b) => a.startTime - b.startTime)
      for (const child of children) {
        descendants.push(child)
        collect(child.spanId)
      }
    }
    collect(spanId)
    return descendants
  }

  getTraces(query?: TraceQuery): Trace[] {
    let results = Array.from(this.traces.values())
    if (query) {
      if (query.status) {
        results = results.filter((t) => t.status === query.status)
      }
      if (query.after !== undefined) {
        results = results.filter((t) => t.startTime >= query.after!)
      }
      if (query.before !== undefined) {
        results = results.filter((t) => t.startTime <= query.before!)
      }
      if (query.traceId) {
        results = results.filter((t) => t.traceId === query.traceId)
      }
      if (query.limit) {
        results = results.slice(0, query.limit)
      }
    }
    return results.sort((a, b) => b.startTime - a.startTime)
  }

  getAllSpans(): Span[] {
    return Array.from(this.spans.values())
  }

  getSpanCount(): number {
    return this.spans.size
  }

  getTraceCount(): number {
    return this.traces.size
  }

  // ── Maintenance ──

  clear(): void {
    this.spans.clear()
    this.traces.clear()
    this.spanToTrace.clear()
    this.typeIndex.clear()
  }

  prune(maxSpans: number): number {
    if (this.spans.size <= maxSpans) return 0
    const spans = Array.from(this.spans.entries())
      .sort(([, a], [, b]) => a.startTime - b.startTime)
    const toRemove = spans.slice(0, spans.length - maxSpans)
    for (const [spanId, span] of toRemove) {
      this.spans.delete(spanId)
      const traceId = this.spanToTrace.get(spanId)
      if (traceId) {
        const trace = this.traces.get(traceId)
        if (trace) {
          trace.spans.delete(spanId)
          trace.spanCount = trace.spans.size
        }
      }
      this.spanToTrace.delete(spanId)
    }
    return toRemove.length
  }
}

// Export singleton accessor
let _store: TraceStore | null = null
export function getTraceStore(): TraceStore {
  if (!_store) _store = TraceStore.getInstance()
  return _store
}
