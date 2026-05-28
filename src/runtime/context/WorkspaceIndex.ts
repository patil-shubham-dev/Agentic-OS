import { useWorkspaceStore } from "@/stores/workspace-store"

export interface FileEntryIndex {
  path: string
  name: string
  score: number
}

function flattenTree(entries: { path: string; name: string; children?: any[] }[]): { path: string; name: string }[] {
  const out: { path: string; name: string }[] = []
  const walk = (nodes: { path: string; name: string; children?: any[] }[]) => {
    for (const node of nodes) {
      out.push({ path: node.path, name: node.name })
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children)
      }
    }
  }
  walk(entries)
  return out
}

export class WorkspaceIndex {
  private static instance: WorkspaceIndex

  static getInstance(): WorkspaceIndex {
    if (!WorkspaceIndex.instance) {
      WorkspaceIndex.instance = new WorkspaceIndex()
    }
    return WorkspaceIndex.instance
  }

  search(query: string, limit = 8): FileEntryIndex[] {
    const workspace = useWorkspaceStore.getState()
    const lowered = query.toLowerCase()
    const terms = lowered.split(/\W+/).filter(Boolean)
    const openFiles = workspace.openFiles.map((file) => ({ path: file.path, name: file.name }))
    const treeFiles = flattenTree(workspace.fileTree as any)
    const aiContext = workspace.aiContextFiles.map((file) => ({ path: file.path, name: file.name }))

    const combined = [...openFiles, ...treeFiles, ...aiContext]
    const deduped = new Map<string, { path: string; name: string }>()
    for (const file of combined) {
      if (!deduped.has(file.path)) deduped.set(file.path, file)
    }

    return Array.from(deduped.values())
      .map((file) => {
        const haystack = `${file.path} ${file.name}`.toLowerCase()
        const score = terms.reduce((sum, term) => {
          if (haystack.includes(term)) return sum + 2
          return sum
        }, 0) + (workspace.aiContextFiles.some((ctx) => ctx.path === file.path) ? 4 : 0)
        return { ...file, score }
      })
      .filter((file) => file.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
