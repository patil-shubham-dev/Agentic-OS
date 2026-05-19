import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, getFiles, upsertFile } from "@/lib/server/agentos-data";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const files = await getFiles(projectId);
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch files" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const file = await upsertFile(body.projectId ?? DEFAULT_PROJECT_ID, {
      id: body.id,
      name: body.name,
      path: body.path,
      content: body.content,
      size: body.size,
      language: body.language,
      metadata: body.metadata,
    });
    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save file" }, { status: 500 });
  }
}
