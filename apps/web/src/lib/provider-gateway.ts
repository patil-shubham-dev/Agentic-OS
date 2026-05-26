import type { RuntimeInfo, ValidationResult, DiscoveryResult } from "@/types"

export type { RuntimeInfo, ValidationResult, DiscoveryResult }

export interface ChatMessage {
  role: string
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  timestamp?: number
}

export interface ToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export interface ToolDef {
  type: "function"
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  tools?: ToolDef[]
  stream?: boolean
  maxTokens?: number
  temperature?: number
  top_p?: number
}

export interface UsageInfo {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatResponse {
  message: ChatMessage
  finish_reason: string | null
  usage?: UsageInfo
}

// ── URL Normalization (single source of truth) ──

export function normalizeChatUrl(baseUrl: string, isOpenAiCompatible: boolean): string {
  const clean = baseUrl.replace(/\/+$/, "")
  let stripped = clean.replace(/\/chat\/completions$/, "")
  stripped = stripped.replace(/\/v1\/v1/, "/v1")
  if (stripped.endsWith("/v1")) return stripped
  if (isOpenAiCompatible && !stripped.endsWith("/v1")) {
    stripped = `${stripped}/v1`
  }
  return stripped
}

export function buildStreamUrl(baseUrl: string, isOpenAiCompatible: boolean): string {
  return normalizeChatUrl(baseUrl, isOpenAiCompatible) + "/chat/completions"
}

// ── Provider Health Cache ──

interface ProviderHealthEntry {
  lastSuccess: number
  lastFailure: number
  avgLatencyMs: number
  samples: number
  streamingSupported: boolean | null
}

const providerHealthCache = new Map<string, ProviderHealthEntry>()

export function getProviderHealth(baseUrl: string): ProviderHealthEntry | undefined {
  return providerHealthCache.get(baseUrl)
}

export function recordProviderSuccess(baseUrl: string, latencyMs: number, streamingSupported?: boolean): void {
  const existing = providerHealthCache.get(baseUrl)
  if (existing) {
    existing.lastSuccess = Date.now()
    existing.avgLatencyMs = ((existing.avgLatencyMs * existing.samples) + latencyMs) / (existing.samples + 1)
    existing.samples += 1
    if (streamingSupported !== undefined) existing.streamingSupported = streamingSupported
  } else {
    providerHealthCache.set(baseUrl, {
      lastSuccess: Date.now(),
      lastFailure: 0,
      avgLatencyMs: latencyMs,
      samples: 1,
      streamingSupported: streamingSupported ?? null,
    })
  }
}

export function recordProviderFailure(baseUrl: string): void {
  const existing = providerHealthCache.get(baseUrl)
  if (existing) {
    existing.lastFailure = Date.now()
  } else {
    providerHealthCache.set(baseUrl, {
      lastSuccess: 0,
      lastFailure: Date.now(),
      avgLatencyMs: 0,
      samples: 0,
      streamingSupported: null,
    })
  }
}

export function providerSupportsStreaming(baseUrl: string): boolean | null {
  return providerHealthCache.get(baseUrl)?.streamingSupported ?? null
}

// ── Tauri IPC ──

const INVOKE_TIMEOUT_MS = 30_000

let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null

function isTauriAvailable(): boolean {
  return !!(globalThis as any).window?.__TAURI_INTERNALS__
}

async function getTauriInvoke(): Promise<typeof tauriInvoke> {
  if (tauriInvoke) return tauriInvoke
  if (!isTauriAvailable()) {
    throw new Error("IPC_BRIDGE_UNAVAILABLE: Tauri backend bridge is not initialized. Run the app inside Tauri.")
  }
  try {
    const mod = await import("@tauri-apps/api/core")
    tauriInvoke = mod.invoke as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
    return tauriInvoke
  } catch {
    throw new Error("IPC_BRIDGE_UNAVAILABLE: Failed to load @tauri-apps/api/core module")
  }
}

async function safeInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const fn = await getTauriInvoke()
  if (!fn) throw new Error("IPC_BRIDGE_UNAVAILABLE")
  return fn(cmd, args) as Promise<T>
}

