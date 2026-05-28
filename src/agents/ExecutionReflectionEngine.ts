import type { AgentTask, ExecutionReflection } from "./AgentTypes"
import type { RuntimeSupervisor } from "@/runtime/RuntimeSupervisor"

export interface ReflectionResult {
  reflection: ExecutionReflection
  actionableInsights: string[]
}

export class ExecutionReflectionEngine {
  private reflections: Map<string, ExecutionReflection> = new Map()
  private maxHistory = 100

  analyze(
    task: AgentTask,
    supervisor: RuntimeSupervisor,
  ): ReflectionResult {
    const traces = supervisor.getTraces()
    const execTrace = traces.find((t) => t.executionId === task.executionId)

    const durationMs = task.completedAt && task.startedAt
      ? task.completedAt - task.startedAt
      : 0

    const outcome = task.status === "completed" ? "success"
      : task.status === "failed" ? "failure"
      : "partial"

    const toolCalls = execTrace?.toolCallCount ?? 0
    const errors = execTrace?.errorCount ?? 0
    const stateEvents = execTrace?.events.filter((e) => e.type === "state_transition") ?? []

    const retries = stateEvents.filter(
      (e: any) => e.type === "state_transition" && e.to === "Repairing",
    ).length

    const lessons = this.extractLessons(task, errors, retries)
    const suggestions = this.generateSuggestions(task, errors, retries)

    const reflection: ExecutionReflection = {
      executionId: task.executionId ?? "unknown",
      taskId: task.id,
      agentKind: task.agentKind,
      outcome,
      summary: this.buildSummary(task, outcome, durationMs),
      lessons,
      suggestions,
      metrics: {
        durationMs,
        toolCalls,
        errors,
        retries,
      },
    }

    this.reflections.set(task.id, reflection)
    if (this.reflections.size > this.maxHistory) {
      const oldest = Array.from(this.reflections.keys()).sort(
        (a, b) => (this.reflections.get(a)?.metrics.durationMs ?? 0) - (this.reflections.get(b)?.metrics.durationMs ?? 0),
      )[0]
      if (oldest) this.reflections.delete(oldest)
    }

    return {
      reflection,
      actionableInsights: suggestions,
    }
  }

  getReflection(taskId: string): ExecutionReflection | undefined {
    return this.reflections.get(taskId)
  }

  getReflectionsByAgent(kind: string): ExecutionReflection[] {
    return Array.from(this.reflections.values()).filter((r) => r.agentKind === kind)
  }

  private buildSummary(task: AgentTask, outcome: string, durationMs: number): string {
    const duration = durationMs < 1000
      ? `${durationMs}ms`
      : `${(durationMs / 1000).toFixed(1)}s`

    const status = outcome === "success" ? "completed successfully"
      : outcome === "failure" ? "failed"
      : "completed partially"

    return `Task "${task.description.slice(0, 80)}" ${status} in ${duration}`
  }

  private extractLessons(task: AgentTask, errors: number, retries: number): string[] {
    const lessons: string[] = []

    if (task.status === "completed" && errors === 0) {
      lessons.push("Execution completed without errors")
    }

    if (retries > 0) {
      lessons.push(`Required ${retries} repair attempt(s) to resolve issues`)
    }

    if (errors > 3) {
      lessons.push("High error rate suggests need for better pre-validation")
    }

    return lessons
  }

  private generateSuggestions(task: AgentTask, errors: number, retries: number): string[] {
    const suggestions: string[] = []

    if (task.status === "failed") {
      suggestions.push("Split the task into smaller subtasks")
      suggestions.push("Add more context or examples to the task description")
      if (retries > 2) {
        suggestions.push("Consider using a different model or agent for this task type")
      }
    }

    if (errors > 0 && task.status === "completed") {
      suggestions.push("Add pre-execution validation to reduce error count")
    }

    return suggestions
  }

  clear(): void {
    this.reflections.clear()
  }
}
