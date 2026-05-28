import { describe, it, expect } from "vitest"
import { getRegistryEntry, resolveByBaseUrl, getAllPresets, getPopularPresets, getCustomPresets } from "./provider-registry"

describe("provider-registry", () => {
  it("has entries for all expected providers", () => {
    const expected = ["openai", "anthropic", "groq", "nvidia", "openrouter", "deepseek", "ollama", "gemini", "together", "azure"]
    for (const id of expected) {
      expect(getRegistryEntry(id)).toBeDefined()
    }
  })

  it("returns undefined for unknown provider", () => {
    expect(getRegistryEntry("nonexistent")).toBeUndefined()
  })

  it("openai entry has correct runtime key", () => {
    const entry = getRegistryEntry("openai")
    expect(entry?.runtimeKey).toBe("OpenAI")
    expect(entry?.isOpenAiCompatible).toBe(true)
    expect(entry?.isLocal).toBe(false)
  })

  it("ollama entry is local", () => {
    const entry = getRegistryEntry("ollama")
    expect(entry?.isLocal).toBe(true)
    expect(entry?.runtimeKey).toBe("Ollama")
  })

  it("nvidia entry is OpenAI-compatible", () => {
    const entry = getRegistryEntry("nvidia")
    expect(entry?.isOpenAiCompatible).toBe(true)
    expect(entry?.runtimeKey).toBe("Nvidia NIM")
    expect(entry?.baseUrl).toBe("https://integrate.api.nvidia.com/v1")
  })

  it("resolveByBaseUrl finds openai by URL", () => {
    const result = resolveByBaseUrl("https://api.openai.com/v1")
    expect(result?.id).toBe("openai")
  })

  it("resolveByBaseUrl finds groq by URL", () => {
    const result = resolveByBaseUrl("https://api.groq.com/openai/v1")
    expect(result?.id).toBe("groq")
  })

  it("resolveByBaseUrl finds nvidia by URL", () => {
    const result = resolveByBaseUrl("https://integrate.api.nvidia.com/v1")
    expect(result?.id).toBe("nvidia")
  })

  it("resolveByBaseUrl returns null for unknown URL", () => {
    const result = resolveByBaseUrl("https://unknown-provider.example.com")
    expect(result).toBeNull()
  })

  it("getAllPresets returns all entries", () => {
    const presets = getAllPresets()
    expect(presets.length).toBeGreaterThanOrEqual(14)
  })

  it("getPopularPresets excludes custom presets", () => {
    const popular = getPopularPresets()
    for (const p of popular) {
      expect(p.isCustom).toBeFalsy()
    }
  })

  it("getCustomPresets returns only custom presets", () => {
    const custom = getCustomPresets()
    for (const c of custom) {
      expect(c.isCustom).toBe(true)
    }
  })

  it("all registry entries have required fields", () => {
    for (const entry of getAllPresets()) {
      expect(entry.id).toBeTruthy()
      expect(entry.name).toBeTruthy()
      expect(typeof entry.isOpenAiCompatible).toBe("boolean")
      expect(typeof entry.isLocal).toBe("boolean")
    }
  })
})
