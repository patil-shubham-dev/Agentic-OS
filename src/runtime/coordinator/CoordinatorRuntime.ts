import { WorkerAgent, type WorkerConfig, type WorkerResult } from './WorkerAgent'
import { TaskRuntime } from '../tasks/TaskRuntime'
import { TaskGraph } from '../tasks/TaskGraph'
import { ToolExecutionPipeline } from '../tools/execution/ToolExecutionPipeline'
import { PermissionEngine } from '../permissions/PermissionEngine'
import { ToolRegistry } from '../tools/registry/ToolRegistry'
import type { ToolContext } from '../tools/core/ToolContext'

export type DelegationPlan = {
  steps: Array<{
    role: string
    input: string
    dependsOn?: string[]
    parallel?: boolean
  }>
  strategy: 'sequential' | 'parallel' | 'mixed'
}

export type CoordinationResult = {
  workerResults: WorkerResult[]
  aggregated: string
  totalDurationMs: number
  successRate: number
  errors: string[]
}

export class CoordinatorRuntime {
  private taskRuntime: TaskRuntime
  private taskGraph: TaskGraph
  private toolPipeline: ToolExecutionPipeline
  private permissionEngine: PermissionEngine
  private workers: Map<string, WorkerAgent> = new Map()

  constructor(
    taskRuntime: TaskRuntime,
    toolPipeline: ToolExecutionPipeline,
    permissionEngine: PermissionEngine,
  ) {
    this.taskRuntime = taskRuntime
    this.taskGraph = new TaskGraph()
    this.toolPipeline = toolPipeline
    this.permissionEngine = permissionEngine
  }

  registerWorker(name: string, config: WorkerConfig): WorkerAgent {
    const worker = new WorkerAgent(config, this.taskRuntime, this.toolPipeline, this.permissionEngine)
    this.workers.set(name, worker)
    return worker
  }

  getWorker(name: string): WorkerAgent | undefined {
    return this.workers.get(name)
  }

  getAllWorkers(): WorkerAgent[] {
    return [...this.workers.values()]
  }

  removeWorker(name: string): boolean {
    return this.workers.delete(name)
  }

  async delegate(task: string, workerName: string, ctx: ToolContext): Promise<WorkerResult> {
    const worker = this.workers.get(workerName)
    if (!worker) throw new Error(`Worker "${workerName}" not registered`)
    return worker.execute(task, ctx)
  }

  async executePlan(plan: DelegationPlan, ctx: ToolContext): Promise<CoordinationResult> {
    const t0 = performance.now()
    const results: WorkerResult[] = []
    const errors: string[] = []

    for (const step of plan.steps) {
      const worker = this.workers.get(step.role)
      if (!worker) {
        errors.push(`Worker "${step.role}" not found`)
        continue
      }

      const result = await worker.execute(step.input, ctx)
      results.push(result)
      if (result.error) errors.push(result.error)
    }

    const successCount = results.filter(r => !r.error).length
    const totalDurationMs = Math.round(performance.now() - t0)

    return {
      workerResults: results,
      aggregated: results.map(r => r.output).join('\n\n'),
      totalDurationMs,
      successRate: results.length > 0 ? successCount / results.length : 0,
      errors,
    }
  }

  async executeParallel(plan: DelegationPlan, ctx: ToolContext): Promise<CoordinationResult> {
    if (plan.strategy === 'sequential') return this.executePlan(plan, ctx)

    const t0 = performance.now()
    const results: WorkerResult[] = []
    const errors: string[] = []

    const parallelBatches: Array<Array<{ role: string; input: string }>> = []
    let currentBatch: Array<{ role: string; input: string }> = []
    for (const step of plan.steps) {
      if (step.parallel) {
        currentBatch.push({ role: step.role, input: step.input })
      } else {
        if (currentBatch.length > 0) {
          parallelBatches.push(currentBatch)
          currentBatch = []
        }
        parallelBatches.push([{ role: step.role, input: step.input }])
      }
    }
    if (currentBatch.length > 0) parallelBatches.push(currentBatch)

    for (const batch of parallelBatches) {
      const batchResults = await Promise.allSettled(
        batch.map(step => {
          const worker = this.workers.get(step.role)
          if (!worker) throw new Error(`Worker "${step.role}" not found`)
          return worker.execute(step.input, ctx)
        }),
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
          if (result.value.error) errors.push(result.value.error)
        } else {
          errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
        }
      }
    }

    return {
      workerResults: results,
      aggregated: results.map(r => r.output).join('\n\n'),
      totalDurationMs: Math.round(performance.now() - t0),
      successRate: results.length > 0 ? (results.length - errors.length) / results.length : 0,
      errors,
    }
  }

  buildDelegationPlan(input: string, roles: string[]): DelegationPlan {
    const steps = roles.map((role, i) => ({
      role,
      input,
      dependsOn: i > 0 ? [roles[i - 1]] : undefined,
      parallel: false,
    }))

    return {
      steps,
      strategy: steps.length > 1 ? 'sequential' : 'sequential',
    }
  }

  clear(): void {
    this.workers.clear()
    this.taskGraph.clear()
  }
}
