import { type ContextDiagnostics, type RetrievalEntry, type MemoryInjection } from "./ObservabilityTypes"
import { TracePipeline } from "../telemetry/TracePipeline"
import { generateTraceId, generateSpanId } from "../telemetry/TraceTypes"

/**
 * Context Forensics Engine — tracks token allocation, retrieval scoring,
 * compression stages, and context window evolution.
 *
 * Light scaffold: types + basic tracking + query interface.
 * Full implementation should add:
 *  - Token budget analyzer with visualization data
 *  - Retrieval score distribution
 *  - Context mutation timeline
 *  - Why-files-were-selected reasoning
 *  - Compression stage snapshots
 */
export class ContextDiagnosticsEngine {
  private static instance: ContextDiagnosticsEngine
  private pipeline = TracePipeline.getInstance()
  private diagnostics = new Map<string, ContextDiagnostics>()
  private mutations: ContextMutation[] = []
  private maxMutations = 1000

  private constructor() {}

  static getInstance(): ContextDiagnosticsEngine {
    if (!ContextDiagnosticsEngine.instance) {
      ContextDiagnosticsEngine.instance = new ContextDiagnosticsEngine()
    }
    return ContextDiagnosticsEngine.instance
  }

  recordDiagnostics(diag: ContextDiagnostics): void {
    this.diagnostics.set(diag.traceId, diag)

    this.pipeline.emit({
      type: "context_diagnostics",
      traceId: diag.traceId,
      spanId: generateSpanId(),
      parentSpanId: null,
      timestamp: performance.now(),
      priority: "normal",
      runtimePhase: "context_assembly",
      source: "context-diagnostics",
      payload: diag,
      metadata: {
        totalTokens: diag.totalTokens,
        retrievalEntries: diag.retrievalEntries.length,
      },
    })
  }

  recordRetrieval(traceId: string, entries: RetrievalEntry[]): void {
    const existing = this.diagnostics.get(traceId)
    if (existing) {
      this.diagnostics.set(traceId, { ...existing, retrievalEntries: entries })
    }
  }

  recordMutation(mutation: ContextMutation): void {
    this.mutations.push(mutation)
    if (this.mutations.length > this.maxMutations) {
      this.mutations = this.mutations.slice(-this.maxMutations)
    }
  }

  // ── Query ──

  getDiagnostics(traceId: string): ContextDiagnostics | undefined {
    return this.diagnostics.get(traceId)
  }

  getAllDiagnostics(): ContextDiagnostics[] {
    return Array.from(this.diagnostics.values())
  }

  getMutations(after?: number): ContextMutation[] {
    if (after) {
      return this.mutations.filter((m) => m.timestamp >= after)
    }
    return [...this.mutations]
  }

  getAverageTokens(): number {
    const all = this.getAllDiagnostics()
    if (all.length === 0) return 0
    return all.reduce((sum, d) => sum + d.totalTokens, 0) / all.length
  }

  // ── Maintenance ──

  clear(): void {
    this.diagnostics.clear()
    this.mutations = []
  }
}

export interface ContextMutation {
  traceId: string
  timestamp: number
  phase: "retrieval" | "compression" | "memory_injection" | "truncation"
  beforeTokens: number
  afterTokens: number
  reason: string
}

export { type ContextDiagnostics, type RetrievalEntry, type MemoryInjection }
