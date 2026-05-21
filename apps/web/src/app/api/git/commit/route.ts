import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { message, files, stageAll } = await request.json();
    const root = process.cwd();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Commit message is required" }, { status: 400 });
    }

    if (stageAll) {
      execSync("git add -A", { cwd: root, encoding: "utf-8", timeout: 15000 });
    } else if (Array.isArray(files) && files.length > 0) {
      for (const f of files) {
        execSync(`git add "${f.replace(/"/g, '\\"')}"`, { cwd: root, encoding: "utf-8", timeout: 15000 });
      }
    }

    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: root,
      encoding: "utf-8",
      timeout: 15000,
    });

    return NextResponse.json({ success: true, message: `Committed: ${message}` });
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message || "Commit failed";
    return NextResponse.json({ error: stderr }, { status: 500 });
  }
}
