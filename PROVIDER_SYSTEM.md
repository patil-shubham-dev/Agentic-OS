# Provider System

## Overview

The provider system handles communication with AI model providers. It supports 17 provider presets with OpenAI-compatible and custom adapters, streaming, retry, health checking, and model discovery.

---

## Supported Providers

| Provider | Type | Streaming | Tool Calls | OpenAI-Compatible |
|----------|------|-----------|------------|-----------------|
| OpenAI | Cloud | Yes | Yes | Native |
| Anthropic | Cloud | Yes | Yes | No |
| Google Gemini | Cloud | Yes | No | No |
| Groq | Cloud | Yes | Yes | Yes |
| OpenRouter | Cloud | Yes | Yes | Yes |
| NVIDIA NIM | Cloud | Yes | Yes | Yes |
| DeepSeek | Cloud | Yes | Yes | Yes |
| Together AI | Cloud | Yes | Yes | Yes |
| Azure OpenAI | Cloud | Yes | Yes | Yes |
| Ollama | Local | Yes | Yes | Yes |
| Custom OpenAI | Cloud/Local | Yes | Yes | Yes |
| Custom vLLM | Local | Yes | Yes | Yes |
| Custom LM Studio | Local | Yes | Yes | Yes |
| Custom LocalAI | Local | Yes | Yes | Yes |
| Custom LiteLLM | Cloud/Local | Yes | Yes | Yes |

---

## Architecture

```
ProviderGateway
  ├── URL normalization & health cache
  ├── Runtime detection (15+ URL patterns)
  ├── Provider validation pipeline
  └── Model discovery

ProviderTransport
  ├── streamChatCompletion() — SSE streaming
  ├── chatCompletion() — non-streaming fallback
  └── Provider-specific adapters

Transport Adapters
  ├── OpenAI-compatible adapter (openai-compatible-adapter.ts)
  ├── Anthropic adapter (transport-adapters.ts)
  ├── NVIDIA NIM adapter (transport-adapters.ts)
  └── Ollama adapter (transport-adapters.ts)

Transport Middleware
  ├── RetryMiddleware (retry on transient failures)
  ├── AuthMiddleware (Bearer token injection)
  └── DiagnosticsMiddleware (timing, tracing)

Streaming Transport
  ├── SSE parser
  ├── Chunk decoding
  └── EventChannel bridge
```

---

## Provider Transport

The `ProviderTransport` class (`transport.ts`) is the main interface:

```typescript
class ProviderTransport {
  async streamChatCompletion(
    request: TransportRequest,
    callbacks: {
      onToken: (token: string) => void
      onDone: (fullContent: string, meta?: ToolCallMeta) => void
      onError: (error: Error) => void
      onReady: () => void
    },
    signal?: AbortSignal
  ): Promise<void>

  async chatCompletion(
    request: TransportRequest
  ): Promise<ChatCompletionResult>
}
```

---

## Callback Pattern (Streaming)

```
ProviderTransport.streamChatCompletion(request, callbacks, signal)
  │
  ├─ callbacks.onReady() — Stream is connected
  ├─ callbacks.onToken(token) — Each content token
  ├─ callbacks.onDone(content, meta) — Stream complete
  └─ callbacks.onError(error) — Stream failed
```

The `EventChannel` (`src/runtime/streaming/EventChannel.ts`) bridges push callbacks to async iteration:

```typescript
class EventChannel implements AsyncIterable<ExecutionEvent> {
  push(event: ExecutionEvent): void
  close(): void
  [Symbol.asyncIterator](): AsyncIterator<ExecutionEvent>
}
```

---

## Provider Runtime Detection

`provider-gateway.ts` detects 15+ provider runtimes from base URLs:

```typescript
function detectProviderRuntime(baseUrl: string): ProviderRuntime | null
// Patterns:
// openai.com → "openai"
// anthropic.com → "anthropic"
// googleapis.com/gemini → "gemini"
// groq.com → "groq"
// openrouter.ai → "openrouter"
// api.nvidia.com → "nvidia"
// deepseek.com → "deepseek"
// together.xyz → "together"
// azure.com → "azure"
// localhost:11434 → "ollama"
// (and custom patterns)
```

---

## Health Checking

```typescript
interface ProviderHealthState {
  status: "unknown" | "checking" | "healthy" | "unhealthy" | "error"
  lastCheck: number
  latencyMs: number
  error?: string
  modelCount: number
}
```

Health is cached in `providerHealthCache` Map and checked:
- On provider setup/validation
- Periodically via health polling hook
- On connection errors (marked unhealthy)

---

## Validation Pipeline

```typescript
validateProvider(baseUrl, apiKey, providerType)
  → URL normalization
  → Runtime detection
  → Connection test (fetch /health or /models)
  → Model discovery
  → Return validation result with errors/warnings
```

---

## Error Classification

`transport-errors.ts` defines:

```typescript
class TransportError extends Error {
  code: string  // "STREAM_INTERRUPTED" | "RATE_LIMITED" | "AUTH_FAILED" | etc.
  statusCode?: number
  retryable: boolean
}

function classifyHttpError(status: number, body: string): TransportError
function isRetryable(err: TransportError): boolean
```

---

## Provider → Role Assignment

`ProviderRegistry.ts` manages provider-to-role mapping:

```typescript
class ProviderRegistry {
  register(provider: ProviderInstance): void
  unregister(providerId: string): void
  getForRole(role: RuntimeRole): ProviderInstance | undefined
  autoAssign(providers: ProviderInstance[], roles: RuntimeRole[]): void
}
```

Each role has capability requirements (`ROLE_CAPABILITY_REQUIREMENTS`) that providers must satisfy. The `autoAssign()` method finds the best compatible provider for each role.

---

## Model Configuration

```typescript
interface ModelConfig {
  model: string
  provider: string
  maxTokens: number
  temperature: number
  topP: number
}
```

Token limits per role and known models are defined in `runtime-token-config.ts`.
