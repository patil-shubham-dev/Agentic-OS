import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveSafePath } from "@/lib/server/path-security";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const oldPath = body?.oldPath;
    const newPath = body?.newPath;

    if (!oldPath || !newPath) {
      return NextResponse.json({ error: "oldPath and newPath are required" }, { status: 400 });
    }

    const oldResolved = resolveSafePath(oldPath);
    const newResolved = resolveSafePath(newPath);

    if (!fs.existsSync(oldResolved)) {
      return NextResponse.json({ error: "Source path does not exist" }, { status: 404 });
    }

    // Ensure destination's parent directory exists
    const destParent = path.dirname(newResolved);
    if (!fs.existsSync(destParent)) {
      await fs.promises.mkdir(destParent, { recursive: true });
    }

    await fs.promises.rename(oldResolved, newResolved);

    return NextResponse.json({
      success: true,
      oldPath: oldResolved,
      newPath: newResolved,
      name: path.basename(newResolved),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rename / move target";
    const status = message.includes("Path traversal") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
