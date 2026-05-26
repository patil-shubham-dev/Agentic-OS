import type {
  RuntimeState,
  RuntimeEvent,
  EventMetadata,
  ExecutionTrace,
} from "./RuntimeTypes"
import { EventBus } from "./EventBus"
import { ExecutionStateMachine } from "./ExecutionStateMachine"
import { TimelineEngine } from "./TimelineEngine"
import { RuntimeQueue, type QueueItem } from "./RuntimeQueue"
import { ToolExecutionManager } from "./ToolExecutionManager"
import { RuntimeCheckpointManager } from "./RuntimeCheckpointManager"
import { LoopDetectionEngine } from "./LoopDetectionEngine"
import { PreflightValidation } from "./PreflightValidation"
import type { PreflightResult } from "./PreflightValidation"
import { ProviderRegistry } from "./ProviderRegistry"

export interface SupervisorConfig {
  maxQueueSize: number
  maxToolRecords: number
  maxCheckpoints: number
  maxTimelineEvents: number
}

const DEFAULT_CONFIG: SupervisorConfig = {
  maxQueueSize: 50,
  maxToolRecords: 100,
  maxCheckpoints: 20,
  maxTimelineEvents: 10000,
}

export class RuntimeSupervisor {
  private config: SupervisorConfig
  private eventBus: EventBus
  readonly stateMachine: ExecutionStateMachine
  readonly timeline: TimelineEngine
  readonly queue: RuntimeQueue
  readonly toolManager: ToolExecutionManager
  readonly checkpointManager: RuntimeCheckpointManager

  private executionCounter = 0
  private eventSequenceCounter = 0
  private agentId: string
  private unsubscribers: (() => void)[] = []
  readonly loopDetector: LoopDetectionEngine
  readonly providerRegistry: ProviderRegistry
  readonly preflight: PreflightValidation

  constructor(agentId: string = "runtime-supervisor", config?: Partial<SupervisorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.agentId = agentId
    this.eventBus = EventBus.getInstance()
    this.stateMachine = new ExecutionStateMachine()
    this.timeline = new TimelineEngine()
    this.queue = new RuntimeQueue(this.config.maxQueueSize)
    this.toolManager = new ToolExecutionManager(this.config.maxToolRecords)
    this.checkpointManager = new RuntimeCheckpointManager(this.config.maxCheckpoints)
    this.loopDetector = new LoopDetectionEngine()
    this.providerRegistry = new ProviderRegistry()
    this.preflight = new PreflightValidation(this.providerRegistry)

    this.setupListeners()
    this.setupLoopDetection()
  }

  private setupListeners(): void {
    this.unsubscribers.push(
      this.stateMachine.subscribe((from, to) => {
        const event: RuntimeEvent = {
          type: "state_transition",
          metadata: this.createMetadata("system"),
          from,
          to,
        }
        this.eventBus.emit(event)
        this.timeline.append(event)
      }),
    )
  }

  private setupLoopDetection(): void {
    this.loopDetector.attach(this.eventBus)
    this.loopDetector.onHaltRequested((reason) => {
      this.halt(reason, `Auto-halt: ${reason}`)
    })
  }

  private createMetadata(source: EventMetadata["source"], agentId?: string, parentExecutionId?: string): EventMetadata {
    this.eventSequenceCounter++
    return {
      timestamp: Date.now(),
      stepIndex: this.executionCounter,
      executionId: `exec_${this.executionCounter}`,
      agentId: agentId ?? this.agentId,
      parentExecutionId: parentExecutionId ?? null,
      source,
      eventSequence: this.eventSequenceCounter,
    }
  }

  startExecution(): boolean {
    const preflight = this.preflight.canExecute()
    if (!preflight.allowed) {
      this.emitEvent({
        type: "execution_error",
        metadata: this.createMetadata("system"),
        error: preflight.reason ?? "Preflight validation failed",
        recoverable: true,
      } as RuntimeEvent)
      return false
    }
    return this.forceStart()
  }

  startWithPreflightResult(): { allowed: boolean; result: PreflightResult | null } {
    const result = this.preflight.validate()
    if (result.passed) {
      this.forceStart()
      return { allowed: true, result }
    }
    return { allowed: false, result }
  }

  private forceStart(): boolean {
    if (!this.stateMachine.transition("Planning")) return false
    this.executionCounter++
    this.eventSequenceCounter = 0
    this.checkpointManager.createCheckpoint(
      this.stateMachine,
      this.timeline,
      this.queue,
      { action: "start_execution", executionId: `exec_${this.executionCounter}` },
    )
    return true
  }

