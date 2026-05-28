import type { RuntimeRole } from "@/types"
import { runRuntimeAgent } from "@/lib/agents/orchestrator"
import type { AgentCallbacks } from "@/lib/agents/orchestrator"

export type AgentStatus = "idle" | "running" | "complete" | "failed" | "cancelled"

export interface AgentTask {
  role: RuntimeRole
  input: string
  history: { role: string; content: string; timestamp?: number }[]
  context?: string
  callbacks?: AgentCallbacks
  signal?: AbortSignal
}

export type AgentWorkerEvent =
  | { type: "THINKING"; message: string }
  | { type: "CONTEXT_LOADED"; files: string[] }
  | { type: "TOKEN_STREAM"; token: string }
  | { type: "TOOL_START"; toolId: string; toolName: string; args: string }
  | { type: "TOOL_COMPLETE"; toolId: string; result: string }
  | { type: "TOOL_ERROR"; toolId: string; error: string }
  | { type: "STREAM_READY" }
  | { type: "FILE_EDIT"; path: string; additions: number; deletions: number }
  | { type: "COMPLETE"; result: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }
  | { type: "ERROR"; error: string }

export class AgentWorker {
  readonly role: RuntimeRole
  private status: AgentStatus = "idle"
  private controller: AbortController | null = null

  constructor(role: RuntimeRole) {
    this.role = role
  }

  async *execute(task: AgentTask): AsyncGenerator<AgentWorkerEvent> {
    this.status = "running"
    this.controller = task.signal ? new AbortController() : new AbortController()
    const signal = task.signal ?? this.controller.signal

    yield { type: "THINKING", message: `Analyzing as ${this.role}...` }

    if (task.context) {
      yield { type: "CONTEXT_LOADED", files: [task.context] }
    }

    yield { type: "STREAM_READY" }

    try {
      const result = await runRuntimeAgent(
        task.role,
        task.input,
        task.history as any,
        undefined,
        signal,
        () => { /* stream ready */ },
        (token: string) => {
          task.callbacks?.onStreamChunk?.(token)
        },
        task.callbacks,
      )
      this.status = "complete"
      yield {
        type: "COMPLETE",
        result: result.response,
        usage: result.usage,
      }
    } catch (error) {
      this.status = "failed"
      yield { type: "ERROR", error: error instanceof Error ? error.message : String(error) }
    } finally {
      this.controller = null
    }
  }

  cancel(): void {
    this.controller?.abort()
    this.status = "cancelled"
  }

  getStatus(): AgentStatus {
    return this.status
  }
}
