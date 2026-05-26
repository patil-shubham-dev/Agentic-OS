export interface RoleTokenLimits {
  maxInput: number
  maxOutput: number
}

export interface ProviderModelCapability {
  maxContext: number
  maxOutput: number
  supportsStreaming: boolean
}

export const TOKEN_CONFIG: Record<string, RoleTokenLimits> = {
  manager: { maxInput: 64000, maxOutput: 4096 },
  coder: { maxInput: 128000, maxOutput: 16000 },
  design: { maxInput: 64000, maxOutput: 12000 },
  research: { maxInput: 64000, maxOutput: 8000 },
  vision: { maxInput: 32000, maxOutput: 8000 },
  runtime: { maxInput: 32000, maxOutput: 8000 },
  qa: { maxInput: 64000, maxOutput: 8000 },
  browser: { maxInput: 32000, maxOutput: 8000 },
  "fast-inference": { maxInput: 16000, maxOutput: 2048 },
  memory: { maxInput: 64000, maxOutput: 8000 },
}

export const RUNTIME_TOKEN_LIMITS = {
  DEFAULT_MAX_TOKENS: 8192,
  MAX_CONTEXT_TOKENS: 64000,
  MAX_CONTEXT_MESSAGES: 100,
  MAX_HISTORY_TOKENS: 32000,
  REQUEST_TIMEOUT_MS: 180_000,
  EXECUTION_TIMEOUT_MS: 300_000,
  STREAM_CONNECTION_TIMEOUT_MS: 15_000,
  STREAM_FIRST_CHUNK_TIMEOUT_MS: 30_000,
  STREAM_IDLE_CHUNK_TIMEOUT_MS: 60_000,
  STREAM_OVERALL_TIMEOUT_MS: 300_000,
  STREAM_READER_TIMEOUT_MS: 30_000,
  SOFT_DEADLINE_MS: 60_000,
  VALIDATION_TIMEOUT_MS: 30_000,
  DISCOVERY_TIMEOUT_MS: 30_000,
  INVOKE_TIMEOUT_MS: 30_000,
} as const

export const KNOWN_PROVIDER_LIMITS: Record<string, ProviderModelCapability> = {
  "minimax-ai/minimax-m2.7": { maxContext: 128000, maxOutput: 4096, supportsStreaming: true },
  "gpt-4": { maxContext: 8192, maxOutput: 4096, supportsStreaming: true },
  "gpt-4-turbo": { maxContext: 128000, maxOutput: 4096, supportsStreaming: true },
  "gpt-4o": { maxContext: 128000, maxOutput: 16384, supportsStreaming: true },
  "gpt-4o-mini": { maxContext: 128000, maxOutput: 16384, supportsStreaming: true },
  "claude-3-opus": { maxContext: 200000, maxOutput: 4096, supportsStreaming: true },
  "claude-3-sonnet": { maxContext: 200000, maxOutput: 4096, supportsStreaming: true },
  "claude-3-haiku": { maxContext: 200000, maxOutput: 4096, supportsStreaming: true },
  "claude-3-5-sonnet": { maxContext: 200000, maxOutput: 8192, supportsStreaming: true },
  "gemini-pro": { maxContext: 30720, maxOutput: 2048, supportsStreaming: true },
  "gemini-1.5-pro": { maxContext: 1048576, maxOutput: 8192, supportsStreaming: true },
  "gemini-1.5-flash": { maxContext: 1048576, maxOutput: 8192, supportsStreaming: true },
}

export function clampOutputTokens(model: string, requested: number): number {
    const known = KNOWN_PROVIDER_LIMITS[model]
        ?? Object.entries(KNOWN_PROVIDER_LIMITS).find(
            ([k]) => k.split("/").pop() === model.split("/").pop()
        )?.[1]
    if (known) return Math.min(requested, known.maxOutput)
    return Math.min(requested, RUNTIME_TOKEN_LIMITS.DEFAULT_MAX_TOKENS)
}

export function getEffectiveMaxTokens(role: string, model?: string): number {
  const roleLimits = TOKEN_CONFIG[role]
  const base = roleLimits?.maxOutput ?? RUNTIME_TOKEN_LIMITS.DEFAULT_MAX_TOKENS
  if (model) return clampOutputTokens(model, base)
  return base
}
