import type { GatewayProvider, ProviderModel, RuntimeInfo } from "@agentic-os/shared"

const DEFAULT_PROVIDERS: Omit<GatewayProvider, "id" | "createdAt">[] = [
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    runtime: null,
    isLocal: false,
    isOpenAiCompatible: true,
    models: [],
  },
  {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    apiKey: "",
    runtime: null,
    isLocal: false,
    isOpenAiCompatible: false,
    models: [],
  },
  {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    runtime: null,
    isLocal: false,
    isOpenAiCompatible: false,
    models: [],
  },
]

export type ProviderAction =
  | { type: "ADD_PROVIDER"; payload: GatewayProvider }
  | { type: "REMOVE_PROVIDER"; payload: string }
  | { type: "UPDATE_PROVIDER"; payload: Partial<GatewayProvider> & { id: string } }
  | { type: "SET_MODELS"; payload: { providerId: string; models: ProviderModel[] } }
  | { type: "SET_RUNTIME"; payload: { providerId: string; runtime: RuntimeInfo } }

export function providerReducer(state: GatewayProvider[], action: ProviderAction): GatewayProvider[] {
  switch (action.type) {
    case "ADD_PROVIDER":
      return [...state, action.payload]
    case "REMOVE_PROVIDER":
      return state.filter((p) => p.id !== action.payload)
    case "UPDATE_PROVIDER":
      return state.map((p) => (p.id === action.payload.id ? { ...p, ...action.payload } : p))
    case "SET_MODELS":
      return state.map((p) => (p.id === action.payload.providerId ? { ...p, models: action.payload.models } : p))
    case "SET_RUNTIME":
      return state.map((p) =>
        p.id === action.payload.providerId
          ? { ...p, runtime: action.payload.runtime.runtime, isLocal: action.payload.runtime.isLocal, isOpenAiCompatible: action.payload.runtime.isOpenAiCompatible }
          : p
      )
    default:
      return state
  }
}

export function createDefaultProviders(): Omit<GatewayProvider, "id" | "createdAt">[] {
  return DEFAULT_PROVIDERS
}

export function createProvider(name: string, baseUrl: string, apiKey: string): GatewayProvider {
  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    baseUrl,
    apiKey,
    runtime: null,
    isLocal: false,
    isOpenAiCompatible: baseUrl.includes("openai") || baseUrl.includes("v1"),
    models: [],
    createdAt: new Date().toISOString(),
  }
}
