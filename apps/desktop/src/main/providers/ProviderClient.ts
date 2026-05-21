/**
 * ProviderClient — universal LLM provider client.
 *
 * All providers normalise to OpenAI /v1/chat/completions format internally.
 * Anthropic has its own adapter; everything else speaks OpenAI-compatible.
 *
 * Lives exclusively in the main process — never instantiated in the renderer.
 */

import * as https from "https";
import * as http from "http";
import * as url from "url";

export interface ProviderConfig {
  id: string;
  gatewayType: "openai" | "anthropic" | "gemini" | "ollama" | "lmstudio" | "custom";
  displayName: string;
  apiKey: string;
  defaultModel: string;
  baseUrl?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const BASE_URL_MAP: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  ollama: "http://localhost:11434/v1",
  lmstudio: "http://localhost:1234/v1",
};

// =============================================================================
// Retry helper
// =============================================================================
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelay = 500
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
    }
  }
  throw new Error("unreachable");
}

// =============================================================================
// HTTP fetch with streaming support
// =============================================================================
function fetchStream(
  requestUrl: string,
  options: http.RequestOptions,
  body: string
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const isHttps = requestUrl.startsWith("https");
    const mod = isHttps ? https : http;
    const req = mod.request(requestUrl, options, (res) => {
      resolve(res);
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// =============================================================================
// Anthropic adapter — transforms messages to/from Anthropic format
// =============================================================================
function toAnthropicMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
}

// =============================================================================
// ProviderClient class
// =============================================================================
export class ProviderClient {
  public readonly id: string;
  public readonly gatewayType: string;
  public readonly displayName: string;
  private apiKey: string;
  public readonly defaultModel: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.gatewayType = config.gatewayType;
    this.displayName = config.displayName;
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel;

    this.baseUrl = config.baseUrl || BASE_URL_MAP[config.gatewayType] || "";
    if (!this.baseUrl) {
      throw new Error(`Unknown gateway type "${config.gatewayType}" and no baseUrl provided`);
    }
    this.baseUrl = this.baseUrl.replace(/\/+$/, "");
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Stream a chat completion. Yields text chunks as they arrive.
   * Emits [STREAM_ERROR: <message>] on mid-stream failures.
   */
  async *streamChat(
    messages: ChatMessage[],
    model: string,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    if (this.gatewayType === "anthropic") {
      yield* this.anthropicStream(messages, model, signal);
    } else {
      yield* this.openaiStream(messages, model, signal);
    }
  }

  /**
   * Fire-and-forget health check. Returns true if provider responds.
   */
  async ping(): Promise<boolean> {
    try {
      return await withRetry(async () => {
        const targetUrl = `${this.baseUrl}/models`;
        const parsed = new url.URL(targetUrl);
        const isHttps = targetUrl.startsWith("https");
        const mod = isHttps ? https : http;

        return new Promise<boolean>((resolve) => {
          const req = mod.get(
            targetUrl,
            { headers: this.getHeaders(), timeout: 5000 },
            (res) => {
              resolve(res.statusCode !== undefined && res.statusCode < 500);
            }
          );
          req.on("error", () => resolve(false));
          req.on("timeout", () => {
            req.destroy();
            resolve(false);
          });
        });
      }, 2, 300);
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // OpenAI-compatible streaming
  // ---------------------------------------------------------------------------
  private async *openaiStream(
    messages: ChatMessage[],
    model: string,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const body = JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 4096,
    });

    try {
      const res = await withRetry(async () => {
        const parsed = new url.URL(`${this.baseUrl}/chat/completions`);
        const options: http.RequestOptions = {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          method: "POST",
          headers: {
            ...this.getHeaders(),
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body).toString(),
          },
          signal,
        };

        return fetchStream(
          `${this.baseUrl}/chat/completions`,
          options,
          body
        );
      });

      const reader = res as unknown as NodeJS.ReadableStream;
      let buffer = "";

      for await (const chunk of reader) {
        const text = Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : (chunk as string);
        buffer += text;

        while (buffer.includes("\n")) {
          const lineEnd = buffer.indexOf("\n");
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (!line || !line.startsWith("data: ")) continue;

          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      yield `[STREAM_ERROR: ${err.message || "Unknown stream error"}]`;
    }
  }

  // ---------------------------------------------------------------------------
  // Anthropic streaming (adapter)
  // ---------------------------------------------------------------------------
  private async *anthropicStream(
    messages: ChatMessage[],
    model: string,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model,
      messages: toAnthropicMessages(nonSystem),
      max_tokens: 4096,
      stream: true,
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => m.content).join("\n");
    }

    const bodyStr = JSON.stringify(body);

    try {
      const res = await withRetry(async () => {
        const targetUrl = `${this.baseUrl}/v1/messages`;
        const parsed = new url.URL(targetUrl);
        const options: http.RequestOptions = {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          method: "POST",
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(bodyStr).toString(),
          },
          signal,
        };

        return fetchStream(targetUrl, options, bodyStr);
      });

      const reader = res as unknown as NodeJS.ReadableStream;
      let buffer = "";

      for await (const chunk of reader) {
        const text = Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : (chunk as string);
        buffer += text;

        while (buffer.includes("\n")) {
          const lineEnd = buffer.indexOf("\n");
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (!line || !line.startsWith("data: ")) continue;

          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield parsed.delta.text;
            }
            if (parsed.type === "message_stop") return;
          } catch {
            // skip
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      yield `[STREAM_ERROR: ${err.message || "Unknown stream error"}]`;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }
}
