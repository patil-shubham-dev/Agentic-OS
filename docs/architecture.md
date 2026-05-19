# AgentOS Studio Architecture

## Overview

AgentOS Studio is a unified AI workspace that combines chat, coding, design generation, autonomous agents, and workflow automation. It integrates three powerful open-source projects:

- **OpenClaude** (github.com/Gitlawb/openclaude) - Coding agent with multi-provider support
- **Hermes Agent** (github.com/NousResearch/hermes-agent) - Self-improving agent with learning loop
- **Open Design** (github.com/nexu-io/open-design) - AI-powered UI generation

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  Next.js 15 + React 19 + TypeScript + Tailwind CSS         │
│  shadcn/ui + Monaco Editor + React Flow                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP / WebSocket
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ OpenClaude   │  │ Hermes      │  │ Open Design         │  │
│  │ Bridge       │  │ Adapter     │  │ Adapter             │  │
│  │ (gRPC)       │  │ (Python)    │  │ (REST API)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Model Router │  │ Usage       │  │ Auth / RBAC         │  │
│  │ (LiteLLM)    │  │ Tracker     │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐    ┌─────────┐    ┌──────────┐
        │PostgreSQL│    │ Redis   │    │ Qdrant   │
        │         │    │         │    │ (Vector) │
        └─────────┘    └─────────┘    └──────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Celery Workers  │
                    │  (Background)    │
                    └─────────────────┘
```

## Integration Points

### OpenClaude Integration

OpenClaude provides tool-driven coding workflows via a headless gRPC server:

```python
# apps/api/src/integrations/openclaude/bridge.py
class OpenClaudeBridge:
    def stream_chat(self, prompt, tools, model):
        # Streams via gRPC to OpenClaude server
        # Returns: text chunks + tool calls + action prompts
```

**Features used:**
- `read_file` / `write_file` / `patch` - File operations
- `bash` - Terminal command execution
- `grep` / `glob` - Code search
- `web_search` - DuckDuckGo + Firecrawl
- Agent routing to different models
- Multi-provider support (OpenAI, Anthropic, Gemini, Groq, etc.)

### Hermes Agent Integration

Hermes provides self-improving agents with persistent memory:

```python
# apps/api/src/integrations/hermes/adapter.py
class HermesAdapter:
    def chat(self, message, session_id, context):
        # Streams via Hermes Agent
        # Returns: text + tool calls + skills_used + memory_updates
```

**Features used:**
- FTS5 session search with LLM summarization
- Autonomous skill creation from experience
- Cron scheduling for automations
- Multi-platform gateway (Telegram, Discord, Slack)
- MCP server integration
- Subagent delegation
- Honcho dialectic user modeling

### Open Design Integration

Open Design provides AI-powered UI generation:

```python
# apps/api/src/integrations/opendesign/adapter.py
class OpenDesignAdapter:
    def generate_component(self, prompt, framework, styling):
        # Calls Open Design API
        # Returns: code + design_tokens + a11y_report
```

**Features used:**
- Natural language to React/Vue/Svelte components
- Design system generation
- Screenshot-to-design conversion
- Design tokens export (CSS, Tailwind, Figma)
- Accessibility checks

## Data Flow

### Chat Flow
1. User sends message via WebSocket
2. Model Router determines provider based on agent/model
3. Message routed to OpenClaude (coding) or Hermes (research)
4. Response streamed back with tool calls
5. Tool results displayed in real-time
6. Usage tracked per token

### Design-to-Code Flow
1. User requests design generation
2. Open Design generates component code
3. OpenClaude writes files to workspace
4. Code tested via bash execution
5. Results displayed with preview

### Automation Flow
1. Trigger fires (cron/webhook/manual)
2. Celery worker picks up task
3. Hermes scheduler or Celery executes steps
4. Each step runs appropriate agent
5. Results stored and notifications sent

## Database Schema

### Core Tables
- `users` - User accounts and profiles
- `projects` - Workspace projects
- `chats` - Conversation history
- `files` - Project files
- `agents` - Agent configurations
- `automations` - Workflow definitions
- `usage_records` - Token/cost tracking
- `knowledge_items` - RAG documents
- `api_keys` - Provider API keys

### Vector Store (Qdrant)
- Document chunks with embeddings
- Semantic search for RAG
- Memory storage for agents

## Security

### Authentication
- JWT-based auth
- OAuth support (GitHub, Google)
- Multi-user organizations with RBAC

### Sandbox
- Isolated execution environments
- File system restrictions
- Network policy controls
- Approval gates for destructive actions

### API Key Management
- Encrypted storage
- Key preview (last 4 chars)
- Per-project key scoping
- Usage limits and alerts

## Scaling

### Horizontal Scaling
- Stateless API servers
- Redis-backed session store
- PostgreSQL read replicas
- Celery worker auto-scaling

### Caching
- Redis for chat sessions
- Vector DB for embeddings
- CDN for static assets

## Deployment

### Docker Compose (Development)
```bash
docker-compose up -d
```

### Kubernetes (Production)
```bash
kubectl apply -f infra/kubernetes/
```

### Environment Variables
See `.env.example` files in each app directory.