function invokeWithTimeout<T>(cmd: string, args: Record<string, unknown>, timeoutMs = INVOKE_TIMEOUT_MS, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted before invoke started", "AbortError"))
      return
    }

    const timer = setTimeout(() => {
      reject(new Error("TIMEOUT_EXCEEDED"))
    }, timeoutMs)

    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException("Invoke aborted", "AbortError"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })

    safeInvoke<T>(cmd, args)
      .then((result) => {
        signal?.removeEventListener("abort", onAbort)
        clearTimeout(timer)
        resolve(result)
      })
      .catch((err) => {
        signal?.removeEventListener("abort", onAbort)
        clearTimeout(timer)
        reject(err)
      })
  })
}

// ── Provider Discovery / Validation ──

let validationToken = 0
let discoveryToken = 0

export function cancelPendingValidation() {
  validationToken++
}

export function cancelPendingDiscovery() {
  discoveryToken++
}

export function detectRuntime(baseUrl: string): Promise<RuntimeInfo> {
  return invokeWithTimeout<RuntimeInfo>("detect_runtime", { baseUrl }, 3_000)
}

export function validateProvider(baseUrl: string, apiKey: string, token?: number): Promise<ValidationResult> {
  const requestToken = token ?? ++validationToken
  return new Promise<ValidationResult>((resolve, reject) => {
    invokeWithTimeout<ValidationResult>("validate_provider", { baseUrl, apiKey }, 30_000)
      .then((result) => {
        if (requestToken !== validationToken) return
        resolve(result)
      })
      .catch((err) => {
        if (requestToken !== validationToken) return
        reject(err)
      })
  })
}

export function discoverModels(baseUrl: string, apiKey: string, token?: number): Promise<DiscoveryResult> {
  const requestToken = token ?? ++discoveryToken
  return new Promise<DiscoveryResult>((resolve, reject) => {
    invokeWithTimeout<DiscoveryResult>("discover_models", { baseUrl, apiKey }, 30_000)
      .then((result) => {
        if (requestToken !== discoveryToken) return
        resolve(result)
      })
      .catch((err) => {
        if (requestToken !== discoveryToken) return
        reject(err)
      })
  })
}

export function testConnection(endpoint: string, apiKey: string): Promise<string> {
  return safeInvoke<string>("test_provider_connection", { endpoint, apiKey })
}

export function nextValidationToken(): number {
  return ++validationToken
}

export function nextDiscoveryToken(): number {
  return ++discoveryToken
}

export function providerChatCompletion(
  baseUrl: string,
  apiKey: string,
  runtime: string | null,
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const { maxTokens: _mt, ...cleanRequest } = request
  return invokeWithTimeout<ChatResponse>("provider_chat_completion", {
    baseUrl,
    apiKey,
    runtime,
    request: { ...cleanRequest, maxTokens: request.maxTokens },
  }, 180_000, signal)
}

// ── Stream Transport ──

export interface StreamCallbacks {
  onToken: (token: string) => void
  onReady: () => void
  onDone: (fullContent: string, meta?: { toolCalls?: ToolCall[]; finishReason?: string | null }) => void
  onError: (error: Error) => void
}

export const STREAM_TIMEOUTS = {
  connectionTimeoutMs: 15_000,
  headersTimeoutMs: 15_000,
  firstChunkTimeoutMs: 30_000,
  idleChunkTimeoutMs: 60_000,
  overallStreamTimeoutMs: 300_000,
  readerReadTimeoutMs: 30_000,
} as const

type StreamAbortReason =
  | "connection_timeout"
  | "headers_timeout"
  | "first_chunk_timeout"
  | "idle_chunk_timeout"
  | "overall_timeout"
  | "http_error"
  | "read_error"
  | "user_abort"
  | "no_body"
  | "reader_timeout"
  | "unknown"

const STREAM_ABORT_MESSAGES: Record<StreamAbortReason, string> = {
  connection_timeout: "Connection timed out after 15s",
  headers_timeout: "Headers not received within 15s",
  first_chunk_timeout: "No data received within 30s of connection",
  idle_chunk_timeout: "Stream idle for 60s — no data received",
  overall_timeout: "Stream exceeded maximum duration of 300s",
  http_error: "Provider returned HTTP error",
  read_error: "Stream read error",
  user_abort: "Request cancelled",
  no_body: "Response body is not readable",
  reader_timeout: "No data from stream within 30s — reader hung",
  unknown: "Unknown stream error",
}

