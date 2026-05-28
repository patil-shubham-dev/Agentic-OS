import { type FailureReport, type RetryStep } from "./ObservabilityTypes"
import { TracePipeline } from "../telemetry/TracePipeline"
import { TraceStore } from "../telemetry/TraceStore"
import { generateTraceId, generateSpanId } from "../telemetry/TraceTypes"

/**
 * Failure Forensics Engine — tracks failures, recovery attempts, retry chains,
 * and fallback activation for comprehensive failure analysis.
 *
 * Light scaffold: types + failure tracking + retry chain analysis.
 * Full implementation should add:
 *  - Malformed chunk detection and repair tracking
 *  - Provider fallback chain visualization
 *  - Cancellation propagation analysis
 *  - Timeout recovery orchestration
 *  - Stream repair inspector
 */
export class FailureAnalyzer {
  private static instance: FailureAnalyzer
  private pipeline = TracePipeline.getInstance()
  private store = TraceStore.getInstance()
  private reports = new Map<string, FailureReport>()
  private retryChains = new Map<string, RetryStep[]>()
  private maxReports = 500

  private constructor() {}

  static getInstance(): FailureAnalyzer {
    if (!FailureAnalyzer.instance) {
      FailureAnalyzer.instance = new FailureAnalyzer()
    }
    return FailureAnalyzer.instance
  }

  // ── Failure Recording ──

  recordFailure(report: FailureReport): void {
    this.reports.set(report.traceId, report)

    if (this.reports.size > this.maxReports) {
      const oldest = Array.from(this.reports.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]
      if (oldest) this.reports.delete(oldest[0])
    }

    this.pipeline.emit({
      type: "failure_recorded",
      traceId: report.traceId,
      spanId: generateSpanId(),
      parentSpanId: null,
      timestamp: report.timestamp,
      priority: "high",
      runtimePhase: report.phase,
      source: "failure-analyzer",
      payload: report,
      metadata: {
        errorType: report.errorType,
        recoverable: report.recoverable,
        retryCount: report.retryCount,
      },
    })
  }

  recordRetry(traceId: string, step: RetryStep): void {
    const chain = this.retryChains.get(traceId) ?? []
    chain.push(step)
    this.retryChains.set(traceId, chain)
  }

  // ── Query ──

  getReport(traceId: string): FailureReport | undefined {
    return this.reports.get(traceId)
  }

  getAllReports(): FailureReport[] {
    return Array.from(this.reports.values())
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  getRecentReports(limit = 20): FailureReport[] {
    return this.getAllReports().slice(0, limit)
  }

  getRetryChain(traceId: string): RetryStep[] {
    return [...(this.retryChains.get(traceId) ?? [])]
  }

  getFailuresByType(errorType: FailureReport["errorType"]): FailureReport[] {
    return this.getAllReports().filter((r) => r.errorType === errorType)
  }

  getRecoveryRate(): { total: number; recovered: number; rate: number } {
    const total = this.getAllReports().length
    const recovered = this.getAllReports().filter((r) => r.recoverySucceeded).length
    return {
      total,
      recovered,
      rate: total > 0 ? recovered / total : 0,
    }
  }

  getMostCommonError(): { type: string; count: number } {
    const counts = new Map<string, number>()
    for (const report of this.getAllReports()) {
      counts.set(report.errorType, (counts.get(report.errorType) ?? 0) + 1)
    }
    let maxType = ""
    let maxCount = 0
    for (const [type, count] of counts) {
      if (count > maxCount) {
        maxType = type
        maxCount = count
      }
    }
    return { type: maxType, count: maxCount }
  }

  getFailureCount(): number {
    return this.reports.size
  }

  // ── Maintenance ──

  clear(): void {
    this.reports.clear()
    this.retryChains.clear()
  }
}
