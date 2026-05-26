import type { ProviderCapabilities, ModelInfo } from "./BaseProviderAdapter"

export interface ProviderRegistration {
  id: string
  name: string
  adapterClass: string
  models: ModelInfo[]
}

export class ProviderCapabilityRegistry {
  private providers: Map<string, ProviderRegistration> = new Map()
  private modelCapabilities: Map<string, ProviderCapabilities> = new Map()

  register(provider: ProviderRegistration): void {
    this.providers.set(provider.id, provider)
    for (const model of provider.models) {
      this.modelCapabilities.set(model.id, model.capabilities)
    }
  }

  unregister(providerId: string): void {
    const provider = this.providers.get(providerId)
    if (provider) {
      for (const model of provider.models) {
        this.modelCapabilities.delete(model.id)
      }
      this.providers.delete(providerId)
    }
  }

  getProvider(providerId: string): ProviderRegistration | undefined {
    return this.providers.get(providerId)
  }

  getAllProviders(): ProviderRegistration[] {
    return Array.from(this.providers.values())
  }

  getModelCapabilities(modelId: string): ProviderCapabilities | undefined {
    return this.modelCapabilities.get(modelId)
  }

  findModelsByCapability(required: Partial<ProviderCapabilities>): { providerId: string; model: ModelInfo }[] {
    const results: { providerId: string; model: ModelInfo }[] = []
    for (const [providerId, provider] of this.providers) {
      for (const model of provider.models) {
        if (this.matchesCapabilities(model.capabilities, required)) {
          results.push({ providerId, model })
        }
      }
    }
    return results
  }

  findBestModel(required: Partial<ProviderCapabilities>): { providerId: string; model: ModelInfo } | null {
    const matches = this.findModelsByCapability(required)
    if (matches.length === 0) return null
    matches.sort((a, b) => b.model.capabilities.maxContextWindow - a.model.capabilities.maxContextWindow)
    return matches[0]
  }

  hasCapability(providerId: string, modelId: string, capability: keyof ProviderCapabilities): boolean {
    const modelCaps = this.modelCapabilities.get(modelId)
    if (!modelCaps) return false
    return !!modelCaps[capability]
  }

  updateModels(providerId: string, models: ModelInfo[]): void {
    const provider = this.providers.get(providerId)
    if (provider) {
      for (const model of provider.models) {
        this.modelCapabilities.delete(model.id)
      }
      provider.models = models
      for (const model of models) {
        this.modelCapabilities.set(model.id, model.capabilities)
      }
    }
  }

  clear(): void {
    this.providers.clear()
    this.modelCapabilities.clear()
  }

  getModelCount(): number {
    return this.modelCapabilities.size
  }

  getProviderCount(): number {
    return this.providers.size
  }

  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId)
  }

  hasModel(modelId: string): boolean {
    return this.modelCapabilities.has(modelId)
  }

  private matchesCapabilities(
    actual: ProviderCapabilities,
    required: Partial<ProviderCapabilities>,
  ): boolean {
    for (const [key, value] of Object.entries(required)) {
      if (value !== undefined && (actual as any)[key] !== value) {
        return false
      }
    }
    return true
  }
}
