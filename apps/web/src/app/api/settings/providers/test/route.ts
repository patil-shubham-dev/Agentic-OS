import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OPENAI_COMPATIBLE_HEADERS = {
  "Content-Type": "application/json",
};

function detectProvider(baseUrl: string, providerId?: string): string {
  if (providerId === "ollama" || baseUrl.includes("localhost:11434")) return "ollama";
  if (providerId === "anthropic" || baseUrl.includes("api.anthropic.com")) return "anthropic";
  if (baseUrl.includes("nvcf.nvidia.com")) return "nvidia-nvcf";
  if (providerId === "nvidia" || baseUrl.includes("integrate.api.nvidia.com")) return "nvidia-nim";
  if (providerId === "google" || baseUrl.includes("googleapis.com")) return "google";
  if (providerId === "lm-studio" || baseUrl.includes("localhost:1234")) return "lm-studio";
  return "openai-compatible";
}

function buildTestUrl(baseUrl: string, provider: string): string {
  const clean = baseUrl.replace(/\/+$/, "");
  if (provider === "ollama") return `${clean}/api/tags`;
  if (provider === "anthropic") return `${clean}/messages`;
  return `${clean}/models`;
}

function buildAuthHeaders(apiKey: string | undefined, provider: string): Record<string, string> {
  const headers: Record<string, string> = { ...OPENAI_COMPATIBLE_HEADERS };
  if (!apiKey) return headers;

  if (provider === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (provider === "nvidia-nvcf") {
    headers["NVCF-API-KEY"] = apiKey;
  } else if (provider === "google") {
    headers["x-goog-api-key"] = apiKey;
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}

function buildFetchOptions(provider: string, headers: Record<string, string>, signal: AbortSignal): RequestInit {
  if (provider === "anthropic") {
    return {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      }),
      signal,
    };
  }
  return { method: "GET", headers, signal };
}

function classifyNetworkError(err: Error, baseUrl: string, provider: string): string {
  const msg = err.message;
  if (err.name === "AbortError") {
    return `Connection timed out after 10s (endpoint: ${baseUrl}/models). Verify the URL is reachable from this server.`;
  }
  if (msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN") || msg.includes("DNS")) {
    return `DNS lookup failed for "${baseUrl}". The domain could not be resolved.`;
  }
  if (msg.includes("ECONNREFUSED") || msg.includes("ERR_CONNECTION_REFUSED")) {
    return `Connection refused at "${baseUrl}". No service is listening on that address.`;
  }
  if (msg.includes("ECONNRESET") || msg.includes("socket hang up") || msg.includes("ERR_CONNECTION_RESET")) {
    return `Connection reset by the server at "${baseUrl}". The service may be overloaded or restarting.`;
  }
  if (msg.includes("CERT") || msg.includes("certificate") || msg.includes("TLS") || msg.includes("SSL")) {
    return `TLS/SSL certificate error for "${baseUrl}". The certificate may be invalid or self-signed.`;
  }
  if (msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("fetch failed")) {
    if (provider === "ollama" || provider === "lm-studio") {
      return `Unable to reach the local service at "${baseUrl}". Ensure the application is running and not blocked by a firewall.`;
    }
    return `Unable to connect to "${baseUrl}". Check the URL is correct and the service is running.`;
  }
  return `Network error: ${msg} (endpoint: ${baseUrl}/models)`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const baseUrl: string = (body.baseUrl || "").replace(/\/+$/, "");
    const apiKey: string | undefined =
      typeof body.apiKey === "string" && body.apiKey.length > 0 ? body.apiKey : undefined;
    const providerId: string | undefined = body.providerId;

    if (!baseUrl.startsWith("http")) {
      return NextResponse.json({
        success: false,
        message: "Base URL must start with http:// or https://",
        diagnostics: { endpoint: baseUrl, status: null, errorType: "invalid-url" },
      });
    }

    const provider = detectProvider(baseUrl, providerId);
    const testUrl = buildTestUrl(baseUrl, provider);
    const headers = buildAuthHeaders(apiKey, provider);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let isValid = false;
    let message = "Connection test completed.";
    let responseStatus: number | null = null;
    let errorType = "none";

    try {
      const response = await fetch(testUrl, buildFetchOptions(provider, headers, controller.signal));
      clearTimeout(timeout);

      responseStatus = response.status;
      const bodyText = await response.text().catch(() => "");

      if (responseStatus >= 200 && responseStatus < 300) {
        isValid = true;
        message = `Connected successfully (HTTP ${responseStatus})`;
        errorType = "none";
      } else if (responseStatus === 401) {
        isValid = false;
        message = `API key rejected (HTTP 401). The endpoint ${testUrl} responded with "Unauthorized". Check your API key.`;
        errorType = "invalid-api-key";
      } else if (responseStatus === 403) {
        isValid = false;
        message = `Access forbidden (HTTP 403). The endpoint ${testUrl} rejected the request. The API key may lack permissions.`;
        errorType = "unauthorized";
      } else if (responseStatus === 404) {
        isValid = false;
        const preview = bodyText.substring(0, 120).replace(/[\r\n]+/g, " ").trim();
        message = `Endpoint not found (HTTP 404) at ${testUrl}. Response: ${preview || "(empty)"}`;
        errorType = "not-found";
      } else if (responseStatus >= 500) {
        isValid = false;
        message = `Provider server error (HTTP ${responseStatus}) at ${testUrl}. The provider service may be experiencing issues.`;
        errorType = "server-error";
      } else {
        isValid = false;
        const preview = bodyText.substring(0, 120).replace(/[\r\n]+/g, " ").trim();
        message = `Unexpected response (HTTP ${responseStatus}) from ${testUrl}. Response: ${preview || "(empty)"}`;
        errorType = "unexpected-status";
      }

      // Validate JSON Content-Type for 2xx responses to ensure it's really working
      if (isValid) {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
          if (provider !== "ollama") {
            isValid = false;
            errorType = "not-json";
            message = `Endpoint returned non-JSON content (Content-Type: ${contentType}, HTTP ${responseStatus}) from ${testUrl}. The URL may point to a web page instead of an API. Response starts with: "${bodyText.substring(0, 80).replace(/[\r\n]+/g, " ")}"`;
          }
        }
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      const error = err instanceof Error ? err : new Error("Network request failed");
      errorType = "network-error";
      message = classifyNetworkError(error, baseUrl, provider);

      if (provider === "ollama" || provider === "lm-studio") {
        if (!message.includes("Ensure the local application")) {
          message += ` Ensure the application is running and accessible at "${baseUrl}".`;
        }
      }
    }

    return NextResponse.json({
      success: isValid,
      message,
      diagnostics: {
        endpoint: testUrl,
        status: responseStatus,
        errorType,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Connection test crashed",
        diagnostics: { endpoint: null, status: null, errorType: "parse-error" },
      },
      { status: 500 }
    );
  }
}
