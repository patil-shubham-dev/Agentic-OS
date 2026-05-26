import { EventBus } from "./EventBus"

interface ActionSignature {
  type: string
  toolName?: string
  target?: string
  contentHash: string
}

interface EntropySample {
  timestamp: number
  action: ActionSignature
}

const WINDOW_SIZE = 20
const EXACT_MATCH_THRESHOLD = 0.6
const FUZZY_MATCH_THRESHOLD = 0.75

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1
  const len = Math.max(a.length, b.length)
  if (len === 0) return 1
  const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1
  const aMatches = new Array(a.length).fill(false)
  const bMatches = new Array(b.length).fill(false)
  let matches = 0
  let transpositions = 0

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, b.length)
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue
      if (a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue
    while (!bMatches[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }

  const m = matches
  return (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3
}

function signaturesSimilar(a: ActionSignature, b: ActionSignature): number {
  let score = 0
  if (a.type === b.type) score += 0.3
  if (a.toolName === b.toolName) score += 0.25
  if (a.target === b.target) score += 0.2
  const contentSim = jaroWinkler(a.contentHash.slice(0, 20), b.contentHash.slice(0, 20))
  score += contentSim * 0.25
  return score
}

export class LoopDetectionEngine {
  private samples: EntropySample[] = []
  private halted = false
  private haltProbability = 0
  private unsub: (() => void) | null = null
  private onHalt: ((reason: string) => void) | null = null

  attach(bus: EventBus): void {
    this.unsub = bus.on("tool_completed", (event: any) => {
      if (this.halted) return

      const sig: ActionSignature = {
        type: event.type,
        toolName: event.toolName,
        target: event.target ?? event.filePath ?? event.url,
        contentHash: String(hashString(JSON.stringify(event))),
      }

      this.samples.push({ timestamp: Date.now(), action: sig })

      if (this.samples.length > WINDOW_SIZE) {
        this.samples = this.samples.slice(this.samples.length - WINDOW_SIZE)
      }

      if (this.samples.length >= 10) {
        this.evaluate()
      }
    })
  }

  detach(): void {
    this.unsub?.()
    this.unsub = null
  }

  onHaltRequested(handler: (reason: string) => void): void {
    this.onHalt = handler
  }

  private evaluate(): void {
    const window = this.samples
    if (window.length < 10) return

    let exactMatchCount = 0
    let totalSimilarity = 0
    let pairCount = 0

    for (let i = 0; i < window.length; i++) {
      for (let j = i + 1; j < window.length; j++) {
        const sim = signaturesSimilar(window[i].action, window[j].action)
        totalSimilarity += sim
        pairCount++
        if (sim > 0.95) {
          exactMatchCount++
        }
      }
    }

    const avgSimilarity = totalSimilarity / pairCount
    const exactMatchRatio = exactMatchCount / pairCount

    this.haltProbability = Math.min(
      1,
      avgSimilarity * 0.6 + exactMatchRatio * 0.4,
    )

    if (this.haltProbability >= EXACT_MATCH_THRESHOLD) {
      this.halted = true
      const reason = `Loop detected: action repetition probability ${(this.haltProbability * 100).toFixed(0)}%`
      this.onHalt?.(reason)
    }
  }

  getHaltProbability(): number {
    return this.haltProbability
  }

  isHalted(): boolean {
    return this.halted
  }

  reset(): void {
    this.samples = []
    this.halted = false
    this.haltProbability = 0
  }

  getWindowSize(): number {
    return this.samples.length
  }
}
