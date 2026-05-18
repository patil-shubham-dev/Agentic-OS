# OpenClaude Integration for AgentOS Studio

This package integrates [OpenClaude](https://github.com/Gitlawb/openclaude) into AgentOS Studio.

## Architecture

OpenClaude provides:
- **Tool-driven coding workflows**: Bash, file read/write/edit, grep, glob, agents, tasks, MCP, slash commands
- **Streaming responses**: Real-time token output and tool progress
- **Multi-provider support**: OpenAI, Anthropic, Gemini, Groq, Ollama, OpenRouter, DeepSeek
- **Headless gRPC server**: For integration into other applications
- **Agent routing**: Route different agents to different models
- **Web search**: DuckDuckGo + Firecrawl integration

## Integration Points

### 1. gRPC Bridge (apps/api/src/integrations/openclaude/)

```python
# openclaude_bridge.py
import grpc
from src.proto import openclaude_pb2, openclaude_pb2_grpc

class OpenClaudeBridge:
    """Bridge between AgentOS and OpenClaude gRPC server."""

    def __init__(self, host="localhost", port=50051):
        self.channel = grpc.insecure_channel(f"{host}:{port}")
        self.stub = openclaude_pb2_grpc.OpenClaudeStub(self.channel)

    async def stream_chat(self, prompt: str, tools: list = None):
        """Stream chat responses from OpenClaude."""
        request = openclaude_pb2.ChatRequest(
            prompt=prompt,
            tools=tools or [],
            stream=True
        )
        async for response in self.stub.StreamChat(request):
            yield {
                "text": response.text,
                "tool_calls": self._parse_tool_calls(response.tool_calls),
                "status": response.status,
            }

    async def execute_tool(self, tool_name: str, args: dict):
        """Execute a tool via OpenClaude."""
        request = openclaude_pb2.ToolRequest(
            name=tool_name,
            arguments=json.dumps(args)
        )
        response = await self.stub.ExecuteTool(request)
        return json.loads(response.result)

    def _parse_tool_calls(self, tool_calls_proto):
        """Parse gRPC tool calls to AgentOS format."""
        return [
            {
                "id": tc.id,
                "name": tc.name,
                "args": json.loads(tc.arguments),
                "status": tc.status,
            }
            for tc in tool_calls_proto
        ]
```

### 2. Provider Router (packages/model-router/)

```typescript
// packages/model-router/src/openclaude-provider.ts
import { BaseProvider, ChatRequest, ChatResponse } from './base';

export class OpenClaudeProvider extends BaseProvider {
  name = 'openclaude';
  supportsTools = true;
  supportsStreaming = true;
  supportsVision = true;

  private grpcClient: OpenClaudeGRPCClient;

  constructor(config: ProviderConfig) {
    super(config);
    this.grpcClient = new OpenClaudeGRPCClient(config.host, config.port);
  }

  async *chat(request: ChatRequest): AsyncGenerator<ChatResponse> {
    const stream = this.grpcClient.streamChat({
      prompt: request.messages.map(m => m.content).join('\n'),
      model: request.model,
      tools: request.tools?.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    });

    for await (const chunk of stream) {
      yield {
        id: chunk.id,
        content: chunk.text,
        toolCalls: chunk.tool_calls,
        usage: chunk.usage,
        finishReason: chunk.status === 'complete' ? 'stop' : null,
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    // OpenClaude supports any OpenAI-compatible model
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' },
      { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google' },
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'groq' },
      { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
    ];
  }
}
```

### 3. File Operations (OpenClaude Features)

```typescript
// packages/integrations/openclaude/src/file-operations.ts
import { spawn } from 'child_process';

export class OpenClaudeFileOperations {
  """File operations powered by OpenClaude's tool system."""

  async readFile(path: string): Promise<string> {
    // Uses OpenClaude's read_file tool
    return this.executeTool('read_file', { path });
  }

  async writeFile(path: string, content: string): Promise<void> {
    return this.executeTool('write_file', { path, content });
  }

  async patchFile(path: string, diff: string): Promise<void> {
    return this.executeTool('patch', { path, diff });
  }

  async searchCode(query: string, path?: string): Promise<SearchResult[]> {
    return this.executeTool('grep', { pattern: query, path });
  }

  async listFiles(path: string, pattern?: string): Promise<string[]> {
    return this.executeTool('glob', { pattern: pattern || '**/*', path });
  }

  async executeBash(command: string, cwd?: string): Promise<CommandResult> {
    return this.executeTool('bash', { command, cwd });
  }

  private async executeTool(name: string, args: Record<string, any>) {
    // Calls OpenClaude gRPC server
    const response = await fetch('http://localhost:50051/api/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, args }),
    });
    return response.json();
  }
}
```

### 4. VS Code Extension Bridge

OpenClaude includes a VS Code extension. We expose its functionality via the AgentOS web interface:

```typescript
// packages/integrations/openclaude/src/vscode-bridge.ts
export class VSCodeBridge {
  """Bridge to OpenClaude's VS Code extension."""

  async openFile(path: string, line?: number): Promise<void> {
    // Send message to VS Code extension via WebSocket
    this.sendCommand('openFile', { path, line });
  }

  async applyEdit(path: string, edits: TextEdit[]): Promise<void> {
    this.sendCommand('applyEdit', { path, edits });
  }

  async runCommand(command: string): Promise<void> {
    this.sendCommand('runCommand', { command });
  }

  private sendCommand(type: string, payload: any) {
    // WebSocket connection to VS Code extension host
    this.ws.send(JSON.stringify({ type, payload }));
  }
}
```

## Setup

### Install OpenClaude as dependency

```bash
# In packages/integrations/openclaude/
npm install @gitlawb/openclaude

# Or use as git submodule
git submodule add https://github.com/Gitlawb/openclaude.git packages/integrations/openclaude/vendor
```

### Start OpenClaude gRPC Server

```bash
# From OpenClaude repository
npm run dev:grpc

# Or via Docker
docker run -p 50051:50051 agentos/openclaude-grpc
```

### Environment Variables

```env
# OpenClaude Configuration
OPENCLAUDE_GRPC_HOST=localhost
OPENCLAUDE_GRPC_PORT=50051
OPENCLAUDE_USE_OPENAI=1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Provider routing
OPENCLAUDE_AGENT_ROUTING='{"Explore":"deepseek-v4-flash","Plan":"gpt-4o","default":"gpt-4o"}'

# Optional: Firecrawl for web search
FIRECRAWL_API_KEY=fc-...
```

## Usage in AgentOS

```typescript
import { OpenClaudeProvider } from '@agentos/integrations/openclaude';

// Initialize provider
const openclaude = new OpenClaudeProvider({
  host: process.env.OPENCLAUDE_GRPC_HOST,
  port: parseInt(process.env.OPENCLAUDE_GRPC_PORT),
});

// Use in chat
const response = await openclaude.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Write a React component...' }],
  tools: ['read_file', 'write_file', 'bash'],
});

// File operations
const files = await openclaude.listFiles('/workspace');
const content = await openclaude.readFile('/workspace/src/App.tsx');
```
