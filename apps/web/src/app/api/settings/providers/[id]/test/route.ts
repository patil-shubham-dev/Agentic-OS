import { NextRequest, NextResponse } from "next/server";
import { getProviderConfig, upsertProviderConfig } from "@/lib/server/agentos-data";
import { decryptSecret } from "@/lib/server/encryption";

export const dynamic = "force-dynamic";

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

    const baseUrl = config.base_url || "";
    let isValid = false;
    let message = "Connection test completed.";

    // Attempt a real lightweight request if URL is configured
    if (baseUrl.startsWith("http")) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout for slower APIs

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (apiKey) {
          if (id === "anthropic") {
            headers["x-api-key"] = apiKey;
            headers["anthropic-version"] = "2023-06-01";
          } else if (id === "google") {
            // Google Gemini uses x-goog-api-key header, not Bearer
            headers["x-goog-api-key"] = apiKey;
          } else if (apiKey.startsWith("nvapi-")) {
            // NVIDIA NGC API uses NVCF-API-KEY header instead of Bearer
            headers["NVCF-API-KEY"] = apiKey;
          } else {
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
        let testUrl: string;
        if (id === "anthropic") {
          testUrl = `${baseUrl}/messages`;
        } else if (id === "ollama") {
          testUrl = `${baseUrl}/api/tags`;
        } else {
          testUrl = `${baseUrl}/models`;
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
          method: id === "anthropic" ? "POST" : "GET",
          headers,
          signal: controller.signal,
        };

        if (id === "anthropic") {
          (fetchOptions as any).body = JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1,
            messages: [{ role: "user", content: "Hi" }],
          });
        }

        const response = await fetch(testUrlObj.toString(), fetchOptions);
        clearTimeout(timeout);

        // Any response (2xx, 4xx) means the gateway was reached successfully
        const status = response.status;
        if (status >= 200 && status < 500) {
          isValid = true;
          if (status >= 200 && status < 300) {
            message = `Connected successfully to ${config.label} (${status})`;
          } else if (status === 401 || status === 403) {
            message = `Connected to ${config.label} but API key was rejected (${status}). Please verify your key.`;
          } else {
            const bodyText = await response.text().catch(() => "");
            message = `Connected to ${config.label} (${status}): ${bodyText.substring(0, 80)}`;
          }
        } else {
          const bodyText = await response.text().catch(() => "");
          message = `Gateway responded with status ${status}: ${bodyText.substring(0, 100)}`;
        }
      } catch (err) {
        if ((err as any)?.name === "AbortError") {
          message = `Connection timed out after 10s. Ensure "${baseUrl}" is reachable from this server.`;
        } else {
          message = err instanceof Error ? err.message : "Network request failed.";
        }

        // For local setups (Ollama, LM Studio), give a clearer message
        if (id === "ollama" || id === "lm-studio") {
          message = `Could not reach local service at ${baseUrl}. Ensure the application is running locally.`;
        }

        // For NVIDIA-specific connection failures, give guidance
        if (apiKey.startsWith("nvapi-")) {
          message = `NVIDIA NGC connection failed. Ensure the base URL is correct (typically https://integrate.api.nvidia.com/v1) and the API key format is valid. Error: ${message}`;
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
