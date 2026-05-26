import type { RuntimeRole } from "@/types"

export interface RuntimeTaskNode {
  id: string
  role: RuntimeRole
  input: string
  dependencies: string[]
  status: "pending" | "running" | "complete" | "failed"
}

export interface RuntimeTaskGraph {
  plan: string
  tasks: RuntimeTaskNode[]
  executionOrder: string[][]
}

export class TaskGraphRuntime {
  buildSequentialGraph(input: string, roles: RuntimeRole[]): RuntimeTaskGraph {
    const tasks = roles.map((role, index) => ({
      id: `task-${index + 1}`,
      role,
      input,
      dependencies: index === 0 ? [] : [`task-${index}`],
      status: "pending" as const,
    }))

    return {
      plan: roles.length > 1
        ? `Delegate the request across ${roles.join(", ")} and synthesize the outputs.`
        : `Delegate the request to ${roles[0] ?? "manager"}.`,
      tasks,
      executionOrder: tasks.map((task) => [task.id]),
    }
  }

  buildParallelGraph(input: string, roles: RuntimeRole[]): RuntimeTaskGraph {
    if (roles.length <= 1) {
      return this.buildSequentialGraph(input, roles)
    }

    const roleGroups = this.computeRoleGroups(roles)

    const tasks: RuntimeTaskNode[] = []
    const executionOrder: string[][] = []
    const taskDeps: Map<string, string[]> = new Map()
    let taskIndex = 0

    for (const [groupIdx, group] of roleGroups.entries()) {
      const groupTaskIds: string[] = []

      for (const role of group) {
        taskIndex++
        const taskId = `task-${taskIndex}`
        groupTaskIds.push(taskId)

        const dependencies: string[] = []
        if (groupIdx > 0) {
          for (const prevGroup of roleGroups[groupIdx - 1]) {
            const prevTaskId = this.findTaskId(roleGroups, groupIdx - 1, prevGroup, taskDeps)
            if (prevTaskId) dependencies.push(prevTaskId)
          }
        }

        tasks.push({
          id: taskId,
          role,
          input,
          dependencies,
          status: "pending",
        })
      }

      executionOrder.push(groupTaskIds)
    }

    return {
      plan: `Concurrent DAG across [${roles.join(", ")}] in ${roleGroups.length} parallel groups`,
      tasks,
      executionOrder,
    }
  }

  private findTaskId(
    roleGroups: RuntimeRole[][],
    groupIdx: number,
    role: RuntimeRole,
    taskDeps: Map<string, string[]>,
  ): string | undefined {
    const store = new Map<number, string>()
    let idx = 0
    for (const group of roleGroups) {
      for (const r of group) {
        idx++
        store.set(idx, `task-${idx}`)
      }
    }
    let searchIdx = 0
    for (let gi = 0; gi <= groupIdx; gi++) {
      for (const r of roleGroups[gi]) {
        searchIdx++
        if (gi === groupIdx && r === role) {
          return `task-${searchIdx}`
        }
      }
    }
    return undefined
  }

  private computeRoleGroups(roles: RuntimeRole[]): RuntimeRole[][] {
    const independentRoles = new Set<string>(["vision", "browser", "research"])
    const dependentRoles = new Set<string>(["coder", "qa", "verifier", "runtime"])
    const managerRole: RuntimeRole = "manager"

    const firstPass = roles.filter((r) => independentRoles.has(r))
    const secondPass = roles.filter((r) => dependentRoles.has(r))
    const managerPass = roles.filter((r) => r === managerRole)

    const groups: RuntimeRole[][] = []

    if (firstPass.length > 0) {
      groups.push(firstPass)
    }

    if (secondPass.length > 0) {
      if (groups.length > 0) {
        groups.push(secondPass)
      } else {
        groups.push(secondPass)
      }
    }

    for (const role of roles) {
      if (!firstPass.includes(role) && !secondPass.includes(role) && role !== managerRole) {
        if (groups.length === 0) {
          groups.push([role])
        } else {
          groups[groups.length - 1].push(role)
        }
      }
    }

    if (managerPass.length > 0) {
      groups.push(managerPass)
    }

    if (groups.length === 0) {
      groups.push(roles)
    }

    return groups
  }

  async executeGraph(
    graph: RuntimeTaskGraph,
    executeTask: (task: RuntimeTaskNode) => Promise<void>,
  ): Promise<void> {
    for (const parallelGroup of graph.executionOrder) {
      const groupTasks = parallelGroup
        .map((taskId) => graph.tasks.find((t) => t.id === taskId))
        .filter((t): t is RuntimeTaskNode => t !== undefined)

      await Promise.allSettled(
        groupTasks.map((task) => {
          task.status = "running"
          return executeTask(task)
        }),
      )

      for (const task of groupTasks) {
        if (task.status === "running") {
          task.status = "complete"
        }
      }
    }
  }
}
