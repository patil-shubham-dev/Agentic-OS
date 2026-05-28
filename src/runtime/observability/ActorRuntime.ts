import {
  type ActorDefinition,
  type ActorMessage,
  type ActorMailbox,
  type ActorStatus,
  type SupervisorStrategy,
} from "./ObservabilityTypes"
import type { RuntimeRole } from "@/types"
import { TracePipeline } from "../telemetry/TracePipeline"
import { generateTraceId, generateSpanId } from "../telemetry/TraceTypes"

// ── Extended Types ──

export interface ActorSnapshot {
  actors: ActorDefinition[]
  supervisor: {
    strategy: SupervisorStrategy
    maxRestarts: number
    windowMs: number
    children: string[]
  }
  stats: {
    totalActors: number
    running: number
    idle: number
    suspended: number
    stopped: number
    crashed: number
    totalMessagesProcessed: number
    totalMessagesQueued: number
    avgProcessingTime: number
  }
  timestamp: number
}

export interface ActorEvent {
  actorId: string
  type: "registered" | "started" | "completed" | "suspended" | "resumed" | "crashed" | "restarted" | "stopped" | "message_sent" | "message_received" | "message_processed"
  timestamp: number
  details: string
}

// ── Engine ──

export class ActorRuntime {
  private static instance: ActorRuntime
  private pipeline = TracePipeline.getInstance()
  private actors = new Map<string, ActorDefinition>()
  private events: ActorEvent[] = []
  private supervisor: {
    strategy: SupervisorStrategy
    maxRestarts: number
    windowMs: number
    restartCounts: Map<string, { count: number; windowStart: number }>
    children: string[]
  }
  private messageCounter = 0
  private maxActors = 100
  private maxEvents = 500
  private totalProcessingTime = 0
  private processedCount = 0

  private constructor() {
    this.supervisor = {
      strategy: "one_for_one",
      maxRestarts: 3,
      windowMs: 60000,
      restartCounts: new Map(),
      children: [],
    }
  }

  static getInstance(): ActorRuntime {
    if (!ActorRuntime.instance) {
      ActorRuntime.instance = new ActorRuntime()
    }
    return ActorRuntime.instance
  }

  // ── Actor Registration ──

  registerActor(
    id: string,
    name: string,
    role: RuntimeRole,
    lifecycle: ActorDefinition["lifecycle"] = "transient",
    restartStrategy: ActorDefinition["restartStrategy"] = "on_failure",
    dependencies: string[] = [],
  ): ActorDefinition {
    const actor: ActorDefinition = {
      id,
      name,
      role,
      status: "idle",
      mailbox: {
        actorId: id,
        messages: [],
        backlog: 0,
        processed: 0,
      },
      lifecycle,
      restartStrategy,
      dependencies,
    }

    this.actors.set(id, actor)
    if (!this.supervisor.children.includes(id)) {
      this.supervisor.children.push(id)
    }

    this.recordEvent(id, "registered", `Actor '${name}' registered with ${lifecycle} lifecycle`)

    this.pipeline.emit({
      type: "actor_registered",
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: null,
      timestamp: Date.now(),
      priority: "low",
      runtimePhase: "actor",
      source: "actor-runtime",
      payload: actor,
      metadata: { role },
    })

    return actor
  }

  unregisterActor(id: string): void {
    this.actors.delete(id)
    this.supervisor.children = this.supervisor.children.filter((c) => c !== id)
    this.recordEvent(id, "stopped", `Actor unregistered`)
  }

  // ── Status Management ──

  setStatus(id: string, status: ActorStatus): void {
    const actor = this.actors.get(id)
    if (!actor) return
    actor.status = status
    this.actors.set(id, actor)

    const eventType: ActorEvent["type"] =
      status === "running" ? "started" :
      status === "idle" ? "completed" :
      status === "suspended" ? "suspended" :
      status === "crashed" ? "crashed" :
      "stopped"

    this.recordEvent(id, eventType, `Status changed to ${status}`)

    this.pipeline.emit({
      type: "actor_status_changed",
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: null,
      timestamp: Date.now(),
      priority: "normal",
      runtimePhase: "actor",
      source: "actor-runtime",
      payload: { actorId: id, status },
      metadata: {},
    })
  }

  // ── Message System ──

  sendMessage(
    from: string,
    to: string,
    type: string,
    payload: unknown,
    priority: ActorMessage["priority"] = "normal",
    correlationId: string | null = null,
  ): ActorMessage | null {
    const toActor = this.actors.get(to)
    if (!toActor) return null

    this.messageCounter++
    const message: ActorMessage = {
      id: `msg_${this.messageCounter}_${Date.now().toString(36)}`,
      from,
      to,
      type,
      payload,
      timestamp: Date.now(),
      correlationId,
      priority,
    }

    toActor.mailbox.messages.push(message)
    toActor.mailbox.backlog = toActor.mailbox.messages.length
    this.actors.set(to, toActor)

    this.recordEvent(to, "message_received", `Message '${type}' from ${from}`)
    this.recordEvent(from, "message_sent", `Message '${type}' to ${to}`)

    this.pipeline.emit({
      type: "actor_message_sent",
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: null,
      timestamp: message.timestamp,
      priority: priority === "high" ? "high" : "normal",
      runtimePhase: "actor",
      source: "actor-runtime",
      payload: message,
      metadata: { from, to, messageType: type },
    })

    return message
  }

