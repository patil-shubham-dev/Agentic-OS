import { NextRequest, NextResponse } from "next/server";
import { deleteAgent, updateAgent } from "@/lib/server/agentos-data";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateAgent(id, {
      name: body.name,
      description: body.description,
      model: body.model,
      status: body.status,
      tools: body.tools,
      memory_scope: body.memoryScope,
      config: body.config,
    });
    return NextResponse.json({ agent: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteAgent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete agent" },
      { status: 500 }
    );
  }
}
