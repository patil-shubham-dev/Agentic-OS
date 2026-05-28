import type { CompactResult, CompactStrategy, MessageLike, BudgetState } from './context-types'
import { TokenEstimator } from './TokenEstimator'
import { ContextWindowResolver } from './ContextWindowResolver'
import { TokenBudgetTracker } from './TokenBudgetTracker'

export type CompactorConfig = {
  autoCompactThreshold: number
  autoCompactBuffer: number
  microCompactThreshold: number
  reactiveCompactThreshold: number
  sessionMemoryMinTokens: number
  sessionMemoryMaxTokens: number
  messageCountHardLimit: number
  maxConsecutiveCompactions: number
}

const DEFAULT_COMPACTOR_CONFIG: CompactorConfig = {
  autoCompactThreshold: 0.75,
  autoCompactBuffer: 13000,
  microCompactThreshold: 0.85,
  reactiveCompactThreshold: 0.10,
  sessionMemoryMinTokens: 10_000,
  sessionMemoryMaxTokens: 40_000,
  messageCountHardLimit: 100,
  maxConsecutiveCompactions: 3,
}

export class Compactor {
  private config: CompactorConfig
  private resolver: ContextWindowResolver
  private budgetTracker: TokenBudgetTracker
  private consecutiveCompactions: number = 0
  private lastCompactStrategy: CompactStrategy | null = null

  constructor(
    resolver: ContextWindowResolver,
    budgetTracker: TokenBudgetTracker,
    config?: Partial<CompactorConfig>,
  ) {
    this.resolver = resolver
    this.budgetTracker = budgetTracker
    this.config = { ...DEFAULT_COMPACTOR_CONFIG, ...config }
  }

  setConfig(config: Partial<CompactorConfig>): void {
    this.config = { ...this.config, ...config }
  }

  shouldAutoCompact(model: string, messages: MessageLike[], betas?: string[]): boolean {
    if (this.consecutiveCompactions >= this.config.maxConsecutiveCompactions) {
      return false
    }

    const budgetState = this.budgetTracker.getBudgetState()
    if (budgetState.percentageUsed >= this.config.autoCompactThreshold * 100) {
      return true
    }

    const currentUsage = TokenEstimator.getCurrentUsage(messages)
    if (!currentUsage) {
      const estimated = TokenEstimator.tokenCountWithEstimation(messages)
      const effectiveWindow = this.resolver.getEffectiveContextWindowSize(model, betas)
      return estimated >= effectiveWindow
    }

    return false
  }

  autoCompact(messages: MessageLike[], model: string, betas?: string[]): CompactResult {
    const beforeCount = messages.length
    const beforeTokens = TokenEstimator.tokenCountWithEstimation(messages)

    const autoCompactThreshold = this.resolver.getAutoCompactThreshold(model, betas)

    if (messages.length <= 10) {
      return {
        strategy: 'auto',
        messagesRetained: messages.length,
        tokensRecovered: 0,
      }
    }

    const boundaryIndex = Math.max(0, Math.floor(messages.length * 0.4))
    const retained = messages.slice(boundaryIndex)

    const afterTokens = TokenEstimator.tokenCountWithEstimation(retained)
    const tokensRecovered = beforeTokens - afterTokens

    this.consecutiveCompactions++
    this.lastCompactStrategy = 'auto'

    return {
      strategy: 'auto',
      messagesRetained: retained.length,
      tokensRecovered: Math.max(0, tokensRecovered),
    }
  }

  shouldMicroCompact(messages: MessageLike[]): boolean {
    const budgetState = this.budgetTracker.getBudgetState()
    if (messages.length > this.config.messageCountHardLimit) return true
    return budgetState.percentageUsed >= this.config.microCompactThreshold * 100
  }

  microCompact(messages: MessageLike[]): CompactResult {
    const beforeCount = messages.length
    const beforeTokens = TokenEstimator.tokenCountWithEstimation(messages)

    const toolCallCounts = new Map<number, number>()
    messages.forEach((m, i) => {
      if (m.type === 'assistant' && m.message?.content && Array.isArray(m.message.content)) {
        const toolCalls = (m.message.content as Array<Record<string, unknown>>)
          .filter(c => c.type === 'tool_use').length
        toolCallCounts.set(i, toolCalls)
      }
    })

    const sortedByToolCalls = [...toolCallCounts.entries()]
      .filter(([_, count]) => count > 3)
      .sort((a, b) => b[1] - a[1])

    const removeIndices = new Set(sortedByToolCalls.slice(0, Math.min(5, sortedByToolCalls.length)).map(([i]) => i))

    const retained = messages.filter((_, i) => !removeIndices.has(i))
    const afterTokens = TokenEstimator.tokenCountWithEstimation(retained)

    this.consecutiveCompactions++
    this.lastCompactStrategy = 'micro'

    return {
      strategy: 'micro',
      messagesRetained: retained.length,
      tokensRecovered: Math.max(0, beforeTokens - afterTokens),
    }
  }

