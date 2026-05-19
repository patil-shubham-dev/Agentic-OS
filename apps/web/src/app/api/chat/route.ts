import { NextRequest, NextResponse } from "next/server";
import {
  appendChatMessages,
  createChat,
  DEFAULT_PROJECT_ID,
  getChats,
  recordUsage,
} from "@/lib/server/agentos-data";

const INTERNAL_API_KEY = process.env.AGENTOS_INTERNAL_API_KEY;
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const chats = await getChats(projectId);
    return NextResponse.json({ chats });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch chats" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = body.projectId ?? DEFAULT_PROJECT_ID;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const latest = messages[messages.length - 1];
    const model = body.model ?? "gpt-5";
    const agent = body.agent ?? "coding";

    const chat = body.chatId
      ? { id: body.chatId }
      : await createChat(projectId, body.title ?? latest?.content?.slice(0, 48) ?? "New chat", model, agent);

    let assistantMessage: Record<string, unknown>;
    let usage: Record<string, unknown> = {};

    if (API_URL && INTERNAL_API_KEY) {
      const backendResponse = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({
          messages,
          model,
          agent,
          project_id: projectId,
          tools: body.tools ?? [],
        }),
        cache: "no-store",
      });

      if (!backendResponse.ok) {
        const text = await backendResponse.text();
        throw new Error(`Backend chat request failed: ${text}`);
      }

      const result = await backendResponse.json();
      usage = result.usage ?? {};
      assistantMessage = {
        role: "assistant",
        content: result.content ?? "",
        model,
        toolCalls: result.tool_calls ?? [],
        timestamp: new Date().toISOString(),
      };

      await recordUsage({
        user_id: null,
        project_id: projectId,
        model,
        provider: model.includes("claude") ? "anthropic" : model.includes("gemini") ? "google" : "openai",
        input_tokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
        output_tokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
        cost: Number(usage.cost ?? 0),
        duration_ms: Number(usage.duration_ms ?? 0),
      });
    } else {
      throw new Error("Missing API runtime configuration. Set NEXT_PUBLIC_API_URL and AGENTOS_INTERNAL_API_KEY.");
    }

    const updatedChat = await appendChatMessages(chat.id, [
      {
        role: latest?.role ?? "user",
        content: latest?.content ?? "",
        timestamp: new Date().toISOString(),
      },
      assistantMessage,
    ], usage);

    return NextResponse.json({ chat: updatedChat });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send chat message" }, { status: 500 });
  }
}
