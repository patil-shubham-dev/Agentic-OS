import { type ReplaySegment, type ReplayState } from "./ObservabilityTypes"
import { TracePipeline } from "../telemetry/TracePipeline"
import { TraceStore, getTraceStore } from "../telemetry/TraceStore"
import { type TraceableEvent, generateTraceId, generateSpanId, SpanBuilder } from "../telemetry/TraceTypes"
import type { Span } from "../telemetry/TraceTypes"

// ── Enhanced types ──

export interface ReplayProgress {
  traceId: string
  currentTime: number
  startTime: number
  endTime: number
  durationMs: number
  progress: number // 0-1
  speed: number
  isPlaying: boolean
  currentSegmentIndex: number
  currentSegment: ReplaySegment | null
  segments: ReplaySegment[]
  eventsPlayed: number
  totalEvents: number
}

export interface SeedSegment {
  name: string
  spanId: string
  kind: "internal" | "server" | "client"
  eventCount: number
  offsetMs: number
  durationMs: number
  eventType?: string
}

// ── ReplayEngine ──

export class ReplayEngine {
  private static instance: ReplayEngine
  private pipeline = TracePipeline.getInstance()
  private store = TraceStore.getInstance()
  private segments = new Map<string, ReplaySegment[]>()
  private activeReplays = new Map<string, ReplayState>()
  private recordings = new Map<string, TraceableEvent[]>()
  private maxRecordings = 50
  private playTimers = new Map<string, number>() // traceId -> requestAnimationFrame id
  private onProgressCallbacks = new Map<string, (progress: ReplayProgress) => void>()
  private lastTickTime = new Map<string, number>()

  private constructor() {}

  static getInstance(): ReplayEngine {
    if (!ReplayEngine.instance) {
      ReplayEngine.instance = new ReplayEngine()
    }
    return ReplayEngine.instance
  }

  // ── Seed Data ──

  generateSeedData(traceId: string): ReplaySegment[] {
    // Generate realistic execution segments for demo purposes
    const segments: ReplaySegment[] = []
    const baseTime = performance.now() - 30000 // 30 seconds ago
    const traceIdVal = traceId

    const seedSegments: SeedSegment[] = [
      { name: "coordinator-plan", spanId: generateSpanId(), kind: "server", eventCount: 5, offsetMs: 0, durationMs: 800 },
      { name: "context-assembly", spanId: generateSpanId(), kind: "internal", eventCount: 8, offsetMs: 600, durationMs: 1200, eventType: "context_diagnostics" },
      { name: "retrieval", spanId: generateSpanId(), kind: "client", eventCount: 12, offsetMs: 1400, durationMs: 2500, eventType: "retrieval_exec" },
      { name: "provider-connect", spanId: generateSpanId(), kind: "client", eventCount: 6, offsetMs: 3000, durationMs: 1800, eventType: "provider_request" },
      { name: "streaming-reasoning", spanId: generateSpanId(), kind: "internal", eventCount: 25, offsetMs: 4200, durationMs: 4000, eventType: "stream_chunk" },
      { name: "tool-execution", spanId: generateSpanId(), kind: "server", eventCount: 10, offsetMs: 7200, durationMs: 3200, eventType: "tool_call" },
      { name: "synthesis", spanId: generateSpanId(), kind: "internal", eventCount: 7, offsetMs: 9500, durationMs: 1500 },
      { name: "memory-propagation", spanId: generateSpanId(), kind: "internal", eventCount: 4, offsetMs: 10500, durationMs: 600, eventType: "memory_propagate" },
    ]

    for (const seed of seedSegments) {
      const startTime = baseTime + seed.offsetMs
      const endTime = startTime + seed.durationMs
      const events: TraceableEvent[] = []

      for (let i = 0; i < seed.eventCount; i++) {
        const eventTime = startTime + (seed.durationMs / seed.eventCount) * i
        const eventType = seed.eventType ?? seed.name
        events.push({
          type: eventType,
          traceId: traceIdVal,
          spanId: seed.spanId,
          parentSpanId: null,
          timestamp: eventTime,
          priority: "normal",
          runtimePhase: seed.name,
          source: "replay-engine",
          payload: { index: i, total: seed.eventCount, name: seed.name },
          metadata: {},
        })
      }

      const span = new SpanBuilder(seed.name, seed.kind)
        .withTraceId(traceIdVal)
        .withSpanId(seed.spanId)
        .withAttribute("duration", seed.durationMs)
        .withAttribute("eventCount", seed.eventCount)
        .build()
      span.startTime = startTime
      span.endTime = endTime
      span.duration = seed.durationMs

      segments.push({
        traceId: traceIdVal,
        spanId: seed.spanId,
        events,
        spans: [span],
        startTime,
        endTime,
        durationMs: seed.durationMs,
      })
    }

    this.segments.set(traceIdVal, segments)
    return segments
  }

