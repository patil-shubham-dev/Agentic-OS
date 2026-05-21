import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

function exec(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, { cwd: cwd || process.cwd(), encoding: "utf-8", timeout: 15000 }).trim();
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  try {
    const file = request.nextUrl.searchParams.get("file");
    const staged = request.nextUrl.searchParams.get("staged") === "true";
    const root = process.cwd();

    let cmd = "git diff";
    if (staged) cmd += " --staged";
    if (file) cmd += ` -- "${file.replace(/"/g, '\\"')}"`;

    const diffOutput = exec(cmd, root);
    if (!diffOutput) {
      return NextResponse.json({ diff: "", message: "No changes" });
    }

    const files = new Set<string>();
    const stats = { additions: 0, deletions: 0 };
    const diffLines = diffOutput.split("\n");

    for (const line of diffLines) {
      if (line.startsWith("+++ b/")) files.add(line.slice(6));
      else if (line.startsWith("--- a/")) files.add(line.slice(6));
      else if (line.startsWith("+") && !line.startsWith("+++")) stats.additions++;
      else if (line.startsWith("-") && !line.startsWith("---")) stats.deletions++;
    }

    return NextResponse.json({
      diff: diffOutput,
      files: Array.from(files),
      stats,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Git diff failed" }, { status: 500 });
  }
}
