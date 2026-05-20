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

## Installation & Setup

> **Important**: This repository uses **pnpm** as its package manager. Do **not** run `npm install` in any workspace; it will cause slow installs and potential incompatibilities.

```bash
# From the repository root (C:\\Users\\91808\\Desktop\\AgentOS Studio)
pnpm install                     # Standard install
pnpm install --filter web...      # Install only frontend dependencies
pnpm install --network-timeout 600000  # Increase network timeout for flaky connections
```

### Setup Checks
- Ensure `pnpm` is installed: `pnpm -v`
- Verify Node.js version (>=20): `node -v`
- Confirm workspace detection: `pnpm workspaces list`

If any of these checks fail, install the appropriate versions before proceeding.

## Troubleshooting
If installation hangs or fails:
1. Delete problematic caches:
   ```cmd
   rmdir /s /q node_modules
   rmdir /s /q .turbo
   ```
2. Prune the pnpm store:
   ```bash
   pnpm store prune
   ```
3. Reinstall dependencies:
   ```bash
   pnpm install
   ```

## Windows-specific Cleanup Commands
```cmd
rmdir /s /q node_modules
rmdir /s /q .turbo
pnpm store prune
pnpm install
```

## Development Workflow
```bash
# Install all dependencies (once)
pnpm install

# Start development for the web app only
pnpm --filter web dev
```

## Verification
After installing, run the following to ensure the monorepo builds and the web app starts correctly:
```bash
pnpm run build   # Build all packages
pnpm --filter web dev   # Start the web dev server
```
If the server starts without errors, the setup is complete.

---

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Monaco Editor, React Flow
- **Backend**: FastAPI, PostgreSQL, Redis, Celery
- **AI**: LiteLLM, Qdrant/pgvector, Hermes Agent
- **Infrastructure**: Docker, Kubernetes, Terraform

## License

MIT
