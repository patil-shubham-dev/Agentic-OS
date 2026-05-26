import {
  type RuntimeMetrics,
  type PerformanceSnapshot,
} from "./ObservabilityTypes"
import { TracePipeline } from "../telemetry/TracePipeline"
import { TraceStore } from "../telemetry/TraceStore"
import { generateTraceId, generateSpanId } from "../telemetry/TraceTypes"

/**
 * Runtime Telemetry Engine — collects, aggregates, and exposes
 * production-grade runtime performance metrics.
 *
 * Light scaffold: types + metric collection + snapshot generation.
 * Full implementation should add:
 *  - Sub-ms first token latency tracking
 *  - Provider RTT measurement
 *  - Stream throughput calculation (tokens/sec)
 *  - Context assembly latency
 *  - Retrieval latency
 *  - Tool execution latency
 *  - Event throughput
 *  - Memory pressure
 *  - Queue congestion
 *  - Latency heatmaps
 *  - Bottleneck analysis
 *  - Hotspot visualization
 */
export class RuntimeTelemetryEngine {
  private static instance: RuntimeTelemetryEngine
  private pipeline = TracePipeline.getInstance()
  private store = TraceStore.getInstance()
  private snapshots: PerformanceSnapshot[] = []
  private metrics: RuntimeMetrics = this.createEmptyMetrics()
  private maxSnapshots = 500
  private snapshotInterval: ReturnType<typeof setInterval> | null = null
  private startTime = performance.now()

  // Raw measurements
  private latencySamples: number[] = []
  private throughputSamples: number[] = []
  private toolLatencySamples: number[] = []

  private constructor() {}

  static getInstance(): RuntimeTelemetryEngine {
    if (!RuntimeTelemetryEngine.instance) {
      RuntimeTelemetryEngine.instance = new RuntimeTelemetryEngine()
    }
    return RuntimeTelemetryEngine.instance
  }

  private createEmptyMetrics(): RuntimeMetrics {
    return {
      firstTokenLatencyMs: 0,
      providerRttMs: 0,
      streamThroughputTokensPerSec: 0,
      contextAssemblyLatencyMs: 0,
      retrievalLatencyMs: 0,
      toolExecutionLatencyMs: 0,
      eventThroughputEventsPerSec: 0,
      memoryPressurePct: 0,
      queueCongestion: 0,
      activeSpans: 0,
      activeTraces: 0,
    }
  }

  // ── Recording ──

  recordFirstTokenLatency(ms: number): void {
    this.metrics.firstTokenLatencyMs = ms
    this.latencySamples.push(ms)
    if (this.latencySamples.length > 100) this.latencySamples.shift()
  }

  recordProviderRtt(ms: number): void {
    this.metrics.providerRttMs = ms
  }

  recordContextAssemblyLatency(ms: number): void {
    this.metrics.contextAssemblyLatencyMs = ms
  }

  recordRetrievalLatency(ms: number): void {
    this.metrics.retrievalLatencyMs = ms
  }

  recordToolExecutionLatency(ms: number): void {
    this.metrics.toolExecutionLatencyMs = ms
    this.toolLatencySamples.push(ms)
    if (this.toolLatencySamples.length > 100) this.toolLatencySamples.shift()
  }

  recordThroughput(tokensPerSec: number): void {
    this.metrics.streamThroughputTokensPerSec = tokensPerSec
    this.throughputSamples.push(tokensPerSec)
    if (this.throughputSamples.length > 100) this.throughputSamples.shift()
  }

  recordMemoryPressure(pct: number): void {
    this.metrics.memoryPressurePct = pct
  }

  recordQueueCongestion(length: number): void {
    this.metrics.queueCongestion = length
  }

  // ── Snapshot ──

  takeSnapshot(): PerformanceSnapshot {
    const snapshot: PerformanceSnapshot = {
      timestamp: performance.now(),
      metrics: { ...this.metrics },
      bottlenecks: this.detectBottlenecks(),
      hotspots: this.detectHotspots(),
    }

    this.snapshots.push(snapshot)
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots)
    }

    return snapshot
  }

  startAutoSnapshot(intervalMs = 5000): void {
    if (this.snapshotInterval) return
    this.snapshotInterval = setInterval(() => this.takeSnapshot(), intervalMs)
  }

  stopAutoSnapshot(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval)
      this.snapshotInterval = null
    }
  }

  // ── Analysis ──

  private detectBottlenecks(): string[] {
    const bottlenecks: string[] = []
    if (this.metrics.firstTokenLatencyMs > 5000) {
      bottlenecks.push("High first-token latency")
    }
    if (this.metrics.memoryPressurePct > 80) {
      bottlenecks.push("Memory pressure critical")
    }
    if (this.metrics.queueCongestion > 50) {
      bottlenecks.push("Event queue congestion")
    }
    return bottlenecks
  }

  private detectHotspots(): string[] {
    const hotspots: string[] = []
    if (this.toolLatencySamples.length > 0) {
      const avg = this.toolLatencySamples.reduce((a, b) => a + b, 0) / this.toolLatencySamples.length
      if (avg > 2000) hotspots.push("Tool execution")
    }
    if (this.metrics.firstTokenLatencyMs > 3000) {
      hotspots.push("Provider streaming")
    }
    return hotspots
  }

  // ── Query ──

  getMetrics(): RuntimeMetrics {
    return { ...this.metrics }
  }

  getSnapshots(limit = 50): PerformanceSnapshot[] {
    return this.snapshots.slice(-limit)
  }

  getAverageLatency(): number {
    if (this.latencySamples.length === 0) return 0
    return this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
  }

  getP95Latency(): number {
    const sorted = [...this.latencySamples].sort((a, b) => a - b)
    const idx = Math.ceil(sorted.length * 0.95) - 1
    return sorted[idx] ?? 0
  }

  getUptimeMs(): number {
    return performance.now() - this.startTime
  }

  // ── Maintenance ──

  reset(): void {
    this.metrics = this.createEmptyMetrics()
    this.snapshots = []
    this.latencySamples = []
    this.throughputSamples = []
    this.toolLatencySamples = []
    this.startTime = performance.now()
  }

  dispose(): void {
    this.stopAutoSnapshot()
    this.reset()
  }
}
