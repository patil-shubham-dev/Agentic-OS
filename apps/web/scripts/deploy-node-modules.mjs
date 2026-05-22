import { execSync } from "child_process";
import { existsSync, rmSync, cpSync, mkdtempSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const webDir = resolve(__dirname, "..");
const workspaceRoot = resolve(webDir, "../..");
const standaloneDir = resolve(webDir, ".next/standalone");
const standaloneWebDir = resolve(standaloneDir, "apps/web");
const standaloneNodeModules = resolve(standaloneWebDir, "node_modules");

if (!existsSync(standaloneDir)) {
  console.error("Standalone output not found at .next/standalone/");
  process.exit(1);
}

const tempDir = mkdtempSync(resolve(tmpdir(), "agentos-deploy-"));
console.log(`Deploying production node_modules to ${tempDir}...`);

try {
  execSync(`pnpm deploy --filter=@agentos/web "${tempDir}"`, {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: true,
    timeout: 180000,
  });

  const deployNodeModules = resolve(tempDir, "node_modules");
  if (!existsSync(deployNodeModules)) {
    throw new Error("pnpm deploy output does not contain node_modules/");
  }

  console.log("Merging into standalone output...");
  if (existsSync(standaloneNodeModules)) {
    rmSync(standaloneNodeModules, { recursive: true, force: true });
  }

  mkdirSync(standaloneNodeModules, { recursive: true });
  cpSync(deployNodeModules, standaloneNodeModules, {
    recursive: true,
    force: true,
  });

  const count = execSync(
    `dir /A:D /B "${standaloneNodeModules}" 2>nul | find /V /C ""`,
    { encoding: "utf-8", shell: true }
  ).trim();
  console.log(`Done: ${count} packages deployed`);
} catch (err) {
  console.error(`Deploy failed: ${err.message}`);
  process.exit(1);
} finally {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
