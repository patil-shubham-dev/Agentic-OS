import { TracePipeline } from "../telemetry/TracePipeline"
import { generateTraceId, generateSpanId } from "../telemetry/TraceTypes"

// ── Types ──

export type CausalRelationship =
  | "causes"        // Direct causality: A directly caused B
  | "depends_on"    // Dependency: A depends on B's output
  | "triggers"      // Trigger: A triggered B's execution
  | "resolves"      // Resolution: A resolved an issue raised by B
  | "blocks"        // Blocking: A is blocked by B
  | "amplifies"     // Amplification: A amplified the effect of B
  | "suppresses"    // Suppression: A suppressed/superseded B

export interface CausalLink {
  id: string
  fromEventId: string
  toEventId: string
  relationship: CausalRelationship
  description: string
  timestamp: number
  metadata: Record<string, unknown>
}

export interface CausalChain {
  id: string
  rootEventId: string
  rootLabel: string
  links: CausalLink[]
  nodeIds: string[]
  outcome: "success" | "failure" | "in_progress"
  duration: number
  startTime: number
  endTime: number | null
  tags: string[]
}

export interface CausalitySnapshot {
  chains: CausalChain[]
  links: CausalLink[]
  stats: {
    totalChains: number
    totalLinks: number
    successfulChains: number
    failedChains: number
    inProgressChains: number
    avgChainDuration: number
  }
  timestamp: number
}

// ── Engine ──

export class ExecutionCausalityEngine {
  private static instance: ExecutionCausalityEngine
  private pipeline = TracePipeline.getInstance()
  private links: CausalLink[] = []
  private chains = new Map<string, CausalChain>()
  private maxLinks = 2000
  private maxChains = 200
  private linkCounter = 0

  private constructor() {}

  static getInstance(): ExecutionCausalityEngine {
    if (!ExecutionCausalityEngine.instance) {
      ExecutionCausalityEngine.instance = new ExecutionCausalityEngine()
    }
    return ExecutionCausalityEngine.instance
  }

  // ── Link Management ──

  addLink(
    fromEventId: string,
    toEventId: string,
    relationship: CausalRelationship,
    description: string,
    metadata: Record<string, unknown> = {},
  ): CausalLink {
    this.linkCounter++
    const link: CausalLink = {
      id: `cl_${this.linkCounter}_${Date.now().toString(36)}`,
      fromEventId,
      toEventId,
      relationship,
      description,
      timestamp: Date.now(),
      metadata,
    }

    this.links.push(link)
    if (this.links.length > this.maxLinks) {
      this.links = this.links.slice(-this.maxLinks)
    }

    this.pipeline.emit({
      type: "causal_link_added",
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: null,
      timestamp: link.timestamp,
      priority: "normal",
      runtimePhase: "causality",
      source: "causality-engine",
      payload: link,
      metadata: { relationship, fromEventId, toEventId },
    })

    return link
  }

  addLinks(batch: Array<{
    fromEventId: string
    toEventId: string
    relationship: CausalRelationship
    description: string
    metadata?: Record<string, unknown>
  }>): CausalLink[] {
    return batch.map((b) => this.addLink(b.fromEventId, b.toEventId, b.relationship, b.description, b.metadata))
  }

  // ── Chain Management ──

