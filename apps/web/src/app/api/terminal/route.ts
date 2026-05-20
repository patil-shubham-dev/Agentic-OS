import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const command = body?.command;
    let cwd = body?.cwd || process.cwd();

    if (!command) {
      return new Response(JSON.stringify({ error: "Command is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    cwd = path.resolve(cwd);
    if (!fs.existsSync(cwd)) {
      return new Response(JSON.stringify({ error: "Working directory does not exist" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isWin = process.platform === "win32";
    const shellCmd = isWin ? "powershell.exe" : "bash";
    const shellArgs = isWin ? ["-NoProfile", "-Command", command] : ["-c", command];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const proc = spawn(shellCmd, shellArgs, {
          cwd,
          env: { ...process.env, FORCE_COLOR: "1" }, // force chalk and other libs to output colors
        });

        const sendEvent = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Controller might be closed
          }
        };

        proc.stdout.on("data", (chunk) => {
          sendEvent({ type: "stdout", text: chunk.toString("utf-8") });
        });

        proc.stderr.on("data", (chunk) => {
          sendEvent({ type: "stderr", text: chunk.toString("utf-8") });
        });

        proc.on("error", (error) => {
          sendEvent({ type: "error", text: error.message });
          try {
            controller.close();
          } catch {}
        });

        proc.on("close", (code) => {
          sendEvent({ type: "exit", code: code ?? 0 });
          try {
            controller.close();
          } catch {}
        });

        // If client terminates stream, kill child process
        request.signal.addEventListener("abort", () => {
          try {
            proc.kill();
          } catch {}
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
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to execute command" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