const LOG_PREFIX_STREAM = "[StreamTx]"

export function buildChatUrl(baseUrl: string, isOpenAiCompatible = true): string {
  return normalizeChatUrl(baseUrl, isOpenAiCompatible)
}

/**
 * Build the Anthropic-specific streaming endpoint URL.
 * Anthropic uses /v1/messages instead of /v1/chat/completions.
 */
function buildAnthropicStreamUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, "")
  // If baseUrl already ends with /v1/messages, use as-is
  if (clean.endsWith("/v1/messages")) return clean
  // If baseUrl ends with /v1, append /messages
  if (clean.endsWith("/v1")) return `${clean}/messages`
  // If baseUrl has no /v1, ensure /v1/messages
  if (clean.includes("anthropic.com")) return clean.replace(/\/+$/, "") + "/v1/messages"
  return `${clean}/v1/messages`
}

/**
 * Convert OpenAI-format messages to Anthropic format:
 * - Filter out system messages (sent as top-level "system" parameter)
 * - Convert tool_calls format
 * - Convert tool_call_id / tool_use_id format
 */
function convertToAnthropicMessages(messages: ChatMessage[]): { role: string; content: string }[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const msg: { role: string; content: string; tool_call_id?: string; tool_calls?: ToolCall[] } = {
        role: m.role,
        content: m.content ?? "",
      }
      // Map tool_call_id for Anthropic's tool_result role
      if (m.role === "tool" && m.tool_call_id) {
        msg.tool_call_id = m.tool_call_id
        msg.content = m.content ?? ""
      }
      // Map tool_calls for Anthropic's assistant role
      if (m.tool_calls && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls
      }
      return msg
    })
}

/**
 * Anthropic SSE streaming parser.
 * Anthropic uses text/event-stream with named events:
 *   event: message_start
 *   event: content_block_start
 *   event: content_block_delta  (delta.text)
 *   event: content_block_stop
 *   event: message_delta        (delta.stop_reason, usage)
 *   event: message_stop
 *   event: ping
 */
