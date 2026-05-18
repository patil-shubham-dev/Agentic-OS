# AgentOS Studio

A unified AI workspace that combines chat, coding, design generation, autonomous agents, and workflow automation with full BYOD (Bring Your Own API Keys) support.

## Product Vision

Build an open-source, self-hostable AI operating system where multiple LLMs collaborate as a virtual team to:
- Chat with the user
- Read/write files
- Generate UI designs
- Write and test code
- Run terminal commands
- Build automations
- Execute long-running tasks
- Track token and cost usage

## Architecture

```
agentos-studio/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # FastAPI backend
│   └── workers/      # Celery background workers
├── packages/
│   ├── ui/           # Shared UI components
│   ├── model-router/ # LLM provider abstraction
│   ├── agent-core/   # Agent orchestration
│   ├── automation-engine/ # Workflow automation
│   ├── usage-tracker/ # Cost & token tracking
│   ├── design-engine/ # UI generation
│   └── integrations/  # Third-party integrations
└── infra/            # Docker, K8s, Terraform
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# Start all services
pnpm dev

# Or start individually
pnpm --filter web dev
pnpm --filter api dev
pnpm --filter workers dev
```

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Monaco Editor, React Flow
- **Backend**: FastAPI, PostgreSQL, Redis, Celery
- **AI**: LiteLLM, Qdrant/pgvector, Hermes Agent
- **Infrastructure**: Docker, Kubernetes, Terraform

## License

MIT
