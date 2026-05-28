/**
 * StreamBuffer — Collects tokens per stepId and flushes them
 * in batches aligned with the browser paint cycle (requestAnimationFrame).
 *
 * Optimized for delta-only delivery: the flush callback receives only NEW tokens,
 * not the entire accumulated text, eliminating full-string re-renders.
 */

interface StepBuffer {
  tokens: string[]
  lastFlushedAt: number
}

type FlushCallback = (stepId: string, delta: string, allTokens: string[]) => void

export class StreamBuffer {
  private buffers = new Map<string, StepBuffer>()
  private flushScheduled = false
  private flushCallback: FlushCallback | null = null
  private flushIntervalMs: number
  private rafId: number | null = null

  private metrics = {
    totalTokens: 0,
    totalFlushes: 0,
    maxTokensPerFlush: 0,
    tokensPerSecond: 0,
    lastSecondTokens: 0,
    lastSecondTime: 0,
  }

  private static instance: StreamBuffer

  static getInstance(flushIntervalMs = 50): StreamBuffer {
    if (!StreamBuffer.instance) {
      StreamBuffer.instance = new StreamBuffer(flushIntervalMs)
    }
    return StreamBuffer.instance
  }

  private constructor(flushIntervalMs = 50) {
    this.flushIntervalMs = flushIntervalMs
  }

  setFlushCallback(callback: FlushCallback): void {
    this.flushCallback = callback
  }

  append(stepId: string, token: string): void {
    let buffer = this.buffers.get(stepId)
    if (!buffer) {
      buffer = { tokens: [], lastFlushedAt: 0 }
      this.buffers.set(stepId, buffer)
    }
    buffer.tokens.push(token)
    this.metrics.totalTokens++

    const now = performance.now()
    if (now - this.metrics.lastSecondTime > 1000) {
      this.metrics.tokensPerSecond = this.metrics.lastSecondTokens
      this.metrics.lastSecondTokens = 0
      this.metrics.lastSecondTime = now
    }
    this.metrics.lastSecondTokens++

    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return
    this.flushScheduled = true
    this.rafId = requestAnimationFrame(() => this.flush())
  }

  private flush(): void {
    this.flushScheduled = false
    this.rafId = null
    if (this.buffers.size === 0) return

    for (const [stepId, buffer] of this.buffers) {
      if (buffer.tokens.length === 0) continue
      const tokens = buffer.tokens.slice()
      const delta = tokens.join("")
      buffer.tokens = []
      buffer.lastFlushedAt = performance.now()

      this.metrics.totalFlushes++
      this.metrics.maxTokensPerFlush = Math.max(this.metrics.maxTokensPerFlush, tokens.length)

      if (tokens.length > 0 && this.flushCallback) {
        try {
          this.flushCallback(stepId, delta, tokens)
        } catch (e) {
          console.error(`[StreamBuffer] flush callback error for ${stepId}:`, e)
        }
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

  clearBuffer(stepId: string): void {
    this.buffers.delete(stepId)
  }

  clearAll(): void {
    this.buffers.clear()
    this.flushScheduled = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  hasBufferedContent(stepId: string): boolean {
    const buffer = this.buffers.get(stepId)
    return buffer !== undefined && buffer.tokens.length > 0
  }

  getMetrics() {
    return { ...this.metrics, activeBuffers: this.buffers.size }
  }
}
