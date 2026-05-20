import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, getRecentUsage } from "@/lib/server/agentos-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const limit = Math.min(500, Number(request.nextUrl.searchParams.get("limit") ?? 100));
    const records = await getRecentUsage(projectId, limit);
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load activity", records: [] },
      { status: 200 }
    );
  }
}
