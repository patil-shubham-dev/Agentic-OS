import type { CacheStrategy } from '../registry/SectionDefinition'
import { CachePolicy } from './CachePolicy'

export class SectionCache {
  private policy: CachePolicy
  private contextHashes: Map<string, string> = new Map()

  constructor(maxEntries?: number, ttlMs?: number) {
    this.policy = new CachePolicy(maxEntries, ttlMs)
  }

  computeContextHash(ctx: Record<string, unknown>): string {
    const relevant = {
      role: ctx.role,
      executionMode: ctx.executionMode,
      workspaceFiles: ctx.workspaceFiles,
      isAutonomous: ctx.isAutonomous,
      isMultiAgent: ctx.isMultiAgent,
      hasTools: ctx.hasTools,
    }
    return JSON.stringify(relevant)
  }

  get(sectionId: string, strategy: CacheStrategy, ctx: Record<string, unknown>): string | null {
    const contextHash = this.computeContextHash(ctx)
    const key = this.policy.getKey(sectionId, strategy, contextHash)
    if (!key) return null
    this.contextHashes.set(sectionId, contextHash)
    return this.policy.get(key)
  }

  set(sectionId: string, strategy: CacheStrategy, ctx: Record<string, unknown>, content: string): void {
    const contextHash = this.computeContextHash(ctx)
    const key = this.policy.getKey(sectionId, strategy, contextHash)
    if (!key) return
    this.policy.set(key, content)
  }

  invalidate(sectionId: string): void {
    this.policy.invalidate(sectionId)
  }

  invalidateAll(): void {
    this.policy.invalidateAll()
    this.contextHashes.clear()
  }

  getStats(): { size: number; hits: number } {
    return this.policy.getStats()
  }
}
