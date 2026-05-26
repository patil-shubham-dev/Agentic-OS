export interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  runtimeKey: string | null
  isOpenAiCompatible: boolean
  isLocal: boolean
  isCustom?: boolean
}

export interface RegistryEntry {
  id: string
  name: string
  baseUrl: string
  runtimeKey: string | null
  isOpenAiCompatible: boolean
  isLocal: boolean
}

const REGISTRY: Record<string, RegistryEntry> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    runtimeKey: "OpenAI",
    isOpenAiCompatible: true,
    isLocal: false,
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    runtimeKey: "Anthropic",
    isOpenAiCompatible: false,
    isLocal: false,
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    runtimeKey: "Google Gemini",
    isOpenAiCompatible: false,
    isLocal: false,
  },
  groq: {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    runtimeKey: "Groq",
    isOpenAiCompatible: true,
    isLocal: false,
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    runtimeKey: "OpenRouter",
    isOpenAiCompatible: true,
    isLocal: false,
  },
  nvidia: {
    id: "nvidia",
    name: "Nvidia NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    runtimeKey: "Nvidia NIM",
    isOpenAiCompatible: true,
    isLocal: false,
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    runtimeKey: "DeepSeek",
    isOpenAiCompatible: true,
    isLocal: false,
  },
  together: {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    runtimeKey: "Together AI",
    isOpenAiCompatible: true,
    isLocal: false,
  },
  azure: {
    id: "azure",
    name: "Azure OpenAI",
    baseUrl: "https://YOUR_RESOURCE.openai.azure.com",
    runtimeKey: "Azure OpenAI",
    isOpenAiCompatible: true,
    isLocal: false,
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    runtimeKey: "Ollama",
    isOpenAiCompatible: true,
    isLocal: true,
  },
  "custom-openai": {
    id: "custom-openai",
    name: "OpenAI-Compatible",
    baseUrl: "",
    runtimeKey: null,
    isOpenAiCompatible: true,
    isLocal: false,
  },
  "custom-vllm": {
    id: "custom-vllm",
    name: "vLLM",
    baseUrl: "http://localhost:8000/v1",
    runtimeKey: "vLLM",
    isOpenAiCompatible: true,
    isLocal: true,
  },
  "custom-lmstudio": {
    id: "custom-lmstudio",
    name: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    runtimeKey: "LM Studio",
    isOpenAiCompatible: true,
    isLocal: true,
  },
  "custom-localai": {
    id: "custom-localai",
    name: "LocalAI",
    baseUrl: "http://localhost:8080/v1",
    runtimeKey: null,
    isOpenAiCompatible: true,
    isLocal: true,
  },
  "custom-litellm": {
    id: "custom-litellm",
    name: "LiteLLM (self-hosted)",
    baseUrl: "http://localhost:4000",
    runtimeKey: "LiteLLM Gateway",
    isOpenAiCompatible: true,
    isLocal: true,
  },
}

export function getRegistryEntry(id: string): RegistryEntry | undefined {
  return REGISTRY[id]
}

export function resolveByBaseUrl(baseUrl: string): RegistryEntry | null {
  const u = baseUrl.toLowerCase()
  for (const entry of Object.values(REGISTRY)) {
    if (!entry.baseUrl) continue
    if (u.includes(entry.baseUrl.toLowerCase().replace(/https?:\/\//, "").replace(/\/v1$/, ""))) {
      return entry
    }
  }
  if (u.includes("openai.com")) return REGISTRY.openai
  if (u.includes("groq.com")) return REGISTRY.groq
  if (u.includes("openrouter.ai")) return REGISTRY.openrouter
  if (u.includes("nvidia.com")) return REGISTRY.nvidia
  if (u.includes("deepseek.com")) return REGISTRY.deepseek
  if (u.includes("together.xyz")) return REGISTRY.together
  if (u.includes("azure.com") || u.includes("azure-api.net")) return REGISTRY.azure
  if (u.includes("ollama") || u.includes("11434")) return REGISTRY.ollama
  if (u.includes("localhost") || u.includes("127.0.0.1")) {
    if (u.includes("8000")) return REGISTRY["custom-vllm"]
    if (u.includes("1234")) return REGISTRY["custom-lmstudio"]
    if (u.includes("8080")) return REGISTRY["custom-localai"]
    if (u.includes("4000")) return REGISTRY["custom-litellm"]
  }
  return null
}

export function getAllPresets(): ProviderPreset[] {
  return Object.values(REGISTRY).map((e) => ({ ...e, isCustom: e.id.startsWith("custom-") }))
}

export function getPopularPresets(): ProviderPreset[] {
  return getAllPresets().filter((p) => !p.isCustom)
}

export function getCustomPresets(): ProviderPreset[] {
  return getAllPresets().filter((p) => p.isCustom)
}
