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
      const send = (data: object) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Controller may be closed
        }
      };

      const onData = (data: string) => {
        send({ type: "data", data });
      };

      const onExit = (exitCode: { exitCode: number; signal?: number }) => {
        send({ type: "exit", exitCode });
        try { controller.close(); } catch {}
      };

      ptyProcess.onData(onData);
      ptyProcess.onExit(onExit);

      // SSE heartbeat every 15s to prevent proxy / browser timeouts
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", ts: Date.now() });
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        deletePty(id);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      deletePty(id);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
