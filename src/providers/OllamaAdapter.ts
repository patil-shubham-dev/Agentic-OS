import { BaseProviderAdapter, type ProviderCapabilities, type ModelInfo, type CompletionRequest, type StreamCallbacks } from "./BaseProviderAdapter"
import { StreamNormalizer, type NormalizedChunk } from "./StreamNormalizer"

export class OllamaAdapter extends BaseProviderAdapter {
  readonly defaultBaseUrl = "http://localhost:11434"
  private normalizer = new StreamNormalizer()
  private isOllamaApi: boolean

  constructor(apiKey: string, baseUrl?: string) {
    super("ollama", "Ollama", baseUrl ?? "http://localhost:11434", apiKey)
    this.isOllamaApi = this.baseUrl.includes("11434") || !this.baseUrl.includes("v1")
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const apiUrl = this.isOllamaApi
        ? `${this.baseUrl}/api/tags`
        : `${this.baseUrl}/models`

      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(3000) })
      if (!response.ok) return this.getDefaultModels()

      const data = await response.json() as any
      const models: ModelInfo[] = []
      const base = this.getCapabilities()

      const list = data.models ?? data.data ?? []
      for (const m of list) {
        const name = m.name ?? m.id ?? ""
        models.push({
          id: name,
          name: name,
          capabilities: { ...base, maxContextWindow: this.inferContextWindow(name) },
        })
      }

      return models.length > 0 ? models : this.getDefaultModels()
    } catch {
      return this.getDefaultModels()
    }
  }

  async stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
    if (this.isOllamaApi) {
      await this.streamOllamaNative(request, callbacks, signal)
    } else {
      await this.streamOpenAICompat(request, callbacks, signal)
    }
  }

  private async streamOllamaNative(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
    const url = `${this.baseUrl}/api/chat`
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: true,
    }
    if (request.temperature !== undefined) body.temperature = request.temperature
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }))
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        callbacks.onError(new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`))
        return
      }

      if (!response.body) {
        callbacks.onError(new Error("Response body is null"))
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split("\n")

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            const content = parsed.message?.content ?? ""
            if (content) {
              callbacks.onChunk({
                deltaText: content,
                reasoningText: null,
                toolCalls: [],
                usage: null,
                finishReason: parsed.done ? "stop" : null,
              })
            }
            if (parsed.done) {
              callbacks.onDone({
                deltaText: "",
                reasoningText: null,
                toolCalls: [],
                usage: parsed.done_reason
                  ? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
                  : null,
                finishReason: "stop",
              })
            }
          } catch {
            // skip unparseable lines
          }
        }
      }
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private async streamOpenAICompat(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
    const url = `${this.baseUrl}/chat/completions`
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: true,
      max_tokens: request.maxTokens ?? 4096,
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
    if (this.isOllamaApi) {
      const url = `${this.baseUrl}/api/chat`
      const body: Record<string, unknown> = {
        model: request.model,
        messages: request.messages,
        stream: false,
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
      }

      const data = await response.json() as any
      return {
        content: data.message?.content ?? "",
        usage: null,
      }
    } else {
      const url = `${this.baseUrl}/chat/completions`
      const body: Record<string, unknown> = {
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens ?? 4096,
      }

      const data = await this.fetchJson(url, body, signal)
      const choice = (data as any).choices?.[0]
      return {
        content: choice?.message?.content ?? "",
        usage: null,
      }
    }
  }

  async validateConnection(): Promise<{ valid: boolean; latencyMs: number; error: string | null }> {
    const t0 = performance.now()
    try {
      const url = this.isOllamaApi ? `${this.baseUrl}/api/tags` : `${this.baseUrl}/models`
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
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
      maxContextWindow: 32768,
      maxOutputTokens: 4096,
      supportsSystemMessages: true,
      supportsFunctionCalling: true,
    }
  }

  private getDefaultModels(): ModelInfo[] {
    const base = this.getCapabilities()
    return [
      { id: "llama3.2", name: "Llama 3.2", capabilities: { ...base, maxContextWindow: 128000 } },
      { id: "llama3.1", name: "Llama 3.1", capabilities: { ...base, maxContextWindow: 128000 } },
      { id: "mistral", name: "Mistral", capabilities: { ...base, maxContextWindow: 32768 } },
      { id: "codellama", name: "CodeLlama", capabilities: { ...base, maxContextWindow: 16384 } },
      { id: "deepseek-coder", name: "DeepSeek Coder", capabilities: { ...base, maxContextWindow: 16384 } },
    ]
  }

  private inferContextWindow(name: string): number {
    const lower = name.toLowerCase()
    if (lower.includes("128k") || lower.includes("claude")) return 128000
    if (lower.includes("70b") || lower.includes("405b")) return 131072
    if (lower.includes("32k")) return 32768
    if (lower.includes("16k")) return 16384
    if (lower.includes("8k")) return 8192
    return 4096
  }

  protected buildHeaders(): Record<string, string> {
    return { "Content-Type": "application/json" }
  }
}
