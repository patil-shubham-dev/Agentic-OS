import { NextRequest } from "next/server";
import { createPty, deletePty } from "@/lib/server/ptyManager";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const cwd = searchParams.get("cwd") || process.cwd();
  
  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const ptyProcess = createPty(id, cwd);

  const stream = new ReadableStream({
    start(controller) {
      const onData = (data: string) => {
        try {
          // SSE format requires double newline
          controller.enqueue(`data: ${JSON.stringify({ type: "data", data })}\n\n`);
        } catch {
          // Controller might be closed
        }
      };

      const onExit = (exitCode: { exitCode: number, signal?: number }) => {
        try {
          controller.enqueue(`data: ${JSON.stringify({ type: "exit", exitCode })}\n\n`);
          controller.close();
        } catch {}
      };

      ptyProcess.onData(onData);
      ptyProcess.onExit(onExit);

      request.signal.addEventListener("abort", () => {
        deletePty(id);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
