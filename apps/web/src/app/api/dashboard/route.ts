import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, getDashboardData } from "@/lib/server/agentos-data";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const data = await getDashboardData(projectId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch dashboard data" }, { status: 500 });
  }
}