  shouldReactiveCompact(): boolean {
    const budgetState = this.budgetTracker.getBudgetState()
    return budgetState.percentageUsed >= 90 || budgetState.remaining <= this.config.autoCompactBuffer
  }

  reactiveCompact(messages: MessageLike[]): CompactResult {
    const beforeCount = messages.length
    const beforeTokens = TokenEstimator.tokenCountWithEstimation(messages)

    if (messages.length <= 5) {
      return {
        strategy: 'reactive',
        messagesRetained: messages.length,
        tokensRecovered: 0,
      }
    }

    const keepRatio = 0.3
    const keepCount = Math.max(5, Math.floor(messages.length * keepRatio))
    const retained = messages.slice(-keepCount)

    const afterTokens = TokenEstimator.tokenCountWithEstimation(retained)
    const tokensRecovered = beforeTokens - afterTokens

    this.consecutiveCompactions++
    this.lastCompactStrategy = 'reactive'

    return {
      strategy: 'reactive',
      messagesRetained: retained.length,
      tokensRecovered: Math.max(0, tokensRecovered),
      summaryGenerated: true,
    }
  }

  shouldSessionMemoryCompact(messages: MessageLike[]): boolean {
    const budgetState = this.budgetTracker.getBudgetState()
    const oldestMessage = messages[0]
    if (!oldestMessage) return false
    return budgetState.percentageUsed >= 80 && messages.length > 20
  }

  sessionMemoryCompact(
    messages: MessageLike[],
    compactFn: (msgs: MessageLike[]) => { summary: string; retained: MessageLike[] },
  ): CompactResult {
    const beforeCount = messages.length
    const beforeTokens = TokenEstimator.tokenCountWithEstimation(messages)

    const result = compactFn(messages)
    const afterTokens = TokenEstimator.tokenCountWithEstimation(result.retained)

    this.consecutiveCompactions++
    this.lastCompactStrategy = 'session-memory'

    return {
      strategy: 'session-memory',
      messagesRetained: result.retained.length,
      tokensRecovered: Math.max(0, beforeTokens - afterTokens),
      summaryGenerated: true,
    }
  }

  decideStrategy(model: string, messages: MessageLike[], betas?: string[]): CompactStrategy | null {
    if (this.consecutiveCompactions >= this.config.maxConsecutiveCompactions) {
      return null
    }

    if (this.shouldReactiveCompact()) return 'reactive'
    if (this.shouldMicroCompact(messages)) return 'micro'
    if (this.shouldAutoCompact(model, messages, betas)) return 'auto'
    if (this.shouldSessionMemoryCompact(messages)) return 'session-memory'

    return null
  }

  compact(model: string, messages: MessageLike[], betas?: string[]): CompactResult | null {
    const strategy = this.decideStrategy(model, messages, betas)
    if (!strategy) return null

    switch (strategy) {
      case 'auto':
        return this.autoCompact(messages, model, betas)
      case 'micro':
        return this.microCompact(messages)
      case 'reactive':
        return this.reactiveCompact(messages)
      case 'session-memory':
        return null
    }
  }

  getLastCompactStrategy(): CompactStrategy | null {
    return this.lastCompactStrategy
  }

  getConsecutiveCompactions(): number {
    return this.consecutiveCompactions
  }

  resetCompactionCount(): void {
    this.consecutiveCompactions = 0
  }

  getCompactStats(): {
    autoCompactTokenThreshold: number
    messageCountHardLimit: number
    consecutiveCompactions: number
    lastStrategy: CompactStrategy | null
  } {
    return {
      autoCompactTokenThreshold: this.config.autoCompactBuffer,
      messageCountHardLimit: this.config.messageCountHardLimit,
      consecutiveCompactions: this.consecutiveCompactions,
      lastStrategy: this.lastCompactStrategy,
    }
  }
}
