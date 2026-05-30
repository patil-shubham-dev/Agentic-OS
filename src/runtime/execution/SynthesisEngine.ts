import { AgentExecutor } from "@/runtime/agents/AgentExecutor"
import { useAppStore } from "@/stores/app-store"
import type { ExecutionEvent } from "@/runtime/ExecutionEvent"

export class SynthesisEngine {
  async synthesize(
    userInput: string,
    agentResults: { role: string; content: string }[],
    history: { role: string; content: string; timestamp?: number }[],
    signal?: AbortSignal,
  ): Promise<string> {
    const agentOutputs = agentResults.map((r) => `## ${r.role} Response\n\n${r.content}`).join("\n\n")
    const synthInput = `The user asked: "${userInput}"

I received responses from delegated agents. Synthesize them into a single coherent response.

${agentOutputs}

Combine the insights and present a unified final response to the user. No preamble.`

    const executor = new AgentExecutor({
      executionId: `synth_${Date.now()}`,
      mode: "FAST",
      role: "manager",
      input: synthInput,
      history: history as any,
      signal,
    })

    let content = ""
    for await (const event of executor.execute()) {
      if (event.type === "MESSAGE_COMPLETE") {
        content = event.content
      }
    }
    return content
  }
}