  transitionTo(target: RuntimeState): boolean {
    const checkpointId = this.checkpointManager.createCheckpoint(
      this.stateMachine,
      this.timeline,
      this.queue,
      { action: "transition", from: this.stateMachine.getState(), to: target },
    ).id

    if (!this.stateMachine.transition(target)) {
      this.checkpointManager.removeCheckpoint(checkpointId)
      return false
    }

    return true
  }

  enqueue(item: Omit<QueueItem, "enqueuedAt">): boolean {
    const metadata = this.createMetadata("system")
    this.eventBus.emit({
      type: "agent_message",
      metadata,
      content: `Enqueued: ${item.command}`,
      role: "system",
    } as RuntimeEvent)
    return this.queue.enqueue(item)
  }

  emitEvent(event: Omit<RuntimeEvent, "metadata"> & { metadata?: Partial<EventMetadata> }): void {
    const fullEvent = {
      ...event,
      metadata: { ...this.createMetadata("system"), ...event.metadata },
    } as RuntimeEvent
    this.eventBus.emit(fullEvent)
    this.timeline.append(fullEvent)
  }

  getState(): RuntimeState {
    return this.stateMachine.getState()
  }

  isRunning(): boolean {
    return this.stateMachine.isRunning()
  }

  isTerminal(): boolean {
    return this.stateMachine.isTerminal()
  }

  getTraces(): ExecutionTrace[] {
    const events = this.timeline.getAll()
    const traceMap = new Map<string, ExecutionTrace>()

    for (const event of events) {
      const execId = event.metadata.executionId
      if (!traceMap.has(execId)) {
        traceMap.set(execId, {
          executionId: execId,
          agentId: event.metadata.agentId,
          parentExecutionId: event.metadata.parentExecutionId,
          state: this.stateMachine.getState(),
          startedAt: event.metadata.timestamp,
          completedAt: null,
          events: [],
          errorCount: 0,
          toolCallCount: 0,
        })
      }
      const trace = traceMap.get(execId)!
      trace.events.push(event)
      if (event.type === "tool_completed") trace.toolCallCount++
      if (event.type === "tool_failed") trace.errorCount++
      if (event.type === "execution_error") trace.errorCount++
      if (event.type === "execution_halted") {
        trace.completedAt = event.metadata.timestamp
        trace.state = "Halted"
      }
    }

    if (this.stateMachine.getState() === "Completed" || this.stateMachine.getState() === "Halted") {
      for (const trace of traceMap.values()) {
        if (trace.completedAt === null) {
          trace.completedAt = Date.now()
        }
      }
    }

    return Array.from(traceMap.values())
  }

  complete(): boolean {
    return this.transitionTo("Completed")
  }

  halt(reason: string, reflection: string | null = null): boolean {
    this.forceHaltAll(reason, reflection)
    return this.transitionTo("Halted")
  }

  forceHaltAll(reason: string, reflection: string | null = null): void {
    const metadata = this.createMetadata("system")
    this.eventBus.emit({
      type: "execution_halted",
      metadata,
      reason,
      reflection,
    } as RuntimeEvent)
    this.queue.clear()
    this.loopDetector.reset()
  }

  haltWithError(error: string, recoverable: boolean = false): void {
    const metadata = this.createMetadata("system")
    this.eventBus.emit({
      type: "execution_error",
      metadata,
      error,
      recoverable,
    } as RuntimeEvent)
    this.forceHaltAll(error, null)
    this.stateMachine.transition("Halted")
  }

  reset(): void {
    this.stateMachine.reset()
    this.queue.clear()
    this.toolManager.clear()
    this.loopDetector.reset()
    this.executionCounter = 0
    this.eventSequenceCounter = 0
  }

  resetAll(): void {
    this.reset()
    this.timeline.clear()
    this.checkpointManager.clearCheckpoints()
  }

  snapshot(): {
    stateMachine: ReturnType<ExecutionStateMachine["snapshot"]>
    timelineCheckpoint: number
    queue: ReturnType<RuntimeQueue["snapshot"]>
    tools: ReturnType<ToolExecutionManager["snapshot"]>
    checkpoints: ReturnType<RuntimeCheckpointManager["snapshot"]>
  } {
    return {
      stateMachine: this.stateMachine.snapshot(),
      timelineCheckpoint: this.timeline.getCheckpoint(),
      queue: this.queue.snapshot(),
      tools: this.toolManager.snapshot(),
      checkpoints: this.checkpointManager.snapshot(),
    }
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
  }
}
