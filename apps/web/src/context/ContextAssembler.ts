import { TokenBudgetManager, type TokenBudget } from "./TokenBudgetManager"
import { SlidingMemoryCompressor, type CompressedBlock } from "./SlidingMemoryCompressor"
import { ASTSummarizer } from "./ASTSummarizer"
import type { FileIndex } from "./WorkspaceIndexer"
import type { ScoredFile } from "./RetrievalEngine"

export interface AssembledContext {
  instructions: string
  history: string
  retrieval: string
  budget: TokenBudget
  totalTokens: number
}

export interface ContextInput {
  instructions: string
  conversationHistory: { role: string; content: string; timestamp?: number }[]
  retrievedFiles: ScoredFile[]
  systemPrompt?: string
}

export class ContextAssembler {
  private tokenBudget: TokenBudgetManager
  private compressor: SlidingMemoryCompressor
  private summarizer: ASTSummarizer

  constructor(tokenBudget: TokenBudgetManager, compressor: SlidingMemoryCompressor) {
    this.tokenBudget = tokenBudget
    this.compressor = compressor
    this.summarizer = new ASTSummarizer()
  }

  assemble(input: ContextInput): AssembledContext {
    const usedTokens = this.tokenBudget.estimateTokens(input.instructions)
    const budget = this.tokenBudget.allocate(usedTokens)

    const instructions = this.fitToBudget(
      input.instructions,
      budget.staticInstructions,
      "instructions",
    )

    const history = this.fitToBudget(
      this.formatHistory(input.conversationHistory),
      budget.history,
      "history",
    )

    const retrieval = this.fitToBudget(
      this.formatRetrieval(input.retrievedFiles),
      budget.retrieval,
      "retrieval",
    )

    const totalTokens =
      this.tokenBudget.estimateTokens(instructions) +
      this.tokenBudget.estimateTokens(history) +
      this.tokenBudget.estimateTokens(retrieval)

    return {
      instructions,
      history,
      retrieval,
      budget,
      totalTokens,
    }
  }

  assembleWithSystemPrompt(input: ContextInput & { systemPrompt: string }): string {
    const assembled = this.assemble(input)

    const parts: string[] = [
      input.systemPrompt,
    ]

    if (assembled.instructions.trim()) {
      parts.push("")
      parts.push(assembled.instructions)
    }

    if (assembled.history.trim()) {
      parts.push("")
      parts.push(assembled.history)
    }

    if (assembled.retrieval.trim()) {
      parts.push("")
      parts.push(assembled.retrieval)
    }

    return parts.join("\n")
  }

  private formatHistory(messages: { role: string; content: string; timestamp?: number }[]): string {
    if (messages.length === 0) return ""

    const compressed = this.compressor.compressMessages(messages.map(m => ({
      content: `${m.role}: ${m.content}`,
      timestamp: m.timestamp,
    })))

    return compressed.map((b) => b.content).join("\n")
  }

  private formatRetrieval(files: ScoredFile[]): string {
    if (files.length === 0) return ""

    const parts: string[] = ["## Relevant Files"]
    for (const file of files) {
      parts.push(`\n### ${file.path}`)
      parts.push(file.summary)
    }

    return parts.join("\n")
  }

  private fitToBudget(text: string, budgetTokens: number, label: string): string {
    const estimated = this.tokenBudget.estimateTokens(text)
    if (estimated <= budgetTokens) return text

    const compressed = this.compressor.compressText(text)
    let result = ""
    let totalTokens = 0

    for (const block of compressed.blocks) {
      const tokens = this.tokenBudget.estimateTokens(block.content)
      if (totalTokens + tokens > budgetTokens) break
      result += (result ? "\n" : "") + block.content
      totalTokens += tokens
    }

    return result || text.slice(0, budgetTokens * 4)
  }
}
