import { useAppStore } from "@/stores/app-store"
import type { GatewayProvider, ProviderModel, RuntimeRole } from "@/types"

type ModelCapability =
  | "reasoning"
  | "planning"
  | "large-context"
  | "retrieval"
  | "code-generation"
  | "edit"
  | "fast"
  | "validation"
  | "vision"
  | "action"
  | "command"

const ROLE_MODEL_PREFERENCES: Record<RuntimeRole, ModelCapability[]> = {
  manager: ["reasoning", "planning"],
  research: ["large-context", "retrieval"],
  coder: ["code-generation", "edit"],
  qa: ["fast", "validation"],
  browser: ["vision", "action"],
  runtime: ["fast", "command"],
  design: ["vision", "edit"],
  vision: ["vision"],
  memory: ["large-context"],
  "fast-inference": ["fast"],
}

function scoreModel(role: RuntimeRole, provider: GatewayProvider, model: ProviderModel): number {
  let score = 0
  const modelId = model.id.toLowerCase()
  const prefs = ROLE_MODEL_PREFERENCES[role] ?? []

  for (const pref of prefs) {
    if (pref === "vision" && model.supportsVision) score += 5
    if ((pref === "edit" || pref === "code-generation") && model.supportsTools) score += 4
    if (pref === "fast" && /mini|small|fast|turbo|flash/.test(modelId)) score += 4
    if (pref === "reasoning" && /o[13]|r1|reason|sonnet|opus|gpt-5/.test(modelId)) score += 5
    if (pref === "large-context" && (model.contextWindow ?? 0) >= 64000) score += 4
    if (pref === "command" && model.supportsTools) score += 3
    if (pref === "planning" && model.supportsTools) score += 2
    if (pref === "validation" && model.supportsTools) score += 2
    if (pref === "action" && model.supportsTools) score += 2
  }

  if (provider.isLocal) score += 1
  if (model.supportsStreaming) score += 1
  return score
}

export class RoleModelRouter {
  selectModel(role: RuntimeRole): { provider: GatewayProvider; model: ProviderModel } | null {
    const providers = useAppStore.getState().providers
    let best: { provider: GatewayProvider; model: ProviderModel; score: number } | null = null

    for (const provider of providers) {
      for (const model of provider.models) {
        const score = scoreModel(role, provider, model)
        if (!best || score > best.score) {
          best = { provider, model, score }
        }
      }
    }

    return best ? { provider: best.provider, model: best.model } : null
  }
}
