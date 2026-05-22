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

    // Merge selected_model and legacy configured_models into metadata JSONB
    // (there is no dedicated DB column for selected_model)
    let metadata = { ...(existing.metadata || {}) };
    if (body.metadata !== undefined) {
      metadata = { ...metadata, ...(body.metadata ?? {}) };
    }
    const selectedModel = body.selectedModel ?? body.selected_model ?? null;
    if (selectedModel) {
      metadata.selected_model = selectedModel;
    }
    if (body.configured_models !== undefined) {
      metadata.configured_models = body.configured_models;
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
      default_model: body.defaultModel !== undefined ? body.defaultModel : existing.default_model,
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
