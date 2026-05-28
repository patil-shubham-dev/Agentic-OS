import { useState, useCallback, useEffect } from "react"
import { ExecutionMemoryStore } from "@/context/ExecutionMemoryStore"
import { SemanticSearchIndex } from "@/context/SemanticSearchIndex"
import { SlidingMemoryCompressor } from "@/context/SlidingMemoryCompressor"
import { RuntimeTelemetryEngine } from "@/runtime/observability/RuntimeTelemetryEngine"

// ── Singleton accessors (use the same instances as the runtime) ──

export function getMemoryStore(): ExecutionMemoryStore {
  return ExecutionMemoryStore.getInstance()
}

export function getSearchIndex(): SemanticSearchIndex {
  return SemanticSearchIndex.getInstance()
}

export function getMemoryCompressor(): SlidingMemoryCompressor {
  return SlidingMemoryCompressor.getInstance()
}

// ── Types ──

export interface MemoryBenchmarkData {
  /** Token counts per tier */
  shortTermTokens: number
  shortTermEntries: number
  compressedTokens: number
  compressedEntries: number
  longTermTokens: number
  longTermEntries: number
  /** Aggregate */
  totalTokens: number
  totalEntries: number
  /** Compression */
  compressionRatio: number
  compressionEnabled: boolean
  /** Search index */
  indexedDocuments: number
  /** Telemetry metrics */
  memoryPressurePct: number
  contextAssemblyLatencyMs: number
  retrievalLatencyMs: number
  /** Alerts */
  bottlenecks: string[]
  hotspots: string[]
}

// ── Collector — snapshots memory state from all available sources ──

function collectMemoryBenchmarks(): MemoryBenchmarkData {
  const store = getMemoryStore()
  const index = getSearchIndex()
  const compressor = getMemoryCompressor()
  const telemetry = RuntimeTelemetryEngine.getInstance()
  const metrics = telemetry.getMetrics()

  const shortTerm = store.getShortTerm()
  const compressed = store.getCompressed()
  const longTerm = store.getLongTerm()

  const shortTermTokens = shortTerm.reduce((s, e) => s + e.tokenEstimate, 0)
  const compressedTokens = compressed.reduce((s, e) => s + e.tokenEstimate, 0)
  const longTermTokens = longTerm.reduce((s, e) => s + e.tokenEstimate, 0)

  const totalTokens = shortTermTokens + compressedTokens + longTermTokens
  const totalEntries = shortTerm.length + compressed.length + longTerm.length

  // Compression ratio: raw estimate of all content / actual stored tokens
  const allContent = [...shortTerm, ...compressed, ...longTerm]
    .map((e) => e.content)
    .join("\n")
  const rawEstimate = compressor.estimateTokens(allContent)
  const storedEstimate = store.getTotalTokenEstimate()
  const compressionRatio =
    storedEstimate > 0 && rawEstimate > storedEstimate
      ? parseFloat((rawEstimate / storedEstimate).toFixed(2))
      : 1

  // Bottlenecks / hotspots from telemetry
  const bottlenecks: string[] = []
  if (metrics.memoryPressurePct > 80) {
    bottlenecks.push("Memory pressure critical")
  }
  if (metrics.contextAssemblyLatencyMs > 5000) {
    bottlenecks.push("Context assembly latency high")
  }
  if (metrics.retrievalLatencyMs > 2000) {
    bottlenecks.push("Retrieval latency high")
  }

  const hotspots: string[] = []
  if (metrics.retrievalLatencyMs > 1000) {
    hotspots.push("Retrieval")
  }
  if (metrics.contextAssemblyLatencyMs > 2000) {
    hotspots.push("Context assembly")
  }

  return {
    shortTermTokens,
    shortTermEntries: shortTerm.length,
    compressedTokens,
    compressedEntries: compressed.length,
    longTermTokens,
    longTermEntries: longTerm.length,
    totalTokens,
    totalEntries,
    compressionRatio,
    compressionEnabled: compressed.length > 0,
    indexedDocuments: index.getDocumentCount(),
    memoryPressurePct: metrics.memoryPressurePct,
    contextAssemblyLatencyMs: metrics.contextAssemblyLatencyMs,
    retrievalLatencyMs: metrics.retrievalLatencyMs,
    bottlenecks,
    hotspots,
  }
}

// ── Hook ──

export function useMemoryBenchmarks(): {
  benchmarks: MemoryBenchmarkData
  refresh: () => void
  isLoading: boolean
} {
  const [benchmarks, setBenchmarks] = useState<MemoryBenchmarkData>(() =>
    collectMemoryBenchmarks(),
  )
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(() => {
    setIsLoading(true)
    requestAnimationFrame(() => {
      setBenchmarks(collectMemoryBenchmarks())
      setIsLoading(false)
    })
  }, [])

  // Refresh every 10 seconds (memory state changes more frequently than provider metrics)
  useEffect(() => {
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [refresh])

  // Initial snapshot
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { benchmarks, refresh, isLoading }
}
