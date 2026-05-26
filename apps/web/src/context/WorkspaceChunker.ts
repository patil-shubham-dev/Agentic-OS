export interface FileChunk {
  path: string
  startLine: number
  endLine: number
  content: string
  tokenEstimate: number
}

export class WorkspaceChunker {
  private maxChunkTokens: number
  private overlapLines: number

  constructor(maxChunkTokens: number = 2000, overlapLines: number = 5) {
    this.maxChunkTokens = maxChunkTokens
    this.overlapLines = overlapLines
  }

  chunkFile(path: string, source: string): FileChunk[] {
    const lines = source.split("\n")
    const chunks: FileChunk[] = []

    let currentChunk: string[] = []
    let currentTokens = 0
    let chunkStartLine = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineTokens = this.estimateTokens(line)

      if (currentTokens + lineTokens > this.maxChunkTokens && currentChunk.length > 0) {
        chunks.push({
          path,
          startLine: chunkStartLine + 1,
          endLine: i,
          content: currentChunk.join("\n"),
          tokenEstimate: currentTokens,
        })

        const overlapStart = Math.max(0, currentChunk.length - this.overlapLines)
        currentChunk = currentChunk.slice(overlapStart)
        chunkStartLine = chunkStartLine + overlapStart
        currentTokens = currentChunk.reduce((sum, l) => sum + this.estimateTokens(l), 0)
      }

      currentChunk.push(line)
      currentTokens += lineTokens
    }

    if (currentChunk.length > 0) {
      chunks.push({
        path,
        startLine: chunkStartLine + 1,
        endLine: lines.length,
        content: currentChunk.join("\n"),
        tokenEstimate: currentTokens,
      })
    }

    return chunks
  }

  chunkFiles(files: { path: string; source: string }[]): FileChunk[] {
    const allChunks: FileChunk[] = []
    for (const file of files) {
      const chunks = this.chunkFile(file.path, file.source)
      allChunks.push(...chunks)
    }
    return allChunks
  }

  findRelevantChunks(
    chunks: FileChunk[],
    query: string,
    maxResults: number = 5,
  ): FileChunk[] {
    const queryTerms = this.tokenize(query)
    const scored = chunks.map((chunk) => ({
      chunk,
      score: this.computeRelevance(chunk.content, queryTerms),
    }))

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, maxResults).map((s) => s.chunk)
  }

  getMaxChunkTokens(): number {
    return this.maxChunkTokens
  }

  setMaxChunkTokens(tokens: number): void {
    this.maxChunkTokens = tokens
  }

  private computeRelevance(content: string, queryTerms: string[]): number {
    if (queryTerms.length === 0) return 0.1
    const lower = content.toLowerCase()
    let score = 0
    for (const term of queryTerms) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
      const matches = lower.match(regex)
      if (matches) {
        score += matches.length * 0.1
      }
    }
    return Math.min(score, 1.0)
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1)
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4))
  }
}
