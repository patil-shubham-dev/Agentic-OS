import {
  type ActorDefinition,
  type ActorMailbox,
  type ActorMessage,
  type ActorStatus,
  type SupervisorStrategy,
} from "../observability/ObservabilityTypes"
import type { RuntimeRole } from "@/types"
import { TracePipeline } from "../telemetry/TracePipeline"
import { generateTraceId, generateSpanId } from "../telemetry/TraceTypes"

/**
 * Actor-Based Agent Runtime — refactors the current async-generator agent
 * system into actor-based orchestration with mailboxes, supervision,
 * lifecycle management, and message passing.
 *
 * **Light scaffold**: types + basic actor registry + mailbox management.
 *
 * Full implementation should add:
 *  - Actor lifecycle (spawn, suspend, resume, stop)
 *  - Mailbox with priority queue
 *  - Message passing with channels
 *  - Supervision tree with restart strategies
 *  - Actor scheduling with work stealing
 *  - Cancellation propagation
 *  - No shared mutable runtime state
 *
 * Concrete actors to implement:
 *  - SupervisorActor
 *  - ManagerActor
 *  - CoderActor
 *  - QAActor
 *  - ResearchActor
 *  - DesignActor
 *  - BrowserActor
 */
export class ActorSystem {
  private static instance: ActorSystem
  private pipeline = TracePipeline.getInstance()
  private actors = new Map<string, ActorDefinition>()
  private mailboxes = new Map<string, ActorMessage[]>()
  private processedCount = new Map<string, number>()
  private supervisorStrategy: SupervisorStrategy = "one_for_one"
  private maxActors = 50

  private constructor() {}

  static getInstance(): ActorSystem {
    if (!ActorSystem.instance) {
      ActorSystem.instance = new ActorSystem()
    }
    return ActorSystem.instance
  }

  // ── Actor Registration ──

  registerActor(actor: ActorDefinition): void {
    this.actors.set(actor.id, actor)
    this.mailboxes.set(actor.id, [])
    this.processedCount.set(actor.id, 0)

    if (this.actors.size > this.maxActors) {
      const oldest = Array.from(this.actors.entries())
        .sort(([, a], [, b]) => a.mailbox.processed - b.mailbox.processed)[0]
      if (oldest) this.unregisterActor(oldest[0])
    }

    this.pipeline.emit({
      type: "actor_registered",
      traceId: generateTraceId(),
      spanId: actor.id,
      parentSpanId: null,
      timestamp: performance.now(),
      priority: "normal",
      runtimePhase: "orchestration",
      source: "actor-system",
      payload: { actorId: actor.id, role: actor.role, name: actor.name },
      metadata: { lifecycle: actor.lifecycle },
    })
  }

  unregisterActor(actorId: string): void {
    const actor = this.actors.get(actorId)
    if (!actor) return

    actor.status = "stopped"
    this.mailboxes.delete(actorId)
    this.actors.delete(actorId)
    this.processedCount.delete(actorId)
  }

  // ── Mailbox ──

  sendMessage(message: ActorMessage): void {
    const mailbox = this.mailboxes.get(message.to)
    if (!mailbox) {
      console.warn(`[ActorSystem] No mailbox for actor "${message.to}"`)
      return
    }

    mailbox.push(message)
    const def = this.actors.get(message.to)
    if (def) {
      def.mailbox.backlog = mailbox.length
    }
  }

  receiveMessage(actorId: string): ActorMessage | undefined {
    const mailbox = this.mailboxes.get(actorId)
    if (!mailbox || mailbox.length === 0) return undefined

    // Sort by priority then timestamp
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    mailbox.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 1
      const pb = priorityOrder[b.priority] ?? 1
      return pa - pb || a.timestamp - b.timestamp
    })

    const message = mailbox.shift()
    if (message) {
      const def = this.actors.get(actorId)
      if (def) {
        def.mailbox.backlog = mailbox.length
        def.mailbox.processed++
      }
      this.processedCount.set(actorId, (this.processedCount.get(actorId) ?? 0) + 1)
    }

    return message
  }

  getMailboxLength(actorId: string): number {
    return this.mailboxes.get(actorId)?.length ?? 0
  }

  getTotalBacklog(): number {
    let total = 0
    for (const mailbox of this.mailboxes.values()) {
      total += mailbox.length
    }
    return total
  }

  // ── Status ──

  setActorStatus(actorId: string, status: ActorStatus): void {
    const actor = this.actors.get(actorId)
    if (actor) {
      actor.status = status
    }
  }

  getActor(actorId: string): ActorDefinition | undefined {
    return this.actors.get(actorId)
  }

  getActorsByRole(role: RuntimeRole): ActorDefinition[] {
    return Array.from(this.actors.values()).filter((a) => a.role === role)
  }

  getActiveActors(): ActorDefinition[] {
    return Array.from(this.actors.values()).filter((a) => a.status === "running")
  }

  getAllActors(): ActorDefinition[] {
    return Array.from(this.actors.values())
  }

  getActorCount(): number {
    return this.actors.size
  }

  // ── Supervision ──

  setSupervisorStrategy(strategy: SupervisorStrategy): void {
    this.supervisorStrategy = strategy
  }

  getSupervisorStrategy(): SupervisorStrategy {
    return this.supervisorStrategy
  }

  onActorCrash(actorId: string, error: Error): void {
    const actor = this.actors.get(actorId)
    if (!actor) return

    actor.status = "crashed"

    this.pipeline.emit({
      type: "actor_crashed",
      traceId: generateTraceId(),
      spanId: actorId,
      parentSpanId: null,
      timestamp: performance.now(),
      priority: "high",
      runtimePhase: "orchestration",
      source: "actor-system",
      payload: { actorId, error: error.message },
      metadata: { role: actor.role, restartStrategy: actor.restartStrategy },
    })

    if (actor.restartStrategy === "always" || actor.restartStrategy === "on_failure") {
      actor.status = "idle"
      // Full implementation: re-spawn actor with new mailbox
    }

    if (this.supervisorStrategy === "one_for_all") {
      // Stop all siblings
      for (const [id, def] of this.actors) {
        if (id !== actorId && def.status === "running") {
          def.status = "suspended"
        }
      }
    }
  }

  // ── Maintenance ──

  reset(): void {
    this.actors.clear()
    this.mailboxes.clear()
    this.processedCount.clear()
  }
}
