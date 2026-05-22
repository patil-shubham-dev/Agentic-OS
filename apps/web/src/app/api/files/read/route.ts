import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveSafePath } from "@/lib/server/path-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetPath = searchParams.get("path");

    if (!targetPath) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    const resolvedPath = resolveSafePath(targetPath);

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Path is not a file" }, { status: 400 });
    }

    const content = await fs.promises.readFile(resolvedPath, "utf-8");

    return NextResponse.json({
      path: resolvedPath,
      name: path.basename(resolvedPath),
      content,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read file content";
    const status = message.includes("Path traversal") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
