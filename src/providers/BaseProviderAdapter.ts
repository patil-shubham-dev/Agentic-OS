import type { NormalizedChunk } from "./StreamNormalizer"
// fetchStream and fetchJson use native fetch() — no Tauri IPC dependency

export interface ProviderCapabilities {
  streaming: boolean
  toolCalls: boolean
  vision: boolean
  reasoning: boolean
  maxContextWindow: number
  maxOutputTokens: number
  supportsSystemMessages: boolean
  supportsFunctionCalling: boolean
}

export interface ModelInfo {
  id: string
  name: string
  capabilities: ProviderCapabilities
}

export interface StreamCallbacks {
  onChunk: (chunk: NormalizedChunk) => void
  onDone: (finalChunk: NormalizedChunk) => void
  onError: (error: Error) => void
}

export interface CompletionRequest {
  model: string
  messages: { role: string; content: string }[]
  tools?: { name: string; description: string; parameters: Record<string, unknown> }[]
  maxTokens?: number
  temperature?: number
  topP?: number
  stop?: string[]
}

/** Supported provider protocol types for routing through the correct Tauri IPC or HTTP flow */
export type ProviderProtocol = "openai" | "anthropic"

export abstract class BaseProviderAdapter {
  readonly id: string
  readonly name: string
  /** Protocol determines which Tauri IPC command and HTTP format to use */
  protected protocol: ProviderProtocol = "openai"
  protected baseUrl: string
  protected apiKey: string

  constructor(id: string, name: string, baseUrl: string, apiKey: string) {
    this.id = id
    this.name = name
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  abstract getModels(): Promise<ModelInfo[]>
  abstract stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void>
  abstract complete(request: CompletionRequest, signal?: AbortSignal): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null }>
  abstract validateConnection(): Promise<{ valid: boolean; latencyMs: number; error: string | null }>
  abstract getCapabilities(): ProviderCapabilities

  updateCredentials(apiKey: string, baseUrl?: string): void {
    this.apiKey = apiKey
    if (baseUrl) {
      this.baseUrl = baseUrl
    }
  }

  protected isExternalProvider(): boolean {
    return !this.baseUrl.includes("localhost") && !this.baseUrl.includes("127.0.0.1")
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
    }
  }

  protected async fetchStream(
    url: string,
    body: Record<string, unknown>,
    onLine: (line: string) => void,
    onError: (error: Error) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    // Raw SSE stream transport using fetch() — works in both Tauri WebView and browser.
    // Passes each SSE line to the onLine callback for protocol-specific parsing.
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({ ...body, stream: true }),
        signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        onError(new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`))
        return
      }

      if (!response.body) {
        onError(new Error("Response body is null"))
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.replace(/\r$/, "")
          if (trimmed) {
            onLine(trimmed)
          }
        }
      }

      // Drain remaining buffer
      if (buffer.trim()) {
        onLine(buffer.trim())
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  protected async fetchJson(
    url: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    // Raw JSON POST transport using fetch() — returns the provider's raw response.
    // Works in both Tauri WebView and browser environments.
    const resp = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal,
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 300)}`)
    }

    return resp.json()
  }

  /**
   * Send a GET request and parse the JSON response.
   * Uses native fetch() for both local and external providers since model listing
   * endpoints accept GET and have permissive CORS policies. Unlike fetchJson,
   * this bypasses Tauri IPC because the chat completion backend only supports POST.
   */
  protected async fetchGet(
    url: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
      method: "GET",
      headers: this.buildHeaders(),
      signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    }

    return response.json()
  }
}
