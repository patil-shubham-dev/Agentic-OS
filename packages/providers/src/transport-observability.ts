import type { TransportTraceEvent, TransportTimeline, StreamMetrics } from "./transport-types"

export interface TransportDiagnostics {
  requestId: string
  url: string
  method: string
  startTime: number
  endTime?: number
  totalDurationMs?: number
  status?: number
  error?: string
  events: TransportTraceEvent[]
  retries: number
  streamMetrics?: StreamMetrics
}

const MAX_STORED_TIMELINES = 200

class TransportObservabilityStore {
  private timelines: TransportTimeline[] = []
  private listeners: Array<(event: TransportTraceEvent) => void> = []

  addTimeline(timeline: TransportTimeline): void {
    this.timelines.push(timeline)
    if (this.timelines.length > MAX_STORED_TIMELINES) {
      this.timelines.splice(0, this.timelines.length - MAX_STORED_TIMELINES)
    }
  }

  getTimelines(): TransportTimeline[] {
    return [...this.timelines]
  }

  getTimeline(requestId: string): TransportTimeline | undefined {
    return this.timelines.find((t) => t.requestId === requestId)
  }

  getRecentTimelines(count = 20): TransportTimeline[] {
    return this.timelines.slice(-count)
  }

  clearTimelines(): void {
    this.timelines = []
  }

  onEvent(cb: (event: TransportTraceEvent) => void): () => void {
    this.listeners.push(cb)
    return () => {
      const idx = this.listeners.indexOf(cb)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  emitEvent(event: TransportTraceEvent): void {
    for (const listener of this.listeners) {
      try { listener(event) } catch { /* ignore listener errors */ }
    }
  }
}

export const observabilityStore = new TransportObservabilityStore()

export function createDiagnosticsHandler() {
  const onEvent = (event: TransportTraceEvent) => {
    observabilityStore.emitEvent(event)
  }

  const onTimelineComplete = (timeline: TransportTimeline) => {
    observabilityStore.addTimeline(timeline)
  }

  return { onEvent, onTimelineComplete }
}

export function formatTimelineSummary(timeline: TransportTimeline): string {
  const lines: string[] = []
  lines.push(`[${timeline.method}] ${timeline.url}`)
  lines.push(`  Request ID: ${timeline.requestId}`)
  lines.push(`  Duration: ${timeline.totalDurationMs ?? "?"}ms`)
  lines.push(`  Status: ${timeline.status ?? "?"} | Error: ${timeline.error ?? "none"}`)
  lines.push(`  Retries: ${timeline.retries}`)
  lines.push(`  Events: ${timeline.events.length}`)

  if (timeline.streamMetrics) {
    const m = timeline.streamMetrics
    lines.push(`  Stream: ${m.totalChunks} chunks, ${m.totalTokens} tokens, ${m.totalToolCalls} tool calls`)
    lines.push(`  TTFB: ${m.ttfbMs}ms | Duration: ${m.durationMs}ms`)
    lines.push(`  Parse errors: ${m.parseErrors}`)
  }

  for (const event of timeline.events) {
    const elapsed = event.timestamp - timeline.startTime
    lines.push(`    [+${elapsed}ms] ${event.type}: ${event.label}`)
  }

  return lines.join("\n")
}

export function formatStreamMetrics(metrics: StreamMetrics): string {
  return [
    `Chunks: ${metrics.totalChunks}`,
    `Tokens: ${metrics.totalTokens}`,
    `Tool calls: ${metrics.totalToolCalls}`,
    `TTFB: ${metrics.ttfbMs}ms`,
    `First token: ${metrics.firstTokenMs}ms`,
    `Last token: ${metrics.lastTokenMs}ms`,
    `Duration: ${metrics.durationMs}ms`,
    `Parse errors: ${metrics.parseErrors}`,
    `Retries: ${metrics.retries}`,
  ].join(" | ")
}
