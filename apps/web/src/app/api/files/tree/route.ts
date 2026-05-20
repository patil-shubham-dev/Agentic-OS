import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SKIPPED_FOLDERS = new Set([".git", "node_modules", ".next", ".turbo", "dist", "build"]);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let targetPath = searchParams.get("path") || process.cwd();

    // Resolve path absolutely
    targetPath = path.resolve(targetPath);

    // Verify it exists
    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "Path does not exist" }, { status: 404 });
    }

    const stat = await fs.promises.stat(targetPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
    }

    const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });

    const items = await Promise.all(
      entries
        .filter((entry) => !SKIPPED_FOLDERS.has(entry.name))
        .map(async (entry) => {
          const entryPath = path.join(targetPath, entry.name);
          const relPath = path.relative(process.cwd(), entryPath);
          const isDir = entry.isDirectory();
          let size = 0;
          let updatedAt = new Date().toISOString();

          try {
            const entryStat = await fs.promises.stat(entryPath);
            size = entryStat.size;
            updatedAt = entryStat.mtime.toISOString();
          } catch {
            // Ignore stat errors for broken symlinks / permission issues
          }

          return {
            name: entry.name,
            path: entryPath,
            relPath: relPath.replace(/\\/g, "/"),
            isDir,
            size,
            updatedAt,
          };
        })
    );

    // Sort: directories first, then alphabetically by name
    items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ path: targetPath, items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read directory tree" },
      { status: 500 }
    );
  }
}
