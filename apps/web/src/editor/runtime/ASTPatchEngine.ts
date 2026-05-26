import { SearchReplaceEngine, type SearchReplaceResult } from "./SearchReplaceEngine"

export interface ASTPatch {
  op: "replace_function_body" | "replace_class_method" | "insert_after" | "insert_before" | "replace_export" | "replace_type" | "replace_interface"
  target: string
  code: string
}

export interface ASTPatchResult {
  success: boolean
  newContent: string
  error: string | null
  byteOffset: number | null
  byteLength: number | null
}

export class ASTPatchEngine {
  private searchReplace: SearchReplaceEngine

  constructor() {
    this.searchReplace = new SearchReplaceEngine()
  }

  applyPatch(source: string, patch: ASTPatch): ASTPatchResult {
    switch (patch.op) {
      case "replace_function_body":
        return this.replaceFunctionBody(source, patch.target, patch.code)
      case "replace_class_method":
        return this.replaceClassMethod(source, patch.target, patch.code)
      case "insert_after":
        return this.insertAfter(source, patch.target, patch.code)
      case "insert_before":
        return this.insertBefore(source, patch.target, patch.code)
      case "replace_export":
        return this.replaceExport(source, patch.target, patch.code)
      case "replace_type":
        return this.replaceType(source, patch.target, patch.code)
      case "replace_interface":
        return this.replaceInterface(source, patch.target, patch.code)
      default:
        return { success: false, newContent: source, error: `Unknown operation: ${patch.op}`, byteOffset: null, byteLength: null }
    }
  }

  private replaceFunctionBody(source: string, functionName: string, newBody: string): ASTPatchResult {
    const funcRegex = new RegExp(
      `(${this.escapeRegex(functionName)}\\s*[=(]\\s*(?:async\\s+)?function\\s*\\([^)]*\\)\\s*(?::\\s*\\w+)?\\s*\\{)[^}]*\\}`,
      "g",
    )

    const match = funcRegex.exec(source)
    if (match) {
      const start = match.index
      const end = start + match[0].length
      const header = match[1]
      const newContent = source.slice(0, start) + header + newBody + "}" + source.slice(end)
      return { success: true, newContent, error: null, byteOffset: start, byteLength: end - start }
    }

    const arrowRegex = new RegExp(
      `(const\\s+${this.escapeRegex(functionName)}\\s*=\\s*(?:async\\s+)?\\([^)]*\\)\\s*(?::\\s*\\w+)?\\s*=>\\s*\\{)[^}]*\\}`,
      "g",
    )

    const arrowMatch = arrowRegex.exec(source)
    if (arrowMatch) {
      const start = arrowMatch.index
      const end = start + arrowMatch[0].length
      const header = arrowMatch[1]
      const newContent = source.slice(0, start) + header + newBody + "}" + source.slice(end)
      return { success: true, newContent, error: null, byteOffset: start, byteLength: end - start }
    }

    return this.searchReplaceFallback(source, functionName, newBody)
  }

  private replaceClassMethod(source: string, methodName: string, newBody: string): ASTPatchResult {
    const regex = new RegExp(
      `(${this.escapeRegex(methodName)}\\s*\\([^)]*\\)\\s*(?::\\s*\\w+)?\\s*\\{)[^}]*\\}`,
      "g",
    )

    const match = regex.exec(source)
    if (match) {
      const start = match.index
      const end = start + match[0].length
      const header = match[1]
      const newContent = source.slice(0, start) + header + newBody + "}" + source.slice(end)
      return { success: true, newContent, error: null, byteOffset: start, byteLength: end - start }
    }

    return this.searchReplaceFallback(source, methodName, newBody)
  }

  private insertAfter(source: string, target: string, code: string): ASTPatchResult {
    const index = source.indexOf(target)
    if (index === -1) {
      return { success: false, newContent: source, error: `Target "${target}" not found for insert_after`, byteOffset: null, byteLength: null }
    }

    const newContent = source.slice(0, index + target.length) + "\n" + code + source.slice(index + target.length)
    return { success: true, newContent, error: null, byteOffset: index + target.length, byteLength: 0 }
  }

  private insertBefore(source: string, target: string, code: string): ASTPatchResult {
    const index = source.indexOf(target)
    if (index === -1) {
      return { success: false, newContent: source, error: `Target "${target}" not found for insert_before`, byteOffset: null, byteLength: null }
    }

    const newContent = source.slice(0, index) + code + "\n" + source.slice(index)
    return { success: true, newContent, error: null, byteOffset: index, byteLength: 0 }
  }

  private replaceExport(source: string, exportName: string, newCode: string): ASTPatchResult {
    const regex = new RegExp(
      `(export\\s+(default\\s+)?(function|class|const|let|var|interface|type|enum)\\s+)${this.escapeRegex(exportName)}[^;]*;?`,
      "g",
    )

    const match = regex.exec(source)
    if (match) {
      const start = match.index
      const end = start + match[0].length
      const newContent = source.slice(0, start) + newCode + source.slice(end)
      return { success: true, newContent, error: null, byteOffset: start, byteLength: end - start }
    }

    return this.searchReplaceFallback(source, exportName, newCode)
  }

  private replaceType(source: string, typeName: string, newCode: string): ASTPatchResult {
    const regex = new RegExp(
      `(export\\s+)?(type\\s+)${this.escapeRegex(typeName)}\\s*=\\s*[^;]+;`,
      "g",
    )

    const match = regex.exec(source)
    if (match) {
      const start = match.index
      const end = start + match[0].length
      const newContent = source.slice(0, start) + newCode + source.slice(end)
      return { success: true, newContent, error: null, byteOffset: start, byteLength: end - start }
    }

    return this.searchReplaceFallback(source, typeName, newCode)
  }

  private replaceInterface(source: string, interfaceName: string, newCode: string): ASTPatchResult {
    const regex = new RegExp(
      `(export\\s+)?(interface\\s+)${this.escapeRegex(interfaceName)}\\s*\\{[^}]*\\}`,
      "g",
    )

    const match = regex.exec(source)
    if (match) {
      const start = match.index
      const end = start + match[0].length
      const newContent = source.slice(0, start) + newCode + source.slice(end)
      return { success: true, newContent, error: null, byteOffset: start, byteLength: end - start }
    }

    return this.searchReplaceFallback(source, interfaceName, newCode)
  }

  private searchReplaceFallback(source: string, target: string, code: string): ASTPatchResult {
    const result: SearchReplaceResult = this.searchReplace.replace(source, target, code)
    if (result.success) {
      return { success: true, newContent: result.newContent, error: null, byteOffset: null, byteLength: null }
    }
    return { success: false, newContent: source, error: `AST patch failed for "${target}": ${result.errors.join("; ")}`, byteOffset: null, byteLength: null }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
}
