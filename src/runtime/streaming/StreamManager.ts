import { emitTelemetry } from "@/lib/telemetry"

type StreamFlushCallback = (stepId: string, delta: string) => void

interface StepStream {
  tokens: string[]
  lastFlushedAt: number
  active: boolean
}

export class StreamManager {
  private static instance: StreamManager
  private streams = new Map<string, StepStream>()
  private flushScheduled = false
  private rafId: number | null = null
  private flushCallback: StreamFlushCallback | null = null
  private cancelled = false

  static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager()
    }
    return StreamManager.instance
  }

  setFlushCallback(callback: StreamFlushCallback): void {
    this.flushCallback = callback
  }

  reset(): void {
    this.cancelled = false
    this.streams.clear()
    this.flushScheduled = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private droppedTokenCount: number = 0

  getDroppedTokenCount(): number {
    return this.droppedTokenCount
  }

  append(stepId: string, token: string): void {
    // Drop tokens during cancellation to prevent orphan streams (Z9 fix)
    if (this.cancelled) {
      this.droppedTokenCount++
      emitTelemetry({ type: "stream_token_dropped", timestamp: Date.now(), error: "Token dropped during cancellation", metadata: { stepId, reason: "cancelled", totalDropped: this.droppedTokenCount } })
      return
    }
    let stream = this.streams.get(stepId)
    if (!stream) {
      stream = { tokens: [], lastFlushedAt: 0, active: true }
      this.streams.set(stepId, stream)
    }
    if (!stream.active) {
      this.droppedTokenCount++
      emitTelemetry({ type: "stream_token_dropped", timestamp: Date.now(), error: "Token dropped for inactive stream", metadata: { stepId, totalDropped: this.droppedTokenCount } })
      console.warn(`[StreamManager] token dropped for inactive stream "${stepId}" (total dropped: ${this.droppedTokenCount})`)
      return
    }
    const isFirstToken = stream.tokens.length === 0
    stream.tokens.push(token)
    if (isFirstToken) {
      this.flushImmediate()
    } else {
      this.scheduleFlush()
    }
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return
    this.flushScheduled = true
    this.rafId = requestAnimationFrame(() => this.flush())
  }

  private flush(): void {
    this.flushScheduled = false
    this.rafId = null
    if (this.streams.size === 0) return

    for (const [stepId, stream] of this.streams) {
      if (stream.tokens.length === 0 || !stream.active) continue
      const tokens = stream.tokens.slice()
      const delta = tokens.join("")
      stream.tokens = []
      stream.lastFlushedAt = performance.now()

      if (delta && this.flushCallback) {
        try {
          this.flushCallback(stepId, delta)
        } catch (e) {
          emitTelemetry({ type: "stream_token_dropped", timestamp: Date.now(), error: e instanceof Error ? e.message : String(e), metadata: { stepId, phase: "flush" } })
          console.error(`[StreamManager] flush error for ${stepId}:`, e)
        }
      }
    }

    // Remove inactive streams with no pending tokens
    for (const [stepId, stream] of this.streams) {
      if (!stream.active && stream.tokens.length === 0) {
        this.streams.delete(stepId)
      }
    }

    if (this.streams.size > 0) {
      // Only reschedule if any active stream has pending tokens
      const hasPendingWork = Array.from(this.streams.values())
        .some(s => s.active && s.tokens.length > 0)
      if (hasPendingWork) {
        this.scheduleFlush()
      }
    }
  }

  flushImmediate(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.flushScheduled = false
    this.flush()
  }

  complete(stepId: string): void {
    this.flushImmediate()
    const stream = this.streams.get(stepId)
    if (stream) {
      stream.active = false
    }
  }

  clearStep(stepId: string): void {
    this.streams.delete(stepId)
  }

  clearAll(): void {
    this.streams.clear()
    this.flushScheduled = false
    this.cancelled = true
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  resetCancelled(): void {
    this.cancelled = false
    this.droppedTokenCount = 0
  }

  hasPending(stepId: string): boolean {
    const stream = this.streams.get(stepId)
    return stream !== undefined && stream.tokens.length > 0
  }

  getActiveStepIds(): string[] {
    return Array.from(this.streams.entries())
      .filter(([, s]) => s.active && s.tokens.length > 0)
      .map(([id]) => id)
  }

  getState(): { activeStreams: number; pendingTokens: number } {
    let pending = 0
    for (const s of this.streams.values()) {
      pending += s.tokens.length
    }
    return { activeStreams: this.streams.size, pendingTokens: pending }
  }
}


