import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { message, files, stageAll } = await request.json();
    const root = process.cwd();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Commit message is required" }, { status: 400 });
    }

    const options = { cwd: root, encoding: "utf-8" as const, timeout: 15000 };

    // Stage files – no shell, no injection
    if (stageAll) {
      const result = spawnSync("git", ["add", "-A"], options);
      if (result.error || result.status !== 0) {
        const stderr = result.stderr?.toString() || result.error?.message || "git add failed";
        return NextResponse.json({ error: stderr }, { status: 500 });
      }
    } else if (Array.isArray(files) && files.length > 0) {
      for (const f of files) {
        if (typeof f !== "string") continue;
        const result = spawnSync("git", ["add", "--", f], options);
        if (result.error || result.status !== 0) {
          const stderr = result.stderr?.toString() || result.error?.message || `Failed to stage "${f}"`;
          return NextResponse.json({ error: stderr }, { status: 500 });
        }
      }
    }

    // Commit – args array prevents shell interpretation
    const commitResult = spawnSync("git", ["commit", "-m", message], options);
    if (commitResult.error || commitResult.status !== 0) {
      const stderr = commitResult.stderr?.toString() || commitResult.error?.message || "Commit failed";
      return NextResponse.json({ error: stderr }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Committed: ${message}` });
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message || "Commit failed";
    return NextResponse.json({ error: stderr }, { status: 500 });
  }
}
