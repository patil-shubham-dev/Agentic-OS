import type { PromptCategory } from '../categories/PromptCategory'
import type { PromptNode, Importance } from '../ast/PromptNode'
import type { ProviderCapabilities } from '../providers/ProviderCapabilities'
import type { SectionDiagnostics } from '../diagnostics/SectionDiagnostics'

export type ResolutionContext = {
  role: string
  executionMode?: string
  provider?: string
  providerCapabilities: ProviderCapabilities
  memorySummary?: string
  projectRules?: string | string[]
  workspaceFiles?: number
  isAutonomous: boolean
  isMultiAgent: boolean
  hasTools: boolean
  toolCount?: number
  hasVision: boolean
  hasBrowser: boolean
  environmentInfo?: Record<string, string>
  customInstructions?: string[]
}

export type CacheStrategy = 'none' | 'request' | 'task' | 'session' | 'workspace'

export type SectionDefinition = {
  id: string
  category: PromptCategory
  importance: Importance
  priority: number
  dependsOn?: string[]
  cache?: CacheStrategy
  when?: (ctx: ResolutionContext) => boolean
  compute: (ctx: ResolutionContext) => Promise<string | null>
}

export type ResolvedSection = {
  definition: SectionDefinition
  content: string | null
  diagnostics: SectionDiagnostics
}

export function defaultContext(overrides?: Partial<ResolutionContext>): ResolutionContext {
  return {
    role: 'coder',
    executionMode: undefined,
    provider: undefined,
    providerCapabilities: {
      supportsSystemPrompts: true,
      supportsToolCalling: true,
      supportsReasoning: false,
      supportsCacheControl: false,
      supportsStreamingTools: true,
      supportsJsonMode: false,
      maxContextWindow: 128000,
      maxOutputTokens: 4096,
    },
    memorySummary: undefined,
    projectRules: undefined,
    workspaceFiles: 0,
    isAutonomous: false,
    isMultiAgent: false,
    hasTools: true,
    hasVision: false,
    hasBrowser: false,
    environmentInfo: undefined,
    customInstructions: undefined,
    ...overrides,
  }
}
