import type {
  ToolEventLifecycle,
  RuntimeEvent,
  EventMetadata,
} from "./RuntimeTypes"
import { EventBus } from "./EventBus"

export interface ToolRecord {
  toolId: string
  toolName: string
  lifecycle: ToolEventLifecycle
  args: string
  result: string | null
  error: string | null
  startedAt: number
  completedAt: number | null
  durationMs: number | null
}

export class ToolExecutionManager {
  private records: Map<string, ToolRecord> = new Map()
  private maxRecords: number

  constructor(maxRecords: number = 100) {
    this.maxRecords = maxRecords
  }

  request(toolId: string, toolName: string, args: string, metadata: EventMetadata): void {
    const record: ToolRecord = {
      toolId,
      toolName,
      lifecycle: "tool_requested",
      args,
      result: null,
      error: null,
      startedAt: Date.now(),
      completedAt: null,
      durationMs: null,
    }
    this.records.set(toolId, record)
    this.evictOld()

    EventBus.getInstance().emit({
      type: "tool_requested",
      metadata,
      toolName,
      args,
    } as RuntimeEvent)
  }

  start(toolId: string, toolName: string, metadata: EventMetadata): void {
    const record = this.records.get(toolId)
    if (record) {
      record.lifecycle = "tool_started"
    }

    EventBus.getInstance().emit({
      type: "tool_started",
      metadata,
      toolName,
      toolId,
    } as RuntimeEvent)
  }

  stream(toolId: string, toolName: string, chunk: string, metadata: EventMetadata): void {
    EventBus.getInstance().emit({
      type: "tool_stream",
      metadata,
      toolName,
      toolId,
      chunk,
    } as RuntimeEvent)
  }

  complete(toolId: string, toolName: string, result: string, metadata: EventMetadata): void {
    const record = this.records.get(toolId)
    if (record) {
      record.lifecycle = "tool_completed"
      record.result = result
      record.completedAt = Date.now()
      record.durationMs = record.completedAt - record.startedAt
    }

    EventBus.getInstance().emit({
      type: "tool_completed",
      metadata,
      toolName,
      toolId,
      result,
      durationMs: record?.durationMs ?? 0,
    } as RuntimeEvent)
  }

  fail(toolId: string, toolName: string, error: string, metadata: EventMetadata): void {
    const record = this.records.get(toolId)
    if (record) {
      record.lifecycle = "tool_failed"
      record.error = error
      record.completedAt = Date.now()
      record.durationMs = record.completedAt - record.startedAt
    }

    EventBus.getInstance().emit({
      type: "tool_failed",
      metadata,
      toolName,
      toolId,
      error,
      durationMs: record?.durationMs ?? 0,
    } as RuntimeEvent)
  }

  getRecord(toolId: string): ToolRecord | null {
    return this.records.get(toolId) ?? null
  }

  getRecordsByExecutionId(executionId: string): ToolRecord[] {
    const result: ToolRecord[] = []
    for (const record of this.records.values()) {
      if (record.toolId.startsWith(executionId)) {
        result.push(record)
      }
    }
    return result
  }

  getAllRecords(): ToolRecord[] {
    return Array.from(this.records.values())
  }

  clear(): void {
    this.records.clear()
  }

  getActiveCount(): number {
    let count = 0
    for (const record of this.records.values()) {
      if (record.lifecycle !== "tool_completed" && record.lifecycle !== "tool_failed") {
        count++
      }
    }
    return count
  }

  snapshot(): ToolRecord[] {
    return Array.from(this.records.values())
  }

  restore(records: ToolRecord[]): void {
    this.records.clear()
    for (const record of records) {
      this.records.set(record.toolId, record)
    }
  }

  private evictOld(): void {
    if (this.records.size <= this.maxRecords) return
    const entries = Array.from(this.records.entries())
    entries.sort((a, b) => a[1].startedAt - b[1].startedAt)
    const toRemove = entries.slice(0, entries.length - this.maxRecords)
    for (const [key] of toRemove) {
      this.records.delete(key)
    }
  }
}
