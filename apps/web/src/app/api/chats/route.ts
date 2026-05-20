import { NextRequest, NextResponse } from "next/server";
import {
  createChat,
  DEFAULT_PROJECT_ID,
  getChats,
} from "@/lib/server/agentos-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/chats — list all chats for the project (most recent first).
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const chats = await getChats(projectId);
    return NextResponse.json({ chats });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch chats", chats: [] },
      { status: 200 }
    );
  }
}

/**
 * POST /api/chats — create a new chat and return its ID.
 * Body: { title, model, agentId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = body.projectId ?? DEFAULT_PROJECT_ID;
    const title = body.title || "New Chat";
    const model = body.model || "default";
    const chat = await createChat(projectId, title, model, body.agentId ?? null);
    return NextResponse.json({ chat }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create chat" },
      { status: 500 }
    );
  }
}
