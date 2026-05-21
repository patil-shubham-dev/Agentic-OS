/**
 * Development launcher for AgentOS Desktop.
 *
 * Starts the Next.js dev server, waits for it to be ready,
 * then launches Electron pointing at localhost:3000.
 *
 * Usage: node scripts/dev.mjs
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const webRoot = resolve(root, "..", "web");

const WEB_PORT = process.env.AGENTOS_WEB_PORT || 3000;
const WEB_URL = `http://localhost:${WEB_PORT}`;

console.log("=".repeat(60));
console.log("  AgentOS Studio — Desktop Dev Mode");
console.log("=".repeat(60));

// 1. Start Next.js dev server
console.log(`\n🚀 Starting Next.js dev server on port ${WEB_PORT}...\n`);

const nextDev = spawn("pnpm", ["exec", "next", "dev", "--port", String(WEB_PORT)], {
  cwd: webRoot,
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: "development",
  },
});

// Forward Next.js output but prefix it
nextDev.stdout.on("data", (chunk) => {
  const text = chunk.toString().trim();
  if (text) {
    console.log(`  [Next.js] ${text}`);
  }
});

nextDev.stderr.on("data", (chunk) => {
  const text = chunk.toString().trim();
  if (text && !text.includes("ExperimentalWarning")) {
    console.error(`  [Next.js:err] ${text}`);
  }
});

nextDev.on("exit", (code) => {
  console.log(`\n⚠️  Next.js exited with code ${code}`);
  process.exit(code ?? 1);
});

// 2. Wait for Next.js to be ready, then launch Electron
async function waitForServer(url, maxRetries = 60, interval = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok || response.status === 404) {
        // 404 means the server is running but page not found — still ready
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Server at ${url} did not become ready within ${(maxRetries * interval) / 1000}s`);
}

try {
  await waitForServer(WEB_URL);
  console.log(`\n✅ Next.js server ready at ${WEB_URL}`);
} catch (err) {
  console.error(`\n❌ ${err.message}`);
  nextDev.kill();
  process.exit(1);
}

// 3. Launch Electron
console.log(`\n🖥️  Launching Electron...\n`);

const electron = spawn(
  resolve(root, "node_modules", ".bin", "electron"),
  [resolve(root, "dist", "main", "index.js")],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      AGENTOS_WEB_URL: WEB_URL,
      NODE_ENV: "development",
    },
  }
);

electron.on("exit", (code) => {
  console.log(`\nElectron exited with code ${code}`);
  nextDev.kill();
  process.exit(code ?? 0);
});

// Cleanup on Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\nShutting down...");
  nextDev.kill();
  electron.kill();
  process.exit(0);
});
