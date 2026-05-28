function uuid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`
}
import { EventBus } from "../EventBus"
import { RuntimeSupervisor } from "../RuntimeSupervisor"
import { PersistentExecutionStore } from "./PersistentExecutionStore"
import { StreamMultiplexer } from "../StreamMultiplexer"
import type { RuntimeState, RuntimeEvent } from "../RuntimeTypes"
import type { ProviderRegistry } from "../ProviderRegistry"

export type SessionStatus = "idle" | "running" | "completed" | "halted" | "orphaned"

export interface SessionDescriptor {
  sessionId: string
  label: string
  status: SessionStatus
  state: RuntimeState
  createdAt: number
  lastActivity: number
  toolCount: number
  errorCount: number
}

export class ExecutionSession {
  readonly sessionId: string
  readonly createdAt: number
  readonly label: string
  readonly supervisor: RuntimeSupervisor
  readonly eventStore: PersistentExecutionStore
  readonly streamMux: StreamMultiplexer

  private eventStoreUnsub: (() => void) | null = null
  private bus = EventBus.getInstance()

  constructor(label: string, supervisor?: RuntimeSupervisor, sessionId?: string) {
    this.sessionId = sessionId ?? uuid()
    this.createdAt = Date.now()
    this.label = label
    this.supervisor = supervisor ?? new RuntimeSupervisor(`session-${this.sessionId}`)
    this.eventStore = new PersistentExecutionStore(this.sessionId)
    this.streamMux = StreamMultiplexer.getInstance()

    this.attachEventStore()
  }

  private attachEventStore(): void {
    const bus = EventBus.getInstance()
    const types: RuntimeEvent["type"][] = [
      "state_transition", "tool_requested", "tool_started", "tool_stream",
      "tool_completed", "tool_failed", "stream_delta", "agent_message",
      "verification_started", "verification_completed", "repair_attempted",
      "repair_failed", "repair_resolved", "execution_error", "execution_halted",
    ]
    const unsubs: (() => void)[] = []
    for (const type of types) {
      unsubs.push(bus.on(type, (event: RuntimeEvent) => {
        this.eventStore.append(event)
      }))
    }
    this.eventStoreUnsub = () => {
      for (const u of unsubs) u()
    }
  }

  start(): boolean {
    if (this.supervisor.isRunning()) return false
    this.streamMux.initialize()
    return this.supervisor.startWithPreflightResult().allowed
  }

  halt(reason: string): void {
    this.supervisor.halt(reason)
  }

  getDescriptor(): SessionDescriptor {
    const ev = this.supervisor
    const snapshot = this.eventStore.getSnapshot()
    const toolCount = snapshot.events.filter((e) =>
      e.event.type === "tool_started" || e.event.type === "tool_completed"
    ).length
    const errorCount = snapshot.events.filter((e) =>
      e.event.type === "tool_failed" || e.event.type === "execution_error"
    ).length

    return {
      sessionId: this.sessionId,
      label: this.label,
      status: snapshot.state as SessionStatus,
      state: snapshot.lastState,
      createdAt: this.createdAt,
      lastActivity: Date.now(),
      toolCount,
      errorCount,
    }
  }

  getState(): RuntimeState {
    return this.supervisor.getState()
  }

  isRunning(): boolean {
    return this.supervisor.isRunning()
  }

  getProviderRegistry(): ProviderRegistry {
    return this.supervisor.providerRegistry
  }

  cleanup(): void {
    this.eventStoreUnsub?.()
    this.eventStoreUnsub = null
    this.eventStore.markOrphaned()
    this.supervisor.destroy()
  }
}
