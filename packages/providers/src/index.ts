export * from "./provider-registry"
export * from "./provider-gateway"
export * from "./provider-manager"
export * from "./provider-health"
export * from "./provider-types"
export * from "./provider-validation"

// OpenAI-compatible adapter (re-exports with care to avoid conflicts)
export {
  PROVIDER_PRESETS,
  getAdapterConfig,
  buildCompletionUrl,
  buildModelsUrl,
  buildAuthHeaders,
  buildAuthQueryParams,
  buildCompletionBody,
  streamCompletion,
  chatCompletion as adapterChatCompletion,
  discoverModels as adapterDiscoverModels,
  validateConnection as adapterValidateConnection,
} from "./openai-compatible-adapter"
export type {
  OpenAICompatibleConfig,
  StreamResult,
  CompletionResult,
} from "./openai-compatible-adapter"

export { parseStreamChunk } from "./openai-compatible-adapter"

// Re-export with canonical names for consumer convenience
export { providerChatCompletion as chatCompletion } from "./provider-gateway"

export * from "./ai-service"

// ── Transport Layer Exports ──

export { ProviderTransport } from "./transport"
export { SseParser, parseSseLine, parseOpenAiStreamChunk, streamingTransportFetch } from "./streaming-transport"
export { TransportError, classifyHttpError, classifyNetworkError, isRetryable } from "./transport-errors"
export { RetryMiddleware, AuthMiddleware, DiagnosticsMiddleware, composeMiddleware } from "./transport-middleware"
export { OpenAITransportAdapter, NvidiaNimAdapter, OllamaAdapter, AnthropicTransportAdapter, resolveAdapter as resolveTransportAdapter } from "./transport-adapters"
export { observabilityStore, createDiagnosticsHandler, formatTimelineSummary, formatStreamMetrics } from "./transport-observability"
export { DEFAULT_TRANSPORT_CONFIG } from "./transport-types"

export type {
  TransportRequest,
  TransportResponse,
  TransportConfig,
  TransportTimeline,
  StreamMetrics,
  TransportTraceEvent,
  StreamEvent,
  StreamState,
} from "./transport-types"
export type { TransportMiddleware } from "./transport-middleware"
export type { TransportAdapter, TransportAdapterConfig, CompletionRequest, CompletionResponse } from "./transport-adapters"
export type { StreamCallbacks, SseChunk, ToolCallBuffer } from "./streaming-transport"
