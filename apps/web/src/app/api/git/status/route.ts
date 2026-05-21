import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

function exec(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, { cwd: cwd || process.cwd(), encoding: "utf-8", timeout: 10000 }).trim();
  } catch {
    return "";
  }
}

export async function GET() {
  try {
    const root = process.cwd();
    const branch = exec("git rev-parse --abbrev-ref HEAD", root);
    const changesRaw = exec("git status --porcelain", root);
    const logRaw = exec("git log --oneline -5", root);

    const changes = changesRaw
      ? changesRaw.split("\n").filter(Boolean).map((line) => ({
          status: line.slice(0, 2).trim(),
          file: line.slice(3),
        }))
      : [];

    const log = logRaw
      ? logRaw.split("\n").filter(Boolean).map((line) => {
          const [hash, ...msg] = line.split(" ");
          return { hash, message: msg.join(" ") };
        })
      : [];

    const aheadBehind = exec(`git rev-list --count --left-right HEAD...${branch}@{upstream}`, root);
    const [ahead = "0", behind = "0"] = aheadBehind ? aheadBehind.split("\t") : ["0", "0"];

    return NextResponse.json({
      branch: branch || "main",
      changes: changes.length,
      changesList: changes,
      log,
      ahead: parseInt(ahead),
      behind: parseInt(behind),
      hasUnpushed: changes.some((c) => c.status === "??" || c.status.includes("M")),
    });
  } catch {
    return NextResponse.json({
      branch: "unknown",
      changes: 0,
      changesList: [],
      log: [],
      ahead: 0,
      behind: 0,
      hasUnpushed: false,
      error: "Not a git repository or git not available",
    });
  }
}
