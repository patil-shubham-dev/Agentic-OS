import { NextRequest, NextResponse } from "next/server";
import {
  getProviderConfig,
  upsertProviderConfig,
  deleteProviderConfig,
  type ProviderConfigRecord,
} from "@/lib/server/agentos-data";
import { encryptSecret } from "@/lib/server/encryption";

export const dynamic = "force-dynamic";

function sanitize(record: ProviderConfigRecord) {
  const { api_key_ciphertext: _ciphertext, ...rest } = record;
  return rest;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await getProviderConfig(id);
    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const apiKey: string | undefined = typeof body.apiKey === "string" && body.apiKey.length > 0 ? body.apiKey : undefined;

    // ARCHITECTURE: One provider card = ONE selected model.
    // selected_model in metadata is the canonical field.
    // Merge with existing metadata preserving all fields.
    let metadata = { ...(existing.metadata || {}) };
    if (body.metadata !== undefined) {
      metadata = { ...metadata, ...(body.metadata ?? {}) };
    }

    // Resolve selected_model from request body with priority:
    // 1. body.selected_model (snake_case, server-side)
    // 2. body.selectedModel (camelCase, client-side)
    // 3. body.defaultModel (fallback for backward compat)
    // 4. existing metadata selected_model
    // 5. existing default_model
    const selectedModel = body.selected_model
      || body.selectedModel
      || body.defaultModel
      || metadata.selected_model
      || existing.default_model
      || "";

    if (selectedModel) {
      metadata.selected_model = selectedModel;
    }

    // configured_models is legacy — only first element matters now
    if (body.configured_models !== undefined && Array.isArray(body.configured_models)) {
      metadata.configured_models = body.configured_models;
    } else if (selectedModel) {
      metadata.configured_models = [selectedModel];
    }

    // Preserve existing API key unless explicitly overwritten
    let apiKeyCiphertext = existing.api_key_ciphertext;
    let apiKeyLast4 = existing.api_key_last4;
    if (apiKey) {
      apiKeyCiphertext = encryptSecret(apiKey);
      apiKeyLast4 = apiKey.slice(-4);
    }

    const updates: Partial<ProviderConfigRecord> = {
      provider: id,
      label: body.label !== undefined ? body.label : existing.label,
      base_url: body.baseUrl !== undefined ? body.baseUrl : existing.base_url,
      default_model: body.defaultModel !== undefined ? body.defaultModel : (selectedModel || existing.default_model),
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
      metadata,
      api_key_ciphertext: apiKeyCiphertext,
      api_key_last4: apiKeyLast4,
      validation_status: "pending",
      last_validated_at: null,
    };

    const provider = await upsertProviderConfig(updates as ProviderConfigRecord);
    return NextResponse.json({ provider: sanitize(provider) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update provider" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await getProviderConfig(id);
    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    await deleteProviderConfig(id);
    return NextResponse.json({ success: true, provider: id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete provider" },
      { status: 500 }
    );
  }
}
