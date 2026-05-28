import type { ToolResult } from '../core/ToolResult'

export type MappedResult = {
  content: string
  isError: boolean
  metadata?: Record<string, unknown>
}

export class ToolResultMapper {
  toBlockParam(result: ToolResult): MappedResult {
    const content = result.error
      ? `Error: ${result.error}`
      : typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data, null, 2)

    return {
      content: content.length > 100_000 ? content.slice(0, 100_000) + '\n\n[Result truncated at 100k chars]' : content,
      isError: result.isError ?? !!result.error,
      metadata: result.meta,
    }
  }

  toSystemMessage(result: ToolResult): string | null {
    if (!result.newMessages || result.newMessages.length === 0) return null
    return result.newMessages.map(m => `${m.role}: ${m.content}`).join('\n')
  }

  truncateForTokenBudget(result: ToolResult, maxChars: number): ToolResult {
    const dataStr = typeof result.data === 'string' ? result.data : JSON.stringify(result.data)
    if (dataStr.length <= maxChars) return result

    return {
      ...result,
      data: dataStr.slice(0, maxChars) + `\n\n[...truncated at ${maxChars} chars]`,
    }
  }
}
