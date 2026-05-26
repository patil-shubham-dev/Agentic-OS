/**
 * Execution Engine — the real state machine for the Agentic-OS execution pipeline.
 *
 * States:
 *   IDLE → PLANNING → ROUTING → EXECUTING → STREAMING → WAITING_APPROVAL
 *                                                    → TESTING → ROLLBACK
 *   Any state → ERROR
 *   Any terminal → COMPLETE
 *
 * The engine emits events on every transition so the UI can react.
 * No fake transitions, no hardcoded timeouts pretending to be work.
 */

export type ExecutionState =
  | "IDLE"
  | "PLANNING"
  | "ROUTING"
  | "EXECUTING"
  | "STREAMING"
  | "WAITING_APPROVAL"
  | "TESTING"
  | "ROLLBACK"
  | "ERROR"
  | "COMPLETE"

export type ExecutionEventType =
  | "TASK_RECEIVED"
  | "INTENT_CLASSIFIED"
  | "ROLES_SELECTED"
  | "DELEGATION_START"
  | "DELEGATION_COMPLETE"
  | "STREAM_TOKEN"
  | "STREAM_DONE"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "TESTS_PASSED"
  | "TESTS_FAILED"
  | "ROLLBACK_STARTED"
  | "ROLLBACK_COMPLETE"
  | "ERROR_OCCURRED"
  | "CANCELLED"
  | "COMPLETED"

export interface ExecutionEvent {
  type: ExecutionEventType
  timestamp: number
  role?: string
  model?: string
  provider?: string
  message?: string
  durationMs?: number
  tokenCount?: number
  toolCalls?: number
  error?: string
  /** Structured metadata for the debug panel */
  metadata?: Record<string, unknown>
}

export type ExecutionEventListener = (event: ExecutionEvent) => void

/** Valid transitions from each state */
const VALID_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  IDLE:            ["PLANNING"],
  PLANNING:        ["ROUTING", "ERROR"],
  ROUTING:         ["EXECUTING", "ERROR", "COMPLETE"],
  EXECUTING:       ["STREAMING", "WAITING_APPROVAL", "ERROR"],
  STREAMING:       ["EXECUTING", "WAITING_APPROVAL", "TESTING", "COMPLETE", "ERROR"],
  WAITING_APPROVAL: ["EXECUTING", "ROLLBACK", "COMPLETE", "ERROR"],
  TESTING:         ["COMPLETE", "ROLLBACK", "EXECUTING", "ERROR"],
  ROLLBACK:        ["COMPLETE", "ERROR"],
  ERROR:           ["IDLE", "PLANNING"],
  COMPLETE:        ["IDLE", "PLANNING"],
}

export interface ExecutionTrace {
  id: string
  state: ExecutionState
  startedAt: number
  endedAt?: number
  events: ExecutionEvent[]
  currentRole?: string
  currentModel?: string
  currentProvider?: string
  tokenUsage: number
  toolCallCount: number
  errorCount: number
}

export interface ExecutionEngineState {
  state: ExecutionState
  trace: ExecutionTrace | null
  history: ExecutionTrace[]
}

/**
 * ExecutionEngine — single-instance state machine for the runtime.
 */
export class ExecutionEngine {
  private state: ExecutionState = "IDLE"
  private trace: ExecutionTrace | null = null
  private history: ExecutionTrace[] = []
  private listeners: Set<ExecutionEventListener> = new Set()

  // ── Listeners ──

  subscribe(listener: ExecutionEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: ExecutionEvent): void {
    if (this.trace) {
      this.trace.events.push(event)
    }
    for (const listener of this.listeners) {
      try { listener(event) } catch (e) {
        console.error("[ExecutionEngine] listener error:", e)
      }
    }
  }

  // ── State Transitions ──

  getState(): ExecutionState {
    return this.state
  }

  getTrace(): ExecutionTrace | null {
    return this.trace
  }

  getHistory(): ExecutionTrace[] {
    return [...this.history]
  }

  private transition(target: ExecutionState, event: ExecutionEvent): void {
    const valid = VALID_TRANSITIONS[this.state]
    if (!valid.includes(target)) {
      const msg = `Illegal transition: ${this.state} → ${target}. Valid: [${valid.join(", ")}]`
      console.error(`[ExecutionEngine] ${msg}`)
      this.emit({
        type: "ERROR_OCCURRED",
        timestamp: Date.now(),
        error: msg,
        metadata: { fromState: this.state, targetState: target },
      })
      if (this.state !== "ERROR") {
        this.state = "ERROR"
        this.emit({ type: "ERROR_OCCURRED", timestamp: Date.now(), error: msg })
        if (this.trace) {
          this.trace.state = "ERROR"
          this.trace.endedAt = Date.now()
          this.trace.errorCount++
        }
      }
      return
    }

    const prev = this.state
    this.state = target
    console.log(
      `[ExecutionEngine] ${prev} → ${target}` +
      (event.role ? ` (role=${event.role})` : "") +
      (event.model ? ` model=${event.model}` : "") +
      (event.durationMs ? ` ${event.durationMs}ms` : ""),
    )
    this.emit(event)

    // Update trace
    if (this.trace) {
      this.trace.state = target
    }

    // Terminal states
    if (target === "COMPLETE") {
      this.finalize()
    }
  }

  private finalize(): void {
    if (this.trace) {
      this.trace.endedAt = Date.now()
      this.trace.state = "COMPLETE"
      this.history.push(this.trace)
    }
    this.trace = null
  }

