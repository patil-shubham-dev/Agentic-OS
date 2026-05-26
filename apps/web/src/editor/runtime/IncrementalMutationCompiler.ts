import type { ASTPatch, ASTPatchResult } from "./ASTPatchEngine"
import { ASTPatchEngine } from "./ASTPatchEngine"

export interface MutationRequest {
  filePath: string
  patches: ASTPatch[]
}

export interface MutationCompilationResult {
  mutations: CompiledMutation[]
  totalPatches: number
  failedPatches: number
  errors: string[]
}

export interface CompiledMutation {
  filePath: string
  patch: ASTPatch
  result: ASTPatchResult
}

export class IncrementalMutationCompiler {
  private astEngine: ASTPatchEngine

  constructor() {
    this.astEngine = new ASTPatchEngine()
  }

  compile(source: string, request: MutationRequest): MutationCompilationResult {
    const mutations: CompiledMutation[] = []
    let currentSource = source
    let failedPatches = 0
    const errors: string[] = []

    for (const patch of request.patches) {
      const result = this.astEngine.applyPatch(currentSource, patch)

      mutations.push({
        filePath: request.filePath,
        patch,
        result,
      })

      if (result.success) {
        currentSource = result.newContent
      } else {
        failedPatches++
        errors.push(`Patch "${patch.op} ${patch.target}": ${result.error}`)
      }
    }

    return {
      mutations,
      totalPatches: request.patches.length,
      failedPatches,
      errors,
    }
  }

  compileBatch(source: string, requests: MutationRequest[]): MutationCompilationResult[] {
    return requests.map((req) => this.compile(source, req))
  }

  mergeResults(results: MutationCompilationResult[]): {
    allPassed: boolean
    totalPatches: number
    totalFailed: number
    errors: string[]
  } {
    let totalPatches = 0
    let totalFailed = 0
    const errors: string[] = []

    for (const result of results) {
      totalPatches += result.totalPatches
      totalFailed += result.failedPatches
      errors.push(...result.errors)
    }

    return {
      allPassed: totalFailed === 0,
      totalPatches,
      totalFailed,
      errors,
    }
  }
}