  // ── Recording ──

  startRecording(traceId: string): void {
    this.recordings.set(traceId, [])
  }

  recordEvent(traceId: string, event: TraceableEvent): void {
    const events = this.recordings.get(traceId)
    if (events) {
      events.push(event)
    }
  }

  stopRecording(traceId: string): TraceableEvent[] {
    const events = this.recordings.get(traceId) ?? []
    this.recordings.delete(traceId)

    const segments = this.buildSegments(traceId, events)
    this.segments.set(traceId, segments)

    return events
  }

  // ── Segment Building ──

  private buildSegments(traceId: string, events: TraceableEvent[]): ReplaySegment[] {
    const spans = this.store.getTraceSpans(traceId)
    const segments: ReplaySegment[] = []

    for (const span of spans) {
      const spanEvents = events.filter((e) => e.spanId === span.spanId)
      segments.push({
        traceId,
        spanId: span.spanId,
        events: spanEvents,
        spans: [span],
        startTime: span.startTime,
        endTime: span.endTime ?? span.startTime,
        durationMs: (span.endTime ?? span.startTime) - span.startTime,
      })
    }

    return segments.sort((a, b) => a.startTime - b.startTime)
  }

  // ── Playback ──

  createReplayState(traceId: string, generateIfEmpty = true): ReplayState {
    let segments = this.segments.get(traceId) ?? []

    // Auto-generate seed data if no segments and generateIfEmpty is true
    if (segments.length === 0 && generateIfEmpty) {
      segments = this.generateSeedData(traceId)
    }

    const first = segments[0]
    const last = segments[segments.length - 1]

    const state: ReplayState = {
      traceId,
      currentTime: first?.startTime ?? 0,
      speed: 1,
      isPlaying: false,
      isPaused: false,
      segments,
      currentSegmentIndex: 0,
    }

    this.activeReplays.set(traceId, state)
    return state
  }

  play(traceId: string): void {
    const state = this.activeReplays.get(traceId)
    if (!state) return

    state.isPlaying = true
    state.isPaused = false
    this.lastTickTime.set(traceId, performance.now())

    // Start the playback tick loop
    this.startPlaybackTick(traceId)
  }

  pause(traceId: string): void {
    const state = this.activeReplays.get(traceId)
    if (!state) return

    state.isPlaying = false
    state.isPaused = true
    this.stopPlaybackTick(traceId)
  }

  stop(traceId: string): void {
    const state = this.activeReplays.get(traceId)
    if (!state) return

    state.isPlaying = false
    state.isPaused = false
    state.currentTime = state.segments[0]?.startTime ?? 0
    state.currentSegmentIndex = 0
    this.stopPlaybackTick(traceId)

    this.emitProgress(traceId)
  }

  setSpeed(traceId: string, speed: ReplayState["speed"]): void {
    const state = this.activeReplays.get(traceId)
    if (!state) return
    state.speed = speed
  }

  seek(traceId: string, time: number): void {
    const state = this.activeReplays.get(traceId)
    if (!state) return
    state.currentTime = time

    // Find the segment at this time
    const idx = state.segments.findIndex(
      (s) => s.startTime <= time && s.endTime >= time,
    )
    if (idx !== -1) {
      state.currentSegmentIndex = idx
    } else if (state.segments.length > 0 && time >= state.segments[state.segments.length - 1].endTime) {
      // Past the end — stay at last segment
      state.currentSegmentIndex = state.segments.length - 1
    } else if (state.segments.length > 0 && time <= state.segments[0].startTime) {
      // Before the start
      state.currentSegmentIndex = 0
    }

    this.emitProgress(traceId)
  }

  // ── Progress Tracking ──

  onProgress(traceId: string, callback: (progress: ReplayProgress) => void): () => void {
    this.onProgressCallbacks.set(traceId, callback)
    return () => this.onProgressCallbacks.delete(traceId)
  }

