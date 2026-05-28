// ── OpenAI-Compatible Adapter Layer ──
// Handles provider-specific quirks for NVIDIA NIM, vLLM, LM Studio, Ollama, etc.
// All share the OpenAI API format but may differ in auth, streaming, model naming, etc.

import { tauriFetch } from "./http-client"
import { recordLatencySample, addTrace, recordSuccess, recordFailure } from "./provider-health"

// ── Provider-specific Config ──

export interface OpenAICompatibleConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  runtime: string | null

  // Override options
  trailingSlash?: boolean
  stripApiKey?: boolean
  useQueryParamKey?: boolean
  queryParamKeyName?: string
  bearerPrefix?: string
  authHeader?: string
  modelsEndpoint?: string
  modelPrefix?: string
  skipAuthValidation?: boolean
  nonStandardFinishReasons?: boolean
  forceJsonMode?: boolean
  defaultModel?: string
  maxContextWindow?: number
  supportsTools?: boolean
  supportsVision?: boolean
  supportsStreaming?: boolean
}

// ── Presets for Common Providers ──

export const PROVIDER_PRESETS: Record<string, Partial<OpenAICompatibleConfig>> = {
  "Nvidia NIM": {
    id: "nvidia-nim",
    name: "Nvidia NIM",
    maxContextWindow: 131072,
    defaultModel: "meta/llama-3.1-70b-instruct",
    supportsTools: true,
    supportsVision: true,
  },
  OpenAI: {
    id: "openai",
    name: "OpenAI",
    maxContextWindow: 128000,
    defaultModel: "gpt-4o-mini",
    supportsTools: true,
    supportsVision: true,
  },
  Ollama: {
    id: "ollama",
    name: "Ollama",
    skipAuthValidation: true,
    defaultModel: "llama3.2",
    supportsTools: true,
    supportsVision: true,
    maxContextWindow: 128000,
  },
  "LM Studio": {
    id: "lm-studio",
    name: "LM Studio",
    skipAuthValidation: true,
    defaultModel: "local-model",
    supportsTools: true,
    supportsVision: false,
    maxContextWindow: 8192,
  },
  vLLM: {
    id: "vllm",
    name: "vLLM",
    skipAuthValidation: true,
    defaultModel: "meta-llama/Llama-2-7b-chat-hf",
    supportsTools: true,
    supportsVision: true,
    maxContextWindow: 8192,
  },
  LiteLLM: {
    id: "litellm",
    name: "LiteLLM",
    defaultModel: "gpt-3.5-turbo",
    supportsTools: true,
    supportsVision: true,
    maxContextWindow: 128000,
  },
  LocalAI: {
    id: "local-ai",
    name: "LocalAI",
    skipAuthValidation: true,
    defaultModel: "gpt-3.5-turbo",
    supportsTools: true,
    supportsVision: true,
    maxContextWindow: 8192,
  },
  OpenRouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    supportsTools: true,
    supportsVision: true,
    maxContextWindow: 128000,
  },
  Groq: {
    id: "groq",
    name: "Groq",
    defaultModel: "llama-3.1-70b-versatile",
    supportsTools: true,
    supportsVision: true,
    maxContextWindow: 131072,
  },
  DeepSeek: {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    supportsTools: true,
    supportsVision: false,
    maxContextWindow: 128000,
  },
  "Google Gemini": {
    id: "gemini",
    name: "Google Gemini",
    useQueryParamKey: true,
    queryParamKeyName: "key",
    nonStandardFinishReasons: true,
    defaultModel: "gemini-1.5-flash",
    supportsTools: true,
    supportsVision: true,
    maxContextWindow: 1000000,
  },
  "Azure OpenAI": {
    id: "azure-openai",
    name: "Azure OpenAI",
    defaultModel: "gpt-4o",
    supportsTools: true,
    supportsVision: true,
    maxContextWindow: 128000,
  },
  "Together AI": {
    id: "together",
    name: "Together AI",
    defaultModel: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    supportsTools: true,
    supportsVision: true,
    maxContextWindow: 32768,
  },
}

