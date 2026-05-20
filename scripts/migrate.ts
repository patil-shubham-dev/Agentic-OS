#!/usr/bin/env node
/* eslint-disable no-console */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

/**
 * Apply schema migrations to a Postgres-compatible database.
 *
 * Configuration precedence:
 *   1. DATABASE_URL — direct Postgres connection string (preferred for local).
 *   2. SUPABASE_DB_URL — alias used by some tooling.
 *   3. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — falls back to the
 *      Postgres connection string under postgresql://postgres:<key>@<host>.
 */

function resolveConnection(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const host = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `postgresql://postgres:${encodeURIComponent(key)}@${host}:5432/postgres`;
  }

  console.error(
    "❌ migrate: no database connection. Set DATABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

function collectMigrationFiles(): string[] {
  const root = join(process.cwd(), "supabase", "migrations");
  try {
    return readdirSync(root)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => join(root, f));
  } catch {
    return [];
  }
}

function main() {
  const conn = resolveConnection();
  const files = collectMigrationFiles();
  // Always include the canonical setup file as a fallback for fresh installs.
  const setupFile = join(process.cwd(), "docs", "supabase-setup.sql");
  const targets = files.length > 0 ? files : [setupFile];

  for (const file of targets) {
    const sql = readFileSync(file, "utf8");
    console.log(`▶ Applying ${file}`);
    try {
      execSync(`psql "${conn}" -v ON_ERROR_STOP=1`, {
        input: sql,
        stdio: ["pipe", "inherit", "inherit"],
      });
    } catch (error) {
      const isLocalhost =
        conn.includes("localhost") ||
        conn.includes("127.0.0.1") ||
        conn.includes("54322") ||
        conn.includes("54321");
      if (isLocalhost) {
        console.log("⚠️ Local 'psql' failed or is missing. Attempting to apply via docker exec...");
        try {
          execSync(`docker exec -i agentos-postgres psql -U postgres -d agentos -v ON_ERROR_STOP=1`, {
            input: sql,
            stdio: ["pipe", "inherit", "inherit"],
          });
          console.log("✅ Successfully applied migration inside Docker container.");
          continue;
        } catch (dockerError) {
          console.error("❌ Failed applying migration inside Docker container as well.");
          throw dockerError;
        }
      }
      console.error(`❌ Failed applying ${file}`);
      throw error;
    }
  }

  console.log("✅ Migrations applied.");
}

main();
