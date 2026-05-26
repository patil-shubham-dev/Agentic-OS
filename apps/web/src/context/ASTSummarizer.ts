export interface ASTSummary {
  imports: string[]
  interfaces: string[]
  typeAliases: string[]
  functionSignatures: string[]
  classSignatures: string[]
  exports: string[]
  dependencies: string[]
}

export class ASTSummarizer {
  summarize(source: string): ASTSummary {
    return {
      imports: this.extractImports(source),
      interfaces: this.extractInterfaces(source),
      typeAliases: this.extractTypeAliases(source),
      functionSignatures: this.extractFunctionSignatures(source),
      classSignatures: this.extractClassSignatures(source),
      exports: this.extractExports(source),
      dependencies: this.extractDependencies(source),
    }
  }

  summarizeToText(source: string): string {
    const summary = this.summarize(source)
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

  private extractImports(source: string): string[] {
    const imports: string[] = []
    const regex = /^(import|export\s+import)\s.+?;?\s*$/gm
    let match
    while ((match = regex.exec(source)) !== null) {
      imports.push(match[0].trim())
    }
    return imports
  }

  private extractInterfaces(source: string): string[] {
    const interfaces: string[] = []
    const regex = /export\s+(interface|type)\s+\w+[\s\S]*?(?=\{|$)/gm
    let match
    while ((match = regex.exec(source)) !== null) {
      const signature = match[0].trim()
      const bodyStart = source.indexOf("{", match.index)
      if (bodyStart !== -1) {
        const body = this.extractBracedBlock(source, bodyStart)
        interfaces.push(`${signature} { ... }`)
      } else {
        interfaces.push(signature)
      }
    }
    return interfaces
  }

  private extractTypeAliases(source: string): string[] {
    const aliases: string[] = []
    const regex = /export\s+type\s+\w+\s*=\s*[\s\S]*?(?=;|\n\n)/g
    let match
    while ((match = regex.exec(source)) !== null) {
      const alias = match[0].trim()
      if (alias.length < 200) {
        aliases.push(alias)
      } else {
        aliases.push(alias.slice(0, 100) + " ...")
      }
    }
    return aliases
  }

  private extractFunctionSignatures(source: string): string[] {
    const signatures: string[] = []
    const regex = /(export\s+)?(async\s+)?function\s+\w+\s*\([^)]*\)\s*(:\s*\w+)?/g
    let match
    while ((match = regex.exec(source)) !== null) {
      signatures.push(match[0].trim() + ";")
    }

    const arrowRegex = /(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*(:\s*\w+)?\s*=>/g
    while ((match = arrowRegex.exec(source)) !== null) {
      signatures.push(match[0].trim() + " => ...;")
    }

    return signatures
  }

  private extractClassSignatures(source: string): string[] {
    const classes: string[] = []
    const regex = /(export\s+)?(abstract\s+)?class\s+\w+[\s\S]*?(?=\{)/g
    let match
    while ((match = regex.exec(source)) !== null) {
      const signature = match[0].trim()
      const methods = this.extractMethodSignatures(source, match.index + match[0].length)
      classes.push(`${signature} {\n${methods.join("\n")}\n}`)
    }
    return classes
  }

  private extractMethodSignatures(source: string, classBodyStart: number): string[] {
    const methods: string[] = []
    const body = source.slice(classBodyStart)
    const bodyEnd = this.findMatchingBrace(body, 0)
    const classBody = body.slice(1, bodyEnd)

    const methodRegex = /(public|private|protected|static|async)?\s*\w+\s*\([^)]*\)\s*(:\s*\w+)?/g
    let match
    while ((match = methodRegex.exec(classBody)) !== null) {
      methods.push("  " + match[0].trim() + ";")
    }

    return methods
  }

  private extractExports(source: string): string[] {
    const exports: string[] = []
    const regex = /export\s+(default\s+)?(function|class|const|let|var|interface|type|enum)\s+(\w+)/g
    const seen = new Set<string>()
    let match
    while ((match = regex.exec(source)) !== null) {
      const name = match[3]
      if (!seen.has(name)) {
        seen.add(name)
        exports.push(match[0].trim())
      }
    }
    return exports
  }

  private extractDependencies(source: string): string[] {
    const deps: string[] = []
    const regex = /from\s+["']([^"']+)["']/g
    let match
    while ((match = regex.exec(source)) !== null) {
      if (!deps.includes(match[1])) {
        deps.push(match[1])
      }
    }
    return deps
  }

  private extractBracedBlock(source: string, startIndex: number): string {
    let depth = 0
    let i = startIndex
    while (i < source.length) {
      if (source[i] === "{") depth++
      if (source[i] === "}") {
        depth--
        if (depth === 0) return source.slice(startIndex, i + 1)
      }
      i++
    }
    return source.slice(startIndex)
  }

  private findMatchingBrace(source: string, startIndex: number): number {
    let depth = 0
    let i = startIndex
    while (i < source.length) {
      if (source[i] === "{") depth++
      if (source[i] === "}") {
        depth--
        if (depth === 0) return i
      }
      i++
    }
    return source.length
  }
}
