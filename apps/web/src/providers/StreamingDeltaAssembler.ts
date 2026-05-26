import type { NormalizedChunk, NormalizedToolCall } from "./StreamNormalizer"

export interface AssembledToolCall {
  id: string
  name: string
  arguments: string
  isComplete: boolean
}

export class StreamingDeltaAssembler {
  private activeToolCalls: Map<string, AssembledToolCall> = new Map()

  ingest(chunk: NormalizedChunk): {
    text: string
    reasoning: string | null
    completedToolCalls: AssembledToolCall[]
    activeToolCalls: AssembledToolCall[]
    usage: NormalizedChunk["usage"]
    finishReason: NormalizedChunk["finishReason"]
  } {
    for (const tc of chunk.toolCalls) {
      if (tc.id) {
        const existing = this.activeToolCalls.get(tc.id)
        if (existing) {
          existing.arguments += tc.function.arguments
          if (tc.function.name) {
            existing.name += tc.function.name
          }
        } else {
          this.activeToolCalls.set(tc.id, {
            id: tc.id,
            name: tc.function.name ?? "",
            arguments: tc.function.arguments ?? "",
            isComplete: false,
          })
        }
      }
    }

    const completedToolCalls: AssembledToolCall[] = []
    if (chunk.finishReason === "tool_calls") {
      for (const [, tc] of this.activeToolCalls) {
        tc.isComplete = true
        completedToolCalls.push({ ...tc })
      }
      this.activeToolCalls.clear()
    }

    const activeCalls: AssembledToolCall[] = []
    for (const [, tc] of this.activeToolCalls) {
      activeCalls.push({ ...tc })
    }

    return {
      text: chunk.deltaText,
      reasoning: chunk.reasoningText,
      completedToolCalls,
      activeToolCalls: activeCalls,
      usage: chunk.usage,
      finishReason: chunk.finishReason,
    }
  }

  getActiveToolCalls(): AssembledToolCall[] {
    return Array.from(this.activeToolCalls.values())
  }

  hasActiveToolCalls(): boolean {
    return this.activeToolCalls.size > 0
  }

  clear(): void {
    this.activeToolCalls.clear()
  }

  getAssembledCount(): number {
    return this.activeToolCalls.size
  }
}
