import {
  type MemoryRecord,
  type MemoryMutation,
  type MemorySnapshot,
} from "./ObservabilityTypes"
import type { RuntimeRole } from "@/types"
import { TracePipeline } from "../telemetry/TracePipeline"
import { generateTraceId, generateSpanId } from "../telemetry/TraceTypes"

/**
 * Memory Propagation System — tracks memory injection, mutation,
 * compression, eviction, and propagation across sessions, projects,
 * workspaces, and long-term storage.
 *
 * Light scaffold: types + memory store + mutation tracking.
 * Full implementation should add:
 *  - Session memory with automatic summarization
 *  - Project memory with cross-session persistence
 *  - Workspace-scoped memory
 *  - Role-scoped memory for agent specialization
 *  - Compressed memory with sliding window
 *  - Retrieval-augmented memory scoring
 *  - Long-term memory with TTL
 *  - Memory graph visualization
 *  - Memory timeline with diffs
 *  - Memory diff viewer
 */
export class MemoryPropagationSystem {
  private static instance: MemoryPropagationSystem
  private pipeline = TracePipeline.getInstance()
  private records = new Map<string, MemoryRecord>()
  private mutations: MemoryMutation[] = []
  private maxRecords = 500
  private maxMutations = 1000

  private constructor() {}

  static getInstance(): MemoryPropagationSystem {
    if (!MemoryPropagationSystem.instance) {
      MemoryPropagationSystem.instance = new MemoryPropagationSystem()
    }
    return MemoryPropagationSystem.instance
  }

  // ── Record Management ──

  addRecord(record: MemoryRecord): void {
    this.records.set(record.id, record)
    if (this.records.size > this.maxRecords) {
      const oldest = Array.from(this.records.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]
      if (oldest) this.records.delete(oldest[0])
    }

    this.recordMutation({
      recordId: record.id,
      mutationType: "create",
      fromType: record.type,
      toType: record.type,
      timestamp: record.timestamp,
      tokenDelta: record.tokens,
      reason: "New memory record created",
    })
  }

  updateRecord(id: string, updates: Partial<MemoryRecord>): void {
    const existing = this.records.get(id)
    if (!existing) return
    this.records.set(id, { ...existing, ...updates })

    this.recordMutation({
      recordId: id,
      mutationType: "update",
      fromType: existing.type,
      toType: updates.type ?? existing.type,
      timestamp: Date.now(),
      tokenDelta: (updates.tokens ?? existing.tokens) - existing.tokens,
      reason: "Memory record updated",
    })
  }

  removeRecord(id: string): void {
    const existing = this.records.get(id)
    if (!existing) return
    this.records.delete(id)

    this.recordMutation({
      recordId: id,
      mutationType: "evict",
      fromType: existing.type,
      toType: existing.type,
      timestamp: Date.now(),
      tokenDelta: -existing.tokens,
      reason: "Memory evicted",
    })
  }

  propagateRecord(id: string, toType: MemoryRecord["type"]): void {
    const existing = this.records.get(id)
    if (!existing) return

    const propagated: MemoryRecord = {
      ...existing,
      id: `${id}_prop_${Date.now()}`,
      type: toType,
      timestamp: Date.now(),
    }
    this.records.set(propagated.id, propagated)

    this.recordMutation({
      recordId: id,
      mutationType: "propagate",
      fromType: existing.type,
      toType,
      timestamp: Date.now(),
      tokenDelta: propagated.tokens,
      reason: `Memory propagated from ${existing.type} to ${toType}`,
    })
  }

  private recordMutation(mutation: MemoryMutation): void {
    this.mutations.push(mutation)
    if (this.mutations.length > this.maxMutations) {
      this.mutations = this.mutations.slice(-this.maxMutations)
    }

    this.pipeline.emit({
      type: "memory_mutation",
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: null,
      timestamp: mutation.timestamp,
      priority: "low",
      runtimePhase: "memory",
      source: "memory-propagation",
      payload: mutation,
      metadata: {},
    })
  }

  // ── Query ──

  getRecord(id: string): MemoryRecord | undefined {
    return this.records.get(id)
  }

  getRecordsByType(type: MemoryRecord["type"]): MemoryRecord[] {
    return Array.from(this.records.values())
      .filter((r) => r.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  getRecordsByRole(role: RuntimeRole): MemoryRecord[] {
    return Array.from(this.records.values())
      .filter((r) => r.role === role)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  getMutations(after?: number): MemoryMutation[] {
    if (after) {
      return this.mutations.filter((m) => m.timestamp >= after)
    }
    return [...this.mutations]
  }

  snapshot(): MemorySnapshot {
    const allRecords = Array.from(this.records.values())
    return {
      totalTokens: allRecords.reduce((sum, r) => sum + r.tokens, 0),
      records: allRecords,
      mutations: [...this.mutations],
      pressure: this.computePressure(),
      timestamp: Date.now(),
    }
  }

  private computePressure(): number {
    const totalTokens = Array.from(this.records.values())
      .reduce((sum, r) => sum + r.tokens, 0)
    // Rough pressure: 0-100% based on record count
    return Math.min(100, (this.records.size / this.maxRecords) * 100)
  }

  getRecordCount(): number {
    return this.records.size
  }

  getMutationCount(): number {
    return this.mutations.length
  }

  // ── Maintenance ──

  clear(): void {
    this.records.clear()
    this.mutations = []
  }
}
