import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetPath = body?.path;

    if (!targetPath) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    const resolvedPath = path.resolve(targetPath);

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "Target does not exist" }, { status: 404 });
    }

    // recursive deletion
    await fs.promises.rm(resolvedPath, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      path: resolvedPath,
      name: path.basename(resolvedPath),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete target" },
      { status: 500 }
    );
  }
}
