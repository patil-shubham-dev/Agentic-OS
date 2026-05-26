import type { GatewayProvider, ProviderModel, ValidationResult, DiscoveryResult } from "@agentic-os/shared"

export interface ChatCompletionRequest {
  model: string
  messages: { role: string; content: string }[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  content: string
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export async function validateProvider(provider: GatewayProvider): Promise<ValidationResult> {
  const start = performance.now()
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    })
    const latencyMs = Math.round(performance.now() - start)

    if (!response.ok) {
      return { success: false, runtime: null, latencyMs, error: `HTTP ${response.status}: ${response.statusText}` }
    }

    return { success: true, runtime: "openai", latencyMs, error: null }
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start)
    return { success: false, runtime: null, latencyMs, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function discoverModels(provider: GatewayProvider): Promise<DiscoveryResult> {
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      return { success: false, models: [], error: `HTTP ${response.status}: ${response.statusText}` }
    }

    const data = await response.json()
    const models: ProviderModel[] = (data.data || []).map((m: { id: string }) => ({
      id: m.id,
      name: m.id,
      supportsTools: m.id.includes("gpt") || m.id.includes("claude") || m.id.includes("gemini"),
      supportsVision: m.id.includes("vision") || m.id.includes("gpt-4") || m.id.includes("claude-3") || m.id.includes("gemini"),
      supportsStreaming: true,
    }))

    return { success: true, models, error: null }
  } catch (error) {
    return { success: false, models: [], error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function chatCompletion(
  provider: GatewayProvider,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 8192,
      stream: false,
    }),
    signal: AbortSignal.timeout(180000),
  })

  if (!response.ok) {
    throw new Error(`Chat completion failed: HTTP ${response.status}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    model: data.model,
    usage: data.usage,
  }
}

export async function* streamChatCompletion(
  provider: GatewayProvider,
  request: ChatCompletionRequest
): AsyncGenerator<string> {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 8192,
      stream: true,
    }),
    signal: AbortSignal.timeout(300000),
  })

  if (!response.ok) {
    throw new Error(`Stream chat completion failed: HTTP ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)
        if (data === "[DONE]") return
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) yield content
        } catch { /* skip parse errors */ }
      }
    }
  }
}
