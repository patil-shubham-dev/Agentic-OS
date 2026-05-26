import { EventBus } from "../EventBus"
import { SessionManager } from "./SessionManager"
import { StreamMultiplexer } from "../StreamMultiplexer"
import type { RuntimeEvent, RuntimeState } from "../RuntimeTypes"

export interface BridgeSnapshot {
  currentState: RuntimeState
  events: RuntimeEvent[]
  lastSeq: number
  sessionId: string | null
  streamText: string
  reasoningText: string | null
}

type SnapshotCallback = (snapshot: BridgeSnapshot) => void

export class RuntimeProjectionBridge {
  private listeners = new Set<SnapshotCallback>()
  private eventBus: EventBus
  private sessionManager: SessionManager
  private streamMux: StreamMultiplexer
  private buffer: RuntimeEvent[] = []
  private lastEmittedSeq = 0
  private unsub: (() => void) | null = null
  private rafId: number | null = null
  private static instance: RuntimeProjectionBridge

  static getInstance(): RuntimeProjectionBridge {
    if (!RuntimeProjectionBridge.instance) {
      RuntimeProjectionBridge.instance = new RuntimeProjectionBridge()
    }
    return RuntimeProjectionBridge.instance
  }

  private constructor() {
    this.eventBus = EventBus.getInstance()
    this.sessionManager = SessionManager.getInstance()
    this.streamMux = StreamMultiplexer.getInstance()
  }

  initialize(): void {
    if (this.unsub) return
    this.streamMux.initialize()

    const types: RuntimeEvent["type"][] = [
      "state_transition", "tool_requested", "tool_started", "tool_stream",
      "tool_completed", "tool_failed", "stream_delta", "agent_message",
      "verification_started", "verification_completed", "repair_attempted",
      "repair_failed", "repair_resolved", "execution_error", "execution_halted",
    ]

    const unsubs: (() => void)[] = []
    for (const type of types) {
      unsubs.push(
        this.eventBus.on(type, (event: RuntimeEvent) => {
          this.buffer.push(event)
          this.scheduleFlush()
        }),
      )
    }

    this.unsub = () => {
      for (const u of unsubs) u()
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId)
        this.rafId = null
      }
      this.buffer = []
    }
  }

  subscribe(callback: SnapshotCallback): () => void {
    this.listeners.add(callback)
    // Emit current state immediately
    callback(this.buildSnapshot())
    return () => {
      this.listeners.delete(callback)
    }
  }

  getSnapshot(): BridgeSnapshot {
    return this.buildSnapshot()
  }

  private buildSnapshot(): BridgeSnapshot {
    const session = this.sessionManager.getActive()
    const store = session?.eventStore
    const events = store?.getEvents() ?? []
    const lastState = store?.getSnapshot().lastState ?? "Idle"
    const streamText = events
      .filter((e) => e.event.type === "stream_delta")
      .map((e) => (e.event as any).deltaText ?? "")
      .join("")
    const reasoningText = events
      .filter((e) => e.event.type === "stream_delta" && (e.event as any).reasoningText)
      .map((e) => (e.event as any).reasoningText)
      .join("")

    return {
      currentState: lastState,
      events: events.map((e) => e.event),
      lastSeq: store?.getLastSeq() ?? 0,
      sessionId: session?.sessionId ?? null,
      streamText,
      reasoningText: reasoningText || null,
    }
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      if (this.buffer.length === 0) return
      this.buffer = []
      const snapshot = this.buildSnapshot()
      for (const cb of this.listeners) {
        try { cb(snapshot) } catch { /* drop dead listeners */ }
      }
    })
  }

  destroy(): void {
    this.unsub?.()
    this.unsub = null
    this.listeners.clear()
    this.buffer = []
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}
