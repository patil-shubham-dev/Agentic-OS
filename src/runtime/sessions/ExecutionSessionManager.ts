import { ExecutionOrchestrator, type ExecuteOptions, type ExecuteResult } from "@/runtime/execution/ExecutionOrchestrator"
import { EventBus } from "@/runtime/render-engine/event-bus"
import { useTimelineStore } from "@/components/workspace/timeline/timeline-store"
import { generateId } from "@/components/workspace/timeline/timeline-store"

export interface ExecutionSession {
  id: string
  traceId: string
  startedAt: number
  completedAt?: number
  status: "running" | "completed" | "failed" | "cancelled"
  input: string
  result?: ExecuteResult
  error?: string
}

export class ExecutionSessionManager {
  private static instance: ExecutionSessionManager
  private sessions: Map<string, ExecutionSession> = new Map()
  private orchestrator = ExecutionOrchestrator.getInstance()

  static getInstance(): ExecutionSessionManager {
    if (!ExecutionSessionManager.instance) {
      ExecutionSessionManager.instance = new ExecutionSessionManager()
    }
    return ExecutionSessionManager.instance
  }

  async start(options: ExecuteOptions): Promise<ExecutionSession> {
    const id = generateId()
    const session: ExecutionSession = {
      id,
      traceId: `msg_${Date.now()}`,
      startedAt: Date.now(),
      status: "running",
      input: options.input,
    }

    this.sessions.set(id, session)

    EventBus.getInstance().emit({
      type: "EXECUTION_STATE_CHANGE",
      state: "running",
      stepId: id,
    } as any)

    try {
      const result = await this.orchestrator.execute(options)
      session.result = result
      session.status = result.success ? "completed" : "failed"
      session.completedAt = Date.now()

      EventBus.getInstance().emit({
        type: "EXECUTION_STATE_CHANGE",
        state: result.success ? "complete" : "error",
        stepId: id,
      } as any)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      session.error = msg
      session.status = "failed"
      session.completedAt = Date.now()

      EventBus.getInstance().emit({
        type: "EXECUTION_STATE_CHANGE",
        state: "error",
        stepId: id,
      } as any)
    }

    return session
  }

  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== "running") return

    this.orchestrator.cancel()
    session.status = "cancelled"
    session.completedAt = Date.now()
  }

  cancelAll(): void {
    for (const [id, session] of this.sessions) {
      if (session.status === "running") {
        this.cancel(id)
      }
    }
  }

  getSession(id: string): ExecutionSession | undefined {
    return this.sessions.get(id)
  }

  getActiveSessions(): ExecutionSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === "running")
  }

  getAllSessions(): ExecutionSession[] {
    return Array.from(this.sessions.values())
  }

  getRecentSessions(limit = 10): ExecutionSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit)
  }

  clear(): void {
    this.sessions.clear()
  }
}
