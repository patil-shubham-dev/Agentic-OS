/**
 * ProviderClient — wraps API calls to a model provider.
 * Handles authentication, streaming, and connection stabilization
 * (retry with exponential backoff, timeout, and error classification).
 *
 * ARCHITECTURE: One ProviderClient instance = one provider + one model.
 */

export interface ProviderConfig {
  id: string;
  gatewayType: "openai" | "anthropic" | "google" | "groq" | "nvidia" | "openrouter" | "deepseek" | "mistral" | "ollama" | "lmstudio" | "custom";
  displayName: string;
  defaultModel: string;
  apiKey: string;
  baseUrl?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StreamChunk {
  type: "text" | "tool_call" | "error" | "done";
  content?: string;
  toolCall?: {
    name: string;
    arguments: string;
  };
  error?: string;
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 4000,
  timeoutMs: 15_000,
};

export class ProviderClient {
  private config: ProviderConfig;
  /** Track the active stream controller for cancellation. Does NOT interfere with ping/discovery. */
  private streamController: AbortController | null = null;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  get id(): string {
    return this.config.id;
  }

  get model(): string {
    return this.config.defaultModel;
  }

  get baseUrl(): string {
    return this.config.baseUrl || "";
  }

  // ── Connection stabilization ─────────────────────

  private async fetchWithRetry(
    url: string,
    options: RequestInit & { retryConfig?: Partial<RetryConfig> } = {}
  ): Promise<Response> {
    const retryConfig = { ...DEFAULT_RETRY, ...options.retryConfig };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      // Each attempt gets its own controller — no shared state race condition
      const controller = new AbortController();
      try {
        const timeoutId = setTimeout(() => controller.abort(), retryConfig.timeoutMs);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (err: any) {
        lastError = err;

        // Don't retry on abort/timeout or auth errors
        if (err.name === "AbortError") {
          throw new Error(`Connection timed out after ${retryConfig.timeoutMs}ms`);
        }

        if (err.message?.includes("401") || err.message?.includes("403")) {
          throw err; // Auth errors are not retryable
        }

        if (attempt < retryConfig.maxRetries) {
          const delay = Math.min(
            retryConfig.baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
            retryConfig.maxDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const { gatewayType, apiKey, baseUrl } = this.config;

    switch (gatewayType) {
      case "anthropic":
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        break;
      case "google":
        headers["x-goog-api-key"] = apiKey;
        break;
      case "nvidia":
        // NVCF API uses NVCF-API-KEY header, integrate.api.nvidia.com uses Bearer
        if (baseUrl?.includes("nvcf.nvidia.com")) {
          headers["NVCF-API-KEY"] = apiKey;
        } else {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }
        break;
      default:
        // Standard OpenAI-compatible bearer auth
        headers["Authorization"] = `Bearer ${apiKey}`;
        break;
    }

    return headers;
  }

  // ── Ping / Health Check ──────────────────────────

  async ping(): Promise<boolean> {
    const { gatewayType, baseUrl, apiKey } = this.config;
    const trimmed = (baseUrl || "").replace(/\/+$/, "");

    if (!trimmed) return false;

    try {
      const isAnthropic = gatewayType === "anthropic";
      const isOllama = gatewayType === "ollama";

      let pingUrl: string;
      let pingOptions: RequestInit;

      if (isAnthropic) {
        pingUrl = `${trimmed}/messages`;
        pingOptions = {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1,
            messages: [{ role: "user", content: "Hi" }],
          }),
          retryConfig: { maxRetries: 1, timeoutMs: 10_000 },
        };
      } else if (isOllama) {
        pingUrl = `${trimmed}/api/tags`;
        pingOptions = {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          retryConfig: { maxRetries: 1, timeoutMs: 5_000 },
        };
      } else {
        pingUrl = `${trimmed}/models`;
        pingOptions = {
          method: "GET",
          headers: this.buildHeaders(),
          retryConfig: { maxRetries: 1, timeoutMs: 10_000 },
        };
      }

      const response = await this.fetchWithRetry(pingUrl, pingOptions);
      return response.status >= 200 && response.status < 500;
    } catch {
      return false;
    }
  }

  // ── Model Discovery ──────────────────────────────

  async discoverModels(): Promise<string[]> {
    const { gatewayType, baseUrl } = this.config;
    const trimmed = (baseUrl || "").replace(/\/+$/, "");

    if (!trimmed) return [];

    const isOllama = gatewayType === "ollama";

    try {
      let modelsUrl: string;
      let modelsOptions: RequestInit;

      if (isOllama) {
        modelsUrl = `${trimmed}/api/tags`;
        modelsOptions = {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          retryConfig: { timeoutMs: 5_000 },
        };
      } else {
        modelsUrl = `${trimmed}/models`;
        modelsOptions = {
          method: "GET",
          headers: this.buildHeaders(),
          retryConfig: { timeoutMs: 10_000 },
        };
      }

      const response = await this.fetchWithRetry(modelsUrl, modelsOptions);

      if (!response.ok) return [];

      const data = await response.json();

      if (isOllama && data.models) {
        return data.models.map((m: any) => m.name || m.model || "");
      }

      if (data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id || "");
      }

      if (Array.isArray(data)) {
        return data.map((m: any) => m.id || m.name || "");
      }

      return [];
    } catch {
      return [];
    }
  }

  // ── Streaming Chat ───────────────────────────────

  async *streamChat(
    messages: ChatMessage[],
    model?: string,
    tools?: Array<{ function: { name: string; description?: string; parameters?: Record<string, unknown> }; type: string }>
  ): AsyncGenerator<StreamChunk> {
    const { gatewayType, baseUrl, defaultModel } = this.config;
    const modelName = model || defaultModel;
    const trimmed = (baseUrl || "").replace(/\/+$/, "");

    if (!trimmed || !modelName) {
      yield { type: "error", error: "Provider not configured" };
      return;
    }

    const isAnthropic = gatewayType === "anthropic";

    try {
      const chatUrl = `${trimmed}${isAnthropic ? "/messages" : "/chat/completions"}`;

      const body: Record<string, unknown> = isAnthropic
        ? {
            model: modelName,
            max_tokens: 4096,
            messages: messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
          }
        : {
            model: modelName,
            messages,
            stream: true,
            max_tokens: 4096,
          };

      if (tools && tools.length > 0 && !isAnthropic) {
        body.tools = tools;
      }

      this.streamController = new AbortController();
      const timeoutId = setTimeout(() => this.streamController!.abort(), 60_000);

      const response = await fetch(chatUrl, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: this.streamController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        yield {
          type: "error",
          error: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
        };
        return;
      }

      if (isAnthropic) {
        // Anthropic uses a different streaming format
        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        yield { type: "text", content: text };
      } else {
        // Standard SSE streaming
        const reader = response.body?.getReader();
        if (!reader) {
          yield { type: "error", error: "No response body" };
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              yield { type: "done" };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                yield { type: "text", content: delta.content };
              }
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  yield {
                    type: "tool_call",
                    toolCall: {
                      name: tc.function?.name || "",
                      arguments: tc.function?.arguments || "",
                    },
                  };
                }
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }

      yield { type: "done" };
    } catch (err: any) {
      if (err.name === "AbortError") {
        yield { type: "error", error: "Stream timed out after 60s" };
      } else {
        yield { type: "error", error: err.message || "Stream failed" };
      }
    }
  }

  cancelStream(): void {
    if (this.streamController) {
      this.streamController.abort();
      this.streamController = null;
    }
  }
}
