import { NextRequest, NextResponse } from "next/server";
import { getProviderConfig } from "@/lib/server/agentos-data";
import { decryptSecret } from "@/lib/server/encryption";
import { upsertRows, deleteRows } from "@/lib/server/supabase";
import { randomUUID } from "crypto";
import { safeJsonFetch } from "@/lib/runtime/safe-fetch";

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

export const dynamic = "force-dynamic";

const PRESET_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4-turbo", "o1-preview", "o1-mini", "o3-mini"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-5-haiku-20241022"],
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"],
  ollama: ["llama3", "mistral", "codellama", "phi3"],
  "lm-studio": ["qwen2.5-7b", "llama-3-8b"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it", "llama-3.2-90b-vision-preview"],
  "nvidia": ["nvidia/llama-3.1-nemotron-70b-instruct", "nvidia/llama-3.3-nemotron-super-49b", "mistralai/mixtral-8x22b-instruct"],
};

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
      } catch {}
    }

    const baseUrl = config.base_url || "";
    let discoveredModels: string[] = [];
    let methodUsed = "presets";

    // Attempt real HTTP discovery if baseUrl is configured
    // (Skip for Anthropic — they don't have a public /models endpoint)
    const isAnthropic = id === "anthropic" || baseUrl.includes("api.anthropic.com");
    const isOllama = id === "ollama";
    const isNvidia = baseUrl.includes("api.nvidia.com") || baseUrl.includes("integrate.api.nvidia.com");

    if (baseUrl.startsWith("http") && !isAnthropic) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (apiKey) {
          const isGoogle = id === "google" || baseUrl.includes("googleapis.com");

          if (isGoogle) {
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

        // Build models URL with proper path joining (handles trailing slashes)
        const modelsPath = isOllama ? "api/tags" : "models";
        const modelsUrlStr = joinUrl(normalizeBaseUrl(baseUrl), modelsPath);
        const modelsUrl = new URL(modelsUrlStr);

        if (config.metadata?.queryParameters) {
          try {
            const queryParams = JSON.parse(config.metadata.queryParameters as string) as Record<string, string>;
            Object.entries(queryParams).forEach(([key, val]) => modelsUrl.searchParams.append(key, String(val)));
          } catch {}
        }

        // safeJsonFetch handles timeout internally via timeoutMs (no need for external AbortController)
        const result = await safeJsonFetch<{ models?: { name: string }[]; data?: { id: string }[] }>(
          modelsUrl.toString(),
          { headers, timeoutMs: 15_000 }
        );

        if (result.data) {
          if (isOllama && Array.isArray(result.data.models)) {
            discoveredModels = result.data.models.map((m: any) => m.name);
            methodUsed = "ollama-api";
          } else if (!isOllama && Array.isArray(result.data.data)) {
            discoveredModels = result.data.data.map((m: any) => m.id);
            methodUsed = "openai-api";
          }
        } else if (result.error) {
          // Log diagnostic but fall back to presets gracefully
          console.warn(`[discover-models] ${result.error.category}: ${result.error.message}`);
        }
      } catch (err) {
        // Fall back to presets on error
      }
    }

    // Fallback to preset models if discovery was empty
    if (discoveredModels.length === 0) {
      const customModelsStr = config.metadata?.customModels as string | undefined;
      if (customModelsStr) {
        discoveredModels = customModelsStr
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean);
      } else {
        discoveredModels = PRESET_MODELS[id] || PRESET_MODELS[config.provider] || (config.default_model ? [config.default_model] : ["custom-model"]);
      }
    }

    // Persist discovered models in the provider_models cache
    // 1. Clear existing cache for this provider
    try {
      await deleteRows("provider_models", { provider: id });
    } catch {}

    // 2. Deduplicate model names to avoid ON CONFLICT errors
    const seen = new Set<string>();
    const uniqueModels = discoveredModels.filter((m) => {
      const key = `${id}:${m}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 3. Insert new models (batch upsert handles (provider, model) conflicts)
    const rowsToInsert = uniqueModels.map((modelName) => ({
      id: randomUUID(),
      provider: id,
      model: modelName,
      context_window: 128000, // standard fallback
      metadata: {},
      fetched_at: new Date().toISOString(),
    }));

    if (rowsToInsert.length > 0) {
      await upsertRows("provider_models", rowsToInsert, "provider,model");
    }

    return NextResponse.json({
      success: true,
      provider: id,
      method: methodUsed,
      models: discoveredModels,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Model discovery failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { selectRows } = await import("@/lib/server/supabase");
    const rows = await selectRows<{ model: string }>("provider_models", {
      filters: { provider: id },
    });
    return NextResponse.json({ success: true, models: rows.map((r) => r.model) });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch models",
      models: [],
    });
  }
}

