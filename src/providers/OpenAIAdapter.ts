import { BaseProviderAdapter, type ProviderCapabilities, type ModelInfo, type CompletionRequest, type StreamCallbacks } from "./BaseProviderAdapter"
import { StreamNormalizer, type NormalizedChunk } from "./StreamNormalizer"

export class OpenAIAdapter extends BaseProviderAdapter {
  readonly defaultBaseUrl = "https://api.openai.com/v1"
  private normalizer = new StreamNormalizer()

  constructor(apiKey: string, baseUrl?: string) {
    super("openai", "OpenAI", baseUrl ?? "https://api.openai.com/v1", apiKey)
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const data = await this.fetchJson(`${this.baseUrl}/models`, {}, undefined)
      const models: ModelInfo[] = []
      if (Array.isArray((data as any).data)) {
        for (const m of (data as any).data) {
          models.push({
            id: m.id,
            name: m.id,
            capabilities: this.inferCapabilities(m.id),
          })
        }
      }
      return models
    } catch {
      return this.getDefaultModels()
    }
  }

  async stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
    const url = `${this.baseUrl}/chat/completions`
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: true,
      max_tokens: request.maxTokens ?? 8192,
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
      max_tokens: request.maxTokens ?? 8192,
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
      await this.fetchJson(`${this.baseUrl}/models`, {}, AbortSignal.timeout(5000))
      return { valid: true, latencyMs: Math.round(performance.now() - t0), error: null }
    } catch (err) {
      return { valid: false, latencyMs: Math.round(performance.now() - t0), error: String(err) }
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      toolCalls: true,
      vision: true,
      reasoning: true,
      maxContextWindow: 128000,
      maxOutputTokens: 16384,
      supportsSystemMessages: true,
      supportsFunctionCalling: true,
    }
  }

  private inferCapabilities(modelId: string): ProviderCapabilities {
    const base: ProviderCapabilities = {
      streaming: true, toolCalls: true, vision: false,
      reasoning: false, maxContextWindow: 8192, maxOutputTokens: 4096,
      supportsSystemMessages: true, supportsFunctionCalling: true,
    }

    if (modelId.includes("gpt-4")) {
      base.maxContextWindow = modelId.includes("128k") ? 128000 : 8192
      base.maxOutputTokens = 16384
      base.vision = modelId.includes("vision") || modelId.includes("turbo")
    }
    if (modelId.includes("gpt-4o")) {
      base.maxContextWindow = 128000
      base.maxOutputTokens = 16384
      base.vision = true
    }
    if (modelId.includes("o1") || modelId.includes("o3")) {
      base.reasoning = true
      base.maxContextWindow = 200000
      base.maxOutputTokens = 100000
    }
    if (modelId.includes("gpt-3.5")) {
      base.maxContextWindow = 16385
      base.maxOutputTokens = 4096
    }

    return base
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: "gpt-4o", name: "GPT-4o", capabilities: this.inferCapabilities("gpt-4o") },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", capabilities: this.inferCapabilities("gpt-4o") },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", capabilities: this.inferCapabilities("gpt-4-turbo") },
      { id: "o1", name: "o1", capabilities: this.inferCapabilities("o1") },
      { id: "o3-mini", name: "o3 Mini", capabilities: this.inferCapabilities("o3") },
    ]
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
    }
  }
}
