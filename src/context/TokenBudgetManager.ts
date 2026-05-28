export interface TokenBudget {
  staticInstructions: number
  history: number
  retrieval: number
  reservedOutput: number
  safetyBuffer: number
  total: number
  used: number
  available: number
}

export class TokenBudgetManager {
  private totalBudget: number
  private staticInstructionsRatio: number = 0.15
  private historyRatio: number = 0.20
  private retrievalRatio: number = 0.40
  private reservedOutputRatio: number = 0.20
  private safetyBufferRatio: number = 0.05

  constructor(totalBudget: number = 128000) {
    this.totalBudget = totalBudget
  }

  allocate(usedTokens: number = 0): TokenBudget {
    const available = this.totalBudget - usedTokens

    return {
      staticInstructions: Math.floor(this.totalBudget * this.staticInstructionsRatio),
      history: Math.floor(this.totalBudget * this.historyRatio),
      retrieval: Math.floor(this.totalBudget * this.retrievalRatio),
      reservedOutput: Math.floor(this.totalBudget * this.reservedOutputRatio),
      safetyBuffer: Math.floor(this.totalBudget * this.safetyBufferRatio),
      total: this.totalBudget,
      used: usedTokens,
      available: Math.max(0, available),
    }
  }

  isCompressionNeeded(usedTokens: number): boolean {
    const ratio = usedTokens / this.totalBudget
    return ratio >= 0.85
  }

  getCompressionUrgency(usedTokens: number): "none" | "moderate" | "critical" {
    const ratio = usedTokens / this.totalBudget
    if (ratio >= 0.95) return "critical"
    if (ratio >= 0.85) return "moderate"
    return "none"
  }

  adjustBudget(newTotal: number): void {
    this.totalBudget = newTotal
  }

  adjustRatios(ratios: {
    staticInstructions?: number
    history?: number
    retrieval?: number
    reservedOutput?: number
    safetyBuffer?: number
  }): void {
    if (ratios.staticInstructions !== undefined) this.staticInstructionsRatio = ratios.staticInstructions
    if (ratios.history !== undefined) this.historyRatio = ratios.history
    if (ratios.retrieval !== undefined) this.retrievalRatio = ratios.retrieval
    if (ratios.reservedOutput !== undefined) this.reservedOutputRatio = ratios.reservedOutput
    if (ratios.safetyBuffer !== undefined) this.safetyBufferRatio = ratios.safetyBuffer
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  getTotalBudget(): number {
    return this.totalBudget
  }

  getAvailableBudget(usedTokens: number): number {
    return Math.max(0, this.totalBudget - usedTokens)
  }
}
