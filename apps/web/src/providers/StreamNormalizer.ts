export interface NormalizedToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface NormalizedChunk {
  deltaText: string
  reasoningText: string | null
  toolCalls: NormalizedToolCall[]
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | "error" | null
}

export class StreamNormalizer {
  normalizeOpenAI(line: string): NormalizedChunk | null {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith("data:")) return null
    const data = trimmed.slice(5).trim()
    if (data === "[DONE]") {
      return {
        deltaText: "",
        reasoningText: null,
        toolCalls: [],
        usage: null,
        finishReason: "stop",
      }
    }
    try {
      const parsed = JSON.parse(data)
      const choice = parsed.choices?.[0]
      if (!choice) return null

      const delta = choice.delta ?? {}
      const text = delta.content ?? ""
      const reasoning = delta.reasoning_content ?? delta.reasoning ?? null

      const toolCalls: NormalizedToolCall[] = []
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          toolCalls.push({
            id: tc.id ?? `call_${Date.now()}`,
            type: "function",
            function: {
              name: tc.function?.name ?? "",
              arguments: tc.function?.arguments ?? "",
            },
          })
        }
      }

      const usage = parsed.usage
        ? {
            promptTokens: parsed.usage.prompt_tokens ?? 0,
            completionTokens: parsed.usage.completion_tokens ?? 0,
            totalTokens: parsed.usage.total_tokens ?? 0,
          }
        : null

      const finishReason = choice.finish_reason ?? null

      return { deltaText: text, reasoningText: reasoning, toolCalls, usage, finishReason }
    } catch {
      return null
    }
  }

  normalizeAnthropic(line: string): NormalizedChunk | null {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith("data:")) return null
    const data = trimmed.slice(5).trim()
    if (!data || data === "[DONE]") {
      return {
        deltaText: "",
        reasoningText: null,
        toolCalls: [],
        usage: null,
        finishReason: "stop",
      }
    }
    try {
      const parsed = JSON.parse(data)
      const text = parsed.delta?.text ?? ""
      const reasoning = parsed.delta?.reasoning ?? null

      const toolCalls: NormalizedToolCall[] = []
      if (parsed.type === "content_block_start" && parsed.content_block?.type === "tool_use") {
        toolCalls.push({
          id: parsed.content_block.id,
          type: "function",
          function: {
            name: parsed.content_block.name,
            arguments: parsed.content_block.input ?? "",
          },
        })
      }

      return {
        deltaText: text,
        reasoningText: reasoning,
        toolCalls,
        usage: null,
        finishReason: parsed.stop_reason ?? null,
      }
    } catch {
      return null
    }
  }

  normalizeGeneric(data: string): NormalizedChunk | null {
    const trimmed = data.trim()
    if (!trimmed || trimmed === "[DONE]") {
      return {
        deltaText: "",
        reasoningText: null,
        toolCalls: [],
        usage: null,
        finishReason: "stop",
      }
    }
    try {
      const parsed = JSON.parse(trimmed)
      const choice = parsed.choices?.[0]
      if (!choice) return null

      const text = choice.delta?.content ?? choice.text ?? ""
      const delta = choice.delta ?? {}
      const reasoning = delta.reasoning_content ?? delta.reasoning ?? null

      const toolCalls: NormalizedToolCall[] = []
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          toolCalls.push({
            id: tc.id ?? `call_${Date.now()}`,
            type: "function",
            function: {
              name: tc.function?.name ?? "",
              arguments: tc.function?.arguments ?? "",
            },
          })
        }
      }

      const usage = parsed.usage
        ? {
            promptTokens: parsed.usage.prompt_tokens ?? parsed.usage.input_tokens ?? 0,
            completionTokens: parsed.usage.completion_tokens ?? parsed.usage.output_tokens ?? 0,
            totalTokens: parsed.usage.total_tokens ?? 0,
          }
        : null

      return {
        deltaText: text,
        reasoningText: reasoning,
        toolCalls,
        usage,
        finishReason: choice.finish_reason ?? null,
      }
    } catch {
      return null
    }
  }
}
