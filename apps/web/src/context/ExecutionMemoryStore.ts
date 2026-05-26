import { SlidingMemoryCompressor } from "./SlidingMemoryCompressor"

export type MemoryLevel = "short_term" | "compressed" | "long_term"

export interface MemoryEntry {
  id: string
  level: MemoryLevel
  content: string
  timestamp: number
  executionId: string | null
  agentId: string | null
  tokenEstimate: number
}

export class ExecutionMemoryStore {
  private static instance: ExecutionMemoryStore | null = null
  private shortTerm: MemoryEntry[] = []
  private compressed: MemoryEntry[] = []
  private longTerm: MemoryEntry[] = []
  private compressor: SlidingMemoryCompressor
  private maxShortTerm: number
  private maxCompressed: number

  static getInstance(maxShortTerm?: number, maxCompressed?: number): ExecutionMemoryStore {
    if (!ExecutionMemoryStore.instance) {
      ExecutionMemoryStore.instance = new ExecutionMemoryStore(maxShortTerm, maxCompressed)
    }
    return ExecutionMemoryStore.instance
  }

  constructor(maxShortTerm: number = 50, maxCompressed: number = 20) {
    this.compressor = new SlidingMemoryCompressor()
    this.maxShortTerm = maxShortTerm
    this.maxCompressed = maxCompressed
  }

  addShortTerm(entry: Omit<MemoryEntry, "id" | "level" | "timestamp" | "tokenEstimate">): MemoryEntry {
    const memory: MemoryEntry = {
      ...entry,
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      level: "short_term",
      timestamp: Date.now(),
      tokenEstimate: this.compressor.estimateTokens(entry.content),
    }

    this.shortTerm.push(memory)
    this.evictShortTerm()
    return memory
  }

  addCompressed(entry: Omit<MemoryEntry, "id" | "level" | "timestamp" | "tokenEstimate">): MemoryEntry {
    const memory: MemoryEntry = {
      ...entry,
      id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      level: "compressed",
      timestamp: Date.now(),
      tokenEstimate: this.compressor.estimateTokens(entry.content),
    }

    this.compressed.push(memory)
    this.evictCompressed()
    return memory
  }

  addLongTerm(content: string, agentId: string | null = null): MemoryEntry {
    const memory: MemoryEntry = {
      id: `long_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      level: "long_term",
      content,
      timestamp: Date.now(),
      executionId: null,
      agentId,
      tokenEstimate: this.compressor.estimateTokens(content),
    }

    this.longTerm.push(memory)
    return memory
  }

  getShortTerm(): MemoryEntry[] {
    return [...this.shortTerm]
  }

  getCompressed(): MemoryEntry[] {
    return [...this.compressed]
  }

  getLongTerm(): MemoryEntry[] {
    return [...this.longTerm]
  }

  getAll(): MemoryEntry[] {
    return [...this.shortTerm, ...this.compressed, ...this.longTerm]
  }

  getByExecutionId(executionId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.executionId === executionId)
  }

  getByAgentId(agentId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.agentId === agentId)
  }

  compressAll(maxTokens: number = 32000): MemoryEntry[] {
    const allContent = this.shortTerm.map((e) => e.content).join("\n")
    const compressed = this.compressor.summarizeExecutionHistory(
      this.shortTerm.map((e) => e.content),
    )

    this.addCompressed({
      content: compressed,
      executionId: null,
      agentId: null,
    })

    this.shortTerm = []
    return this.getCompressed()
  }

  clearShortTerm(): void {
    this.shortTerm = []
  }

  clearCompressed(): void {
    this.compressed = []
  }

  clearLongTerm(): void {
    this.longTerm = []
  }

  clearAll(): void {
    this.shortTerm = []
    this.compressed = []
    this.longTerm = []
  }

  getTotalTokenEstimate(): number {
    return this.getAll().reduce((sum, e) => sum + e.tokenEstimate, 0)
  }

  getMemoryPressure(): number {
    const shortTermTokens = this.shortTerm.reduce((sum, e) => sum + e.tokenEstimate, 0)
    const maxShortTermTokens = this.maxShortTerm * 1000
    const ratio = shortTermTokens / maxShortTermTokens
    return Math.min(100, Math.round(ratio * 100))
  }

  private evictShortTerm(): void {
    if (this.shortTerm.length <= this.maxShortTerm) return
    const toCompress = this.shortTerm.slice(0, this.shortTerm.length - this.maxShortTerm)
    if (toCompress.length > 0) {
      const content = toCompress.map((e) => e.content).join("\n")
      const compressed = this.compressor.summarizeExecutionHistory(toCompress.map((e) => e.content))
      this.addCompressed({ content: compressed, executionId: null, agentId: null })
    }
    this.shortTerm = this.shortTerm.slice(-this.maxShortTerm)
  }

  private evictCompressed(): void {
    if (this.compressed.length <= this.maxCompressed) return
    this.compressed = this.compressed.slice(-this.maxCompressed)
  }
}
