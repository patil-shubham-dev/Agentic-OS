import { CoordinatorRuntime, type DelegationPlan } from './CoordinatorRuntime'
import type { ToolContext } from '../tools/core/ToolContext'
import { TaskGraph } from '../tasks/TaskGraph'
import { TaskRuntime } from '../tasks/TaskRuntime'

export class TaskDelegator {
  private coordinator: CoordinatorRuntime
  private taskRuntime: TaskRuntime
  private taskGraph: TaskGraph

  constructor(coordinator: CoordinatorRuntime, taskRuntime: TaskRuntime) {
    this.coordinator = coordinator
    this.taskRuntime = taskRuntime
    this.taskGraph = new TaskGraph()
  }

  async delegateWithGraph(plan: DelegationPlan, ctx: ToolContext) {
    for (const step of plan.steps) {
      this.taskGraph.addNode(step.role, 'local_agent', step.input, {
        dependsOn: step.dependsOn,
      })
    }

    if (this.taskGraph.hasCycle()) {
      throw new Error('Task graph contains a cycle — cannot execute')
    }

    return this.coordinator.executeParallel(plan, ctx)
  }

  async delegateSequential(roles: string[], input: string, ctx: ToolContext) {
    const plan: DelegationPlan = {
      strategy: 'sequential',
      steps: roles.map((role, i) => ({
        role,
        input,
        dependsOn: i > 0 ? [roles[i - 1]] : undefined,
        parallel: false,
      })),
    }
    return this.coordinator.executePlan(plan, ctx)
  }

  async delegateParallel(roles: string[], input: string, ctx: ToolContext) {
    const plan: DelegationPlan = {
      strategy: 'parallel',
      steps: roles.map(role => ({
        role,
        input,
        parallel: true,
      })),
    }
    return this.coordinator.executeParallel(plan, ctx)
  }

  clearGraph(): void {
    this.taskGraph.clear()
  }
}
