import { NextRequest, NextResponse } from "next/server";
import { createAgent, getAgents } from "@/lib/server/agentos-data";

export async function GET() {
  try {
    const agents = await getAgents();
    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch agents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const agent = await createAgent({
      name: body.name,
      description: body.description,
      model: body.model,
      type: body.type,
      status: body.status,
      tools: body.tools,
      memory_scope: body.memoryScope,
      config: body.config,
    });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create agent" }, { status: 500 });
  }
}
