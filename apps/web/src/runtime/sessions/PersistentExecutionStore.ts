import type { RuntimeEvent, RuntimeState } from "../RuntimeTypes"
import { EventBus } from "../EventBus"

export type PersistedEvent = {
  seq: number
  timestamp: number
  event: RuntimeEvent
}

export interface ExecutionSnapshot {
  sessionId: string
  events: PersistedEvent[]
  lastState: RuntimeState
  createdAt: number
  lastUpdated: number
  state: "running" | "completed" | "halted" | "orphaned"
}

const MAX_EVENTS = 10000
const STORAGE_KEY_PREFIX = "aos_exec_"

export class PersistentExecutionStore {
  private sessionId: string
  private events: PersistedEvent[] = []
  private seq = 0
  private lastState: RuntimeState = "Idle"
  private createdAt = Date.now()
  private state: ExecutionSnapshot["state"] = "running"
  private storage: Storage | null = null

  constructor(sessionId: string) {
    this.sessionId = sessionId
    if (typeof localStorage !== "undefined") {
      this.storage = localStorage
    }
    this.loadFromStorage()
  }

  append(event: RuntimeEvent): void {
    this.seq++
    const persisted: PersistedEvent = {
      seq: this.seq,
      timestamp: Date.now(),
      event,
    }
    this.events.push(persisted)
    if (event.type === "state_transition") {
      this.lastState = event.to
      if (event.to === "Completed") this.state = "completed"
      if (event.to === "Halted") this.state = "halted"
    }
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS)
    }
    this.persistToStorage()
  }

  getEvents(): PersistedEvent[] {
    return [...this.events]
  }

  getEventsSince(seq: number): PersistedEvent[] {
    return this.events.filter((e) => e.seq > seq)
  }

  getLastSeq(): number {
    return this.seq
  }

  getSnapshot(): ExecutionSnapshot {
    return {
      sessionId: this.sessionId,
      events: this.getEvents(),
      lastState: this.lastState,
      createdAt: this.createdAt,
      lastUpdated: Date.now(),
      state: this.state,
    }
  }

  clear(): void {
    this.events = []
    this.seq = 0
    this.state = "running"
    this.createdAt = Date.now()
    this.lastState = "Idle"
    this.removeFromStorage()
  }

  markOrphaned(): void {
    this.state = "orphaned"
    this.persistToStorage()
  }

  getState(): ExecutionSnapshot["state"] {
    return this.state
  }

  private persistToStorage(): void {
    if (!this.storage) return
    try {
      const data = JSON.stringify({
        sessionId: this.sessionId,
        events: this.events.slice(-500),
        lastState: this.lastState,
        createdAt: this.createdAt,
        state: this.state,
      })
      this.storage.setItem(`${STORAGE_KEY_PREFIX}${this.sessionId}`, data)
    } catch {
      // Storage full or unavailable — graceful degradation
    }
  }

  private loadFromStorage(): void {
    if (!this.storage) return
    try {
      const raw = this.storage.getItem(`${STORAGE_KEY_PREFIX}${this.sessionId}`)
      if (!raw) return
      const data = JSON.parse(raw)
      this.events = data.events ?? []
      this.lastState = data.lastState ?? "Idle"
      this.createdAt = data.createdAt ?? Date.now()
      this.state = data.state ?? "running"
      this.seq = this.events.length
    } catch {
      // Corrupted data — start fresh
    }
  }

  private removeFromStorage(): void {
    if (this.storage) {
      this.storage.removeItem(`${STORAGE_KEY_PREFIX}${this.sessionId}`)
    }
  }

  static restoreFromStorage(sessionId: string): ExecutionSnapshot | null {
    if (typeof localStorage === "undefined") return null
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`)
      if (!raw) return null
      const data = JSON.parse(raw)
      return {
        sessionId: data.sessionId,
        events: data.events ?? [],
        lastState: data.lastState ?? "Idle",
        createdAt: data.createdAt ?? Date.now(),
        lastUpdated: Date.now(),
        state: data.state ?? "orphaned",
      }
    } catch {
      return null
    }
  }

  static restoreAllFromStorage(): ExecutionSnapshot[] {
    if (typeof localStorage === "undefined") return []
    const snapshots: ExecutionSnapshot[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const sessionId = key.slice(STORAGE_KEY_PREFIX.length)
        const snap = PersistentExecutionStore.restoreFromStorage(sessionId)
        if (snap) snapshots.push(snap)
      }
    }
    return snapshots
  }

  static clearAllStorage(): void {
    if (typeof localStorage === "undefined") return
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  }
}
