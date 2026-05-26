export interface ToolCallChunk {
  index: number
  id?: string
  function?: {
    name?: string
    arguments?: string
  }
}

export class ToolCallAssembler {
  private buffer = new Map<number, { id: string; name: string; arguments: string }>()

  ingest(chunks: ToolCallChunk[]): void {
    for (const tc of chunks) {
      const existing = this.buffer.get(tc.index) ?? {
        id: tc.id ?? "",
        name: tc.function?.name ?? "",
        arguments: "",
      }
      existing.arguments += tc.function?.arguments ?? ""
      if (tc.id) existing.id = tc.id
      if (tc.function?.name) existing.name = tc.function.name
      this.buffer.set(tc.index, existing)
    }
  }

  flush() {
    const toolCalls = Array.from(this.buffer.entries())
      .sort(([a], [b]) => a - b)
      .map(([, tc], index) => ({
        id: tc.id || `tool_call_${index}`,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }))
    this.buffer.clear()
    return toolCalls
  }
}
