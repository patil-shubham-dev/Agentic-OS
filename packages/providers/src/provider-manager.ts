import type { GatewayProvider, RuntimeInfo } from "@agentic-os/shared"

interface RuntimeDetectionResult {
  runtime: RuntimeInfo
  baseUrl: string
}

const KNOWN_RUNTIMES = [
  { name: "Ollama", baseUrl: "http://localhost:11434", isLocal: true },
  { name: "LM Studio", baseUrl: "http://localhost:1234", isLocal: true },
  { name: "LocalAI", baseUrl: "http://localhost:8080", isLocal: true },
  { name: "vLLM", baseUrl: "http://localhost:8000", isLocal: true },
  { name: "llama.cpp", baseUrl: "http://localhost:8080", isLocal: true },
]

export async function detectRuntimes(): Promise<RuntimeDetectionResult[]> {
  const results: RuntimeDetectionResult[] = []

  for (const runtime of KNOWN_RUNTIMES) {
    try {
      const response = await fetch(`${runtime.baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        results.push({
          runtime: {
            runtime: runtime.name,
            isOpenAiCompatible: true,
            isLocal: true,
          },
          baseUrl: runtime.baseUrl,
        })
      }
    } catch {
      // runtime not available
    }
  }

  return results
}

export async function detectRuntime(baseUrl: string): Promise<RuntimeInfo> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    })

    if (response.ok) {
      return {
        runtime: "OpenAI-compatible",
        isOpenAiCompatible: true,
        isLocal: baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"),
      }
    }

    return { runtime: null, isOpenAiCompatible: false, isLocal: false }
  } catch {
    return { runtime: null, isOpenAiCompatible: false, isLocal: false }
  }
}
