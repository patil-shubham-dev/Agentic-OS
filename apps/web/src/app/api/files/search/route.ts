import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SKIPPED_FOLDERS = new Set([".git", "node_modules", ".next", ".turbo", "dist", "build"]);
const TEXT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".html", ".md",
  ".yml", ".yaml", ".txt", ".conf", ".ini", ".sh", ".py", ".go"
]);

async function walk(dir: string, fileList: string[] = [], maxFiles = 1000) {
  if (fileList.length >= maxFiles) return fileList;

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIPPED_FOLDERS.has(entry.name)) continue;

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath, fileList, maxFiles);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) {
        fileList.push(entryPath);
      }
    }
  }
  return fileList;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.toLowerCase();
    let rootPath = searchParams.get("root") || process.cwd();

    if (!query) {
      return NextResponse.json({ error: "Query 'q' is required" }, { status: 400 });
    }

    rootPath = path.resolve(rootPath);
    if (!fs.existsSync(rootPath)) {
      return NextResponse.json({ error: "Root path does not exist" }, { status: 404 });
    }

    // Recursively list text files
    const allFiles = await walk(rootPath);
    const results: Array<{
      name: string;
      path: string;
      relPath: string;
      matches: Array<{ line: number; text: string }>;
    }> = [];

    let matchedCount = 0;
    for (const filePath of allFiles) {
      if (matchedCount >= 50) break; // limit to 50 files with matches

      try {
        const content = await fs.promises.readFile(filePath, "utf-8");
        if (content.toLowerCase().includes(query)) {
          const lines = content.split("\n");
          const fileMatches: Array<{ line: number; text: string }> = [];

          lines.forEach((lineText, idx) => {
            if (lineText.toLowerCase().includes(query) && fileMatches.length < 10) {
              fileMatches.push({
                line: idx + 1,
                text: lineText.trim().substring(0, 150), // grab first 150 characters
              });
            }
          });

          if (fileMatches.length > 0) {
            const relPath = path.relative(process.cwd(), filePath);
            results.push({
              name: path.basename(filePath),
              path: filePath,
              relPath: relPath.replace(/\\/g, "/"),
              matches: fileMatches,
            });
            matchedCount++;
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    return NextResponse.json({ query, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search codebase" },
      { status: 500 }
    );
  }
}
