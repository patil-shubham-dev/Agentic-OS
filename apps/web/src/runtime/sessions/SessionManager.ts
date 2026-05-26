import { EventBus } from "../EventBus"
import { ExecutionSession } from "./ExecutionSession"
import { PersistentExecutionStore } from "./PersistentExecutionStore"
import type { SessionDescriptor, SessionStatus } from "./ExecutionSession"
import type { RuntimeEvent } from "../RuntimeTypes"

type SessionChangeCallback = (sessions: SessionDescriptor[]) => void

export class SessionManager {
  private sessions = new Map<string, ExecutionSession>()
  private listeners = new Set<SessionChangeCallback>()
  private activeSessionId: string | null = null
  private static instance: SessionManager
  private bus = EventBus.getInstance()

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  private constructor() {
    this.restoreOrphanedSessions()
    if (typeof globalThis !== "undefined") {
      (globalThis as any).__sessionManager = this
    }
  }

  create(label: string = "Execution"): ExecutionSession {
    const session = new ExecutionSession(label)
    this.sessions.set(session.sessionId, session)
    this.activeSessionId = session.sessionId
    this.notify()
    return session
  }

  get(sessionId: string): ExecutionSession | undefined {
    return this.sessions.get(sessionId)
  }

  getActive(): ExecutionSession | undefined {
    if (this.activeSessionId) {
      return this.sessions.get(this.activeSessionId)
    }
    return undefined
  }

  setActive(sessionId: string): void {
    this.activeSessionId = sessionId
    this.notify()
  }

  list(): SessionDescriptor[] {
    return Array.from(this.sessions.values()).map((s) => s.getDescriptor())
  }

  listRunning(): SessionDescriptor[] {
    return this.list().filter((d) => d.status === "running")
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.cleanup()
      this.sessions.delete(sessionId)
    }
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null
    }
    this.notify()
  }

  destroyAll(): void {
    for (const session of this.sessions.values()) {
      session.cleanup()
    }
    this.sessions.clear()
    this.activeSessionId = null
    this.notify()
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId
  }

  subscribe(callback: SessionChangeCallback): () => void {
    this.listeners.add(callback)
    callback(this.list())
    return () => {
      this.listeners.delete(callback)
    }
  }

  getCount(): number {
    return this.sessions.size
  }

  private notify(): void {
    const descriptors = this.list()
    for (const cb of this.listeners) {
      try { cb(descriptors) } catch { /* drop dead listeners */ }
    }
  }

  private restoreOrphanedSessions(): void {
    const snapshots = PersistentExecutionStore.restoreAllFromStorage()
    for (const snap of snapshots) {
      if (snap.state === "running" || snap.state === "halted") {
        const session = new ExecutionSession(
          `Restored #${snap.sessionId.slice(0, 6)}`,
          undefined,
          snap.sessionId,
        )
        this.sessions.set(session.sessionId, session)
      }
    }
    if (this.sessions.size > 0) {
      this.activeSessionId = Array.from(this.sessions.keys())[0]
    }
  }
}
