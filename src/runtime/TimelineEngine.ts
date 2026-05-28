import type { RuntimeEvent } from "./RuntimeTypes"
import { compareTimelineEvents } from "./RuntimeTypes"

export interface TimelineSnapshot {
  events: RuntimeEvent[]
  checkpoint: number
}

export class TimelineEngine {
  private events: RuntimeEvent[] = []
  private checkpoint: number = 0
  private listeners: Set<(event: RuntimeEvent) => void> = new Set()
  private replayListeners: Set<(events: RuntimeEvent[]) => void> = new Set()

  append(event: RuntimeEvent): void {
    this.events.push(event)
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // listener error silently swallowed
      }
    }
  }

  appendBatch(events: RuntimeEvent[]): void {
    for (const event of events) {
      this.events.push(event)
    }
    for (const listener of this.listeners) {
      for (const event of events) {
        try {
          listener(event)
        } catch {
          // listener error silently swallowed
        }
      }
    }
  }

  getAll(): readonly RuntimeEvent[] {
    return this.events
  }

  getSorted(): RuntimeEvent[] {
    return [...this.events].sort(compareTimelineEvents)
  }

  getByExecutionId(executionId: string): RuntimeEvent[] {
    return this.events.filter((e) => e.metadata.executionId === executionId)
  }

  getByAgentId(agentId: string): RuntimeEvent[] {
    return this.events.filter((e) => e.metadata.agentId === agentId)
  }

  getByType<T extends RuntimeEvent["type"]>(type: T): RuntimeEvent[] {
    return this.events.filter((e) => e.type === type)
  }

  getRange(startIndex: number, endIndex: number): RuntimeEvent[] {
    return this.events.slice(startIndex, endIndex)
  }

  getCount(): number {
    return this.events.length
  }

  clear(): void {
    this.events = []
    this.checkpoint = 0
  }

  truncate(keepCount: number): void {
    if (this.events.length > keepCount) {
      this.events = this.events.slice(-keepCount)
      this.checkpoint = Math.max(0, this.checkpoint - (this.events.length - keepCount))
    }
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onReplay(listener: (events: RuntimeEvent[]) => void): () => void {
    this.replayListeners.add(listener)
    return () => this.replayListeners.delete(listener)
  }

  snapshot(): TimelineSnapshot {
    return {
      events: [...this.events],
      checkpoint: this.checkpoint,
    }
  }

  restore(snapshot: TimelineSnapshot): void {
    this.events = [...snapshot.events]
    this.checkpoint = snapshot.checkpoint
  }

  replay(): void {
    const sorted = this.getSorted()
    for (const listener of this.replayListeners) {
      try {
        listener(sorted)
      } catch {
        // listener error silently swallowed
      }
    }
  }

  replayFrom(index: number): void {
    const sorted = this.getSorted()
    const slice = sorted.slice(index)
    for (const listener of this.replayListeners) {
      try {
        listener(slice)
      } catch {
        // listener error silently swallowed
      }
    }
  }

  createCheckpoint(): number {
    this.checkpoint = this.events.length
    return this.checkpoint
  }

  rollbackToCheckpoint(checkpoint: number): boolean {
    if (checkpoint >= 0 && checkpoint <= this.events.length) {
      this.events = this.events.slice(0, checkpoint)
      this.checkpoint = checkpoint
      return true
    }
    return false
  }

  getCheckpoint(): number {
    return this.checkpoint
  }

  toJSON(): string {
    return JSON.stringify(this.snapshot())
  }

  static fromJSON(json: string): TimelineEngine {
    const snapshot: TimelineSnapshot = JSON.parse(json)
    const engine = new TimelineEngine()
    engine.restore(snapshot)
    return engine
  }
}
