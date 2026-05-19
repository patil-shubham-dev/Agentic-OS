import { NextRequest, NextResponse } from "next/server";
import { createAutomation, DEFAULT_PROJECT_ID, getAutomations } from "@/lib/server/agentos-data";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const automations = await getAutomations(projectId);
    return NextResponse.json({ automations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch automations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const automation = await createAutomation(body.projectId ?? DEFAULT_PROJECT_ID, {
      name: body.name,
      description: body.description,
      status: body.status,
      trigger: body.trigger,
      steps: body.steps,
      runs: body.runs,
      success_rate: body.successRate,
    });
    return NextResponse.json({ automation }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create automation" }, { status: 500 });
  }
}
