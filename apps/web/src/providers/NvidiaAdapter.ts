import { BaseProviderAdapter, type ProviderCapabilities, type ModelInfo, type CompletionRequest, type StreamCallbacks } from "./BaseProviderAdapter"
import { StreamNormalizer, type NormalizedChunk } from "./StreamNormalizer"

export class NvidiaAdapter extends BaseProviderAdapter {
  readonly defaultBaseUrl = "https://integrate.api.nvidia.com/v1"
  private normalizer = new StreamNormalizer()

  constructor(apiKey: string, baseUrl?: string) {
    super("nvidia", "Nvidia NIM", baseUrl ?? "https://integrate.api.nvidia.com/v1", apiKey)
  }

  async getModels(): Promise<ModelInfo[]> {
    const base = this.getCapabilities()
    try {
      const data = await this.fetchGet(`${this.baseUrl}/models`)
      const models: ModelInfo[] = []
      if (Array.isArray((data as any).data)) {
        for (const m of (data as any).data) {
          const id: string = m.id ?? ""
          models.push({
            id,
            name: m.id ?? id,
            capabilities: {
              ...base,
              vision: id.toLowerCase().includes("vision") || id.toLowerCase().includes("vl"),
              maxContextWindow: id.includes("128k") || id.includes("131k") ? 131072 : 128000,
            },
          })
        }
      }
      if (models.length > 0) return models
    } catch {
      // Fall back to hardcoded model list
    }

    return [
      { id: "meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B", capabilities: { ...base, maxContextWindow: 131072 } },
      { id: "meta/llama-3.1-405b-instruct", name: "Llama 3.1 405B", capabilities: { ...base, maxContextWindow: 131072 } },
      { id: "meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B", capabilities: { ...base, maxContextWindow: 131072 } },
      { id: "mistralai/mistral-large-24-11", name: "Mistral Large", capabilities: { ...base, maxContextWindow: 128000 } },
      { id: "nvidia/llama-3.1-nemotron-nano-8b-v1", name: "Nemotron Nano 8B", capabilities: { ...base, maxContextWindow: 4096 } },
    ]
  }

  async stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
    const url = `${this.baseUrl}/chat/completions`
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: true,
      max_tokens: request.maxTokens ?? 4096,
    }
    if (request.temperature !== undefined) body.temperature = request.temperature
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }))
    }

    await this.fetchStream(
      url,
      body,
      (line) => {
        const chunk = this.normalizer.normalizeOpenAI(line)
        if (chunk) {
          callbacks.onChunk(chunk)
          if (chunk.finishReason) {
            callbacks.onDone(chunk)
          }
        }
      },
      callbacks.onError,
      signal,
    )
  }

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null }> {
    const url = `${this.baseUrl}/chat/completions`
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 4096,
    }
    if (request.temperature !== undefined) body.temperature = request.temperature
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }))
    }

    const data = await this.fetchJson(url, body, signal)
    const choice = (data as any).choices?.[0]
    return {
      content: choice?.message?.content ?? "",
      usage: (data as any).usage
        ? {
            promptTokens: (data as any).usage.prompt_tokens ?? 0,
            completionTokens: (data as any).usage.completion_tokens ?? 0,
            totalTokens: (data as any).usage.total_tokens ?? 0,
          }
        : null,
    }
  }

  async validateConnection(): Promise<{ valid: boolean; latencyMs: number; error: string | null }> {
    const t0 = performance.now()
    try {
      await this.fetchGet(`${this.baseUrl}/models`, AbortSignal.timeout(5000))
      return { valid: true, latencyMs: Math.round(performance.now() - t0), error: null }
    } catch (err) {
      return { valid: false, latencyMs: Math.round(performance.now() - t0), error: String(err) }
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      toolCalls: true,
      vision: false,
      reasoning: false,
      maxContextWindow: 131072,
      maxOutputTokens: 4096,
      supportsSystemMessages: true,
      supportsFunctionCalling: true,
    }
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
    }
  }
}
