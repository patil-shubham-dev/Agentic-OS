import { EventBus } from "../EventBus"
import { ExecutionSession } from "./ExecutionSession"
import { PersistentExecutionStore } from "./PersistentExecutionStore"
import type { SessionDescriptor, SessionStatus } from "./ExecutionSession"
import type { RuntimeEvent } from "../RuntimeTypes"
import { useSessionHistoryStore, type SessionHistoryEntry } from "@/lib/history"
import { useTimelineStore } from "@/components/workspace/timeline/timeline-store"

/** Safely map a session status to a history-compatible status */
function toHistoryStatus(status: string): "completed" | "halted" | "orphaned" | "cancelled" {
  if (status === "completed" || status === "halted" || status === "orphaned" || status === "cancelled") {
    return status
  }
  // Running / idle sessions are treated as orphaned when archived
  return "orphaned"
}

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
    // Archive orphaned sessions to History instead of re-activating them
    this.archiveOrphanedSessions()
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
      // Auto-archive to history before destroying
      this.archiveToHistory(session)
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
      this.archiveToHistory(session)
      session.cleanup()
    }
    this.sessions.clear()
    this.activeSessionId = null
    // Clear persisted execution state so next boot starts fresh
    PersistentExecutionStore.clearAllStorage()
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

  /** Archive a session to the history store before removal */
  private archiveToHistory(session: ExecutionSession): void {
    try {
      const desc = session.getDescriptor()
      useSessionHistoryStore.getState().archiveSession({
        sessionId: desc.sessionId,
        label: desc.label,
        status: toHistoryStatus(desc.status),
        state: desc.state,
        createdAt: desc.createdAt,
        lastActivity: desc.lastActivity,
        toolCount: desc.toolCount,
        errorCount: desc.errorCount,
        snapshotRef: `aos_exec_${desc.sessionId}`,
      })
    } catch {
      // Archiving is best-effort
    }
  }

  /** Archive orphaned sessions to history instead of re-activating them (fresh start) */
  private archiveOrphanedSessions(): void {
    // Reset timeline state so no stale agent cards appear on restart
    useTimelineStore.getState().clear()

    const snapshots = PersistentExecutionStore.restoreAllFromStorage()
    for (const snap of snapshots) {
      if (snap.state === "running" || snap.state === "halted" || snap.state === "orphaned") {
        try {
          useSessionHistoryStore.getState().archiveSession({
            sessionId: snap.sessionId,
            label: `Session ${snap.sessionId.slice(0, 6)}`,
            status: toHistoryStatus(snap.state),
            state: snap.lastState,
            createdAt: snap.createdAt,
            lastActivity: snap.lastUpdated,
            toolCount: snap.events.filter((e) =>
              e.event.type === "tool_started" || e.event.type === "tool_completed"
            ).length,
            errorCount: snap.events.filter((e) =>
              e.event.type === "tool_failed" || e.event.type === "execution_error"
            ).length,
            snapshotRef: `aos_exec_${snap.sessionId}`,
          })
        } catch {
          // Best-effort
        }
      }
    }
    // Clear persisted execution store so next boot starts with a truly fresh state
    PersistentExecutionStore.clearAllStorage()
  }
}