export function getAdapterConfig(baseUrl: string, runtime: string | null, apiKey: string): OpenAICompatibleConfig {
  const preset = runtime ? PROVIDER_PRESETS[runtime] : null
  const clean = baseUrl.replace(/\/+$/, "")

  const config: OpenAICompatibleConfig = {
    id: preset?.id ?? "unknown",
    name: preset?.name ?? runtime ?? "Unknown",
    baseUrl: clean,
    apiKey,
    runtime,
    ...preset,
  }

  return config
}

// ── URL Construction ──

export function buildCompletionUrl(config: OpenAICompatibleConfig): string {
  const clean = config.baseUrl

  // If the URL already contains /chat/completions, use it directly
  if (clean.endsWith("/chat/completions")) return clean

  // If it's Anthropic-style, route differently
  if (clean.includes("anthropic.com")) {
    return clean.endsWith("/v1/messages") ? clean : `${clean.replace(/\/v1$/, "")}/v1/messages`
  }

  // OpenAI-compatible: ensure /v1/chat/completions
  const v1 = clean.endsWith("/v1") ? clean : `${clean}/v1`
  return `${v1}/chat/completions`
}

export function buildModelsUrl(config: OpenAICompatibleConfig): string {
  const clean = config.baseUrl

  // If custom models endpoint is specified
  if (config.modelsEndpoint) {
    const prefix = clean.endsWith("/v1") ? clean.slice(0, -3) : clean
    return `${prefix}${config.modelsEndpoint}`
  }

  // For Ollama
  if (clean.includes("11434") || config.runtime === "Ollama") {
    return `${clean.replace(/\/v1$/, "")}/api/tags`
  }

  // Standard OpenAI-compatible
  const v1 = clean.endsWith("/v1") ? clean : `${clean}/v1`
  return `${v1}/models`
}

// ── Auth Header Construction ──

export function buildAuthHeaders(config: OpenAICompatibleConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (config.skipAuthValidation || !config.apiKey) {
    return headers
  }

  // NVIDIA NIM specific: Bearer token with NVIDIA API key format
  if (config.runtime === "Nvidia NIM") {
    headers["Authorization"] = `Bearer ${config.apiKey}`
    return headers
  }

  // For Anthropic
  if (config.baseUrl.includes("anthropic.com") || config.runtime === "Anthropic") {
    headers["x-api-key"] = config.apiKey
    headers["anthropic-version"] = "2023-06-01"
    return headers
  }

  // Standard Bearer auth
  const prefix = config.bearerPrefix ?? "Bearer"
  headers[config.authHeader ?? "Authorization"] = `${prefix} ${config.apiKey}`

  return headers
}

export function buildAuthQueryParams(config: OpenAICompatibleConfig): Record<string, string> {
  if (config.useQueryParamKey && config.apiKey) {
    return { [config.queryParamKeyName ?? "key"]: config.apiKey }
  }
  return {}
}

// ── Request Body Construction ──

export function buildCompletionBody(
  config: OpenAICompatibleConfig,
  model: string,
  messages: { role: string; content: string }[],
  options?: {
    stream?: boolean
    maxTokens?: number
    temperature?: number
    topP?: number
    tools?: { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }[]
  },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: model || config.defaultModel || "gpt-4o-mini",
    messages,
    max_tokens: options?.maxTokens ?? 4096,
  }

  if (options?.stream !== undefined) body.stream = options.stream
  if (options?.temperature !== undefined) body.temperature = options.temperature
  if (options?.topP !== undefined) body.top_p = options.topP
  if (options?.tools && options.tools.length > 0) body.tools = options.tools

  // NVIDIA NIM specific: ensure proper tool format
  if (config.runtime === "Nvidia NIM" && options?.tools) {
    body.tools = options.tools.map((t) => ({
      type: "function",
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }))
  }

  // For Gemini
  if (config.runtime === "Google Gemini") {
    body.model = `models/${model}`
  }

  return body
}

// ── Response Parsing ──

