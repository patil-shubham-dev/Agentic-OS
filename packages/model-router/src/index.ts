export interface ProviderConfig {
  host?: string;
  port?: number;
  apiKey?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: any[];
}

export interface ChatResponse {
  id: string;
  content: string;
  toolCalls?: any[];
  usage?: Record<string, number>;
  finishReason?: string;
}

export abstract class BaseProvider {
  abstract name: string;
  abstract supportsTools: boolean;
  abstract supportsStreaming: boolean;
  abstract supportsVision: boolean;

  constructor(protected config: ProviderConfig) {}

  abstract chat(request: ChatRequest): AsyncGenerator<ChatResponse>;
}
