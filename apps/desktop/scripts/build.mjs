/**
 * Desktop production build script.
 *
 * Steps:
 * 1. Build the web app (Next.js standalone)
 * 2. Compile TypeScript for Electron main process
 * 3. Package with electron-builder
 *
 * Usage:
 *   node scripts/build.mjs [--win|--mac|--linux]
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const webRoot = resolve(root, "../web");

const args = process.argv.slice(2);
const platform = args.includes("--win") ? "win" : args.includes("--mac") ? "mac" : args.includes("--linux") ? "linux" : null;

function run(cmd, cwd) {
  console.log(`\n> ${cmd} (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

async function build() {
  console.log("=== AgentOS Desktop Production Build ===");

  // Step 1: Build web app
  console.log("\n--- Step 1/3: Building Next.js web app ---");
  if (!existsSync(resolve(webRoot, ".next"))) {
    run("pnpm --filter @agentos/web build", root);
  } else {
    console.log("  Web build exists, skipping (delete .next to rebuild)");
  }

  // Step 2: TypeScript compile for Electron main process
  console.log("\n--- Step 2/3: Compiling Electron TypeScript ---");
  run("npx tsc --project tsconfig.json", root);

  // Step 3: Package with electron-builder
  console.log("\n--- Step 3/3: Packaging with electron-builder ---");
  const target = platform ? `--${platform}` : "";
  run(`npx electron-builder ${target} --publish=never`, root);

  console.log("\n=== Build Complete ===");
  console.log(`Output: ${resolve(root, "out")}`);
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
