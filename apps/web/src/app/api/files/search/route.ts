import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  resolveSafePath,
  loadGitIgnorePatterns,
  shouldSkipEntry,
} from "@/lib/server/path-security";

export const dynamic = "force-dynamic";

const TEXT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".html", ".md",
  ".yml", ".yaml", ".txt", ".conf", ".ini", ".sh", ".py", ".go",
]);

async function walk(
  dir: string,
  skipSet: Set<string>,
  fileList: string[] = [],
  maxFiles = 1000
) {
  if (fileList.length >= maxFiles) return fileList;

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipEntry(entry.name, skipSet)) continue;

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath, skipSet, fileList, maxFiles);
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
    const rootParam = searchParams.get("root") || process.cwd();

    if (!query) {
      return NextResponse.json({ error: "Query 'q' is required" }, { status: 400 });
    }

    const rootPath = resolveSafePath(rootParam);
    if (!fs.existsSync(rootPath)) {
      return NextResponse.json({ error: "Root path does not exist" }, { status: 404 });
    }

    const skipSet = loadGitIgnorePatterns(rootPath);

    // Recursively list text files
    const allFiles = await walk(rootPath, skipSet);
    const results: Array<{
      name: string;
      path: string;
      relPath: string;
      matches: Array<{ line: number; text: string }>;
    }> = [];

    let matchedCount = 0;
    for (const filePath of allFiles) {
      if (matchedCount >= 50) break;

      try {
        const content = await fs.promises.readFile(filePath, "utf-8");
        if (content.toLowerCase().includes(query)) {
          const lines = content.split("\n");
          const fileMatches: Array<{ line: number; text: string }> = [];

          lines.forEach((lineText, idx) => {
            if (lineText.toLowerCase().includes(query) && fileMatches.length < 10) {
              fileMatches.push({
                line: idx + 1,
                text: lineText.trim().substring(0, 150),
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
        // Ignore per-file read errors
      }
    }

    return NextResponse.json({ query, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search codebase";
    const status = message.includes("Path traversal") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
