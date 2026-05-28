import {
  type StreamDiagnostic,
  type ChunkRecord,
  type ToolCallReconstruction,
} from "./ObservabilityTypes"
import { TracePipeline } from "../telemetry/TracePipeline"
import { generateTraceId, generateSpanId } from "../telemetry/TraceTypes"

/**
 * Stream Diagnostics Engine — tracks chunk accumulation, JSON repair,
 * and tool call reconstruction for debugging streaming LLM responses.
 *
 * Light scaffold: types + chunk tracking + basic repair detection.
 * Full implementation should add:
 *  - Quote balancing
 *  - Brace balancing with state machine
 *  - Partial JSON repair with recovery
 *  - Chunk-by-chunk visualizer data
 */
export class StreamDiagnostics {
  private static instance: StreamDiagnostics
  private pipeline = TracePipeline.getInstance()
  private activeStreams = new Map<string, StreamDiagnostic>()
  private chunkHistory = new Map<string, ChunkRecord[]>()
  private toolCallBuffers = new Map<string, ToolCallReconstruction[]>()
  private maxChunksPerStream = 50_000

  private constructor() {}

  static getInstance(): StreamDiagnostics {
    if (!StreamDiagnostics.instance) {
      StreamDiagnostics.instance = new StreamDiagnostics()
    }
    return StreamDiagnostics.instance
  }

  // ── Stream Tracking ──

  startStream(streamId: string, traceId: string): void {
    const diagnostic: StreamDiagnostic = {
      traceId,
      spanId: generateSpanId(),
      streamId,
      startTime: performance.now(),
      endTime: null,
      durationMs: null,
      totalChunks: 0,
      totalTokens: 0,
      tokensPerSecond: 0,
      toolCallsDetected: 0,
      jsonRepairCount: 0,
      malformedChunks: 0,
      recoveredChunks: 0,
      finishReason: null,
    }
    this.activeStreams.set(streamId, diagnostic)
    this.chunkHistory.set(streamId, [])
    this.toolCallBuffers.set(streamId, [])
  }

  recordChunk(chunk: ChunkRecord, streamId: string): void {
    const diagnostic = this.activeStreams.get(streamId)
    if (!diagnostic) return

    diagnostic.totalChunks++
    diagnostic.totalTokens += this.estimateTokens(chunk.raw)

    if (chunk.isToolCall) {
      diagnostic.toolCallsDetected++
    }
    if (chunk.jsonRepairApplied) {
      diagnostic.jsonRepairCount++
    }
    if (this.isMalformed(chunk.raw)) {
      diagnostic.malformedChunks++
    }

    const chunks = this.chunkHistory.get(streamId) ?? []
    chunks.push(chunk)
    if (chunks.length > this.maxChunksPerStream) {
      chunks.splice(0, chunks.length - this.maxChunksPerStream)
    }
    this.chunkHistory.set(streamId, chunks)

    // Emit diagnostic event
    this.pipeline.emit({
      type: "stream_chunk_recorded",
      traceId: diagnostic.traceId,
      spanId: generateSpanId(),
      parentSpanId: null,
      timestamp: chunk.timestamp,
      priority: "low",
      runtimePhase: "streaming",
      source: "stream-diagnostics",
      payload: { chunk, streamId },
      metadata: { chunkIndex: chunk.index, size: chunk.raw.length },
    })
  }

  recordToolCallReconstruction(tc: ToolCallReconstruction, streamId: string): void {
    const buffers = this.toolCallBuffers.get(streamId) ?? []
    const existing = buffers.findIndex((b) => b.index === tc.index)
    if (existing !== -1) {
      buffers[existing] = tc
    } else {
      buffers.push(tc)
    }
    this.toolCallBuffers.set(streamId, buffers)
  }

  completeStream(streamId: string, finishReason: string | null): StreamDiagnostic {
    const diagnostic = this.activeStreams.get(streamId)
    if (!diagnostic) {
      throw new Error(`Stream ${streamId} not found`)
    }

    diagnostic.endTime = performance.now()
    const dur = diagnostic.endTime - diagnostic.startTime
    diagnostic.durationMs = dur
    diagnostic.tokensPerSecond = dur > 0
      ? (diagnostic.totalTokens / dur) * 1000
      : 0
    diagnostic.finishReason = finishReason

    return diagnostic
  }

  // ── Query ──

  getStream(streamId: string): StreamDiagnostic | undefined {
    return this.activeStreams.get(streamId)
  }

  getChunks(streamId: string): ChunkRecord[] {
    return [...(this.chunkHistory.get(streamId) ?? [])]
  }

  getToolCallBuffers(streamId: string): ToolCallReconstruction[] {
    return [...(this.toolCallBuffers.get(streamId) ?? [])]
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size
  }

  getAllStreams(): StreamDiagnostic[] {
    return Array.from(this.activeStreams.values())
  }

  // ── Utilities ──

  private isMalformed(chunk: string): boolean {
    try {
      JSON.parse(chunk)
      return false
    } catch {
      // Not valid JSON, but could be partial — check for obvious issues
      const unclosedBraces = (chunk.match(/\{/g) ?? []).length - (chunk.match(/\}/g) ?? []).length
      const unclosedBrackets = (chunk.match(/\[/g) ?? []).length - (chunk.match(/\]/g) ?? []).length
      return Math.abs(unclosedBraces) > 3 || Math.abs(unclosedBrackets) > 3
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  // ── Maintenance ──

  clear(): void {
    this.activeStreams.clear()
    this.chunkHistory.clear()
    this.toolCallBuffers.clear()
  }
}
