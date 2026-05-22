import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveSafePath } from "@/lib/server/path-security";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetPath = body?.path;
    const content = body?.content ?? "";

    if (!targetPath) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    const resolvedPath = resolveSafePath(targetPath);

    // Create parent directory if it doesn't exist
    const parentDir = path.dirname(resolvedPath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(resolvedPath, content, "utf-8");

    const stat = await fs.promises.stat(resolvedPath);

    return NextResponse.json({
      success: true,
      path: resolvedPath,
      name: path.basename(resolvedPath),
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to write file";
    const status = message.includes("Path traversal") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
