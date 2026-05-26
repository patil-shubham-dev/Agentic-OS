import { EventBus } from "./EventBus"
import type { RuntimeEvent } from "./RuntimeTypes"

export interface StreamSubscription {
  id: string
  sessionId: string
  onChunk: (chunk: string, event: RuntimeEvent) => void
  onError: (error: Error) => void
  onDone: () => void
  filter?: (event: RuntimeEvent) => boolean
}

export class StreamMultiplexer {
  private subscriptions = new Map<string, StreamSubscription>()
  private buffers = new Map<string, string[]>()
  private unsub: (() => void) | null = null
  private static instance: StreamMultiplexer

  static getInstance(): StreamMultiplexer {
    if (!StreamMultiplexer.instance) {
      StreamMultiplexer.instance = new StreamMultiplexer()
    }
    return StreamMultiplexer.instance
  }

  private constructor() {}

  initialize(): void {
    if (this.unsub) return
    const bus = EventBus.getInstance()
    this.unsub = bus.on("tool_stream", (event: RuntimeEvent) => {
      this.broadcast(event)
    })
  }

  subscribe(sub: StreamSubscription): () => void {
    this.subscriptions.set(sub.id, sub)
    const buffered = this.buffers.get(sub.sessionId)
    if (buffered && buffered.length > 0) {
      for (const chunk of buffered) {
        sub.onChunk(chunk, null as any)
      }
    }
    return () => {
      this.subscriptions.delete(sub.id)
    }
  }

  private broadcast(event: RuntimeEvent): void {
    let buffer = this.buffers.get((event as any).toolId ?? "default")
    if (!buffer) {
      buffer = []
      this.buffers.set((event as any).toolId ?? "default", buffer)
    }
    buffer.push((event as any).chunk ?? "")
    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 1000)
    }

    for (const sub of this.subscriptions.values()) {
      if (sub.filter && !sub.filter(event)) continue
      try {
        sub.onChunk((event as any).chunk ?? "", event)
      } catch {
        // subscriber disconnected — remove
        this.subscriptions.delete(sub.id)
      }
    }
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size
  }

  destroy(): void {
    this.unsub?.()
    this.unsub = null
    this.subscriptions.clear()
    this.buffers.clear()
  }
}