async function streamAnthropicChatCompletion(
  baseUrl: string,
  apiKey: string,
  request: ChatRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const t0 = performance.now()
  const url = buildAnthropicStreamUrl(baseUrl)

  // Extract system prompt from messages
  const systemMessages = request.messages.filter((m) => m.role === "system")
  const systemContent = systemMessages.map((m) => m.content).join("\n")

  // Build Anthropic request body
  const bodyPayload: Record<string, unknown> = {
    model: request.model,
    messages: convertToAnthropicMessages(request.messages),
    max_tokens: request.maxTokens ?? 8192,
    stream: true,
  }
  if (request.temperature !== undefined) bodyPayload.temperature = request.temperature
  if (systemContent) bodyPayload.system = systemContent

  // Convert tools to Anthropic format (tool_use blocks)
  if (request.tools && request.tools.length > 0) {
    bodyPayload.tools = request.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }))
  }

  const body = JSON.stringify(bodyPayload)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  }

  console.log(`${LOG_PREFIX_STREAM} [Anthropic] sending streaming request to ${url}`)
  console.log(`${LOG_PREFIX_STREAM} [Anthropic] model: ${request.model}, messages: ${request.messages.length}, maxTokens: ${bodyPayload.max_tokens}`)

  const ctrl = new AbortController()
  if (signal) {
    if (signal.aborted) {
      callbacks.onError(new DOMException("Cancelled before start", "AbortError"))
      return
    }
    const abortListener = () => {
      ctrl.abort()
      callbacks.onError(new DOMException("Request cancelled", "AbortError"))
    }
    signal.addEventListener("abort", abortListener, { once: true })
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: ctrl.signal,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`${LOG_PREFIX_STREAM} [Anthropic] fetch FAILED: ${msg}`)
    recordProviderFailure(baseUrl)
    callbacks.onError(err instanceof Error ? err : new Error(msg))
    return
  }

  if (!response.ok) {
    let text = ""
    try { text = await response.text() } catch {}
    console.log(`${LOG_PREFIX_STREAM} [Anthropic] HTTP ${response.status}: ${text.slice(0, 200)}`)
    recordProviderFailure(baseUrl)
    callbacks.onError(new Error(`Anthropic API returned ${response.status}: ${text.slice(0, 200)}`))
    return
  }

  if (!response.body) {
    recordProviderFailure(baseUrl)
    callbacks.onError(new Error("STREAM_NO_BODY: Response body is null"))
    return
  }

  callbacks.onReady()

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullContent = ""
  let chunkCount = 0
  let contentLength = 0
  let finishReason: string | null = null
  let currentEvent = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunkCount++
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
          if (!dataStr) continue

          try {
            const parsed = JSON.parse(dataStr)

            switch (currentEvent) {
              case "content_block_delta": {
                const text = parsed.delta?.text ?? ""
                if (text) {
                  fullContent += text
                  contentLength += text.length
                  callbacks.onToken(text)
                }
                break
              }
              case "message_delta": {
                if (parsed.delta?.stop_reason) {
                  finishReason = parsed.delta.stop_reason === "end_turn" ? "stop"
                    : parsed.delta.stop_reason === "max_tokens" ? "length"
                    : parsed.delta.stop_reason === "tool_use" ? "tool_calls"
                    : parsed.delta.stop_reason
                }
                break
              }
              case "message_stop": {
                // Stream complete — handled below via onDone
                break
              }
              case "message_start":
              case "content_block_start":
              case "content_block_stop":
              case "ping":
                // No action needed for these events
                break
            }
          } catch {
            // skip unparseable SSE data
          }

          currentEvent = ""
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`${LOG_PREFIX_STREAM} [Anthropic] read error after ${contentLength} chars: ${msg}`)
    if (contentLength > 0) {
      console.log(`${LOG_PREFIX_STREAM} [Anthropic] delivering partial content (${contentLength} chars) despite read error`)
      recordProviderSuccess(baseUrl, parseFloat((performance.now() - t0).toFixed(0)), true)
      callbacks.onDone(fullContent, { finishReason })
      return
    }
    recordProviderFailure(baseUrl)
    callbacks.onError(err instanceof Error ? err : new Error(msg))
    return
  }

  const elapsed = (performance.now() - t0).toFixed(0)
  console.log(`${LOG_PREFIX_STREAM} [Anthropic] stream complete: ${chunkCount} chunks, ${contentLength} chars in ${elapsed}ms`)

  recordProviderSuccess(baseUrl, parseFloat(elapsed), true)
  callbacks.onDone(fullContent, { finishReason })
}

