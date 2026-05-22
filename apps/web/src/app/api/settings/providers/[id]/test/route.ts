import { NextRequest, NextResponse } from "next/server";
import { getProviderConfig, upsertProviderConfig } from "@/lib/server/agentos-data";
import { decryptSecret } from "@/lib/server/encryption";

// ── URL normalization helper ────────────────────────────────────────────────

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

/**
 * Safely join a path segment to a base URL. Handles trailing/leading slashes.
 * Uses URL constructor which gracefully handles most edge cases.
 */
function joinUrl(base: string, ...paths: string[]): string {
  let result = base.replace(/\/+$/, "");
  for (const p of paths) {
    result += "/" + p.replace(/^\/+|\/+$/g, "");
  }
  return result;
}

export const dynamic = "force-dynamic";

// ── Error classification ────────────────────────────────────────────────────

interface ClassifiedError {
  message: string;
  category: "timeout" | "dns" | "refused" | "reset" | "tls" | "auth" | "network" | "unknown";
}

function classifyFetchError(err: Error, baseUrl: string): ClassifiedError {
  const msg = err.message;

  if (err.name === "AbortError") {
    return {
      message: `Connection timed out after 10s. Ensure "${baseUrl}" is reachable from this server and the URL is correct.`,
      category: "timeout",
    };
  }

  if (msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN") || msg.includes("DNS")) {
    return {
      message: `DNS lookup failed for "${baseUrl}". Check that the domain name is correct and the service is accessible.`,
      category: "dns",
    };
  }

  if (msg.includes("ECONNREFUSED")) {
    return {
      message: `Connection refused at "${baseUrl}". The service may not be running on that address/port.`,
      category: "refused",
    };
  }

  if (msg.includes("ECONNRESET") || msg.includes("socket hang up") || msg.includes("ERR_CONNECTION_RESET")) {
    return {
      message: `Connection was reset by "${baseUrl}". The service may be overloaded, restarting, or blocking the request.`,
      category: "reset",
    };
  }

  if (msg.includes("CERT") || msg.includes("certificate") || msg.includes("TLS") || msg.includes("SSL")) {
    return {
      message: `TLS/SSL certificate error for "${baseUrl}". The server's certificate may be invalid, self-signed, or expired.`,
      category: "tls",
    };
  }

  if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden")) {
    return {
      message: `Authentication rejected by "${baseUrl}". Check that your API key is valid.`,
      category: "auth",
    };
  }

  if (msg.includes("Failed to fetch") || msg.includes("fetch failed")) {
    // Node.js undici on Windows often produces "Failed to fetch" without the underlying
    // OS error code. This could be DNS, connection refused, or any network-level failure.
    return {
      message: `Unable to connect to "${baseUrl}". Check that the service is running and the address is correct. If this is a local service, ensure it's not blocked by a firewall.`,
      category: "network",
    };
  }

  return {
    message: `Could not reach endpoint: ${msg}. Check the Base URL and ensure the service is running.`,
    category: "network",
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const config = await getProviderConfig(id);

    if (!config) {
      return NextResponse.json({ error: "Provider config not found" }, { status: 404 });
    }

    let apiKey = "";
    if (config.api_key_ciphertext) {
      try {
        apiKey = decryptSecret(config.api_key_ciphertext);
      } catch {
        // ignore decryption errors
      }
    }

    const baseUrl = normalizeBaseUrl(config.base_url || "");
    let isValid = false;
    let message = "Connection test completed.";

    // Attempt a real lightweight request if URL is configured
    if (baseUrl.startsWith("http")) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (apiKey) {
          const isAnthropic = id === "anthropic" || baseUrl.includes("api.anthropic.com");
          const isGoogle = id === "google" || baseUrl.includes("googleapis.com");
          const isNvidia = id === "nvidia" || baseUrl.includes("api.nvidia.com") || baseUrl.includes("integrate.api.nvidia.com");

          if (isAnthropic) {
            headers["x-api-key"] = apiKey;
            headers["anthropic-version"] = "2023-06-01";
          } else if (isGoogle) {
            headers["x-goog-api-key"] = apiKey;
          } else if (isNvidia && baseUrl.includes("nvcf.nvidia.com")) {
            // NVCF API uses NVCF-API-KEY header
            headers["NVCF-API-KEY"] = apiKey;
          } else {
            // Standard OpenAI-compatible bearer auth (default for most providers including integrate.api.nvidia.com)
            headers["Authorization"] = `Bearer ${apiKey}`;
          }
        }

        // Apply custom headers from metadata
        if (config.metadata?.headers) {
          try {
            const customHeaders = JSON.parse(config.metadata.headers as string);
            Object.assign(headers, customHeaders);
          } catch {}
        }

        // Determine test URL based on provider type
        const isAnthropic = id === "anthropic" || baseUrl.includes("api.anthropic.com");
        const isOllama = id === "ollama";

        let testUrl: string;
        if (isAnthropic) {
          testUrl = joinUrl(baseUrl, "messages");
        } else if (isOllama) {
          testUrl = joinUrl(baseUrl, "api/tags");
        } else {
          testUrl = joinUrl(baseUrl, "models");
        }

        // Apply custom query parameters from metadata
        const testUrlObj = new URL(testUrl);
        if (config.metadata?.queryParameters) {
          try {
            const queryParams = JSON.parse(config.metadata.queryParameters as string) as Record<string, string>;
            Object.entries(queryParams).forEach(([key, val]) => testUrlObj.searchParams.append(key, String(val)));
          } catch {}
        }

        const fetchOptions: RequestInit = {
          method: isAnthropic ? "POST" : "GET",
          headers,
          signal: controller.signal,
        };

        if (isAnthropic) {
          (fetchOptions as any).body = JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1,
            messages: [{ role: "user", content: "Hi" }],
          });
        }

        const response = await fetch(testUrlObj.toString(), fetchOptions);
        clearTimeout(timeout);

        const status = response.status;
        if (status >= 200 && status < 500) {
          isValid = true;
          if (status >= 200 && status < 300) {
            message = `Connected successfully to ${config.label} (HTTP ${status})`;
          } else if (status === 401 || status === 403) {
            message = `Connected to ${config.label} but API key was rejected (HTTP ${status}). Please verify your key.`;
          } else {
            const bodyText = await response.text().catch(() => "");
            message = `Connected to ${config.label} (HTTP ${status}): ${bodyText.substring(0, 80)}`;
          }
        } else {
          const bodyText = await response.text().catch(() => "");
          message = `Gateway responded with status ${status}: ${bodyText.substring(0, 100)}`;
        }
      } catch (err) {
        const classified = classifyFetchError(err instanceof Error ? err : new Error(String(err)), baseUrl);
        message = classified.message;

        // Append local-specific guidance for local providers
        if (id === "ollama" || id === "lm-studio") {
          message = `Could not reach local service at ${baseUrl}. Ensure the application is running locally. ${classified.message}`;
        }

        // Append NVIDIA-specific guidance
        if (baseUrl.includes("api.nvidia.com") || baseUrl.includes("integrate.api.nvidia.com")) {
          message = `NVIDIA NIM connection failed. Ensure the base URL is correct (typically https://integrate.api.nvidia.com/v1) and the API key is valid. ${classified.message}`;
        }
      }
    } else {
      // No URL configured
      if (["openai", "anthropic", "google"].includes(id)) {
        isValid = apiKey.length > 0;
        message = isValid
          ? "API Key loaded. Connection test skipped (no custom base URL)."
          : "No API Key configured and no custom base URL.";
      } else {
        isValid = true;
        message = "Provider configuration looks valid.";
      }
    }

    const validationStatus = isValid ? "valid" : "invalid";
    try {
      await upsertProviderConfig({
        ...config,
        validation_status: validationStatus,
        last_validated_at: new Date().toISOString(),
      });
    } catch {
      // Best-effort persistence
    }

    return NextResponse.json({
      success: isValid,
      status: validationStatus,
      message,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection test crashed" },
      { status: 500 }
    );
  }
}