export function parseStreamChunk(
  config: OpenAICompatibleConfig,
  rawLine: string,
): { content: string; finishReason: string | null; toolCalls?: any[] } | null {
  // Skip non-data lines
  const trimmed = rawLine.trim()
  if (!trimmed.startsWith("data:")) return null

  const data = trimmed.slice(5).trim()
  if (data === "[DONE]") return { content: "", finishReason: "stop" }

  try {
    const parsed = JSON.parse(data)
    const choice = parsed.choices?.[0]
    const delta = choice?.delta ?? {}

    let content = delta.content ?? ""
    if (typeof content !== "string") content = String(content ?? "")

    let finishReason: string | null = choice?.finish_reason ?? null

    // Normalize non-standard finish reasons
    if (config.nonStandardFinishReasons && finishReason) {
      if (finishReason === "eos" || finishReason === "end" || finishReason === "complete") {
        finishReason = "stop"
      }
    }

    // Extract tool calls if present
    const toolCalls = delta.tool_calls
      ? Array.isArray(delta.tool_calls)
        ? delta.tool_calls.map((tc: any) => ({
            id: tc.id ?? "",
            type: "function",
            function: {
              name: tc.function?.name ?? "",
              arguments: tc.function?.arguments ?? "",
            },
          }))
        : undefined
      : undefined

    return { content, finishReason, toolCalls }
  } catch {
    return null
  }
}

// ── Full Streaming Handler ──

export interface StreamResult {
  content: string
  finishReason: string | null
  toolCalls?: { id: string; type: string; function: { name: string; arguments: string } }[]
  totalLatencyMs: number
  ttfbMs: number
  chunkCount: number
}

