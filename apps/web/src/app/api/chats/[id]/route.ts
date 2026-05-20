import { NextRequest, NextResponse } from "next/server";
import {
  appendChatMessages,
  DEFAULT_PROJECT_ID,
  type ChatRecord,
} from "@/lib/server/agentos-data";
import { deleteRows, selectRows, updateRows } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/chats/[id] — fetch a single chat with its messages.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await selectRows<ChatRecord>("chats", {
      filters: { id },
      limit: 1,
    });
    if (rows.length === 0) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    return NextResponse.json({ chat: rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch chat" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chats/[id] — update chat title, messages, or usage.
 * Body can include: { title?, messages?, usage? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    updates.updated_at = new Date().toISOString();

    if (body.messages !== undefined) {
      // Full message replace
      updates.messages = body.messages;
    } else if (body.appendMessages !== undefined) {
      // Append to existing messages
      const chat = await appendChatMessages(
        id,
        body.appendMessages as Array<Record<string, unknown>>,
        body.usage ?? {}
      );
      return NextResponse.json({ chat });
    }

    if (body.usage !== undefined) {
      updates.usage = body.usage;
    }

    const [chat] = await updateRows<ChatRecord>("chats", updates, { id });
    return NextResponse.json({ chat });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update chat" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chats/[id] — delete a chat.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteRows<ChatRecord>("chats", { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete chat" },
      { status: 500 }
    );
  }
}