  getProgress(traceId: string): ReplayProgress | null {
    const state = this.activeReplays.get(traceId)
    if (!state || state.segments.length === 0) return null

    const first = state.segments[0]
    const last = state.segments[state.segments.length - 1]
    const totalDuration = last.endTime - first.startTime
    const elapsed = state.currentTime - first.startTime
    const progress = totalDuration > 0 ? Math.min(1, Math.max(0, elapsed / totalDuration)) : 0

    const currentSegment = state.segments[state.currentSegmentIndex] ?? null
    const totalEvents = state.segments.reduce((sum, s) => sum + s.events.length, 0)
    const eventsPlayed = state.segments
      .slice(0, state.currentSegmentIndex + 1)
      .reduce((sum, s) => sum + s.events.length, 0)

    return {
      traceId,
      currentTime: state.currentTime,
      startTime: first.startTime,
      endTime: last.endTime,
      durationMs: totalDuration,
      progress,
      speed: state.speed,
      isPlaying: state.isPlaying,
      currentSegmentIndex: state.currentSegmentIndex,
      currentSegment,
      segments: state.segments,
      eventsPlayed,
      totalEvents,
    }
  }

  getSegments(traceId: string): ReplaySegment[] {
    return [...(this.segments.get(traceId) ?? [])]
  }

  getReplayState(traceId: string): ReplayState | undefined {
    return this.activeReplays.get(traceId)
  }

  getRecording(traceId: string): TraceableEvent[] {
    return [...(this.recordings.get(traceId) ?? [])]
  }

  hasRecording(traceId: string): boolean {
    return this.recordings.has(traceId)
  }

  getSegmentAtTime(traceId: string, time: number): ReplaySegment | null {
    const segments = this.segments.get(traceId) ?? []
    return segments.find((s) => s.startTime <= time && s.endTime >= time) ?? null
  }

  getAllTraceIds(): string[] {
    return Array.from(this.segments.keys())
  }

  // ── Private: Playback Tick ──

  private startPlaybackTick(traceId: string): void {
    if (this.playTimers.has(traceId)) return

    const tick = () => {
      const state = this.activeReplays.get(traceId)
      if (!state || !state.isPlaying) {
        this.stopPlaybackTick(traceId)
        return
      }

      const now = performance.now()
      const lastTick = this.lastTickTime.get(traceId) ?? now
      const deltaMs = (now - lastTick) * state.speed
      this.lastTickTime.set(traceId, now)

      const newTime = state.currentTime + deltaMs
      const lastSegment = state.segments[state.segments.length - 1]

      if (lastSegment && newTime >= lastSegment.endTime) {
        // Reached the end
        state.isPlaying = false
        state.currentTime = lastSegment.endTime
        state.currentSegmentIndex = state.segments.length - 1
        this.stopPlaybackTick(traceId)
        this.emitProgress(traceId)
        return
      }

      state.currentTime = newTime

      // Update current segment index
      const idx = state.segments.findIndex(
        (s) => s.startTime <= newTime && s.endTime >= newTime,
      )
      if (idx !== -1) {
        state.currentSegmentIndex = idx
      }

      this.emitProgress(traceId)

      this.playTimers.set(traceId, requestAnimationFrame(tick))
    }

    this.playTimers.set(traceId, requestAnimationFrame(tick))
  }

  private stopPlaybackTick(traceId: string): void {
    const id = this.playTimers.get(traceId)
    if (id !== undefined) {
      cancelAnimationFrame(id)
    }
    this.playTimers.delete(traceId)
    this.lastTickTime.delete(traceId)
  }

  private emitProgress(traceId: string): void {
    const progress = this.getProgress(traceId)
    if (progress) {
      const cb = this.onProgressCallbacks.get(traceId)
      cb?.(progress)
    }
  }

  // ── Maintenance ──

  clear(): void {
    for (const traceId of this.playTimers.keys()) {
      this.stopPlaybackTick(traceId)
    }
    this.segments.clear()
    this.activeReplays.clear()
    this.recordings.clear()
    this.onProgressCallbacks.clear()
  }

  removeTrace(traceId: string): void {
    this.stopPlaybackTick(traceId)
    this.segments.delete(traceId)
    this.activeReplays.delete(traceId)
    this.recordings.delete(traceId)
    this.onProgressCallbacks.delete(traceId)
  }
}
