import type { RuntimeState } from "./RuntimeTypes"
import { isValidTransition } from "./RuntimeTypes"

export interface StateMachineSnapshot {
  state: RuntimeState
  startedAt: number
  completedAt: number | null
  totalTransitions: number
  errorCount: number
}

export type StateTransitionListener = (from: RuntimeState, to: RuntimeState) => void

export class ExecutionStateMachine {
  private state: RuntimeState = "Idle"
  private startedAt: number = 0
  private completedAt: number | null = null
  private totalTransitions: number = 0
  private errorCount: number = 0
  private listeners: Set<StateTransitionListener> = new Set()

  getState(): RuntimeState {
    return this.state
  }

  transition(target: RuntimeState): boolean {
    const from = this.state
    if (!isValidTransition(from, target)) {
      this.errorCount++
      return false
    }

    this.state = target
    this.totalTransitions++

    if (this.totalTransitions === 1) {
      this.startedAt = Date.now()
    }

    if (target === "Completed" || target === "Halted") {
      this.completedAt = Date.now()
    }

    for (const listener of this.listeners) {
      try {
        listener(from, target)
      } catch {
        // listener error silently swallowed
      }
    }

    return true
  }

  reset(): void {
    this.state = "Idle"
    this.startedAt = 0
    this.completedAt = null
    this.totalTransitions = 0
    this.errorCount = 0
  }

  subscribe(listener: StateTransitionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  snapshot(): StateMachineSnapshot {
    return {
      state: this.state,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      totalTransitions: this.totalTransitions,
      errorCount: this.errorCount,
    }
  }

  restore(snapshot: StateMachineSnapshot): void {
    this.state = snapshot.state
    this.startedAt = snapshot.startedAt
    this.completedAt = snapshot.completedAt
    this.totalTransitions = snapshot.totalTransitions
    this.errorCount = snapshot.errorCount
  }

  isTerminal(): boolean {
    return this.state === "Completed" || this.state === "Halted"
  }

  isRunning(): boolean {
    return !this.isTerminal() && this.state !== "Idle"
  }

  elapsed(): number {
    if (this.completedAt !== null) {
      return this.completedAt - this.startedAt
    }
    return this.startedAt > 0 ? Date.now() - this.startedAt : 0
  }
}