export async function providerStreamChatCompletion(
  baseUrl: string,
  apiKey: string,
  runtime: string | null,
  request: ChatRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  isOpenAiCompatible?: boolean,
): Promise<void> {
  // ── Anthropic protocol routing ──
  if (runtime === "Anthropic") {
    return streamAnthropicChatCompletion(baseUrl, apiKey, request, callbacks, signal)
  }

  // ── OpenAI-compatible (default) ──
  const t0 = performance.now()
  const compat = isOpenAiCompatible ?? (runtime !== null && runtime !== "custom")
  const url = buildStreamUrl(baseUrl, compat)
  const { maxTokens, ...rest } = request
  const body = JSON.stringify({ ...rest, stream: true, max_tokens: maxTokens ?? 8192 })

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  }
  if (runtime) headers["X-Runtime"] = runtime

  console.log(`${LOG_PREFIX_STREAM} sending streaming request to ${url}`)
  console.log(`${LOG_PREFIX_STREAM} model: ${request.model}, messages: ${request.messages.length}, maxTokens: ${maxTokens ?? 8192}`)

  const ctrl = new AbortController()
  if (signal) {
    if (signal.aborted) {
      callbacks.onError(new DOMException("Cancelled before start", "AbortError"))
      return
    }
    const abortListener = () => {
      ctrl.abort()
      callbacks.onError(new DOMException("Request cancelled", "AbortError"))
    }
    signal.addEventListener("abort", abortListener, { once: true })
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST", headers, body,
      signal: ctrl.signal,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`${LOG_PREFIX_STREAM} fetch FAILED: ${msg}`)
    recordProviderFailure(baseUrl)
    callbacks.onError(err instanceof Error ? err : new Error(msg))
    return
  }

  if (!response.ok) {
    let text = ""
    try { text = await response.text() } catch {}
    console.log(`${LOG_PREFIX_STREAM} HTTP ${response.status}: ${text.slice(0, 200)}`)
    recordProviderFailure(baseUrl)
    callbacks.onError(new Error(`Provider returned ${response.status}: ${text.slice(0, 200)}`))
    return
  }

  if (!response.body) {
    recordProviderFailure(baseUrl)
    callbacks.onError(new Error("STREAM_NO_BODY: Response body is null"))
    return
  }

  callbacks.onReady()

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullContent = ""
  let chunkCount = 0
  let contentLength = 0
  let finishReason: string | null = null
  const toolCallBuffer = new Map<number, {
    id: string
    name: string
    arguments: string
  }>()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunkCount++
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith("data:")) continue
        const data = trimmed.slice(5).trim()
        if (data === "[DONE]") {
          console.log(`${LOG_PREFIX_STREAM} received [DONE] signal after ${chunkCount} chunks, ${contentLength} chars`)
          break
        }
        try {
          const parsed = JSON.parse(data)
          const choice = parsed.choices?.[0]
          const delta = choice?.delta ?? {}

          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const index = typeof tc.index === "number" ? tc.index : toolCallBuffer.size
              const existing = toolCallBuffer.get(index) ?? {
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                arguments: "",
              }
              existing.arguments += tc.function?.arguments ?? ""
              if (tc.id) existing.id = tc.id
              if (tc.function?.name) existing.name = tc.function.name
              toolCallBuffer.set(index, existing)
            }
          }

          if (typeof choice?.finish_reason !== "undefined") {
            finishReason = choice.finish_reason ?? null
          }

          const content = delta.content ?? choice?.text ?? ""
          if (content) {
            fullContent += content
            contentLength += content.length
            callbacks.onToken(content)
          }
        } catch {
          // skip unparseable SSE lines
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`${LOG_PREFIX_STREAM} read error after ${contentLength} chars: ${msg}`)
    if (contentLength > 0) {
      console.log(`${LOG_PREFIX_STREAM} delivering partial content (${contentLength} chars) despite read error`)
      recordProviderSuccess(baseUrl, parseFloat((performance.now() - t0).toFixed(0)), true)
      callbacks.onDone(fullContent, { finishReason })
      return
    }
    recordProviderFailure(baseUrl)
    callbacks.onError(err instanceof Error ? err : new Error(msg))
    return
  }

  // Drain any remaining buffer (last line without newline)
  if (buffer.trim()) {
    const trimmed = buffer.trim()
    if (trimmed.startsWith("data:") && !trimmed.includes("[DONE]")) {
      try {
        const parsed = JSON.parse(trimmed.slice(5).trim())
        const choice = parsed.choices?.[0]
        const delta = choice?.delta ?? {}

        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const index = typeof tc.index === "number" ? tc.index : toolCallBuffer.size
            const existing = toolCallBuffer.get(index) ?? {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              arguments: "",
            }
            existing.arguments += tc.function?.arguments ?? ""
            if (tc.id) existing.id = tc.id
            if (tc.function?.name) existing.name = tc.function.name
            toolCallBuffer.set(index, existing)
          }
        }

        if (typeof choice?.finish_reason !== "undefined") {
          finishReason = choice.finish_reason ?? null
        }

        const content = delta.content ?? choice?.text ?? ""
        if (content) {
          fullContent += content
          contentLength += content.length
          callbacks.onToken(content)
        }
      } catch { /* skip */ }
    }
  }

  const elapsed = (performance.now() - t0).toFixed(0)
  console.log(`${LOG_PREFIX_STREAM} stream complete: ${chunkCount} chunks, ${contentLength} chars in ${elapsed}ms`)

  recordProviderSuccess(baseUrl, parseFloat(elapsed), true)
  const toolCalls = Array.from(toolCallBuffer.entries())
    .sort(([a], [b]) => a - b)
    .map(([, tc], index) => ({
      id: tc.id || `tool_call_${index}`,
      type: "function" as const,
      function: {
        name: tc.name,
        arguments: tc.arguments,
      },
    }))

  callbacks.onDone(fullContent, { toolCalls, finishReason })
}
