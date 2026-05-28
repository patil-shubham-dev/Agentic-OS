export interface IndexedDocument {
  id: string
  path: string
  content: string
  terms: Map<string, number>
  magnitude: number
}

export interface SearchResult {
  document: IndexedDocument
  score: number
  matches: string[]
}

export class SemanticSearchIndex {
  private static instance: SemanticSearchIndex | null = null
  private documents: Map<string, IndexedDocument> = new Map()
  private idfCache: Map<string, number> = new Map()
  private dirty: boolean = true

  static getInstance(): SemanticSearchIndex {
    if (!SemanticSearchIndex.instance) {
      SemanticSearchIndex.instance = new SemanticSearchIndex()
    }
    return SemanticSearchIndex.instance
  }

  index(path: string, content: string): void {
    const terms = this.extractTerms(content)
    const magnitude = this.computeMagnitude(terms)
    const id = `${path}:${content.length}:${Date.now()}`

    this.documents.set(path, { id, path, content, terms, magnitude })
    this.dirty = true
  }

  indexBatch(files: { path: string; content: string }[]): void {
    for (const file of files) {
      this.index(file.path, file.content)
    }
  }

  remove(path: string): void {
    this.documents.delete(path)
    this.dirty = true
  }

  search(query: string, maxResults: number = 10): SearchResult[] {
    if (this.dirty) {
      this.rebuildIdf()
    }

    const queryTerms = this.extractTerms(query)
    const queryMagnitude = this.computeMagnitude(queryTerms)

    if (queryTerms.size === 0 || queryMagnitude === 0) return []

    const scored: SearchResult[] = []

    for (const [, doc] of this.documents) {
      let dotProduct = 0

      for (const [term, queryTf] of queryTerms) {
        const docTf = doc.terms.get(term) ?? 0
        const idf = this.idfCache.get(term) ?? 1
        if (docTf > 0) {
          dotProduct += queryTf * docTf * idf * idf
        }
      }

      if (dotProduct === 0) continue

      const score = dotProduct / (queryMagnitude * doc.magnitude)
      if (score <= 0) continue

      const matches: string[] = []
      for (const term of queryTerms.keys()) {
        if (doc.terms.has(term)) {
          matches.push(term)
        }
      }

      scored.push({ document: doc, score, matches })
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, maxResults)
  }

  searchByPrefix(prefix: string, maxResults: number = 10): SearchResult[] {
    const lowerPrefix = prefix.toLowerCase()
    const results: SearchResult[] = []

    for (const [, doc] of this.documents) {
      const lowerPath = doc.path.toLowerCase()
      if (lowerPath.includes(lowerPrefix)) {
        results.push({
          document: doc,
          score: 1.0,
          matches: [doc.path],
        })
      }
    }

    return results.slice(0, maxResults)
  }

  clear(): void {
    this.documents.clear()
    this.idfCache.clear()
    this.dirty = true
  }

  getDocumentCount(): number {
    return this.documents.size
  }

  getDocument(path: string): IndexedDocument | undefined {
    return this.documents.get(path)
  }

  getAllDocuments(): IndexedDocument[] {
    return Array.from(this.documents.values())
  }

  private extractTerms(text: string): Map<string, number> {
    const terms = new Map<string, number>()
    const tokens = text.toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && t.length < 50)

    for (const token of tokens) {
      terms.set(token, (terms.get(token) ?? 0) + 1)
    }

    return terms
  }

  private computeMagnitude(terms: Map<string, number>): number {
    let sum = 0
    for (const [, tf] of terms) {
      sum += tf * tf
    }
    return Math.sqrt(sum)
  }

  private rebuildIdf(): void {
    this.idfCache.clear()
    const docCount = this.documents.size
    if (docCount === 0) return

    const docFreq = new Map<string, number>()

    for (const [, doc] of this.documents) {
      const seen = new Set<string>()
      for (const term of doc.terms.keys()) {
        if (!seen.has(term)) {
          seen.add(term)
          docFreq.set(term, (docFreq.get(term) ?? 0) + 1)
        }
      }
    }

    for (const [term, freq] of docFreq) {
      this.idfCache.set(term, Math.log((docCount + 1) / (freq + 1)) + 1)
    }

    this.dirty = false
  }
}
