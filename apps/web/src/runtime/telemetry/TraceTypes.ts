// ── Core Trace/Span Types (OpenTelemetry-inspired) ──

export type SpanStatus = "ok" | "error" | "unset"

export type SpanKind = "internal" | "server" | "client" | "producer" | "consumer"

export interface SpanContext {
  traceId: string
  spanId: string
  parentSpanId: string | null
  isRemote: boolean
}

export interface SpanEvent {
  name: string
  timestamp: number // performance.now() ms
  attributes?: Record<string, unknown>
}

export interface SpanLink {
  context: SpanContext
  attributes?: Record<string, unknown>
}

export interface Span {
  traceId: string
  spanId: string
  parentSpanId: string | null
  name: string
  kind: SpanKind
  startTime: number
  endTime: number | null
  duration: number | null
  status: SpanStatus
  statusMessage?: string
  attributes: Record<string, unknown>
  events: SpanEvent[]
  links: SpanLink[]
  resource: Record<string, string>
}

export interface Trace {
  traceId: string
  rootSpanId: string
  spans: Map<string, Span>
  startTime: number
  endTime: number | null
  duration: number | null
  attributes: Record<string, unknown>
  status: SpanStatus
  spanCount: number
}

// ── Trace Event Types ──

export type EventPriority = "low" | "normal" | "high" | "critical"

export interface TraceableEventBase {
  type: string
  traceId: string
  spanId: string
  parentSpanId: string | null
  timestamp: number
  priority: EventPriority
  runtimePhase: string
  source: string
}

export interface TraceableEvent<T = unknown> extends TraceableEventBase {
  payload: T
  metadata: Record<string, unknown>
}

export type TraceEventHandler<T = unknown> = (event: TraceableEvent<T>) => void

// ── Trace Pipeline Types ──

export interface TraceMiddleware {
  name: string
  pre?: (event: TraceableEvent) => TraceableEvent | null
  post?: (event: TraceableEvent, error?: Error) => void
}

export interface TraceFilter {
  types?: string[]
  traceIds?: string[]
  spanIds?: string[]
  sources?: string[]
  minPriority?: EventPriority
  after?: number
  before?: number
}

// ── Span Builder ──

export class SpanBuilder {
  private span: Span

  constructor(name: string, kind: SpanKind = "internal") {
    this.span = {
      traceId: "",
      spanId: "",
      parentSpanId: null,
      name,
      kind,
      startTime: performance.now(),
      endTime: null,
      duration: null,
      status: "unset",
      attributes: {},
      events: [],
      links: [],
      resource: {},
    }
  }

  withTraceId(id: string): this {
    this.span.traceId = id
    return this
  }

  withSpanId(id: string): this {
    this.span.spanId = id
    return this
  }

  withParentSpanId(id: string | null): this {
    this.span.parentSpanId = id
    return this
  }

  withAttribute(key: string, value: unknown): this {
    this.span.attributes[key] = value
    return this
  }

  withAttributes(attrs: Record<string, unknown>): this {
    Object.assign(this.span.attributes, attrs)
    return this
  }

  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.span.events.push({ name, timestamp: performance.now(), attributes })
    return this
  }

  withResource(resource: Record<string, string>): this {
    Object.assign(this.span.resource, resource)
    return this
  }

  build(): Span {
    if (!this.span.spanId) {
      this.span.spanId = generateSpanId()
    }
    if (!this.span.traceId) {
      this.span.traceId = generateTraceId()
    }
    return { ...this.span }
  }

  static fromActive(span: Span): SpanBuilder {
    const builder = new SpanBuilder(span.name, span.kind)
    builder.span = { ...span }
    return builder
  }
}

// ── ID Generators ──

let _counter = 0

export function generateTraceId(): string {
  _counter++
  return `tr_${Date.now().toString(36)}_${_counter}_${Math.random().toString(36).slice(2, 6)}`
}

export function generateSpanId(): string {
  _counter++
  return `sp_${Date.now().toString(36)}_${_counter}`
}

// ── Utility ──

export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(1)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}

export function computeSpanDuration(span: Span): number {
  if (span.endTime !== null && span.startTime !== null) {
    return span.endTime - span.startTime
  }
  return 0
}

export function spanSortKey(span: Span): [number, number] {
  return [span.startTime, computeSpanDuration(span)]
}
