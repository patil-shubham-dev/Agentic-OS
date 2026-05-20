import { NextRequest, NextResponse } from "next/server";
import {
  getProviderConfigs,
  upsertProviderConfig,
  type ProviderConfigRecord,
} from "@/lib/server/agentos-data";
import { encryptSecret } from "@/lib/server/encryption";

export const dynamic = "force-dynamic";

function sanitize(record: ProviderConfigRecord) {
  const { api_key_ciphertext: _ciphertext, ...rest } = record;
  return rest;
}

export async function GET() {
  try {
    const providers = await getProviderConfigs();
    return NextResponse.json({ providers: providers.map(sanitize) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch providers", providers: [] },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.provider || !body?.label) {
      return NextResponse.json({ error: "provider and label are required" }, { status: 400 });
    }

    const apiKey: string | undefined = typeof body.apiKey === "string" && body.apiKey.length > 0 ? body.apiKey : undefined;
    const updates: Partial<ProviderConfigRecord> = {
      provider: body.provider,
      label: body.label,
      base_url: body.baseUrl ?? null,
      default_model: body.defaultModel ?? null,
      enabled: Boolean(body.enabled ?? true),
      metadata: body.metadata ?? {},
    };

    if (apiKey) {
      updates.api_key_ciphertext = encryptSecret(apiKey);
      updates.api_key_last4 = apiKey.slice(-4);
    }
    // Re-validation must happen explicitly; clear any prior status.
    updates.validation_status = "pending";
    updates.last_validated_at = null;

    // Validate base_url for known cloud providers
    if (!body.baseUrl && ["openai","anthropic","google"].includes(body.provider)) {
      const presetMap: Record<string, string> = {
        openai: "https://api.openai.com/v1",
        anthropic: "https://api.anthropic.com/v1",
        google: "https://generativelanguage.googleapis.com/v1beta",
      };
      updates.base_url = presetMap[body.provider];
    }

    const provider = await upsertProviderConfig(updates as ProviderConfigRecord);
    return NextResponse.json({ provider: sanitize(provider) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update provider" },
      { status: 500 }
    );
  }
}
