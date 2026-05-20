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
        const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (apiKey) {
          if (id === "anthropic") {
            headers["x-api-key"] = apiKey;
            headers["anthropic-version"] = "2023-06-01";
          } else {
            headers["Authorization"] = `Bearer ${apiKey}`;
          }
        }

        // Try getting model list or basic endpoint
        const testUrl = id === "anthropic" 
          ? `${baseUrl}/messages` 
          : `${baseUrl}/models`;

        const response = await fetch(testUrl, {
          method: id === "anthropic" ? "POST" : "GET",
          headers,
          body: id === "anthropic" ? JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "Hi" }] }) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok || response.status === 400 || response.status === 404) {
          // Anthropic /messages will fail with 400 if model list is wrong, but response.status 400/404 means the gateway resolved successfully!
          isValid = true;
          message = `Successfully connected to ${config.label}. Status: ${response.status}`;
        } else {
          const bodyText = await response.text().catch(() => "");
          message = `Gateway responded with code ${response.status}: ${bodyText.substring(0, 100)}`;
        }
      } catch (err) {
        message = err instanceof Error ? err.message : "Network request timed out or failed.";
        // For local offline setups (Ollama/LM Studio), if they aren't booted yet, we report validation status clearly.
        if (id === "ollama" || id === "lm-studio") {
          message = `Could not reach local gateway on ${baseUrl}. Ensure the application is running locally.`;
        }
      }
    } else {
      // No URL, default validation based on presence of API Key if cloud provider
      if (id === "openai" || id === "anthropic" || id === "google") {
        isValid = apiKey.length > 0;
        message = isValid ? "API Key loaded. Gateway validation skipped (no base URL configured)." : "API Key is missing.";
      } else {
        isValid = true;
        message = "Gateway config looks valid.";
      }
    }

    const validationStatus = isValid ? "valid" : "invalid";
    await upsertProviderConfig({
      ...config,
      validation_status: validationStatus,
      last_validated_at: new Date().toISOString(),
    });

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
