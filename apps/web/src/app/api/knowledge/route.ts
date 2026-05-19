import { NextRequest, NextResponse } from "next/server";
import {
  createKnowledge,
  DEFAULT_PROJECT_ID,
  getKnowledge,
  updateKnowledge,
} from "@/lib/server/agentos-data";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
    const items = await getKnowledge(projectId);

    if (!query) {
      return NextResponse.json({ items });
    }

    const results = items
      .filter((item) => {
        const haystack = `${item.name} ${item.source} ${JSON.stringify(item.metadata ?? {})}`.toLowerCase();
        return haystack.includes(query);
      })
      .map((item) => ({
        id: item.id,
        content: item.metadata?.summary ?? item.name,
        source: item.name,
        score: 0.8,
        metadata: item.metadata ?? {},
      }));

    return NextResponse.json({ items, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch knowledge" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const item = await createKnowledge(body.projectId ?? DEFAULT_PROJECT_ID, {
      name: body.name,
      type: body.type,
      source: body.source,
      size: body.size,
      chunks: body.chunks,
      metadata: body.metadata,
      status: "indexed",
    });

    await updateKnowledge(item.id, {
      status: "indexed",
      metadata: {
        ...(item.metadata ?? {}),
        summary: body.metadata?.summary ?? body.content ?? body.source,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to add knowledge" }, { status: 500 });
  }
}
