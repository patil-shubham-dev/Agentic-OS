import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { DEFAULT_PROJECT_ID, getMemories, type MemoryRecord } from "@/lib/server/agentos-data";
import { insertRows } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const memories = await getMemories(projectId);
    return NextResponse.json({ memories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load memories", memories: [] },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.key || !body?.value) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 });
    }
    const [memory] = await insertRows<MemoryRecord>("memories", {
      id: randomUUID(),
      project_id: body.projectId ?? DEFAULT_PROJECT_ID,
      scope: body.scope === "global" ? "global" : "project",
      key: body.key,
      value: body.value,
      metadata: body.metadata ?? {},
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create memory" },
      { status: 500 }
    );
  }
}
