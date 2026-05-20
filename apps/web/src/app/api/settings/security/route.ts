import { NextRequest, NextResponse } from "next/server";
import { selectRows, upsertRows } from "@/lib/server/supabase";
import { DEFAULT_PROJECT_ID } from "@/lib/server/agentos-data";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const DEFAULT_SECURITY = {
  terminal: true,
  filesystem: true,
  approval: true,
  browser: false,
};

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || DEFAULT_PROJECT_ID;

    const rows = await selectRows<{ value: string }>("memories", {
      filters: { project_id: projectId, key: "system_security" },
      limit: 1,
    });

    const security = rows.length > 0 ? JSON.parse(rows[0].value) : DEFAULT_SECURITY;
    return NextResponse.json({ security });
  } catch (error) {
    return NextResponse.json({ security: DEFAULT_SECURITY });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = body.projectId || DEFAULT_PROJECT_ID;
    const security = body.security;

    if (!security) {
      return NextResponse.json({ error: "Security object is required" }, { status: 400 });
    }

    const rows = await selectRows<{ id: string }>("memories", {
      filters: { project_id: projectId, key: "system_security" },
      limit: 1,
    });

    const existingId = rows.length > 0 ? rows[0].id : randomUUID();

    await upsertRows("memories", [
      {
        id: existingId,
        project_id: projectId,
        scope: "project",
        key: "system_security",
        value: JSON.stringify(security),
        metadata: {},
        updated_at: new Date().toISOString(),
      },
    ], "id");

    return NextResponse.json({ success: true, security });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save security toggles" },
      { status: 500 }
    );
  }
}
