import type { AgentTool } from '../tools/core/AgentTool'
import type { ToolContext } from '../tools/core/ToolContext'
import { TaskRuntime } from '../tasks/TaskRuntime'
import { ToolExecutionPipeline } from '../tools/execution/ToolExecutionPipeline'
import { PermissionEngine } from '../permissions/PermissionEngine'

export type WorkerConfig = {
  role: string
  model?: string
  provider?: string
  allowedTools: string[]
  tokenBudget?: number
  isolatedMemory: boolean
  executionMode: string
}

export type WorkerResult = {
  role: string
  output: string
  toolCalls: number
  durationMs: number
  error?: string
}

export class WorkerAgent {
  readonly config: WorkerConfig
  private taskRuntime: TaskRuntime
  private toolPipeline: ToolExecutionPipeline
  private permissionEngine: PermissionEngine

  constructor(
    config: WorkerConfig,
    taskRuntime: TaskRuntime,
    toolPipeline: ToolExecutionPipeline,
    permissionEngine: PermissionEngine,
  ) {
    this.config = config
    this.taskRuntime = taskRuntime
    this.toolPipeline = toolPipeline
    this.permissionEngine = permissionEngine
  }

  async execute(input: string, ctx: ToolContext): Promise<WorkerResult> {
    const t0 = performance.now()
    let toolCalls = 0

    const workerCtx: ToolContext = {
      ...ctx,
      role: this.config.role,
      executionMode: this.config.executionMode,
      model: this.config.model,
      provider: this.config.provider,
    }

    try {
      const taskHandle = await this.taskRuntime.start('local_agent', input, {
        agentId: this.config.role,
        metadata: { worker: true, role: this.config.role },
      })

      return new Promise<WorkerResult>((resolve) => {
        taskHandle.onComplete((state) => {
          resolve({
            role: this.config.role,
            output: String(state.result ?? ''),
            toolCalls,
            durationMs: Math.round(performance.now() - t0),
          })
        })
        taskHandle.onError((error) => {
          resolve({
            role: this.config.role,
            output: '',
            toolCalls,
            durationMs: Math.round(performance.now() - t0),
            error,
          })
        })
      })
    } catch (err) {
      return {
        role: this.config.role,
        output: '',
        toolCalls,
        durationMs: Math.round(performance.now() - t0),
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  isAllowedTool(toolName: string): boolean {
    return this.config.allowedTools.includes(toolName) || this.config.allowedTools.length === 0
  }

  getToolFilter(): (tool: AgentTool) => boolean {
    return (tool: AgentTool) => {
      if (this.config.allowedTools.length === 0) return true
      return this.config.allowedTools.includes(tool.name)
    }
  }
}
