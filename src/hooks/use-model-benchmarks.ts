import { useState, useCallback, useEffect } from "react"
import { RuntimeTelemetryEngine } from "@/runtime/observability/RuntimeTelemetryEngine"
import { ProviderInspector } from "@/runtime/observability/ProviderInspector"
import type { ProviderHealthCheck } from "@/runtime/observability/ObservabilityTypes"
import { getAllProviderCache, getGatewayProviderHealth } from "@agentic-os/providers"
import type { GatewayProvider } from "@/types"

// ── Types ──

export interface ModelBenchmarkData {
  /** Average round-trip latency in ms (from health checks or cached stream data) */
  latencyMs: number | null
  /** Tokens per second throughput (from telemetry engine) */
  tokensPerSec: number | null
  /** Time to first token in ms (average of recorded first-token samples) */
  ttftMs: number | null
  /** 50th percentile latency (from first-token samples) */
  p50Ms: number | null
  /** 95th percentile latency */
  p95Ms: number | null
  /** 99th percentile latency */
  p99Ms: number | null
  /** Number of samples collected */
  samples: number
  /** Whether the provider is currently considered healthy */
  isHealthy: boolean
  /** Timestamp of last health check */
  lastChecked: number
  /** Last error message from health check, if any */
  providerError: string | null
}

export interface BenchmarkSnapshot {
  [providerId: string]: ModelBenchmarkData
}

// ── Collector — snapshots all observable data sources into a flat map ──

function collectBenchmarks(providers: GatewayProvider[]): BenchmarkSnapshot {
  const telemetry = RuntimeTelemetryEngine.getInstance()
  const inspector = ProviderInspector.getInstance()
  const libHealth = getAllProviderCache()
  const globalMetrics = telemetry.getMetrics()

  const snapshot: BenchmarkSnapshot = {}

  for (const provider of providers) {
    const inspHealth = inspector.getHealth(provider.id) as
      | ProviderHealthCheck
      | undefined

    const gwHealth = getGatewayProviderHealth(provider.baseUrl)
    const libHealthEntry = libHealth[provider.baseUrl]

    // First-token samples from lib health (per-endpoint)
    const firstTokenMs = libHealthEntry?.firstTokenMs ?? []
    const avgFirstToken =
      firstTokenMs.length > 0
        ? firstTokenMs.reduce((a, b) => a + b, 0) / firstTokenMs.length
        : null

    const sorted = [...firstTokenMs].sort((a, b) => a - b)

    // Latency: prefer health-check latency, fallback to gateway cache
    const latencyMs =
      inspHealth?.latencyMs ?? gwHealth?.avgLatencyMs ?? null

    // Throughput: use global telemetry metric (per-stream average)
    const tokensPerSec =
      globalMetrics.streamThroughputTokensPerSec > 0
        ? globalMetrics.streamThroughputTokensPerSec
        : null

    // TTFT: use per-provider first-token average, or global first-token latency
    const ttftMs =
      avgFirstToken ??
      (globalMetrics.firstTokenLatencyMs > 0
        ? globalMetrics.firstTokenLatencyMs
        : null)

    // Percentiles from first-token samples
    const p50 =
      sorted.length > 0
        ? sorted[Math.max(0, Math.floor(sorted.length * 0.5))] ?? null
        : null
    const p95 =
      sorted.length > 0
        ? sorted[Math.max(0, Math.floor(sorted.length * 0.95))] ?? null
        : null
    const p99 =
      sorted.length > 0
        ? sorted[Math.max(0, Math.floor(sorted.length * 0.99))] ?? null
        : null

    snapshot[provider.id] = {
      latencyMs,
      tokensPerSec,
      ttftMs,
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      samples:
        gwHealth?.samples ?? libHealthEntry?.totalRequests ?? 0,
      isHealthy:
        inspHealth?.healthy ?? (gwHealth?.samples ?? 0) > 0,
      lastChecked:
        inspHealth?.lastChecked ??
        gwHealth?.lastSuccess ??
        libHealthEntry?.lastStreamingSuccess ??
        0,
      providerError: inspHealth?.error ?? null,
    }
  }

  return snapshot
}

// ── Hook ──

export function useModelBenchmarks(
  providers: GatewayProvider[],
): {
  benchmarks: BenchmarkSnapshot
  refresh: () => void
  isLoading: boolean
} {
  const [benchmarks, setBenchmarks] = useState<BenchmarkSnapshot>(() =>
    collectBenchmarks(providers),
  )
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(() => {
    setIsLoading(true)
    // Defer to avoid blocking render
    requestAnimationFrame(() => {
      setBenchmarks(collectBenchmarks(providers))
      setIsLoading(false)
    })
  }, [providers])

  // Auto-refresh every 30 seconds while the component is mounted
  useEffect(() => {
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  // Re-collect when providers list changes (new provider added/removed)
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers.length])

  return { benchmarks, refresh, isLoading }
}
