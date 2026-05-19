import { NextRequest, NextResponse } from "next/server";
import { getProviderConfigs } from "@/lib/server/agentos-data";
import { updateRows } from "@/lib/server/supabase";

export async function GET() {
  try {
    const providers = await getProviderConfigs();
    return NextResponse.json({ providers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch providers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const [provider] = await updateRows("provider_configs", {
      label: body.label,
      base_url: body.baseUrl,
      default_model: body.defaultModel,
      enabled: body.enabled,
      metadata: body.metadata ?? {},
      updated_at: new Date().toISOString(),
    }, { provider: body.provider });

    return NextResponse.json({ provider });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update provider" }, { status: 500 });
  }
}
