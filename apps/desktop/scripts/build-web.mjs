/**
 * Builds the Next.js web app for Electron packaging.
 *
 * 1. Runs `next build` in the web app directory
 * 2. Verifies the output exists
 *
 * Usage: node scripts/build-web.mjs
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const webRoot = resolve(root, "..", "web");

console.log("=".repeat(60));
console.log("  AgentOS Studio — Build Web for Desktop");
console.log("=".repeat(60));

// 1. Build Next.js
console.log("\n📦 Building Next.js application...\n");

const build = await new Promise((resolve, reject) => {
  const proc = spawn("pnpm", ["exec", "next", "build"], {
    cwd: webRoot,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NODE_ENV: "production" },
  });

  proc.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Next.js build exited with code ${code}`));
  });

  proc.on("error", reject);
});

console.log("\n✅ Next.js build complete");

// 2. Verify output directory exists
const nextOut = resolve(webRoot, ".next");
if (!existsSync(nextOut)) {
  console.error(`\n❌ Output directory not found: ${nextOut}`);
  process.exit(1);
}

console.log(`\n📁 Output: ${nextOut}`);
console.log("\n✅ Web build ready for Electron packaging.");
