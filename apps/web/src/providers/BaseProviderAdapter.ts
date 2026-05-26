import type { NormalizedChunk } from "./StreamNormalizer"
import { invoke } from "@tauri-apps/api/core"

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
    // External providers: route through Tauri IPC (CORS-immune)
    if (this.isExternalProvider()) {
      try {
        if (this.protocol === "anthropic") {
          // Anthropic protocol: use the provider_gateway streaming path
          // The Anthropic stream is handled in provider-gateway.ts which
          // uses fetch() with Anthropic-specific headers and SSE parsing.
          // Anthropic's API supports CORS, so fetch() works from any context.
          const anthropicUrl = this.baseUrl.replace(/\/+$/, "") +
            (this.baseUrl.endsWith("/v1") ? "/messages" : "/v1/messages")
          const systemMessages = ((body as any).messages ?? []).filter(
            (m: { role: string }) => m.role === "system"
          )
          const requestBody = {
            model: (body as any).model ?? "unknown",
            messages: ((body as any).messages ?? []).filter(
              (m: { role: string }) => m.role !== "system"
            ),
            max_tokens: (body as any).max_tokens ?? 8192,
            stream: true,
            ...(systemMessages.length > 0 ? {
              system: systemMessages.map((m: { content: string }) => m.content).join("\n")
            } : {}),
            ...((body as any).tools ? {
              tools: (body as any).tools.map((t: any) => ({
                name: t.function?.name ?? t.name,
                description: t.function?.description ?? t.description,
                input_schema: t.function?.parameters ?? t.parameters,
              }))
            } : {}),
          }

          const response = await fetch(anthropicUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.apiKey.trim(),
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(requestBody),
            signal,
          })

          if (!response.ok) {
            const text = await response.text().catch(() => "")
            onError(new Error(`Anthropic API error ${response.status}: ${text.slice(0, 200)}`))
            return
          }

          if (!response.body) {
            onError(new Error("Response body is null"))
            return
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ""
          let currentEvent = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""

            for (const line of lines) {
              const trimmed = line.replace(/\r$/, "")
              if (!trimmed) continue

              if (trimmed.startsWith("event: ")) {
                currentEvent = trimmed.slice(7)
                continue
              }

              if (trimmed.startsWith("data: ")) {
                const dataStr = trimmed.slice(6)
                if (dataStr) {
                  // Pass the raw data line to the normalizer
                  onLine(`data: ${dataStr}`)
                }
                currentEvent = ""
              }
            }
          }

          if (buffer.trim()) {
            const trimmed = buffer.replace(/\r$/, "").trim()
            if (trimmed.startsWith("data: ")) {
              onLine(trimmed)
            }
          }
        } else {
          // OpenAI-compatible: route through stream_openai_chat Tauri IPC
          await invoke("stream_openai_chat", {
            endpoint: url,
            apiKey: this.apiKey.trim(),
            model: (body as any).model ?? "unknown",
            messages: (body as any).messages ?? [],
            tools: (body as any).tools ?? null,
            streamId: `adapter_stream_${Date.now()}`,
          })
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)))
      }
      return
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
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
          onLine(line)
        }
      }

      if (buffer.trim()) {
        onLine(buffer)
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
    // External providers: route through Tauri IPC (CORS-immune)
    if (this.isExternalProvider()) {
      // Pass the correct runtime key so the Rust backend uses the right protocol
      const runtime = this.protocol === "anthropic" ? "Anthropic" : null
      return await invoke("provider_chat_completion", {
        baseUrl: this.baseUrl,
        apiKey: this.apiKey.trim(),
        runtime,
        request: body,
      }) as Record<string, unknown>
    }

    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    }

    return response.json()
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
