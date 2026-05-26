export interface HealthRecord {
  providerId: string
  lastSuccess: number
  lastFailure: number
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  samples: number
  failures: number
  consecutiveFailures: number
  isHealthy: boolean
  lastError: string | null
}

export class ProviderHealthMonitor {
  private records: Map<string, HealthRecord> = new Map()
  private latencyHistograms: Map<string, number[]> = new Map()
  private maxSamples: number
  private failureThreshold: number

  constructor(maxSamples: number = 100, failureThreshold: number = 3) {
    this.maxSamples = maxSamples
    this.failureThreshold = failureThreshold
  }

  recordSuccess(providerId: string, latencyMs: number): void {
    const record = this.getOrCreate(providerId)
    record.lastSuccess = Date.now()
    record.samples++
    record.consecutiveFailures = 0
    record.isHealthy = true
    record.lastError = null

    const alpha = 1 / Math.min(record.samples, 10)
    record.avgLatencyMs = record.samples === 1
      ? latencyMs
      : record.avgLatencyMs * (1 - alpha) + latencyMs * alpha

    this.recordLatency(providerId, latencyMs)
    this.updatePercentiles(providerId)
  }

  recordFailure(providerId: string, error: string): void {
    const record = this.getOrCreate(providerId)
    record.lastFailure = Date.now()
    record.failures++
    record.consecutiveFailures++
    record.lastError = error

    if (record.consecutiveFailures >= this.failureThreshold) {
      record.isHealthy = false
    }
  }

  getHealth(providerId: string): HealthRecord | undefined {
    return this.records.get(providerId)
  }

  getAllHealth(): HealthRecord[] {
    return Array.from(this.records.values())
  }

  isHealthy(providerId: string): boolean {
    const record = this.records.get(providerId)
    if (!record) return true
    return record.isHealthy
  }

  getHealthyProviders(): string[] {
    const result: string[] = []
    for (const [id, record] of this.records) {
      if (record.isHealthy) result.push(id)
    }
    return result
  }

  getUnhealthyProviders(): string[] {
    const result: string[] = []
    for (const [id, record] of this.records) {
      if (!record.isHealthy) result.push(id)
    }
    return result
  }

  getLatencyPercentile(providerId: string, percentile: number): number | null {
    const hist = this.latencyHistograms.get(providerId)
    if (!hist || hist.length === 0) return null

    const sorted = [...hist].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }

  reset(providerId: string): void {
    this.records.delete(providerId)
    this.latencyHistograms.delete(providerId)
  }

  resetAll(): void {
    this.records.clear()
    this.latencyHistograms.clear()
  }

  getSummary(): { total: number; healthy: number; unhealthy: number; avgLatencyMs: number } {
    let healthy = 0
    let unhealthy = 0
    let totalLatency = 0
    let latencyCount = 0

    for (const record of this.records.values()) {
      if (record.isHealthy) healthy++
      else unhealthy++
      if (record.samples > 0) {
        totalLatency += record.avgLatencyMs
        latencyCount++
      }
    }

    return {
      total: this.records.size,
      healthy,
      unhealthy,
      avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
    }
  }

  private getOrCreate(providerId: string): HealthRecord {
    let record = this.records.get(providerId)
    if (!record) {
      record = {
        providerId,
        lastSuccess: 0,
        lastFailure: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        samples: 0,
        failures: 0,
        consecutiveFailures: 0,
        isHealthy: true,
        lastError: null,
      }
      this.records.set(providerId, record)
    }
    return record
  }

  private recordLatency(providerId: string, latencyMs: number): void {
    let hist = this.latencyHistograms.get(providerId)
    if (!hist) {
      hist = []
      this.latencyHistograms.set(providerId, hist)
    }
    hist.push(latencyMs)
    if (hist.length > this.maxSamples) {
      hist.shift()
    }
  }

  private updatePercentiles(providerId: string): void {
    const record = this.records.get(providerId)
    if (!record) return
    record.p50LatencyMs = this.getLatencyPercentile(providerId, 50) ?? 0
    record.p95LatencyMs = this.getLatencyPercentile(providerId, 95) ?? 0
    record.p99LatencyMs = this.getLatencyPercentile(providerId, 99) ?? 0
  }
}