export async function streamCompletion(
  config: OpenAICompatibleConfig,
  model: string,
  messages: { role: string; content: string }[],
  options?: {
    maxTokens?: number
    temperature?: number
    topP?: number
    signal?: AbortSignal
    onToken?: (token: string) => void
  },
): Promise<StreamResult> {
  const t0 = performance.now()
  const url = buildCompletionUrl(config)
  const headers = buildAuthHeaders(config)
  const body = buildCompletionBody(config, model, messages, {
    ...options,
    stream: true,
  })

  let content = ""
  let finishReason: string | null = null
  let ttfb: number | null = null
  let chunkCount = 0
  const toolCallBuffer = new Map<number, { id: string; name: string; arguments: string }>()

  try {
    const response = await tauriFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options?.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    }

    if (!response.body) {
      throw new Error("Response body is null — streaming not supported")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunkCount++
      if (ttfb === null) ttfb = performance.now() - t0

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const chunk = parseStreamChunk(config, line)
        if (chunk) {
          if (chunk.content) {
            content += chunk.content
            options?.onToken?.(chunk.content)
          }

          if (chunk.toolCalls) {
            for (const tc of chunk.toolCalls) {
              const index = toolCallBuffer.size
              const existing = toolCallBuffer.get(index) ?? { id: tc.id, name: tc.function.name, arguments: "" }
              existing.arguments += tc.function.arguments
              if (tc.id) existing.id = tc.id
              if (tc.function.name) existing.name = tc.function.name
              toolCallBuffer.set(index, existing)
            }
          }

          if (chunk.finishReason) {
            finishReason = chunk.finishReason
          }
        }
      }
    }

    const totalLatencyMs = Math.round(performance.now() - t0)
    recordSuccess(config.baseUrl, totalLatencyMs)
    recordLatencySample(config.baseUrl, totalLatencyMs)

    addTrace(config.baseUrl, {
      id: `stream_${Date.now()}`,
      timestamp: Date.now(),
      type: "response",
      providerId: config.id,
      providerName: config.name,
      url,
      statusCode: 200,
      latencyMs: totalLatencyMs,
    })

    return {
      content,
      finishReason,
      toolCalls: Array.from(toolCallBuffer.entries())
        .sort(([a], [b]) => a - b)
        .map(([, tc], i) => ({
          id: tc.id || `tc_${i}`,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      totalLatencyMs,
      ttfbMs: Math.round(ttfb ?? totalLatencyMs),
      chunkCount,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    recordFailure(config.baseUrl, msg)

    addTrace(config.baseUrl, {
      id: `stream_err_${Date.now()}`,
      timestamp: Date.now(),
      type: "error",
      providerId: config.id,
      providerName: config.name,
      url,
      errorMessage: msg,
      latencyMs: Math.round(performance.now() - t0),
    })

    throw err
  }
}

// ── Non-Streaming Chat Completion ──

export interface CompletionResult {
  content: string
  finishReason: string | null
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null
  totalLatencyMs: number
}

export async function chatCompletion(
  config: OpenAICompatibleConfig,
  model: string,
  messages: { role: string; content: string }[],
  options?: {
    maxTokens?: number
    temperature?: number
    tools?: { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }[]
    signal?: AbortSignal
  },
): Promise<CompletionResult> {
  const t0 = performance.now()
  const url = buildCompletionUrl(config)
  const headers = buildAuthHeaders(config)
  const body = buildCompletionBody(config, model, messages, options)

  try {
    const response = await tauriFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options?.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    }

    const data: any = await response.json()
    const choice = data.choices?.[0]
    const latencyMs = Math.round(performance.now() - t0)

    recordSuccess(config.baseUrl, latencyMs)
    recordLatencySample(config.baseUrl, latencyMs)

    return {
      content: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? null,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : null,
      totalLatencyMs: latencyMs,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    recordFailure(config.baseUrl, msg)
    throw err
  }
}

// ── Models Discovery ──

export async function discoverModels(
  config: OpenAICompatibleConfig,
): Promise<{ id: string; name: string }[]> {
  const url = buildModelsUrl(config)
  const headers = buildAuthHeaders(config)
  const queryParams = buildAuthQueryParams(config)

  // Build URL with query params if needed
  let fullUrl = url
  const queryString = Object.entries(queryParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&")
  if (queryString) fullUrl += `?${queryString}`

  try {
    const response = await tauriFetch(fullUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data: any = await response.json()

    // Handle different response formats
    let rawModels: any[] = []

    if (data.models && Array.isArray(data.models)) {
      // Ollama format: { models: [{ name: "..." }] }
      rawModels = data.models
      return rawModels.map((m: any) => ({
        id: m.name || m.model || m.id,
        name: m.name || m.model || m.id,
      }))
    }

    if (data.data && Array.isArray(data.data)) {
      // OpenAI format: { data: [{ id: "..." }] }
      rawModels = data.data
    }

    return rawModels
      .filter((m: any) => m.id || m.name || m.model)
      .map((m: any) => ({
        id: m.id || m.name || m.model || "",
        name: m.id || m.name || m.model || "",
      }))
  } catch (err) {
    // For local providers without /v1/models, try alternative endpoints
    if (config.skipAuthValidation) {
      try {
        // Try /models (non-v1)
        const altUrl = config.baseUrl.replace(/\/v1$/, "") + "/models"
        const resp = await tauriFetch(altUrl, { signal: AbortSignal.timeout(5000) })
        if (resp.ok) {
          const data: any = await resp.json()
          const raw = data.data || data.models || []
          if (Array.isArray(raw)) {
            return raw.map((m: any) => ({
              id: m.id || m.name || m.model || "",
              name: m.id || m.name || m.model || "",
            }))
          }
        }
      } catch {
        // Give up
      }
    }

    throw err
  }
}

// ── Connection Validation ──

export async function validateConnection(
  config: OpenAICompatibleConfig,
): Promise<{ valid: boolean; latencyMs: number; error: string | null }> {
  const t0 = performance.now()

  try {
    const models = await discoverModels(config)
    const latencyMs = Math.round(performance.now() - t0)

    if (models.length > 0) {
      return { valid: true, latencyMs, error: null }
    }

    // Models endpoint worked but returned empty — try chat completion
    try {
      await chatCompletion(config, config.defaultModel || "gpt-4o-mini", [
        { role: "user", content: "test" },
      ], { maxTokens: 1 })
      return { valid: true, latencyMs: Math.round(performance.now() - t0), error: null }
    } catch {
      return { valid: true, latencyMs, error: "Connected but no models discovered" }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const latencyMs = Math.round(performance.now() - t0)

    // Try direct chat completion as fallback
    try {
      await chatCompletion(config, config.defaultModel || "gpt-4o-mini", [
        { role: "user", content: "test" },
      ], { maxTokens: 1 })
      return { valid: true, latencyMs: Math.round(performance.now() - t0), error: null }
    } catch {
      return { valid: false, latencyMs, error: msg }
    }
  }
}
