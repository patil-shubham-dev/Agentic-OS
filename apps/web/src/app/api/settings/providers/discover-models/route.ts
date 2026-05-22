import { NextRequest, NextResponse } from "next/server";
import { safeJsonFetch } from "@/lib/runtime/safe-fetch";

export const dynamic = "force-dynamic";

// ── URL normalization helper ────────────────────────────────────────────────

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function joinUrl(base: string, ...paths: string[]): string {
  let result = base.replace(/\/+$/, "");
  for (const p of paths) {
    result += "/" + p.replace(/^\/+|\/+$/g, "");
  }
  return result;
}

const PRESET_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4-turbo", "o1-preview", "o1-mini", "o3-mini", "gpt-4o-mini"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-5-haiku-20241022", "claude-3-sonnet-20240229"],
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp", "gemini-2.0-flash"],
  ollama: ["llama3", "llama3.1:8b", "llama3.1:70b", "mistral", "codellama", "phi3", "qwen2.5"],
  "lm-studio": ["qwen2.5-7b", "llama-3-8b", "mistral-7b"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it", "llama-3.2-90b-vision-preview"],
  nvidia: [
    "deepseek-ai/deepseek-v4-flash",
    "deepseek-ai/deepseek-r1",
    "meta/llama-3.1-70b-instruct",
    "meta/llama-3.1-8b-instruct",
    "meta/llama-3.3-70b-instruct",
    "meta/llama-3.2-3b-instruct",
    "meta/llama-3.2-11b-vision-instruct",
    "mistralai/mistral-small-3.1-24b-instruct",
    "mistralai/mixtral-8x22b-instruct",
    "qwen/qwen2.5-72b-instruct",
    "qwen/qwen2.5-coder-32b-instruct",
    "google/gemma-2-27b-it",
    "google/gemma-2-9b-it",
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "nvidia/llama-3.3-nemotron-super-49b",
  ],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl: rawBaseUrl, apiKey, providerId } = body as {
      baseUrl?: string;
      apiKey?: string;
      providerId?: string;
    };

    if (!providerId || !rawBaseUrl) {
      return NextResponse.json(
        { error: "providerId and baseUrl are required", models: [] },
        { status: 400 }
      );
    }

    const baseUrl = normalizeBaseUrl(rawBaseUrl || "");
    let discoveredModels: string[] = [];
    let methodUsed = "presets";

    // Attempt HTTP discovery if URL is configured and not Anthropic
    const isAnthropic = providerId === "anthropic" || baseUrl.includes("api.anthropic.com");
    const isOllama = providerId === "ollama";
    const isNvidiaIntegrate = baseUrl.includes("integrate.api.nvidia.com");
    const isNvidiaNvcf = baseUrl.includes("nvcf.nvidia.com");

    if (baseUrl.startsWith("http") && !isAnthropic) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (apiKey) {
          const isGoogle = providerId === "google" || baseUrl.includes("googleapis.com");

          if (isGoogle) {
            headers["x-goog-api-key"] = apiKey;
          } else if (isNvidiaNvcf) {
            // NVCF API uses NVCF-API-KEY header
            headers["NVCF-API-KEY"] = apiKey;
          } else if (isNvidiaIntegrate) {
            // integrate.api.nvidia.com is OpenAI-compatible, uses Bearer auth
            headers["Authorization"] = `Bearer ${apiKey}`;
          } else {
            // Standard OpenAI-compatible bearer auth (default for most providers)
            headers["Authorization"] = `Bearer ${apiKey}`;
          }
        }

        // Build models URL
        const modelsPath = isOllama ? "api/tags" : "models";
        const modelsUrlStr = joinUrl(normalizeBaseUrl(baseUrl), modelsPath);
        const modelsUrl = new URL(modelsUrlStr);

        const result = await safeJsonFetch<{
          models?: { name: string }[];
          data?: { id: string }[];
        }>(modelsUrl.toString(), {
          headers,
          timeoutMs: 15_000,
        });

        if (result.data) {
          if (isOllama && Array.isArray((result.data as any)?.models)) {
            discoveredModels = (result.data as any).models.map((m: any) => m.name);
            methodUsed = "ollama-api";
          } else if (!isOllama && Array.isArray(result.data.data)) {
            discoveredModels = result.data.data.map((m: any) => m.id);
            methodUsed = "openai-api";
          }
        } else if (result.error) {
          console.warn(`[discover-models-dialog] ${result.error.category}: ${result.error.message}`);
        }
      } catch (err) {
        // Fall back to presets
        console.warn(`[discover-models-dialog] Fetch error, falling back to presets:`, err);
      }
    }

    // Fallback to presets
    if (discoveredModels.length === 0) {
      const isNvidia = providerId === "nvidia" || baseUrl.includes("nvidia.com") || baseUrl.includes("nvcf");
      discoveredModels = PRESET_MODELS[providerId] || (isNvidia ? PRESET_MODELS["nvidia"] : []) || [];
      if (discoveredModels.length === 0) {
        discoveredModels = ["custom-model"];
      }
    }

    return NextResponse.json({
      success: true,
      provider: providerId,
      method: methodUsed,
      models: discoveredModels,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Model discovery failed",
        models: [],
      },
      { status: 200 }
    );
  }
}
