import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { providerChatCompletion, providerStreamChatCompletion, buildChatUrl, buildStreamUrl } from "./provider-gateway"
import { resolveAdapter } from "./provider-manager"
import type { ChatRequest, ChatResponse, StreamCallbacks } from "./provider-gateway"
import type { ToolCall } from "./provider-gateway"
import { RUNTIME_TOKEN_LIMITS, KNOWN_PROVIDER_LIMITS } from "@/runtime/runtime-token-config"

export type { ChatMessage, ToolCall, ToolDef, ChatRequest, ChatResponse, UsageInfo } from "./provider-gateway"
export type { StreamCallbacks } from "./provider-gateway"

const LOG_PREFIX = "[AIService]"

function logTokenDiagnostics(
  label: string,
  opts: {
    model?: string
    maxTokens?: number
    messages?: number
    inputTokens?: number
    outputTokens?: number
    providerLimit?: number
    contextTokens?: number
  },
) {
  const { model, maxTokens, messages, inputTokens, outputTokens, providerLimit, contextTokens } = opts
  const modelLimit = model ? KNOWN_PROVIDER_LIMITS[model] : undefined
  const effectiveMax = maxTokens ?? RUNTIME_TOKEN_LIMITS.DEFAULT_MAX_TOKENS
  const clamped = modelLimit ? Math.min(effectiveMax, modelLimit.maxOutput) : effectiveMax
  console.log(`${LOG_PREFIX} [${label}]`, {
    model,
    maxTokens: effectiveMax,
    clampedTo: clamped,
    messages,
    inputTokens: inputTokens ?? "?",
    outputTokens: outputTokens ?? "?",
    providerLimit: providerLimit ?? modelLimit?.maxOutput ?? "unknown",
    contextTokens: contextTokens ?? "?",
  })
}

export async function chatCompletion(
  baseUrl: string,
  apiKey: string,
  runtime: string | null,
  req: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const adapter = resolveAdapter(baseUrl)
  const resolvedRuntime = runtime ?? adapter?.runtimeKey ?? null
  const isOpenAiCompatible = adapter?.isOpenAiCompatible ?? true
  const normalizedUrl = buildChatUrl(baseUrl, isOpenAiCompatible)
  logTokenDiagnostics("chatCompletion", { model: req.model, maxTokens: req.maxTokens, messages: req.messages.length })
  return providerChatCompletion(normalizedUrl, apiKey, resolvedRuntime, req, signal)
}

export async function streamChatCompletion(
  baseUrl: string,
  apiKey: string,
  runtime: string | null,
  req: ChatRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const adapter = resolveAdapter(baseUrl)
  const resolvedRuntime = runtime ?? adapter?.runtimeKey ?? null
  const isOpenAiCompatible = adapter?.isOpenAiCompatible ?? true
  const normalizedUrl = buildChatUrl(baseUrl, isOpenAiCompatible)
  logTokenDiagnostics("streamChatCompletion", { model: req.model, maxTokens: req.maxTokens, messages: req.messages.length })
  return providerStreamChatCompletion(normalizedUrl, apiKey, resolvedRuntime, req, callbacks, signal, isOpenAiCompatible)
}

let streamCounter = 0

export async function tauriStreamChatCompletion(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string; tool_calls?: ToolCall[]; tool_call_id?: string }[],
  tools: { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }[] | undefined,
  callbacks: {
    onToken: (token: string) => void
    onToolCalls: (toolCalls: ToolCall[]) => void
    onDone: () => void
    onError: (err: Error) => void
  },
  signal?: AbortSignal,
): Promise<void> {
  if (!apiKey || apiKey.trim() === "") {
    callbacks.onError(new Error("API key is empty — check Settings → Providers"))
    return
  }

  const streamId = `stream_${++streamCounter}_${Date.now()}`
  const unlisteners: UnlistenFn[] = []

  return new Promise<void>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      unlisteners.forEach((u) => u())
    }

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }

    signal?.addEventListener("abort", () => {
      settle(() => reject(new Error("Aborted")))
    })

    Promise.all([
      listen<{ token: string }>(`stream-token-${streamId}`, (e) => {
        callbacks.onToken(e.payload.token)
      }),
      listen<{ tool_calls: ToolCall[] }>(`stream-tool-calls-${streamId}`, (e) => {
        callbacks.onToolCalls(e.payload.tool_calls)
      }),
      listen<{ done: boolean }>(`stream-done-${streamId}`, () => {
        settle(() => {
          callbacks.onDone()
          resolve()
        })
      }),
    ]).then((unlistenFns) => {
      unlisteners.push(...unlistenFns)

      invoke("stream_openai_chat", {
        endpoint,
        apiKey: apiKey.trim(),
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content ?? "",
          ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
          ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        })),
        tools: tools ?? [],
        streamId,
      }).catch((err: unknown) => {
        settle(() => {
          const error = err instanceof Error ? err : new Error(String(err))
          callbacks.onError(error)
          reject(error)
        })
      })
    })
  })
}

export async function directChatCompletion(
  baseUrl: string,
  apiKey: string,
  req: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const adapter = resolveAdapter(baseUrl)
  const isOpenAiCompatible = adapter?.isOpenAiCompatible ?? true
  const url = buildStreamUrl(baseUrl, isOpenAiCompatible)
  const model = req.model ?? "unknown"
  const apiKeyPresent = !!apiKey
  const apiKeyPrefix = apiKeyPresent ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "none"

  console.log(`[PROVIDER] directChatCompletion`, {
    model,
    baseUrl: baseUrl?.slice(0, 60),
    url: url?.slice(0, 80),
    apiKeyPresent,
    apiKeyPrefix,
    adapterId: adapter?.id ?? "unknown",
    isOpenAiCompatible,
    stream: false,
    messageCount: req.messages?.length ?? 0,
  })

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      tools: req.tools,
      stream: false,
      max_tokens: req.maxTokens ?? 8192,
    }),
      signal: signal ?? AbortSignal.timeout(180000),
    })
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error(`[PROVIDER] FETCH FAILED`, { model, url, error: msg })
    throw new Error(`Provider request failed — fetch error for ${model} at ${url}: ${msg}`)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    console.error(`[PROVIDER] HTTP ${response.status}`, { model, url, status: response.status, body: text.slice(0, 500) })
    throw new Error(`Provider returned ${response.status} for ${model} at ${url}: ${text.slice(0, 300)}`)
  }

  console.log(`[PROVIDER] response OK`, { model, status: response.status })

  let json: any
  try {
    json = await response.json()
  } catch (parseErr: unknown) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
    console.error(`[PROVIDER] JSON PARSE FAILED`, { model, error: msg })
    throw new Error(`Provider response parse failed for ${model}: ${msg}`)
  }

  if (!json.choices?.[0]?.message?.content && json.choices?.[0]?.message) {
    console.warn(`[PROVIDER] Empty content in response`, { model, finishReason: json.choices?.[0]?.finish_reason })
  }

  const message = json.choices?.[0]?.message ?? {}

  return {
    message: {
      role: "assistant",
      content: message.content ?? "",
      tool_calls: message.tool_calls ?? [],
    },
    finish_reason: json.choices?.[0]?.finish_reason ?? null,
    usage: json.usage ?? {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  }
}
