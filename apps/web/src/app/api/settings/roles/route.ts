import { NextRequest, NextResponse } from "next/server";
import { selectRows, upsertRows } from "@/lib/server/supabase";
import { DEFAULT_PROJECT_ID } from "@/lib/server/agentos-data";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const DEFAULT_ROLES = {
  Manager: "",
  Coding: "",
  Design: "",
  Research: "",
  "Fast Inference": "",
  Vision: "",
};

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || DEFAULT_PROJECT_ID;

    const rows = await selectRows<{ value: string }>("memories", {
      filters: { project_id: projectId, key: "system_roles" },
      limit: 1,
    });

    const roles = rows.length > 0 ? JSON.parse(rows[0].value) : DEFAULT_ROLES;
    return NextResponse.json({ roles });
  } catch (error) {
    // Supabase unavailable — return empty defaults so the app still works
    console.warn("[roles] Supabase unavailable, returning defaults:", error);
    return NextResponse.json({ roles: DEFAULT_ROLES });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = body.projectId || DEFAULT_PROJECT_ID;
    const roles = body.roles;

    if (!roles) {
      return NextResponse.json({ error: "Roles object is required" }, { status: 400 });
    }

    const rows = await selectRows<{ id: string }>("memories", {
      filters: { project_id: projectId, key: "system_roles" },
      limit: 1,
    });

    const existingId = rows.length > 0 ? rows[0].id : randomUUID();

    await upsertRows("memories", [
      {
        id: existingId,
        project_id: projectId,
        scope: "project",
        key: "system_roles",
        value: JSON.stringify(roles),
        metadata: {},
        updated_at: new Date().toISOString(),
      },
    ], "id");

    return NextResponse.json({ success: true, roles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save roles" },
      { status: 500 }
    );
  }
}
