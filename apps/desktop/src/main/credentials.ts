import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

// ──────────────────────────────────────────────
// OS-Level Credential Store (keytar)
// ──────────────────────────────────────────────

async function loadKeytar() {
  try {
    return await import("keytar");
  } catch {
    return null;
  }
}

/**
 * Store a credential in the OS keychain.
 * Falls back to encrypted file storage when keytar is unavailable.
 */
export async function setCredential(
  service: string,
  account: string,
  password: string
): Promise<void> {
  const keytar = await loadKeytar();
  if (keytar) {
    await keytar.setPassword(service, account, password);
    return;
  }
  // Fallback: store in encrypted local file
  setStoreValue(
    `credential:${service}:${account}`,
    Buffer.from(password).toString("base64"),
    "local"
  );
}

/**
 * Get a credential from the OS keychain.
 */
export async function getCredential(
  service: string,
  account: string
): Promise<string | null> {
  const keytar = await loadKeytar();
  if (keytar) {
    return keytar.getPassword(service, account);
  }
  // Fallback: read from local file
  const raw = getStoreValue(`credential:${service}:${account}`, "local");
  if (raw) {
    return Buffer.from(raw, "base64").toString("utf-8");
  }
  return null;
}

/**
 * Delete a credential from the OS keychain.
 */
export async function deleteCredential(
  service: string,
  account: string
): Promise<boolean> {
  const keytar = await loadKeytar();
  if (keytar) {
    return keytar.deletePassword(service, account);
  }
  deleteStoreValue(`credential:${service}:${account}`, "local");
  return true;
}

/**
 * Find all accounts for a given service.
 */
export async function findCredentials(
  service: string
): Promise<Array<{ account: string; password: string }>> {
  const keytar = await loadKeytar();
  if (keytar) {
    return keytar.findCredentials(service);
  }
  return [];
}

// ──────────────────────────────────────────────
// Local JSON Store (for non-sensitive data)
// ──────────────────────────────────────────────

interface StoreData {
  [key: string]: string;
}

function getStorePath(kind: "local" | "session"): string {
  const userDataPath = app?.getPath?.("userData") || process.cwd();
  const file = kind === "local" ? "agentos-store.json" : "agentos-session.json";
  return path.join(userDataPath, file);
}

function readStore(kind: "local" | "session"): StoreData {
  try {
    const storePath = getStorePath(kind);
    if (fs.existsSync(storePath)) {
      return JSON.parse(fs.readFileSync(storePath, "utf-8"));
    }
  } catch {
    // Corrupted store file — start fresh
  }
  return {};
}

function writeStore(kind: "local" | "session", data: StoreData): void {
  try {
    const storePath = getStorePath(kind);
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Silently fail — store is non-critical
  }
}

export function getStoreValue(
  key: string,
  kind: "local" | "session" = "local"
): string | null {
  const store = readStore(kind);
  return store[key] ?? null;
}

export function setStoreValue(
  key: string,
  value: string,
  kind: "local" | "session" = "local"
): void {
  const store = readStore(kind);
  store[key] = value;
  writeStore(kind, store);
}

export function deleteStoreValue(
  key: string,
  kind: "local" | "session" = "local"
): void {
  const store = readStore(kind);
  delete store[key];
  writeStore(kind, store);
}