  processMessage(id: string, durationMs: number): ActorMessage | null {
    const actor = this.actors.get(id)
    if (!actor || actor.mailbox.messages.length === 0) return null

    // Sort by priority (high first), then by timestamp
    const sorted = [...actor.mailbox.messages].sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 }
      const pDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
      if (pDiff !== 0) return pDiff
      return a.timestamp - b.timestamp
    })

    const message = sorted[0]
    actor.mailbox.messages = actor.mailbox.messages.filter((m) => m.id !== message.id)
    actor.mailbox.processed++
    actor.mailbox.backlog = actor.mailbox.messages.length
    this.actors.set(id, actor)

    this.totalProcessingTime += durationMs
    this.processedCount++

    this.recordEvent(id, "message_processed", `Processed '${message.type}' in ${durationMs}ms`)

    return message
  }

  getMailbox(id: string): ActorMailbox | undefined {
    return this.actors.get(id)?.mailbox
  }

  getMessages(id: string, limit = 50): ActorMessage[] {
    const actor = this.actors.get(id)
    if (!actor) return []
    return actor.mailbox.messages.slice(-limit)
  }

  // ── Supervisor ──

  setSupervisorStrategy(strategy: SupervisorStrategy): void {
    this.supervisor.strategy = strategy
  }

  handleCrash(actorId: string): boolean {
    const actor = this.actors.get(actorId)
    if (!actor) return false

    // Check restart limits
    const restartInfo = this.supervisor.restartCounts.get(actorId) ?? { count: 0, windowStart: Date.now() }

    if (Date.now() - restartInfo.windowStart > this.supervisor.windowMs) {
      restartInfo.count = 0
      restartInfo.windowStart = Date.now()
    }

    restartInfo.count++
    this.supervisor.restartCounts.set(actorId, restartInfo)

    if (restartInfo.count > this.supervisor.maxRestarts) {
      actor.status = "crashed"
      this.actors.set(actorId, actor)
      this.recordEvent(actorId, "crashed", `Exceeded max restarts (${this.supervisor.maxRestarts})`)
      return false
    }

    // Apply supervisor strategy
    if (this.supervisor.strategy === "one_for_all" || this.supervisor.strategy === "rest_for_one") {
      const idx = this.supervisor.children.indexOf(actorId)
      if (this.supervisor.strategy === "rest_for_one") {
        // Restart this actor and all after it
        for (let i = idx; i < this.supervisor.children.length; i++) {
          const childId = this.supervisor.children[i]
          this.restartActor(childId)
        }
      } else {
        // Restart all children
        for (const childId of this.supervisor.children) {
          this.restartActor(childId)
        }
      }
    } else {
      // one_for_one: restart just this actor
      this.restartActor(actorId)
    }

    return true
  }

  private restartActor(actorId: string): void {
    const actor = this.actors.get(actorId)
    if (!actor) return
    actor.status = "idle"
    actor.mailbox.messages = []
    actor.mailbox.backlog = 0
    this.actors.set(actorId, actor)
    this.recordEvent(actorId, "restarted", `Actor restarted by supervisor`)
  }

  // ── Event Recording ──

  private recordEvent(actorId: string, type: ActorEvent["type"], details: string): void {
    this.events.push({ actorId, type, timestamp: Date.now(), details })
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }
  }

  // ── Query ──

  getActor(id: string): ActorDefinition | undefined {
    return this.actors.get(id)
  }

  getActorByName(name: string): ActorDefinition | undefined {
    return Array.from(this.actors.values()).find((a) => a.name === name)
  }

  getActorsByRole(role: RuntimeRole): ActorDefinition[] {
    return Array.from(this.actors.values()).filter((a) => a.role === role)
  }

  getActorsByStatus(status: ActorStatus): ActorDefinition[] {
    return Array.from(this.actors.values()).filter((a) => a.status === status)
  }

  getAllActors(): ActorDefinition[] {
    return Array.from(this.actors.values())
  }

  getEvents(actorId?: string, limit = 50): ActorEvent[] {
    const allEvents = actorId
      ? this.events.filter((e) => e.actorId === actorId)
      : [...this.events]
    return allEvents.slice(-limit).reverse()
  }

  getSupervisorInfo() {
    return { ...this.supervisor, restartCounts: Array.from(this.supervisor.restartCounts.entries()) }
  }

  // ── Statistics ──

  snapshot(): ActorSnapshot {
    const allActors = this.getAllActors()
    const running = allActors.filter((a) => a.status === "running").length
    const idle = allActors.filter((a) => a.status === "idle").length
    const suspended = allActors.filter((a) => a.status === "suspended").length
    const stopped = allActors.filter((a) => a.status === "stopped").length
    const crashed = allActors.filter((a) => a.status === "crashed").length
    const totalMessagesQueued = allActors.reduce((sum, a) => sum + a.mailbox.backlog, 0)
    const totalMessagesProcessed = allActors.reduce((sum, a) => sum + a.mailbox.processed, 0)

    return {
      actors: allActors,
      supervisor: {
        strategy: this.supervisor.strategy,
        maxRestarts: this.supervisor.maxRestarts,
        windowMs: this.supervisor.windowMs,
        children: [...this.supervisor.children],
      },
      stats: {
        totalActors: allActors.length,
        running,
        idle,
        suspended,
        stopped,
        crashed,
        totalMessagesProcessed,
        totalMessagesQueued,
        avgProcessingTime: this.processedCount > 0
          ? this.totalProcessingTime / this.processedCount
          : 0,
      },
      timestamp: Date.now(),
    }
  }

  getActorCount(): number {
    return this.actors.size
  }

  // ── Maintenance ──

  clear(): void {
    this.actors.clear()
    this.events = []
    this.supervisor.children = []
    this.supervisor.restartCounts.clear()
    this.messageCounter = 0
    this.totalProcessingTime = 0
    this.processedCount = 0
  }
}
