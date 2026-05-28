import { WorkspaceIndexer, type FileIndex } from "./WorkspaceIndexer"
import { ASTSummarizer, type ASTSummary } from "./ASTSummarizer"
import { TokenBudgetManager } from "./TokenBudgetManager"

export interface RetrievalQuery {
  text: string
  filePattern?: string
  maxResults?: number
  maxTokens?: number
  includeContent?: boolean
}

export interface RetrievalResult {
  files: ScoredFile[]
  totalTokens: number
  queryTime: number
}

export interface ScoredFile {
  path: string
  score: number
  summary: string
  matchingImports: string[]
  matchingExports: string[]
}

export class RetrievalEngine {
  private indexer: WorkspaceIndexer
  private tokenBudget: TokenBudgetManager

  constructor(indexer: WorkspaceIndexer, tokenBudget: TokenBudgetManager) {
    this.indexer = indexer
    this.tokenBudget = tokenBudget
  }

  retrieve(query: RetrievalQuery): RetrievalResult {
    const t0 = performance.now()
    const maxResults = query.maxResults ?? 10
    const maxTokens = query.maxTokens ?? this.tokenBudget.allocate().retrieval

    const allFiles = this.indexer.getAllFiles()
    const queryTerms = this.tokenize(query.text)
    const filePattern = query.filePattern ? new RegExp(query.filePattern, "i") : null

    const scored: ScoredFile[] = []
    let totalTokens = 0

    for (const file of allFiles) {
      if (filePattern && !filePattern.test(file.path)) continue

      const score = this.computeRelevance(file, queryTerms)
      if (score <= 0) continue

      const summaryText = this.summaryToText(file.summary)
      const summaryTokens = this.tokenBudget.estimateTokens(summaryText)
      if (totalTokens + summaryTokens > maxTokens && scored.length > 0) break

      const summary = query.includeContent
        ? this.summaryToText(file.summary)
        : this.buildSummaryLine(file)

      const matchingImports = file.summary.imports.filter((i) =>
        queryTerms.some((t) => i.toLowerCase().includes(t)),
      )
      const matchingExports = file.summary.exports.filter((e) =>
        queryTerms.some((t) => e.toLowerCase().includes(t)),
      )

      scored.push({
        path: file.path,
        score,
        summary,
        matchingImports,
        matchingExports,
      })

      totalTokens += summaryTokens
    }

    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, maxResults)

    return {
      files: top,
      totalTokens,
      queryTime: Math.round(performance.now() - t0),
    }
  }

  retrieveByPath(path: string): RetrievalResult {
    const file = this.indexer.getFile(path)
    if (!file) {
      return { files: [], totalTokens: 0, queryTime: 0 }
    }

    return {
      files: [{
        path: file.path,
        score: 1.0,
        summary: this.summaryToText(file.summary),
        matchingImports: [],
        matchingExports: file.summary.exports,
      }],
      totalTokens: this.tokenBudget.estimateTokens(this.summaryToText(file.summary)),
      queryTime: 0,
    }
  }

  private computeRelevance(file: FileIndex, queryTerms: string[]): number {
    if (queryTerms.length === 0) return 0.1

    let score = 0
    const lowerPath = file.path.toLowerCase()

    for (const term of queryTerms) {
      if (lowerPath.includes(term)) {
        score += 0.5
      }
      if (file.summary.exports.some((e) => e.toLowerCase().includes(term))) {
        score += 0.3
      }
      if (file.summary.imports.some((i) => i.toLowerCase().includes(term))) {
        score += 0.2
      }
      if (file.summary.functionSignatures.some((f) => f.toLowerCase().includes(term))) {
        score += 0.25
      }
      if (file.summary.classSignatures.some((c) => c.toLowerCase().includes(term))) {
        score += 0.25
      }
    }

    return Math.min(score, 1.0)
  }

  private summaryToText(summary: ASTSummary): string {
    const parts: string[] = []

    if (summary.imports.length > 0) {
      parts.push(summary.imports.join("\n"))
    }

    if (summary.interfaces.length > 0) {
      parts.push("")
      parts.push(...summary.interfaces)
    }

    if (summary.typeAliases.length > 0) {
      parts.push("")
      parts.push(...summary.typeAliases)
    }

    if (summary.classSignatures.length > 0) {
      parts.push("")
      parts.push(...summary.classSignatures)
    }

    if (summary.functionSignatures.length > 0) {
      parts.push("")
      parts.push(...summary.functionSignatures)
    }

    return parts.join("\n")
  }

  private buildSummaryLine(file: FileIndex): string {
    const parts: string[] = [file.path]
    if (file.summary.exports.length > 0) {
      parts.push(`exports: ${file.summary.exports.slice(0, 5).join(", ")}`)
    }
    if (file.summary.dependencies.length > 0) {
      parts.push(`deps: ${file.summary.dependencies.slice(0, 3).join(", ")}`)
    }
    return parts.join(" | ")
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1)
  }
}
