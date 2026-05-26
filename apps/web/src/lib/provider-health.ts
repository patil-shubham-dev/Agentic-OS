export interface ProviderHealthStats {
  totalRequests: number
  streamingFailures: number
  lastStreamingSuccess: number
  lastStreamingFailure: number
  firstTokenMs: number[]
  lastFirstTokenMs: number
  consecutiveTimeouts: number
}

const providerHealth = new Map<string, ProviderHealthStats>()

export function getProviderHealth(baseUrl: string): ProviderHealthStats {
  let stats = providerHealth.get(baseUrl)
  if (!stats) {
    stats = {
      totalRequests: 0,
      streamingFailures: 0,
      lastStreamingSuccess: 0,
      lastStreamingFailure: 0,
      firstTokenMs: [],
      lastFirstTokenMs: 0,
      consecutiveTimeouts: 0,
    }
    providerHealth.set(baseUrl, stats)
  }
  return stats
}

export function recordStreamStarted(baseUrl: string): void {
  const stats = getProviderHealth(baseUrl)
  stats.totalRequests++
}

export function recordStreamSuccess(baseUrl: string): void {
  const stats = getProviderHealth(baseUrl)
  stats.lastStreamingSuccess = Date.now()
  stats.consecutiveTimeouts = 0
}

export function recordStreamFailure(baseUrl: string): void {
  const stats = getProviderHealth(baseUrl)
  stats.streamingFailures++
  stats.lastStreamingFailure = Date.now()
}

export function recordFirstToken(baseUrl: string, elapsedMs: number): void {
  const stats = getProviderHealth(baseUrl)
  stats.firstTokenMs.push(elapsedMs)
  if (stats.firstTokenMs.length > 10) stats.firstTokenMs.shift()
  stats.lastFirstTokenMs = elapsedMs
  stats.consecutiveTimeouts = 0
}

export function recordStreamTimeout(baseUrl: string): void {
  const stats = getProviderHealth(baseUrl)
  stats.streamingFailures++
  stats.consecutiveTimeouts++
}

export function shouldStream(baseUrl: string): boolean {
  const stats = getProviderHealth(baseUrl)
  if (stats.totalRequests < 3) return true
  if (stats.consecutiveTimeouts >= 2) return false
  const avgFirstToken = stats.firstTokenMs.length > 0
    ? stats.firstTokenMs.reduce((a, b) => a + b, 0) / stats.firstTokenMs.length
    : 0
  if (avgFirstToken > 8000 && stats.totalRequests >= 3) return false
  return true
}

export function resetProviderHealth(baseUrl: string): void {
  providerHealth.delete(baseUrl)
}

export function getAllProviderHealth(): Record<string, ProviderHealthStats> {
  const result: Record<string, ProviderHealthStats> = {}
  for (const [key, value] of providerHealth.entries()) {
    result[key] = { ...value, firstTokenMs: [...value.firstTokenMs] }
  }
  return result
}
