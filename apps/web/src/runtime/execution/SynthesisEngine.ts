import { runRuntimeAgent } from "@/lib/agents/orchestrator"

export class SynthesisEngine {
  async synthesize(
    userInput: string,
    agentResults: { role: string; content: string }[],
    history: { role: string; content: string; timestamp?: number }[],
    signal?: AbortSignal,
    onStreamReady?: () => void,
    onToken?: (token: string) => void,
  ): Promise<string> {
    const agentOutputs = agentResults.map((r) => `## ${r.role} Response\n\n${r.content}`).join("\n\n")
    const synthInput = `The user asked: "${userInput}"

I received responses from delegated agents. Synthesize them into a single coherent response.

${agentOutputs}

Combine the insights and present a unified final response to the user. No preamble.`

    const result = await runRuntimeAgent(
      "manager",
      synthInput,
      history as any,
      undefined,
      signal,
      onStreamReady,
      onToken,
    )
    return result.response
  }
}
