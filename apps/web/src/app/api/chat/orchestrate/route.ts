import { NextRequest, NextResponse } from "next/server";
import { AgentOrchestrator, OrchestratorEvent } from "@/lib/runtime/agent-orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/chat/orchestrate
 *
 * Runs Manager-level orchestration on a user task. Streams back SSE events:
 *   - "text"       → intermediate agent text
 *   - "plan"       → Manager's structured plan
 *   - "agent_msg"  → Inter-agent bus message
 *   - "tool_call"  → Tool invocation by a specialist
 *   - "tool_result" → Tool execution result
 *   - "status"     → Status update
 *   - "completed"  → Final consolidated response
 *   - "error"      → Orchestration error
 */
export async function POST(request: NextRequest) {
  try {
    const { task, projectId, workspaceRoot, autonomous = false } = await request.json();

    if (!task || typeof task !== "string") {
      return NextResponse.json({ error: "task (string) is required" }, { status: 400 });
    }

    if (!workspaceRoot || typeof workspaceRoot !== "string") {
      return NextResponse.json({ error: "workspaceRoot is required — open a workspace folder first" }, { status: 400 });
    }

    const root = workspaceRoot;

    // Create a TransformStream to pipe SSE events
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Instantiate orchestrator with an onEvent callback that writes SSE
    const orchestrator = new AgentOrchestrator(
      projectId || "default-project",
      root,
      (event: OrchestratorEvent) => {
        const sseData = JSON.stringify(event);
        writer.write(encoder.encode(`data: ${sseData}\n\n`));
      },
      autonomous
    );

    // Run orchestration in the background
    orchestrator.orchestrateTask(task).finally(() => {
      writer.close();
    });

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Orchestration failed" },
      { status: 500 }
    );
  }
}