  startChain(rootEventId: string, rootLabel: string, tags: string[] = []): CausalChain {
    const chain: CausalChain = {
      id: `cc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      rootEventId,
      rootLabel,
      links: [],
      nodeIds: [rootEventId],
      outcome: "in_progress",
      duration: 0,
      startTime: Date.now(),
      endTime: null,
      tags,
    }

    this.chains.set(chain.id, chain)

    if (this.chains.size > this.maxChains) {
      const oldest = Array.from(this.chains.entries())
        .sort(([, a], [, b]) => a.startTime - b.startTime)[0]
      if (oldest) this.chains.delete(oldest[0])
    }

    return chain
  }

  addLinkToChain(chainId: string, link: CausalLink): void {
    const chain = this.chains.get(chainId)
    if (!chain) return

    chain.links.push(link)
    if (!chain.nodeIds.includes(link.toEventId)) {
      chain.nodeIds.push(link.toEventId)
    }
    if (!chain.nodeIds.includes(link.fromEventId)) {
      chain.nodeIds.unshift(link.fromEventId)
    }

    chain.endTime = Date.now()
    chain.duration = chain.endTime - chain.startTime
    this.chains.set(chainId, chain)
  }

  completeChain(chainId: string, outcome: "success" | "failure"): void {
    const chain = this.chains.get(chainId)
    if (!chain) return
    chain.outcome = outcome
    chain.endTime = Date.now()
    chain.duration = chain.endTime - chain.startTime
    this.chains.set(chainId, chain)

    this.pipeline.emit({
      type: "causal_chain_completed",
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: null,
      timestamp: chain.endTime,
      priority: "normal",
      runtimePhase: "causality",
      source: "causality-engine",
      payload: { chainId, outcome, duration: chain.duration },
      metadata: { outcome, tags: chain.tags },
    })
  }

  // ── Query ──

  getChain(chainId: string): CausalChain | undefined {
    return this.chains.get(chainId)
  }

  getAllChains(): CausalChain[] {
    return Array.from(this.chains.values())
      .sort((a, b) => b.startTime - a.startTime)
  }

  getChainsByOutcome(outcome: CausalChain["outcome"]): CausalChain[] {
    return this.getAllChains().filter((c) => c.outcome === outcome)
  }

  getChainsByTag(tag: string): CausalChain[] {
    return this.getAllChains().filter((c) => c.tags.includes(tag))
  }

  getChainsByEventId(eventId: string): CausalChain[] {
    return this.getAllChains().filter((c) => c.nodeIds.includes(eventId))
  }

  getLinksByEventId(eventId: string): CausalLink[] {
    return this.links.filter((l) => l.fromEventId === eventId || l.toEventId === eventId)
  }

  getLinksByRelationship(relationship: CausalRelationship): CausalLink[] {
    return this.links.filter((l) => l.relationship === relationship)
  }

  // ── Critical Path Analysis ──

  getCriticalPath(chainId: string): CausalLink[] {
    const chain = this.chains.get(chainId)
    if (!chain || chain.links.length === 0) return []

    // Build adjacency: eventId → downstream links
    const adjacency = new Map<string, CausalLink[]>()
    for (const link of chain.links) {
      const existing = adjacency.get(link.fromEventId) ?? []
      existing.push(link)
      adjacency.set(link.fromEventId, existing)
    }

    // Build in-degree map
    const inDegree = new Map<string, number>()
    for (const link of chain.links) {
      inDegree.set(link.toEventId, (inDegree.get(link.toEventId) ?? 0) + 1)
      if (!inDegree.has(link.fromEventId)) {
        inDegree.set(link.fromEventId, 0)
      }
    }

    // Topological sort (Kahn's algorithm) using link timestamp ordering
    const sorted: CausalLink[] = []
    const queue: string[] = []

    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId)
    }

    const visited = new Set<string>()
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      if (visited.has(nodeId)) continue
      visited.add(nodeId)

      const outLinks = adjacency.get(nodeId) ?? []
      // Sort by timestamp for deterministic ordering
      outLinks.sort((a, b) => a.timestamp - b.timestamp)

      for (const link of outLinks) {
        sorted.push(link)
        const deg = inDegree.get(link.toEventId) ?? 0
        inDegree.set(link.toEventId, deg - 1)
        if (deg - 1 === 0) {
          queue.push(link.toEventId)
        }
      }
    }

    return sorted
  }

  // ── Root Cause Analysis ──

  findRootCauses(eventId: string): { link: CausalLink; chainId: string }[] {
    const results: { link: CausalLink; chainId: string }[] = []

    for (const chain of this.chains.values()) {
      // Find all links that lead TO eventId within this chain
      for (const link of chain.links) {
        if (link.toEventId === eventId) {
          results.push({ link, chainId: chain.id })
        }
      }
    }

    // Find transitive root causes (follow the chain backward)
    const rootCauses: { link: CausalLink; chainId: string }[] = []
    for (const result of results) {
      const transitiveLinks = this.findTransitiveCauses(result.link.fromEventId, result.chainId, 0)
      rootCauses.push(result, ...transitiveLinks)
    }

    return rootCauses
  }

  private findTransitiveCauses(
    eventId: string,
    chainId: string,
    depth: number,
    maxDepth = 5,
  ): { link: CausalLink; chainId: string }[] {
    if (depth >= maxDepth) return []

    const results: { link: CausalLink; chainId: string }[] = []
    const chain = this.chains.get(chainId)
    if (!chain) return results

    for (const link of chain.links) {
      if (link.toEventId === eventId) {
        results.push({ link, chainId })
        // Recurse to find what caused this link's source
        const transitive = this.findTransitiveCauses(link.fromEventId, chainId, depth + 1, maxDepth)
        results.push(...transitive)
      }
    }

    return results
  }

  // ── Statistics ──

  getStats() {
    const allChains = this.getAllChains()
    const successful = allChains.filter((c) => c.outcome === "success")
    const failed = allChains.filter((c) => c.outcome === "failure")
    const inProgress = allChains.filter((c) => c.outcome === "in_progress")
    const avgDuration = allChains.length > 0
      ? allChains.reduce((sum, c) => sum + c.duration, 0) / allChains.length
      : 0

    return {
      totalChains: allChains.length,
      totalLinks: this.links.length,
      successfulChains: successful.length,
      failedChains: failed.length,
      inProgressChains: inProgress.length,
      avgChainDuration: avgDuration,
    }
  }

  getLinkCountByRelationship(): Record<CausalRelationship, number> {
    const counts: Record<string, number> = {
      causes: 0,
      depends_on: 0,
      triggers: 0,
      resolves: 0,
      blocks: 0,
      amplifies: 0,
      suppresses: 0,
    }
    for (const link of this.links) {
      counts[link.relationship] = (counts[link.relationship] ?? 0) + 1
    }
    return counts as Record<CausalRelationship, number>
  }

  snapshot(): CausalitySnapshot {
    return {
      chains: this.getAllChains(),
      links: [...this.links],
      stats: this.getStats(),
      timestamp: Date.now(),
    }
  }

  // ── Maintenance ──

  clear(): void {
    this.links = []
    this.chains.clear()
    this.linkCounter = 0
  }
}
