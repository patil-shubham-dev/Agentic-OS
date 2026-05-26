export interface CompressedBlock {
  type: "summary" | "head_tail" | "preserved"
  content: string
  tokenEstimate: number
  originalLength: number
}

export interface CompressionResult {
  blocks: CompressedBlock[]
  originalTokens: number
  compressedTokens: number
  compressionRatio: number
}

export class SlidingMemoryCompressor {
  private static instance: SlidingMemoryCompressor | null = null
  private headLines: number = 120
  private tailLines: number = 250
  private maxHistoryTokens: number = 32000

  static getInstance(): SlidingMemoryCompressor {
    if (!SlidingMemoryCompressor.instance) {
      SlidingMemoryCompressor.instance = new SlidingMemoryCompressor()
    }
    return SlidingMemoryCompressor.instance
  }

  configure(headLines?: number, tailLines?: number, maxHistoryTokens?: number): void {
    if (headLines !== undefined) this.headLines = headLines
    if (tailLines !== undefined) this.tailLines = tailLines
    if (maxHistoryTokens !== undefined) this.maxHistoryTokens = maxHistoryTokens
  }

  compressText(text: string): CompressionResult {
    const lines = text.split("\n")
    const originalTokens = this.estimateTokens(text)

    if (originalTokens <= this.maxHistoryTokens) {
      return {
        blocks: [{ type: "preserved", content: text, tokenEstimate: originalTokens, originalLength: text.length }],
        originalTokens,
        compressedTokens: originalTokens,
        compressionRatio: 1,
      }
    }

    const blocks: CompressedBlock[] = []

    if (lines.length > this.headLines + this.tailLines) {
      const head = lines.slice(0, this.headLines).join("\n")
      blocks.push({ type: "head_tail", content: head, tokenEstimate: this.estimateTokens(head), originalLength: head.length })

      const truncatedCount = lines.length - this.headLines - this.tailLines
      blocks.push({
        type: "summary",
        content: `[ ... truncated ${truncatedCount} lines ... ]`,
        tokenEstimate: 10,
        originalLength: 0,
      })

      const tail = lines.slice(lines.length - this.tailLines).join("\n")
      blocks.push({ type: "head_tail", content: tail, tokenEstimate: this.estimateTokens(tail), originalLength: tail.length })
    } else {
      blocks.push({ type: "preserved", content: text, tokenEstimate: originalTokens, originalLength: text.length })
    }

    const compressedTokens = blocks.reduce((sum, b) => sum + b.tokenEstimate, 0)
    return { blocks, originalTokens, compressedTokens, compressionRatio: compressedTokens / originalTokens }
  }

  compressMessages<T extends { content: string; timestamp?: number }>(
    messages: T[],
    maxTokens: number = 32000,
  ): CompressedBlock[] {
    const totalTokens = messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0)

    if (totalTokens <= maxTokens) {
      return [{
        type: "preserved",
        content: messages.map((m) => m.content).join("\n"),
        tokenEstimate: totalTokens,
        originalLength: messages.length,
      }]
    }

    const tokensPerMessage = totalTokens / messages.length
    const keepCount = Math.floor(maxTokens / tokensPerMessage)

    if (keepCount < 2) {
      const combined = messages.map((m) => m.content).join("\n")
      return this.compressText(combined).blocks
    }

    const recentMessages = messages.slice(-keepCount)
    const recentTokens = recentMessages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0)

    const blocks: CompressedBlock[] = [
      {
        type: "summary",
        content: `[ ... truncated ${messages.length - keepCount} earlier messages ... ]`,
        tokenEstimate: 10,
        originalLength: 0,
      },
      {
        type: "preserved",
        content: recentMessages.map((m) => m.content).join("\n"),
        tokenEstimate: recentTokens,
        originalLength: recentMessages.length,
      },
    ]

    return blocks
  }

  summarizeExecutionHistory(history: string[]): string {
    const combined = history.join("\n")
    const compressed = this.compressText(combined)

    if (compressed.blocks.length === 1 && compressed.blocks[0].type === "preserved") {
      return compressed.blocks[0].content
    }

    return compressed.blocks
      .map((b) => b.type === "summary" ? b.content : b.content)
      .join("\n")
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}