  // ── Public API ──

  startTask(taskId: string): void {
    this.transition("PLANNING", {
      type: "TASK_RECEIVED",
      timestamp: Date.now(),
      metadata: { taskId },
    })
    this.trace = {
      id: taskId,
      state: "PLANNING",
      startedAt: Date.now(),
      events: [],
      tokenUsage: 0,
      toolCallCount: 0,
      errorCount: 0,
    }
  }

  classifyIntent(role?: string): void {
    this.transition("ROUTING", {
      type: "INTENT_CLASSIFIED",
      timestamp: Date.now(),
      role,
    })
    if (this.trace) this.trace.currentRole = role
  }

  selectRoles(roles: string[]): void {
    this.transition("EXECUTING", {
      type: "ROLES_SELECTED",
      timestamp: Date.now(),
      message: `Selected roles: ${roles.join(", ")}`,
      metadata: { roles },
    })
  }

  startDelegation(role: string, model?: string, provider?: string): void {
    this.transition("EXECUTING", {
      type: "DELEGATION_START",
      timestamp: Date.now(),
      role,
      model,
      provider,
    })
    if (this.trace) {
      this.trace.currentRole = role
      this.trace.currentModel = model
      this.trace.currentProvider = provider
    }
  }

  completeDelegation(role: string, durationMs: number, tokenCount?: number, toolCalls?: number): void {
    this.transition("STREAMING", {
      type: "DELEGATION_COMPLETE",
      timestamp: Date.now(),
      role,
      durationMs,
      tokenCount,
      toolCalls,
    })
    if (this.trace) {
      this.trace.tokenUsage += tokenCount ?? 0
      this.trace.toolCallCount += toolCalls ?? 0
    }
  }

  streamToken(role: string, token: string): void {
    this.state = "STREAMING"
    this.emit({
      type: "STREAM_TOKEN",
      timestamp: Date.now(),
      role,
      message: token,
    })
  }

  streamDone(role: string, durationMs: number): void {
    this.transition("COMPLETE", {
      type: "STREAM_DONE",
      timestamp: Date.now(),
      role,
      durationMs,
    })
  }

  requireApproval(role: string): void {
    this.transition("WAITING_APPROVAL", {
      type: "APPROVAL_REQUIRED",
      timestamp: Date.now(),
      role,
    })
  }

  grantApproval(role: string): void {
    this.transition("EXECUTING", {
      type: "APPROVAL_GRANTED",
      timestamp: Date.now(),
      role,
    })
  }

  denyApproval(role: string): void {
    this.transition("ROLLBACK", {
      type: "APPROVAL_DENIED",
      timestamp: Date.now(),
      role,
    })
  }

  startTests(): void {
    this.transition("TESTING", {
      type: "TESTS_PASSED",
      timestamp: Date.now(),
      message: "Tests started",
    })
  }

  completeTests(passed: boolean): void {
    if (passed) {
      this.transition("COMPLETE", {
        type: "TESTS_PASSED",
        timestamp: Date.now(),
        message: "All tests passed",
      })
    } else {
      this.transition("ROLLBACK", {
        type: "TESTS_FAILED",
        timestamp: Date.now(),
        message: "Tests failed",
      })
    }
  }

  rollback(role: string): void {
    this.transition("ROLLBACK", {
      type: "ROLLBACK_STARTED",
      timestamp: Date.now(),
      role,
    })
  }

  rollbackComplete(): void {
    this.transition("COMPLETE", {
      type: "ROLLBACK_COMPLETE",
      timestamp: Date.now(),
    })
  }

  fail(error: string, role?: string): void {
    this.transition("ERROR", {
      type: "ERROR_OCCURRED",
      timestamp: Date.now(),
      error,
      role,
    })
  }

  cancel(): void {
    this.emit({ type: "CANCELLED", timestamp: Date.now() })
    if (this.state !== "COMPLETE" && this.state !== "ERROR") {
      this.state = "IDLE"
    }
    if (this.trace) {
      this.trace.endedAt = Date.now()
      this.history.push(this.trace)
    }
    this.trace = null
  }

  complete(): void {
    this.transition("COMPLETE", {
      type: "COMPLETED",
      timestamp: Date.now(),
    })
  }

  reset(): void {
    this.state = "IDLE"
    this.trace = null
  }

  /** Get full diagnostics snapshot for the debug panel */
  getDiagnostics(): {
    state: ExecutionState
    trace: ExecutionTrace | null
    historyLength: number
    totalTokens: number
    totalToolCalls: number
    totalErrors: number
    avgExecutionMs: number
  } {
    const completedTraces = this.history.filter((t) => t.endedAt)
    const avgMs = completedTraces.length > 0
      ? completedTraces.reduce((sum, t) => sum + (t.endedAt! - t.startedAt), 0) / completedTraces.length
      : 0

    return {
      state: this.state,
      trace: this.trace,
      historyLength: this.history.length,
      totalTokens: this.history.reduce((sum, t) => sum + t.tokenUsage, 0),
      totalToolCalls: this.history.reduce((sum, t) => sum + t.toolCallCount, 0),
      totalErrors: this.history.reduce((sum, t) => sum + t.errorCount, 0),
      avgExecutionMs: Math.round(avgMs),
    }
  }
}

/** Singleton instance */
export const executionEngine = new ExecutionEngine()
