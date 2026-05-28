import {
  type ProviderPacket,
  type ProviderRequestSnapshot,
  type ProviderResponseSnapshot,
  type ProviderStreamChunk,
  type ProviderHealthCheck,
} from "./ObservabilityTypes"
import { TracePipeline } from "../telemetry/TracePipeline"
import { TraceStore } from "../telemetry/TraceStore"
import { generateTraceId } from "../telemetry/TraceTypes"

/**
 * Provider Inspector — captures, stores, and exposes provider request/response
 * packets for real-time observability.
 *
 * Light scaffold: types + basic capture infrastructure + query interface.
 * Full implementation should add:
 *  - SSE chunk reassembly
 *  - Request/response diffing
 *  - Provider capability matrix
 *  - Per-provider latency tracking
 */
export class ProviderInspector {
  private static instance: ProviderInspector
  private pipeline = TracePipeline.getInstance()
  private store = TraceStore.getInstance()
  private packets: ProviderPacket[] = []
  private streams = new Map<string, ProviderStreamChunk[]>()
  private healthCache = new Map<string, ProviderHealthCheck>()
  private maxPackets = 10_000

  private constructor() {}

  static getInstance(): ProviderInspector {
    if (!ProviderInspector.instance) {
      ProviderInspector.instance = new ProviderInspector()
    }
    return ProviderInspector.instance
  }

  // ── Capture ──

  capturePacket(packet: ProviderPacket): void {
    this.packets.push(packet)
    if (this.packets.length > this.maxPackets) {
      this.packets = this.packets.slice(-this.maxPackets / 2)
    }

    this.pipeline.emit({
      type: "provider_packet",
      traceId: packet.traceId,
      spanId: packet.spanId,
      parentSpanId: null,
      timestamp: packet.timestamp,
      priority: "normal",
      runtimePhase: "provider_connect",
      source: "provider-inspector",
      payload: packet,
      metadata: {},
    })
  }

  captureRequest(request: ProviderRequestSnapshot): void {
    this.pipeline.emit({
      type: "provider_request",
      traceId: request.traceId,
      spanId: generateTraceId(),
      parentSpanId: null,
      timestamp: request.timestamp,
      priority: "normal",
      runtimePhase: "provider_connect",
      source: "provider-inspector",
      payload: request,
      metadata: {},
    })
  }

  captureResponse(response: ProviderResponseSnapshot): void {
    this.pipeline.emit({
      type: "provider_response",
      traceId: response.traceId,
      spanId: generateTraceId(),
      parentSpanId: null,
      timestamp: response.timestamp,
      priority: "normal",
      runtimePhase: "provider_connect",
      source: "provider-inspector",
      payload: response,
      metadata: {},
    })
  }

  captureStreamChunk(chunk: ProviderStreamChunk): void {
    const chunks = this.streams.get(chunk.traceId) ?? []
    chunks.push(chunk)
    this.streams.set(chunk.traceId, chunks)

    this.pipeline.emit({
      type: "provider_stream_chunk",
      traceId: chunk.traceId,
      spanId: generateTraceId(),
      parentSpanId: null,
      timestamp: chunk.timestamp,
      priority: "low",
      runtimePhase: "streaming",
      source: "provider-inspector",
      payload: chunk,
      metadata: { chunkIndex: chunk.chunkIndex },
    })
  }

  updateHealth(check: ProviderHealthCheck): void {
    this.healthCache.set(check.providerId, check)
  }

  // ── Query ──

  getPackets(traceId?: string): ProviderPacket[] {
    if (traceId) {
      return this.packets.filter((p) => p.traceId === traceId)
    }
    return [...this.packets]
  }

  getStreamChunks(traceId: string): ProviderStreamChunk[] {
    return [...(this.streams.get(traceId) ?? [])]
  }

  getStreamCount(): number {
    return this.streams.size
  }

  getHealth(providerId?: string): ProviderHealthCheck | Map<string, ProviderHealthCheck> {
    if (providerId) {
      return this.healthCache.get(providerId) ?? {
        providerId,
        healthy: false,
        latencyMs: 0,
        lastChecked: 0,
        error: "No health data",
        modelCapabilities: [],
      }
    }
    return new Map(this.healthCache)
  }

  // ── Maintenance ──

  clear(): void {
    this.packets = []
    this.streams.clear()
    this.healthCache.clear()
  }
}
