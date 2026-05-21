# AgentOS Studio

A unified AI workspace that combines chat, coding, multi-agent orchestration, terminal, git, and workflow automation — powered by your own LLM API keys (BYOD).

## Features

### 🤖 Chat & AI
- **Multi-model chat** with streaming SSE responses
- **Role-based routing** — automatically routes tasks to the right LLM (Manager, Coding, Design, Research, Fast Inference, Vision)
- **Multi-agent orchestration** — dynamic plan generation, parallel execution, intelligent replanning (up to 3 retries)
- **Inter-agent communication bus** — agents collaborate via a pub/sub message bus
- **Fast Inference pre-classifier** — short-circuits simple tasks to a fast model, routes complex tasks to orchestration
- **Vision support** — analyze images via chat attachments
- **Chat history** — full CRUD with title/message persistence

### 🧠 Agent System
- **6 role types**: Manager, Coding, Design, Research, Fast Inference, Vision
- **Agent CRUD** — configure name, description, model, tools, status per agent
- **Tool-calling loop** — agents can read/write files, search code, execute terminal commands, fetch URLs, analyze images
- **Workspace context indexing** — TF-IDF based file indexer injects relevant files into agent context automatically

### ⌨️ Code Editor
- **Monaco Editor** with syntax highlighting, multiple tabs, split pane
- **Monaco Diff Editor** — side-by-side diff view for git/file changes
- **Patch protocol** — agents can output WRITE/PATCH directives or unified diffs
- **Auto-save** with dirty tab confirmation

### 📁 File System
- Full file CRUD (create, read, write, delete, rename, move)
- Directory tree with sorting (dirs first)
- Full-text search across workspace files
- Electron IPC bridge for native file operations
- File watcher for real-time sync

### 💻 Terminal
- **PTY (pseudo-terminal)** via node-pty with resize/write/kill
- Server-side terminal via spawned process (SSE streaming)
- Electron native terminal integration
- Multi-session tabs
- Security permission enforcement

### 🔧 Git Integration
- Git status: branch, changes, log, ahead/behind tracking
- Git diff: per-file or staged, with add/delete stats
- Git commit: stage files or `-A` and commit

### 🔄 Automation
- Visual flow builder (React Flow-based)
- Trigger types: schedule, webhook, manual, file_change, git_commit
- Multi-step automation: agent, tool, approval, notification steps
- Automation runs history

### 💰 Usage & Analytics
- Token and cost tracking per provider
- Provider-by-provider breakdown
- Usage timeline chart (area chart) and provider cost pie chart
- Dashboard with stat tiles and recent activity feed

### 🔐 Security
- Command allowlist/blocklist for terminal
- Filesystem sandbox (path traversal protection)
- Domain allowlist for web fetching
- Destructive operation approval flow
- Rate limiting per tool
- Secret/credential scanning in file content
- Audit log

### 🖥️ Desktop App (Electron)
- Native window with tray, menu bar, global shortcuts
- Deep linking (`agentos://` protocol)
- Bundled Next.js production server
- OS keychain integration (keytar) for API keys
- Provider health monitoring (every 5 minutes)
- Auto-updater (electron-updater)
- Full IPC bridge (~60 methods) for native file ops, dialogs, PTY, credentials

### ⚙️ Settings
- **Provider Configuration** — add/edit/delete LLM providers (11 supported: OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, Together AI, Fireworks, Mistral, Ollama, LM Studio + custom)
- **Connection testing** — provider-specific auth (Bearer, x-api-key, x-goog-api-key, NVCF-API-KEY)
- **Model auto-discovery** — from provider endpoints or presets
- **API key encryption** — AES-256-GCM at rest
- **Role mappings** — assign roles to specific models
- **Security toggles** — terminal, filesystem, destructive approval, browser

### 📊 Pages
| Route | Purpose |
|-------|---------|
| `/setup` | Setup wizard — env validation, Supabase connectivity, project creation, provider checks |
| `/dashboard` | Stats, charts, recent chats, activity feed |
| `/workspace` | Main IDE — file explorer, editor, terminal, chat, execution graph, status bar |
| `/agents` | Agent management |
| `/automations` | Automation workflows |
| `/knowledge` | Knowledge base |
| `/memory` | Memory store |
| `/activity` | Activity/history log |
| `/settings` | Providers, roles, security |

### 🗄️ Data Storage
Supabase (PostgreSQL) with tables: `agents`, `automations`, `chats`, `files`, `usage_records`, `knowledge_items`, `provider_configs`, `provider_models`, `memories`, `agent_runs`, `automation_runs`, `projects`

## Architecture

```
agentos-studio/
├── apps/
│   ├── web/              # Next.js 15 frontend + API routes
│   └── desktop/          # Electron shell (optional)
├── packages/
│   ├── agent-core/       # Agent execution interface
│   ├── automation-engine/# Workflow engine
│   ├── model-router/     # LLM provider abstraction
│   ├── usage-tracker/    # Token & cost tracking
│   ├── design-engine/    # UI generation
│   └── ui/               # Shared design tokens
└── supabase/
    └── migrations/       # SQL schema migrations
```

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Monaco Editor, React Flow
- **Runtime**: node-pty, xterm.js, cmdk, recharts, framer-motion
- **Desktop**: Electron, electron-builder, keytar, electron-updater
- **Storage**: Supabase / PostgreSQL
- **AI**: LiteLLM-compatible API (any OpenAI/Azure/Anthropic/Google provider), Ollama, LM Studio
- **Monorepo**: pnpm, TurboRepo

## Quick Start

### Prerequisites
- Node.js >= 20 (`node -v`)
- pnpm >= 9 (`pnpm -v`)
- Supabase project (or local Supabase instance)

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp apps/web/.env.example apps/web/.env.local

# Edit apps/web/.env.local with your Supabase credentials:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENTOS_ENCRYPTION_KEY
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# Apply database migrations
# (run these against your Supabase SQL editor or via the CLI)

# Start development
pnpm --filter @agentos/web dev
```

Open http://localhost:3000 — the setup wizard will guide you through the remaining configuration.

### Run with Desktop (Electron)

```bash
# Build the web app and package the desktop app
node apps/desktop/scripts/build.mjs --win   # or --mac / --linux
```

The installer will be in `apps/desktop/out/`.

## Provider Support

| Provider | Type | Auth Method |
|----------|------|-------------|
| OpenAI | Cloud | Bearer token |
| Anthropic | Cloud | x-api-key |
| Google AI Studio | Cloud | x-goog-api-key |
| Groq | Cloud | Bearer token |
| DeepSeek | Cloud | Bearer token |
| OpenRouter | Cloud | Bearer token |
| Together AI | Cloud | Bearer token |
| Fireworks | Cloud | Bearer token |
| Mistral | Cloud | Bearer token |
| Ollama | Local | None (localhost) |
| LM Studio | Local | None (localhost) |
| Custom | Any | Bearer token |

## Development

```bash
# Start web dev server only
pnpm --filter @agentos/web dev

# Typecheck
pnpm --filter @agentos/web typecheck

# Build
pnpm --filter @agentos/web build

# Desktop dev mode (Electron + web dev server)
pnpm --filter @agentos/desktop dev
```

## License

MIT
