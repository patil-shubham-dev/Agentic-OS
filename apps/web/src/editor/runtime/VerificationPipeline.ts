export interface VerificationResult {
  passed: boolean
  errors: string[]
  warnings: string[]
  type: "syntax" | "lsp" | "typecheck" | "test"
}

export type VerificationScope = "syntax" | "lsp" | "typecheck" | "test"

export class VerificationPipeline {
  async verify(source: string, language: string, scope: VerificationScope[] = ["syntax", "typecheck"]): Promise<VerificationResult[]> {
    const results: VerificationResult[] = []

    for (const s of scope) {
      switch (s) {
        case "syntax":
          results.push(await this.verifySyntax(source, language))
          break
        case "typecheck":
          results.push(await this.verifyTypeCheck(source, language))
          break
        case "lsp":
          results.push(await this.verifyLSP(source, language))
          break
        case "test":
          results.push(await this.verifyTests(source, language))
          break
      }
    }

    return results
  }

  async verifySyntax(source: string, language: string): Promise<VerificationResult> {
    switch (language) {
      case "typescript":
      case "javascript":
      case "tsx":
      case "jsx":
        return this.verifyTypeScriptSyntax(source)
      case "json":
        return this.verifyJSON(source)
      case "css":
      case "scss":
        return { passed: true, errors: [], warnings: [], type: "syntax" }
      default:
        return { passed: true, errors: [], warnings: [], type: "syntax" }
    }
  }

  async verifyTypeCheck(_source: string, _language: string): Promise<VerificationResult> {
    return { passed: true, errors: [], warnings: [], type: "typecheck" }
  }

  async verifyLSP(_source: string, _language: string): Promise<VerificationResult> {
    return { passed: true, errors: [], warnings: [], type: "lsp" }
  }

  async verifyTests(_source: string, _language: string): Promise<VerificationResult> {
    return { passed: true, errors: [], warnings: [], type: "test" }
  }

  allPassed(results: VerificationResult[]): boolean {
    return results.every((r) => r.passed)
  }

  getErrors(results: VerificationResult[]): string[] {
    return results.flatMap((r) => r.errors)
  }

  getWarnings(results: VerificationResult[]): string[] {
    return results.flatMap((r) => r.warnings)
  }

  private async verifyTypeScriptSyntax(source: string): Promise<VerificationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    const lines = source.split("\n")
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes("debugger;")) {
        warnings.push(`Line ${i + 1}: debugger statement`)
      }
    }

    const openBraces = (source.match(/\{/g) ?? []).length
    const closeBraces = (source.match(/\}/g) ?? []).length
    if (openBraces !== closeBraces) {
      errors.push(`Mismatched braces: ${openBraces} open, ${closeBraces} close`)
    }

    const openParens = (source.match(/\(/g) ?? []).length
    const closeParens = (source.match(/\)/g) ?? []).length
    if (openParens !== closeParens) {
      errors.push(`Mismatched parentheses: ${openParens} open, ${closeParens} close`)
    }

    const openBrackets = (source.match(/\[/g) ?? []).length
    const closeBrackets = (source.match(/\]/g) ?? []).length
    if (openBrackets !== closeBrackets) {
      errors.push(`Mismatched brackets: ${openBrackets} open, ${closeBrackets} close`)
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      type: "syntax",
    }
  }

  private async verifyJSON(source: string): Promise<VerificationResult> {
    try {
      JSON.parse(source)
      return { passed: true, errors: [], warnings: [], type: "syntax" }
    } catch (err) {
      return {
        passed: false,
        errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
        warnings: [],
        type: "syntax",
      }
    }
  }
}
