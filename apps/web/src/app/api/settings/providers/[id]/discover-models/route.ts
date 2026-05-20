import { NextRequest, NextResponse } from "next/server";
import { getProviderConfig } from "@/lib/server/agentos-data";
import { decryptSecret } from "@/lib/server/encryption";
import { upsertRows, deleteRows } from "@/lib/server/supabase";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const PRESET_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4-turbo", "o1-preview", "o1-mini", "o3-mini"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-5-haiku-20241022"],
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"],
  ollama: ["llama3", "mistral", "codellama", "phi3"],
  "lm-studio": ["qwen2.5-7b", "llama-3-8b"],
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
          } else if (apiKey.startsWith("nvapi-")) {
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

        // Apply custom query parameters from metadata
        // Use URL constructor to append params while preserving original path
        const modelsUrl = new URL(baseUrl + (id === "ollama" ? "/api/tags" : "/models"));
        if (config.metadata?.queryParameters) {
          try {
            const queryParams = JSON.parse(config.metadata.queryParameters as string) as Record<string, string>;
            Object.entries(queryParams).forEach(([key, val]) => modelsUrl.searchParams.append(key, String(val)));
          } catch {}
        }

        const res = await fetch(modelsUrl.toString(), { headers, signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        if (id === "ollama") {
          if (res.ok && Array.isArray(data.models)) {
            discoveredModels = data.models.map((m: any) => m.name);
            methodUsed = "ollama-api";
          }
        } else {
          if (res.ok && Array.isArray(data.data)) {
            discoveredModels = data.data.map((m: any) => m.id);
            methodUsed = "openai-api";
          }
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
        discoveredModels = PRESET_MODELS[id] || (config.default_model ? [config.default_model] : ["custom-model"]);
      }
    }

    // Persist discovered models in the provider_models cache
    // 1. Clear existing cache for this provider
    try {
      await deleteRows("provider_models", { provider: id });
    } catch {}

    // 2. Insert new models
    const rowsToInsert = discoveredModels.map((modelName) => ({
      id: randomUUID(),
      provider: id,
      model: modelName,
      context_window: 128000, // standard fallback
      metadata: {},
      fetched_at: new Date().toISOString(),
    }));

    if (rowsToInsert.length > 0) {
      await upsertRows("provider_models", rowsToInsert, "id");
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

