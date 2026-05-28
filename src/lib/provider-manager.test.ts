import { describe, it, expect } from "vitest"
import { ProviderError, resolveAdapter, normalizeError } from "./provider-manager"

describe("ProviderError", () => {
  it("creates error with code and message", () => {
    const err = new ProviderError("INVALID_API_KEY", "Invalid API key", "Check your key and try again")
    expect(err.code).toBe("INVALID_API_KEY")
    expect(err.message).toBe("Invalid API key")
    expect(err.details).toBe("Check your key and try again")
    expect(err.name).toBe("ProviderError")
  })

  it("toJSON returns normalized shape", () => {
    const err = new ProviderError("CONNECTION_FAILED", "Failed to connect", null)
    const json = err.toJSON()
    expect(json).toEqual({ code: "CONNECTION_FAILED", message: "Failed to connect", details: null })
  })
})

describe("normalizeError", () => {
  it("returns ProviderError unchanged", () => {
    const original = new ProviderError("INVALID_API_KEY", "Invalid API key")
    const result = normalizeError(original)
    expect(result).toBe(original)
  })

  it("normalizes timeout message", () => {
    const result = normalizeError(new Error("TIMEOUT_EXCEEDED"))
    expect(result.code).toBe("CONNECTION_TIMED_OUT")
  })

  it("normalizes unauthorized", () => {
    const result = normalizeError(new Error("401 Unauthorized"))
    expect(result.code).toBe("INVALID_API_KEY")
  })

  it("normalizes 404", () => {
    const result = normalizeError(new Error("404 Not Found"))
    expect(result.code).toBe("ENDPOINT_NOT_FOUND")
  })

  it("normalizes connection refused", () => {
    const result = normalizeError(new Error("Connection refused"))
    expect(result.code).toBe("CONNECTION_FAILED")
  })

  it("normalizes DNS errors", () => {
    const result = normalizeError(new Error("ENOTFOUND"))
    expect(result.code).toBe("CONNECTION_FAILED")
  })

  it("normalizes IPC bridge errors", () => {
    const result = normalizeError(new Error("__TAURI_INTERNALS__ is undefined"))
    expect(result.code).toBe("IPC_BRIDGE_UNAVAILABLE")
  })

  it("normalizes unknown errors", () => {
    const result = normalizeError(new Error("Some random error"))
    expect(result.code).toBe("UNKNOWN")
  })

  it("handles non-Error values", () => {
    const result = normalizeError("string error")
    expect(result.code).toBe("UNKNOWN")
  })

  it("truncates long messages", () => {
    const long = "x".repeat(200)
    const result = normalizeError(new Error(long))
    expect(result.message.length).toBeLessThanOrEqual(103)
  })
})

describe("resolveAdapter", () => {
  it("resolves OpenAI", () => {
    const adapter = resolveAdapter("https://api.openai.com/v1")
    expect(adapter.id).toBe("openai")
    expect(adapter.runtimeKey).toBe("OpenAI")
    expect(adapter.isOpenAiCompatible).toBe(true)
    expect(adapter.isLocal).toBe(false)
  })

  it("resolves Nvidia NIM", () => {
    const adapter = resolveAdapter("https://integrate.api.nvidia.com/v1")
    expect(adapter.id).toBe("nvidia")
    expect(adapter.runtimeKey).toBe("Nvidia NIM")
    expect(adapter.isOpenAiCompatible).toBe(true)
  })

  it("resolves Ollama", () => {
    const adapter = resolveAdapter("http://localhost:11434/v1")
    expect(adapter.id).toBe("ollama")
    expect(adapter.isLocal).toBe(true)
  })

  it("resolves Groq", () => {
    const adapter = resolveAdapter("https://api.groq.com/openai/v1")
    expect(adapter.id).toBe("groq")
  })

  it("resolves OpenRouter", () => {
    const adapter = resolveAdapter("https://openrouter.ai/api/v1")
    expect(adapter.id).toBe("openrouter")
  })

  it("returns unknown adapter for unrecognized URL", () => {
    const adapter = resolveAdapter("https://some-strange-api.example.com")
    expect(adapter.id).toBe("unknown")
    expect(adapter.runtimeKey).toBeNull()
    expect(adapter.isOpenAiCompatible).toBe(true)
    expect(adapter.isLocal).toBe(false)
  })
})
