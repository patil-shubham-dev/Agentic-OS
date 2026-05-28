import type { BudgetState, MessageLike } from './context-types'
import { TokenEstimator } from './TokenEstimator'
import { ContextWindowResolver } from './ContextWindowResolver'

export type BudgetConfig = {
  contextWindow: number
  maxOutputTokens: number
  autoContinueBuffer: number
  warningThreshold: number
  diminishingReturnsCutoff: number
}

const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  contextWindow: 200_000,
  maxOutputTokens: 32_000,
  autoContinueBuffer: 3_000,
  warningThreshold: 20_000,
  diminishingReturnsCutoff: 3,
}

export class TokenBudgetTracker {
  private config: BudgetConfig
  private resolver: ContextWindowResolver
  private consecutiveAutoContinues: number = 0
  private taskBudget: number = 0
  private remainingBudget: number = 0
  private outputTokensUsed: number = 0
  private autoContinueTriggered: boolean = false
  private lastFinalWindowTokens: number = 0

  constructor(resolver: ContextWindowResolver, config?: Partial<BudgetConfig>) {
    this.resolver = resolver
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config }
    this.taskBudget = this.config.contextWindow + this.config.maxOutputTokens
    this.remainingBudget = this.taskBudget
  }

  initializeTask(model: string, betas?: string[]): void {
    const ctxConfig = this.resolver.getModelConfig(model)
    this.config = {
      ...this.config,
      contextWindow: ctxConfig.contextWindow,
      maxOutputTokens: ctxConfig.defaultMaxTokens,
    }
    this.taskBudget = this.config.contextWindow + this.config.maxOutputTokens
    this.remainingBudget = this.taskBudget
    this.outputTokensUsed = 0
    this.autoContinueTriggered = false
    this.consecutiveAutoContinues = 0
    this.lastFinalWindowTokens = 0
  }

  updateAfterResponse(messages: MessageLike[]): void {
    const finalWindowTokens = TokenEstimator.finalContextTokensFromLastResponse(messages)
    if (finalWindowTokens > 0) {
      this.lastFinalWindowTokens = finalWindowTokens
      this.remainingBudget = this.taskBudget - finalWindowTokens
    }

    const outputTokens = TokenEstimator.messageOutputTokensFromLastResponse(messages)
    if (outputTokens > 0) {
      this.outputTokensUsed += outputTokens
    }

    this.remainingBudget = Math.max(0, this.remainingBudget)
  }

  shouldAutoContinue(): boolean {
    if (this.remainingBudget <= this.config.autoContinueBuffer) {
      this.autoContinueTriggered = true
      this.consecutiveAutoContinues++
      return true
    }
    return false
  }

  hasDiminishingReturns(): boolean {
    return this.consecutiveAutoContinues >= this.config.diminishingReturnsCutoff
  }

  shouldWarning(): boolean {
    if (this.remainingBudget <= this.config.warningThreshold) return true
    const percentageUsed = this.getPercentageUsed()
    return percentageUsed >= 75
  }

  getBudgetState(): BudgetState {
    const percentageUsed = this.getPercentageUsed()
    return {
      total: this.taskBudget,
      used: this.taskBudget - this.remainingBudget,
      remaining: this.remainingBudget,
      outputTokens: this.outputTokensUsed,
      percentageUsed,
      autoContinueTriggered: this.autoContinueTriggered,
    }
  }

  getPercentageUsed(): number {
    if (this.taskBudget === 0) return 0
    const used = this.taskBudget - this.remainingBudget
    return Math.round((used / this.taskBudget) * 100)
  }

  getConsecutiveAutoContinues(): number {
    return this.consecutiveAutoContinues
  }

  getRemainingBudget(): number {
    return this.remainingBudget
  }

  setConfig(config: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...config }
    this.taskBudget = this.config.contextWindow + this.config.maxOutputTokens
    this.remainingBudget = this.taskBudget - (this.taskBudget - this.remainingBudget)
  }

  shouldCompact(threshold: number): boolean {
    const lastWindowTokens = this.lastFinalWindowTokens > 0
      ? this.lastFinalWindowTokens
      : TokenEstimator.fromLastAPIResponse([])

    if (lastWindowTokens === 0) return false

    const effectiveWindow = this.config.contextWindow - this.config.maxOutputTokens
    const used = this.config.contextWindow - this.remainingBudget
    return used >= threshold
  }
}
