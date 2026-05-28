export interface DependencyNode {
  path: string
  imports: string[]
  importedBy: string[]
  depth: number
}

export class DependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map()

  addFile(path: string, imports: string[]): void {
    let node = this.nodes.get(path)
    if (!node) {
      node = { path, imports: [], importedBy: [], depth: 0 }
      this.nodes.set(path, node)
    }

    node.imports = [...new Set([...node.imports, ...imports])]

    for (const imp of imports) {
      let depNode = this.nodes.get(imp)
      if (!depNode) {
        depNode = { path: imp, imports: [], importedBy: [], depth: 0 }
        this.nodes.set(imp, depNode)
      }
      if (!depNode.importedBy.includes(path)) {
        depNode.importedBy.push(path)
      }
    }

    this.recalculateDepths()
  }

  removeFile(path: string): void {
    const node = this.nodes.get(path)
    if (!node) return

    for (const imp of node.imports) {
      const depNode = this.nodes.get(imp)
      if (depNode) {
        depNode.importedBy = depNode.importedBy.filter((p) => p !== path)
      }
    }

    this.nodes.delete(path)
    this.recalculateDepths()
  }

  getNode(path: string): DependencyNode | undefined {
    return this.nodes.get(path)
  }

  getDependents(path: string): string[] {
    const node = this.nodes.get(path)
    return node ? [...node.importedBy] : []
  }

  getDependencies(path: string): string[] {
    const node = this.nodes.get(path)
    return node ? [...node.imports] : []
  }

  getTransitiveDependents(path: string, maxDepth: number = 5): string[] {
    const visited = new Set<string>()
    const result: string[] = []

    const traverse = (currentPath: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentPath)) return
      visited.add(currentPath)

      const node = this.nodes.get(currentPath)
      if (!node) return

      for (const dependent of node.importedBy) {
        if (!visited.has(dependent)) {
          result.push(dependent)
          traverse(dependent, depth + 1)
        }
      }
    }

    traverse(path, 0)
    return result
  }

  getTransitiveDependencies(path: string, maxDepth: number = 5): string[] {
    const visited = new Set<string>()
    const result: string[] = []

    const traverse = (currentPath: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentPath)) return
      visited.add(currentPath)

      const node = this.nodes.get(currentPath)
      if (!node) return

      for (const dep of node.imports) {
        if (!visited.has(dep)) {
          result.push(dep)
          traverse(dep, depth + 1)
        }
      }
    }

    traverse(path, 0)
    return result
  }

  findAffectedFiles(changedPaths: string[]): string[] {
    const affected = new Set<string>()

    for (const path of changedPaths) {
      const dependents = this.getTransitiveDependents(path)
      for (const dep of dependents) {
        affected.add(dep)
      }
    }

    return Array.from(affected)
  }

  hasCircularDependency(): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recStack = new Set<string>()

    const dfs = (node: string, path: string[]) => {
      visited.add(node)
      recStack.add(node)

      const deps = this.getDependencies(node)
      for (const dep of deps) {
        if (!this.nodes.has(dep)) continue
        if (!visited.has(dep)) {
          dfs(dep, [...path, dep])
        } else if (recStack.has(dep)) {
          const cycleStart = path.indexOf(dep)
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart))
          }
        }
      }

      recStack.delete(node)
    }

    for (const [path] of this.nodes) {
      if (!visited.has(path)) {
        dfs(path, [path])
      }
    }

    return cycles
  }

  getEntryPoints(): string[] {
    const entryPoints: string[] = []
    for (const [, node] of this.nodes) {
      if (node.importedBy.length === 0 && node.imports.length > 0) {
        entryPoints.push(node.path)
      }
    }
    return entryPoints
  }

  getLeafNodes(): string[] {
    const leaves: string[] = []
    for (const [, node] of this.nodes) {
      if (node.imports.length === 0) {
        leaves.push(node.path)
      }
    }
    return leaves
  }

  getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values())
  }

  getNodeCount(): number {
    return this.nodes.size
  }

  clear(): void {
    this.nodes.clear()
  }

  private recalculateDepths(): void {
    const visited = new Set<string>()

    const dfs = (path: string, depth: number) => {
      if (visited.has(path)) return
      visited.add(path)

      const node = this.nodes.get(path)
      if (!node) return

      if (depth > node.depth) {
        node.depth = depth
      }

      for (const dep of node.imports) {
        dfs(dep, depth + 1)
      }
    }

    for (const [path] of this.nodes) {
      dfs(path, 0)
    }
  }
}
