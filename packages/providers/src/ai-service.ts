import type { GatewayProvider } from "@agentic-os/shared"
import { chatCompletion, streamChatCompletion } from "./provider-gateway"

export interface AIServiceConfig {
  provider: GatewayProvider
  model: string
  temperature?: number
  maxTokens?: number
}

export class AIService {
  private config: AIServiceConfig

  constructor(config: AIServiceConfig) {
    this.config = config
  }

  async chat(messages: { role: string; content: string }[]) {
    return chatCompletion(this.config.provider, {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    })
  }

  async* chatStream(messages: { role: string; content: string }[]) {
    for await (const chunk of streamChatCompletion(this.config.provider, {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      stream: true,
    })) {
      yield chunk
    }
  }
}
