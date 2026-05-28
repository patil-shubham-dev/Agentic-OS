import type { TaskState, TaskType, TaskPriority } from './Task'

export type GraphNode = {
  id: string
  type: TaskType
  description: string
  priority: TaskPriority
  dependsOn: string[]
  children: string[]
  state?: TaskState
}

export type GraphEdge = {
  from: string
  to: string
}

export class TaskGraph {
  private nodes: Map<string, GraphNode> = new Map()

  addNode(id: string, type: TaskType, description: string, options?: { priority?: TaskPriority; dependsOn?: string[] }): void {
    this.nodes.set(id, {
      id,
      type,
      description,
      priority: options?.priority ?? 'normal',
      dependsOn: options?.dependsOn ?? [],
      children: [],
    })
  }

  addEdge(from: string, to: string): void {
    const fromNode = this.nodes.get(from)
    const toNode = this.nodes.get(to)
    if (!fromNode || !toNode) throw new Error(`Cannot add edge: node not found (${from} -> ${to})`)
    if (!fromNode.children.includes(to)) fromNode.children.push(to)
    if (!toNode.dependsOn.includes(from)) toNode.dependsOn.push(from)
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id)
  }

  getAllNodes(): GraphNode[] {
    return [...this.nodes.values()]
  }

  getRoots(): GraphNode[] {
    return this.getAllNodes().filter(n => n.dependsOn.length === 0)
  }

  getLeaves(): GraphNode[] {
    return this.getAllNodes().filter(n => n.children.length === 0)
  }

  getExecutionOrder(): GraphNode[][] {
    const visited = new Set<string>()
    const levels: GraphNode[][] = []
    let current = this.getRoots()

    while (current.length > 0) {
      for (const node of current) visited.add(node.id)
      levels.push([...current])

      const next: GraphNode[] = []
      for (const node of current) {
        for (const childId of node.children) {
          const child = this.nodes.get(childId)
          if (!child || visited.has(childId)) continue
          const depsMet = child.dependsOn.every(d => visited.has(d))
          if (depsMet && !next.some(n => n.id === childId)) {
            next.push(child)
          }
        }
      }
      current = next
    }

    return levels
  }

  hasCycle(): boolean {
    const visited = new Set<string>()
    const inStack = new Set<string>()

    const dfs = (id: string): boolean => {
      if (inStack.has(id)) return true
      if (visited.has(id)) return false
      visited.add(id)
      inStack.add(id)

      const node = this.nodes.get(id)
      if (node) {
        for (const childId of node.children) {
          if (dfs(childId)) return true
        }
      }

      inStack.delete(id)
      return false
    }

    for (const [id] of this.nodes) {
      if (dfs(id)) return true
    }
    return false
  }

  topologicalSort(): GraphNode[] {
    if (this.hasCycle()) return this.getAllNodes()

    const visited = new Set<string>()
    const result: GraphNode[] = []

    const dfs = (id: string): void => {
      if (visited.has(id)) return
      visited.add(id)
      const node = this.nodes.get(id)
      if (!node) return
      for (const childId of node.children) dfs(childId)
      result.push(node)
    }

    for (const [id] of this.nodes) dfs(id)
    return result.reverse()
  }

  size(): number {
    return this.nodes.size
  }

  clear(): void {
    this.nodes.clear()
  }

  toJSON(): { nodes: GraphNode[]; levels: GraphNode[][] } {
    return {
      nodes: this.getAllNodes(),
      levels: this.getExecutionOrder(),
    }
  }
}
