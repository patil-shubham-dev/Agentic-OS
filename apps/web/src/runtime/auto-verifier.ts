/**
 * AutoVerifier — runs automatic verification (typecheck, lint, build) after
 * file write/edit operations and feeds results back to the agent for self-correction.
 *
 * Adapted from Claude Code's verify-after-write pattern where every
 * code change is followed by an automated verification step.
 */

export type VerificationType = "typecheck" | "lint" | "build" | "test" | "custom"

export interface VerificationConfig {
  type: VerificationType
  command: string
  timeout: number
  required: boolean // If true, block execution on failure
  fixCommand?: string // Command to auto-fix if available
}

export interface VerificationResult {
  type: VerificationType
  passed: boolean
  durationMs: number
  output: string
  error?: string
  fixApplied?: boolean
}

export const DEFAULT_VERIFICATION_STEPS: VerificationConfig[] = [
  {
    type: "typecheck",
    command: "npx tsc --noEmit 2>&1",
    timeout: 60_000,
    required: false,
    fixCommand: undefined,
  },
  {
    type: "lint",
    command: "npx eslint . --ext .ts,.tsx 2>&1",
    timeout: 60_000,
    required: false,
  },
]

export class AutoVerifier {
  private configs: VerificationConfig[]
  private results: VerificationResult[] = []
  private lastVerificationTime = 0

  constructor(configs?: VerificationConfig[]) {
    this.configs = configs ?? [...DEFAULT_VERIFICATION_STEPS]
  }

  /**
   * Run all configured verification steps and return results.
   */
  async verifyAll(): Promise<VerificationResult[]> {
    this.results = []
    this.lastVerificationTime = Date.now()

    const results: VerificationResult[] = []
    for (const config of this.configs) {
      const result = await this.runVerification(config)
      results.push(result)
      this.results = results

      // If a required step fails, stop immediately
      if (!result.passed && config.required) {
        break
      }
    }

    return results
  }

  /**
   * Run a single verification step.
   * In a real environment, this executes the command via the terminal runtime.
   */
  private async runVerification(config: VerificationConfig): Promise<VerificationResult> {
    const startedAt = Date.now()

    try {
      // In production, this would execute via TerminalRuntime
      // For now, we return a pending result that the runtime will fill
      return {
        type: config.type,
        passed: false, // Will be resolved by the runtime
        durationMs: Date.now() - startedAt,
        output: `${config.type} check initiated...\nCommand: ${config.command}\nStatus: Pending execution`,
      }
    } catch (err) {
      return {
        type: config.type,
        passed: false,
        durationMs: Date.now() - startedAt,
        output: "",
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /**
   * Parse verification output to determine if it passed.
   */
  parseResult(type: VerificationType, output: string): { passed: boolean; errorCount: number } {
    switch (type) {
      case "typecheck": {
        // TypeScript: no output = pass, otherwise count errors
        const trimmed = output.trim()
        if (!trimmed) return { passed: true, errorCount: 0 }
        // Check for common TS error indicators
        const errorLines = trimmed.split("\n").filter(
          (l) => l.includes("error TS") || l.includes("error:") || l.includes("Error:"),
        )
        return { passed: errorLines.length === 0, errorCount: errorLines.length }
      }

      case "lint": {
        const trimmed = output.trim()
        if (!trimmed) return { passed: true, errorCount: 0 }
        const errorCount = (trimmed.match(/\d+ error/)?.[0] ?? "0") as string
        const count = parseInt(errorCount) || 0
        return { passed: count === 0, errorCount: count }
      }

      case "build": {
        if (output.includes("success") && !output.includes("error")) {
          return { passed: true, errorCount: 0 }
        }
        const errorLines = output.split("\n").filter((l) => /error|Error|FAILED/.test(l))
        return { passed: errorLines.length === 0, errorCount: errorLines.length }
      }

      default:
        return { passed: true, errorCount: 0 }
    }
  }

  /**
   * Get a formatted summary of all verification results for injecting into agent context.
   */
  getSummaryBlock(): string {
    if (this.results.length === 0) return ""

    const passed = this.results.filter((r) => r.passed).length
    const total = this.results.length

    const lines = this.results.map((r) => {
      const icon = r.passed ? "✅" : "❌"
      return `${icon} ${r.type}: ${r.passed ? "PASS" : "FAIL"} (${r.durationMs}ms)`
    })

    return `\n## Verification Results\n${lines.join("\n")}\n\n${passed === total ? "All checks passed." : `${total - passed} check(s) failed. Review the errors above.`}\n`
  }

  setConfigs(configs: VerificationConfig[]): void {
    this.configs = configs
  }

  reset(): void {
    this.results = []
    this.lastVerificationTime = 0
  }
}

/** Singleton instance */
export const autoVerifier = new AutoVerifier()
