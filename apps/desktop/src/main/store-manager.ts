import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

interface StoreSchema {
  version: number;
  data: Record<string, unknown>;
}

interface StoreOptions {
  name: string;
  defaults?: Record<string, unknown>;
}

export class StoreManager {
  private filePath: string;
  private data: Record<string, unknown> = {};
  private schemaVersion = 1;

  constructor(options: StoreOptions) {
    const userDataPath = app?.getPath?.("userData") || process.cwd();
    this.filePath = path.join(userDataPath, `${options.name}.json`);
    this.data = { ...(options.defaults || {}) };
    this.load();
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    if (key in this.data) {
      return this.data[key] as T;
    }
    return defaultValue;
  }

  set(key: string, value: unknown): void {
    this.data[key] = value;
    this.save();
  }

  delete(key: string): void {
    delete this.data[key];
    this.save();
  }

  has(key: string): boolean {
    return key in this.data;
  }

  clear(): void {
    this.data = {};
    this.save();
  }

  getAll(): Record<string, unknown> {
    return { ...this.data };
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed: StoreSchema = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && "data" in parsed) {
          this.data = { ...this.data, ...parsed.data };
        }
      }
    } catch {
      this.data = {};
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const schema: StoreSchema = {
        version: this.schemaVersion,
        data: this.data,
      };
      fs.writeFileSync(this.filePath, JSON.stringify(schema, null, 2), "utf-8");
    } catch {
      console.error("[StoreManager] Failed to save store");
    }
  }
}
