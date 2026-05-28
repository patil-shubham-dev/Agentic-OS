import { BaseProviderAdapter, type ProviderCapabilities, type ModelInfo, type CompletionRequest, type StreamCallbacks } from "./BaseProviderAdapter"
import { StreamNormalizer, type NormalizedChunk } from "./StreamNormalizer"

export class AnthropicAdapter extends BaseProviderAdapter {
  readonly defaultBaseUrl = "https://api.anthropic.com/v1"
  private normalizer = new StreamNormalizer()
  private apiVersion = "2023-06-01"

  constructor(apiKey: string, baseUrl?: string) {
    super("anthropic", "Anthropic", baseUrl ?? "https://api.anthropic.com/v1", apiKey)
    this.protocol = "anthropic"
  }

  async getModels(): Promise<ModelInfo[]> {
    return this.getDefaultModels()
  }

  async stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
    const url = `${this.baseUrl}/messages`
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.filter((m) => m.role !== "system"),
      max_tokens: request.maxTokens ?? 8192,
      stream: true,
    }
    if (request.temperature !== undefined) body.temperature = request.temperature

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }))
    }

    const systemMessages = request.messages.filter((m) => m.role === "system")
    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => ({ type: "text", text: m.content }))
    }

    await this.fetchStream(
      url,
      body,
      (line) => {
        const chunk = this.normalizer.normalizeAnthropic(line)
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
    const url = `${this.baseUrl}/messages`
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.filter((m) => m.role !== "system"),
      max_tokens: request.maxTokens ?? 8192,
    }
    if (request.temperature !== undefined) body.temperature = request.temperature

    const systemMessages = request.messages.filter((m) => m.role === "system")
    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => ({ type: "text", text: m.content }))
    }

    const data = await this.fetchJson(url, body, signal) as Record<string, unknown>

    // fetchJson() returns the raw Anthropic response — extract content
    // from the Anthropic-specific format.
    const contentBlock = ((data as any).content as Array<{ type: string; text: string }> | undefined)
      ?.find((c: { type: string }) => c.type === "text")
    const content = contentBlock?.text ?? ""
    const rawUsage = (data as any).usage as Record<string, unknown> | undefined

    return {
      content,
      usage: rawUsage
        ? {
            promptTokens: (rawUsage.input_tokens as number) ?? 0,
            completionTokens: (rawUsage.output_tokens as number) ?? 0,
            totalTokens: ((rawUsage.input_tokens as number) ?? 0) + ((rawUsage.output_tokens as number) ?? 0),
          }
        : null,
    }
  }

  async validateConnection(): Promise<{ valid: boolean; latencyMs: number; error: string | null }> {
    const t0 = performance.now()
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": this.apiVersion,
        },
        signal: AbortSignal.timeout(5000),
      })
      return { valid: response.ok, latencyMs: Math.round(performance.now() - t0), error: response.ok ? null : `HTTP ${response.status}` }
    } catch (err) {
      return { valid: false, latencyMs: Math.round(performance.now() - t0), error: String(err) }
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      toolCalls: true,
      vision: true,
      reasoning: false,
      maxContextWindow: 200000,
      maxOutputTokens: 8192,
      supportsSystemMessages: true,
      supportsFunctionCalling: true,
    }
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": this.apiVersion,
    }
  }

  private convertMessages(messages: CompletionRequest["messages"]): { role: string; content: string }[] {
    return messages.filter((m) => m.role !== "system")
  }

  private getDefaultModels(): ModelInfo[] {
    const base = this.getCapabilities()
    return [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", capabilities: { ...base, maxContextWindow: 200000, maxOutputTokens: 8192 } },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", capabilities: { ...base, maxContextWindow: 200000, maxOutputTokens: 8192 } },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", capabilities: { ...base, maxContextWindow: 200000, maxOutputTokens: 8192 } },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", capabilities: { ...base, maxContextWindow: 200000, maxOutputTokens: 4096 } },
    ]
  }
}
