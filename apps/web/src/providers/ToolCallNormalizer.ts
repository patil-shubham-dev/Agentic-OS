export interface ValidatedToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  isValid: boolean
  error: string | null
}

export class ToolCallNormalizer {
  repairJson(raw: string): string {
    if (!raw || raw.trim() === "") return "{}"

    let cleaned = raw.trim()

    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7)
    }
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3)
    }

    cleaned = cleaned.trim()

    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1")
    cleaned = cleaned.replace(/,\s*,/g, ",")

    cleaned = cleaned.replace(/'/g, '"')

    cleaned = cleaned.replace(
      /(\s*:\s*)'([^']*?)'(\s*[,}\]])/g,
      '$1"$2"$3',
    )

    cleaned = cleaned.replace(
      /(\w+):\s/g,
      '"$1": ',
    )

    let openCount = 0
    let closeCount = 0
    for (const ch of cleaned) {
      if (ch === "{") openCount++
      if (ch === "}") closeCount++
    }
    while (closeCount < openCount) {
      cleaned += "}"
      closeCount++
    }

    return cleaned
  }

  validate(toolCall: { id: string; name: string; arguments: string }): ValidatedToolCall {
    if (!toolCall.name) {
      return {
        id: toolCall.id,
        name: toolCall.name,
        arguments: {},
        isValid: false,
        error: "Tool call has no name",
      }
    }

    if (!toolCall.arguments || toolCall.arguments.trim() === "") {
      return {
        id: toolCall.id,
        name: toolCall.name,
        arguments: {},
        isValid: true,
        error: null,
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(toolCall.arguments)
    } catch {
      const repaired = this.repairJson(toolCall.arguments)
      try {
        parsed = JSON.parse(repaired)
      } catch {
        return {
          id: toolCall.id,
          name: toolCall.name,
          arguments: {},
          isValid: false,
          error: `Failed to parse tool arguments as JSON after repair attempt`,
        }
      }
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        id: toolCall.id,
        name: toolCall.name,
        arguments: {},
        isValid: false,
        error: `Tool arguments must be a JSON object, got ${typeof parsed}`,
      }
    }

    return {
      id: toolCall.id,
      name: toolCall.name,
      arguments: parsed as Record<string, unknown>,
      isValid: true,
      error: null,
    }
  }

  validateBatch(
    toolCalls: { id: string; name: string; arguments: string }[],
  ): ValidatedToolCall[] {
    return toolCalls.map((tc) => this.validate(tc))
  }

  hasInvalid(validated: ValidatedToolCall[]): boolean {
    return validated.some((v) => !v.isValid)
  }

  getInvalid(validated: ValidatedToolCall[]): ValidatedToolCall[] {
    return validated.filter((v) => !v.isValid)
  }

  escapeUnescapedQuotes(raw: string): string {
    let result = ""
    let inString = false
    let escapeNext = false

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]

      if (escapeNext) {
        result += ch
        escapeNext = false
        continue
      }

      if (ch === "\\") {
        result += ch
        escapeNext = true
        continue
      }

      if (ch === '"') {
        inString = !inString
        result += ch
        continue
      }

      if (ch === "'" && !inString) {
        result += '"'
        continue
      }

      result += ch
    }

    return result
  }
}
