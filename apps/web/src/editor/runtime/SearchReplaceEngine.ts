export interface SearchReplaceResult {
  success: boolean
  newContent: string
  replacements: number
  errors: string[]
}

export class SearchReplaceEngine {
  private fuzzyThreshold: number = 0.82

  setFuzzyThreshold(threshold: number): void {
    this.fuzzyThreshold = Math.max(0, Math.min(1, threshold))
  }

  replace(source: string, oldString: string, newString: string): SearchReplaceResult {
    const result = this.replaceExact(source, oldString, newString)
    if (result.success) return result

    return this.replaceFuzzy(source, oldString, newString)
  }

  replaceAll(source: string, oldString: string, newString: string): SearchReplaceResult {
    const index = source.indexOf(oldString)
    if (index !== -1) {
      let count = 0
      let result = source
      let searchIndex = 0
      while ((searchIndex = result.indexOf(oldString, searchIndex)) !== -1) {
        result = result.slice(0, searchIndex) + newString + result.slice(searchIndex + oldString.length)
        searchIndex += newString.length
        count++
      }
      return { success: true, newContent: result, replacements: count, errors: [] }
    }

    return this.replaceFuzzy(source, oldString, newString)
  }

  private replaceExact(source: string, oldString: string, newString: string): SearchReplaceResult {
    const index = source.indexOf(oldString)
    if (index === -1) {
      return { success: false, newContent: source, replacements: 0, errors: ["Exact match not found"] }
    }

    const result = source.slice(0, index) + newString + source.slice(index + oldString.length)
    return { success: true, newContent: result, replacements: 1, errors: [] }
  }

  private replaceFuzzy(source: string, oldString: string, newString: string): SearchReplaceResult {
    const lines = source.split("\n")
    const searchLines = oldString.split("\n")

    if (searchLines.length === 0) {
      return { success: false, newContent: source, replacements: 0, errors: ["Empty search string"] }
    }

    const normalizedSearch = this.normalizeIndent(searchLines[0])
    let bestScore = 0
    let bestIndex = -1
    let bestMatchLine = -1

    for (let i = 0; i < lines.length; i++) {
      const normalizedLine = this.normalizeIndent(lines[i])
      const score = this.levenshteinSimilarity(normalizedSearch, normalizedLine)
      if (score > bestScore && score >= this.fuzzyThreshold) {
        bestScore = score
        bestIndex = i
        bestMatchLine = i
      }
    }

    if (bestIndex === -1) {
      return { success: false, newContent: source, replacements: 0, errors: [`No fuzzy match found (best: ${(bestScore * 100).toFixed(0)}%, threshold: ${(this.fuzzyThreshold * 100).toFixed(0)}%)`] }
    }

    const matchIndent = this.getIndent(lines[bestMatchLine])
    const searchIndent = this.getIndent(searchLines[0])
    const indentDiff = matchIndent.length - searchIndent.length

    const adjustedNewLines = newString.split("\n").map((line) => {
      if (line.trim() === "") return line
      return " ".repeat(indentDiff) + line
    })
    const adjustedNewString = adjustedNewLines.join("\n")

    lines.splice(bestMatchLine, searchLines.length, adjustedNewString)
    return {
      success: true,
      newContent: lines.join("\n"),
      replacements: 1,
      errors: [`Fuzzy match (${(bestScore * 100).toFixed(0)}%) at line ${bestMatchLine + 1}`],
    }
  }

  private levenshteinSimilarity(a: string, b: string): number {
    if (a === b) return 1
    if (a.length === 0 || b.length === 0) return 0

    const maxLen = Math.max(a.length, b.length)
    const distance = this.levenshteinDistance(a, b)
    return 1 - distance / maxLen
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          )
        }
      }
    }

    return matrix[b.length][a.length]
  }

  private normalizeIndent(line: string): string {
    return line.trim().replace(/\s+/g, " ")
  }

  private getIndent(line: string): string {
    const match = line.match(/^(\s*)/)
    return match ? match[1] : ""
  }
}
