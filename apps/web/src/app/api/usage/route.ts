import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, getDashboardData } from "@/lib/server/agentos-data";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const data = await getDashboardData(projectId);
    return NextResponse.json({
      summary: data.summary,
      byProvider: data.byProvider,
      usageTimeline: data.usageTimeline,
      recentActivities: data.chats.slice(0, 8).map((chat) => ({
        id: chat.id,
        title: chat.title,
        model: chat.model,
        time: chat.updated_at,
        tokens: Number((chat.usage?.total_tokens as number | undefined) ?? 0),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch usage" }, { status: 500 });
  }
}
