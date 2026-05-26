import type { RuntimeState } from "./RuntimeTypes"
import { ExecutionStateMachine } from "./ExecutionStateMachine"
import { TimelineEngine } from "./TimelineEngine"
import { RuntimeQueue } from "./RuntimeQueue"

export interface RuntimeCheckpoint {
  id: string
  timestamp: number
  stateMachine: ReturnType<ExecutionStateMachine["snapshot"]>
  timelineCheckpoint: number
  queueItems: ReturnType<RuntimeQueue["snapshot"]>
  metadata: Record<string, unknown>
}

export class RuntimeCheckpointManager {
  private checkpoints: RuntimeCheckpoint[] = []
  private maxCheckpoints: number

  constructor(maxCheckpoints: number = 20) {
    this.maxCheckpoints = maxCheckpoints
  }

  createCheckpoint(
    stateMachine: ExecutionStateMachine,
    timeline: TimelineEngine,
    queue: RuntimeQueue,
    metadata: Record<string, unknown> = {},
  ): RuntimeCheckpoint {
    const checkpoint: RuntimeCheckpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      stateMachine: stateMachine.snapshot(),
      timelineCheckpoint: timeline.getCheckpoint(),
      queueItems: queue.snapshot(),
      metadata,
    }

    this.checkpoints.push(checkpoint)
    this.evictOld()

    return checkpoint
  }

  restoreCheckpoint(
    id: string,
    stateMachine: ExecutionStateMachine,
    timeline: TimelineEngine,
    queue: RuntimeQueue,
  ): boolean {
    const checkpoint = this.checkpoints.find((c) => c.id === id)
    if (!checkpoint) return false

    stateMachine.restore(checkpoint.stateMachine)
    timeline.rollbackToCheckpoint(checkpoint.timelineCheckpoint)
    queue.restore(checkpoint.queueItems)

    return true
  }

  restoreLatest(
    stateMachine: ExecutionStateMachine,
    timeline: TimelineEngine,
    queue: RuntimeQueue,
  ): boolean {
    if (this.checkpoints.length === 0) return false
    const latest = this.checkpoints[this.checkpoints.length - 1]
    return this.restoreCheckpoint(latest.id, stateMachine, timeline, queue)
  }

  getCheckpoints(): RuntimeCheckpoint[] {
    return [...this.checkpoints]
  }

  getCheckpoint(id: string): RuntimeCheckpoint | null {
    return this.checkpoints.find((c) => c.id === id) ?? null
  }

  clearCheckpoints(): void {
    this.checkpoints = []
  }

  removeCheckpoint(id: string): boolean {
    const index = this.checkpoints.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.checkpoints.splice(index, 1)
      return true
    }
    return false
  }

  getLatestCheckpoint(): RuntimeCheckpoint | null {
    return this.checkpoints[this.checkpoints.length - 1] ?? null
  }

  snapshot(): RuntimeCheckpoint[] {
    return [...this.checkpoints]
  }

  restore(checkpoints: RuntimeCheckpoint[]): void {
    this.checkpoints = [...checkpoints]
  }

  private evictOld(): void {
    if (this.checkpoints.length <= this.maxCheckpoints) return
    this.checkpoints = this.checkpoints.slice(-this.maxCheckpoints)
  }
}
