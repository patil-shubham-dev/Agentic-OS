export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  model: string;
  tools: string[];
}

export class AgentCore {
  constructor(private config: AgentConfig) {}

  async run(prompt: string): Promise<string> {
    return \`Executed \${prompt} on \${this.config.name}\`;
  }
}
