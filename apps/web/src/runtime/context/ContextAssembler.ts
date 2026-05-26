import { useWorkspaceStore } from "@/stores/workspace-store"
import { WorkspaceIndex } from "./WorkspaceIndex"
import {
  ContextAssembler as RichContextAssembler,
  RetrievalEngine,
  SlidingMemoryCompressor,
  TokenBudgetManager,
  WorkspaceIndexer,
} from "@/context"

async function readTextFile(path: string): Promise<string> {
  const fs = await import("@tauri-apps/plugin-fs")
  return fs.readTextFile(path)
}

export interface ContextAssemblyResult {
  files: { path: string; excerpt: string }[]
  promptBlock: string
}

export class ContextAssembler {
  private static instance: ContextAssembler
  private workspaceIndex = WorkspaceIndex.getInstance()
  private indexer = new WorkspaceIndexer()
  private tokenBudget = new TokenBudgetManager(64000)
  private retrieval = new RetrievalEngine(this.indexer, this.tokenBudget)
  private richAssembler = new RichContextAssembler(this.tokenBudget, new SlidingMemoryCompressor())

  static getInstance(): ContextAssembler {
    if (!ContextAssembler.instance) {
      ContextAssembler.instance = new ContextAssembler()
    }
    return ContextAssembler.instance
  }

  async assemble(input: string, role: string): Promise<ContextAssemblyResult> {
    const workspace = useWorkspaceStore.getState()
    const matches = this.workspaceIndex.search(input, role === "research" ? 10 : 6)
    const files: { path: string; excerpt: string }[] = []
    const indexableFiles: { path: string; source: string; lastModified?: number }[] = []

    for (const match of matches.slice(0, 4)) {
      const alreadyOpen = workspace.openFiles.find((file) => file.path === match.path)
      const raw = alreadyOpen?.content ?? await this.tryRead(match.path)
      if (!raw) continue
       indexableFiles.push({ path: match.path, source: raw, lastModified: Date.now() })
      files.push({
        path: match.path,
        excerpt: raw.slice(0, 2000),
      })
    }

    if (indexableFiles.length > 0) {
      this.indexer.clear()
      this.indexer.indexFiles(indexableFiles)
    }

    const retrieved = this.retrieval.retrieve({
      text: input,
      maxResults: role === "research" ? 10 : 6,
      includeContent: true,
    })
    const assembled = this.richAssembler.assemble({
      instructions: `Role: ${role}. Focus only on the most relevant workspace files and dependencies.`,
      conversationHistory: [],
      retrievedFiles: retrieved.files,
    })

    const promptBlock = assembled.retrieval.trim()
      ? `Relevant workspace context:\n${assembled.retrieval}`
      : files.length === 0
        ? ""
        : files.map((file) => `\n[${file.path}]\n${file.excerpt}`).join("\n")

    return { files, promptBlock }
  }

  private async tryRead(path: string): Promise<string | null> {
    try {
      return await readTextFile(path)
    } catch {
      return null
    }
  }
}
