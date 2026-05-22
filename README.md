<div align="center">
  <br/>
  <h1>⚡ AgentOS Studio</h1>
  <p><strong>A unified AI workspace — chat, code, agents, automations, and terminal, powered by your own LLM keys.</strong></p>

  <p>
    <a href="#features"><img src="https://img.shields.io/badge/APP-AI_Workspace-F5A524?style=flat-square&labelColor=090D14" alt="App"/></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/STACK-Next.js_15_·_Electron_·_TypeScript-F5A524?style=flat-square&labelColor=090D14" alt="Tech Stack"/></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-F5A524?style=flat-square&labelColor=090D14" alt="License"/></a>
    <a href="https://github.com/patil-shubham-dev/AgentOS-Studio"><img src="https://img.shields.io/badge/STATUS-Active_Development-F5A524?style=flat-square&labelColor=090D14" alt="Status"/></a>
  </p>

  <br/>
</div>

---

**AgentOS Studio** is a unified desktop AI workspace that combines multi-model chat, a full code editor (Monaco), multi-agent orchestration, a PTY terminal, git integration, visual workflow automation, and usage analytics — all running locally with your own API keys. Available as a **web app** or a **native desktop application** (Electron).

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Provider Support](#-provider-support)
- [Desktop App (Electron)](#-desktop-app-electron)
- [Development](#-development)
- [Build & Package](#-build--package)
- [Documentation](#-documentation)
- [License](#-license)

---

## ✨ Features

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
- Multi-session tabs
- Security permission enforcement

### 🔧 Git Integration
- Git status: branch, changes, log, ahead/behind tracking
- Git diff: per-file or staged, with add/delete stats
- Git commit: stage files or `-A` and commit

### 🔄 Automation
- Visual flow builder (React Flow-based DAG editor)
- Trigger types: schedule, webhook, manual, file change, git commit
- Multi-step automation: agent, tool, approval, notification steps
- Automation runs history

### 📊 Usage & Analytics
- Token and cost tracking per provider
- Provider-by-provider breakdown
- Usage timeline chart (area chart) and provider cost pie chart
- Dashboard with stat tiles and recent activity feed
- Filterable, searchable activity log

### 🔐 Security
- Command allowlist/blocklist for terminal
- Filesystem sandbox (path traversal protection)
- Domain allowlist for web fetching
- Destructive operation approval flow
- Rate limiting per tool
- Secret/credential scanning in file content
- Audit log

### ⚙️ Settings & Providers
- **Provider Configuration** — add/edit/delete LLM providers (11 supported: OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, Together AI, Fireworks, Mistral, Ollama, LM Studio + any OpenAI-compatible endpoint)
- **Connection testing** — provider-specific auth (Bearer, x-api-key, x-goog-api-key, NVCF-API-KEY) with backend-proxied requests (no CORS issues)
- **Model auto-discovery** — from provider endpoints or presets
- **API key encryption** — AES-256-GCM at rest
- **Role mappings** — assign roles to specific models
- **Security toggles** — terminal, filesystem, destructive approval, browser

### 📄 Pages

| Route | Purpose |
|-------|---------|
| `/setup` | Setup wizard — env validation, Supabase connectivity, project creation, provider checks |
| `/dashboard` | Stats, charts, recent chats, activity feed |
| `/workspace` | Main IDE — file explorer, editor, terminal, chat, execution graph, status bar |
| `/agents` | Agent management (6 role types) |
| `/automations` | Visual workflow automation |
| `/knowledge` | Knowledge base |
| `/memory` | Memory store |
| `/activity` | Filterable activity/history log |
| `/settings` | Providers, roles, security |

### 🗄️ Data Storage
Supabase (PostgreSQL) with 15+ tables: `agents`, `automations`, `chats`, `files`, `usage_records`, `knowledge_items`, `provider_configs`, `provider_models`, `memories`, `agent_runs`, `automation_runs`, `projects`, `security_audit_log`, `pending_approvals`, `execution_history`, `agent_collaboration`, `git_cache`, `context_index_cache`, `agent_prompts`.

### 🖥️ Desktop App (Electron)
See the [Desktop App](#-desktop-app-electron) section below.

---

## 🏗 Architecture

```
agentos-studio/
├── apps/
│   ├── web/              # Next.js 15 — frontend + API routes (primary)
│   ├── desktop/          # Electron shell (optional native app)
│   ├── api/              # FastAPI backend (alternative deployment)
│   └── workers/          # Celery background workers (alternative deployment)
├── packages/
│   ├── agent-core/       # Agent execution interface
│   ├── automation-engine/# Workflow engine
│   ├── model-router/     # LLM provider abstraction
│   ├── usage-tracker/    # Token & cost tracking
│   ├── design-engine/    # UI generation
│   └── ui/               # Shared design tokens
├── docs/                 # Architecture, deployment, API docs
├── infra/                # Docker Compose, K8s manifests
├── scripts/              # Build, dev, setup scripts
└── supabase/
    └── migrations/       # SQL schema migrations
```

> **Note:** The primary backend runs on Next.js API routes (`apps/web`). The `apps/api` (FastAPI) and `apps/workers` (Celery) directories exist for alternative/infrastructure deployment paths — see the [Deployment Guide](docs/deployment.md) for details.

### Data Flow

```
User → Next.js API Route → Backend Proxy → Provider API (OpenAI, Anthropic, etc.)
                          ↓
                    (or desktop IPC)
                          ↓
                    Electron Main Process → ProviderClient → External API
```

```
Chat Flow:
User → ChatPanel → API Route → Model Router → Provider Adapter → LLM → Streaming SSE → UI
                                                                 ↓
                                                    Tool-calling loop (read/write/search)
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router, React Server Components) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS, shadcn/ui, Framer Motion, CSS custom properties (design tokens) |
| **Editor** | Monaco Editor, Monaco Diff Editor |
| **Terminal** | node-pty, xterm.js |
| **Flow Builder** | React Flow (@xyflow/react) |
| **Charts** | Recharts |
| **Desktop** | Electron, electron-builder, keytar, electron-updater |
| **Storage** | Supabase / PostgreSQL |
| **AI** | OpenAI, Anthropic, Google, Groq, OpenRouter, Ollama, LM Studio + any OpenAI-compatible API |
| **Monorepo** | pnpm workspaces, TurboRepo |
| **Fonts** | Geist Sans, Geist Mono |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 20 (`node -v`)
- **pnpm** >= 9 (`pnpm -v`)
- **Supabase project** — free tier works (or run locally via `supabase start`)

### Setup

```bash
# 1. Clone
git clone https://github.com/patil-shubham-dev/AgentOS-Studio.git
cd AgentOS-Studio

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp apps/web/.env.example apps/web/.env.local

# 4. Edit apps/web/.env.local with your Supabase credentials:
#    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENTOS_ENCRYPTION_KEY
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# 5. Apply database migrations (run the SQL in supabase/migrations/
#    against your Supabase SQL editor or via the CLI)

# 6. Start development
pnpm --filter @agentos/web dev
```

Open **http://localhost:3000** — the setup wizard will guide you through the remaining configuration.

### Run with Desktop (Electron)

```bash
# Build the Next.js web app for production
pnpm --filter @agentos/web build

# Package the desktop app
pnpm build:desktop:win   # or build:desktop:mac / build:desktop:linux
```

The installer will be in `apps/desktop/out/`.

---

## 🔌 Provider Support

| Provider | Type | Auth Method | Notes |
|----------|------|-------------|-------|
| OpenAI | Cloud | `Bearer` token | `/v1/chat/completions` |
| Anthropic | Cloud | `x-api-key` | Requires POST to `/v1/messages` |
| Google AI Studio | Cloud | `x-goog-api-key` | |
| Groq | Cloud | `Bearer` token | |
| DeepSeek | Cloud | `Bearer` token | |
| OpenRouter | Cloud | `Bearer` token | |
| Together AI | Cloud | `Bearer` token | |
| Fireworks | Cloud | `Bearer` token | |
| Mistral | Cloud | `Bearer` token | |
| NVIDIA NIM | Cloud | `NVCF-API-KEY` | Requires specific auth header |
| Ollama | Local | None | Default: `http://localhost:11434/v1` |
| LM Studio | Local | None | Default: `http://localhost:1234/v1` |
| Custom | Any | `Bearer` token | Any OpenAI-compatible endpoint |

> **Connection testing** is proxied through the backend — no CORS issues. Error messages are classified into 7 categories (timeout, DNS, TLS, auth, refused, reset, network) with actionable guidance.

### Provider Architecture: One Card = One Model

AgentOS Studio uses a **one-provider-card = one-model** architecture.

To use multiple models from the same vendor, create multiple provider cards — each with its own selected model:

```
Provider Card A:          Provider Card B:          Provider Card C:
NVIDIA NIM                NVIDIA NIM                NVIDIA NIM
→ deepseek-v4-flash        → deepseek-v3             → qwen-coder
```

**Key rules:**

| Rule | Description |
|------|-------------|
| **Single selection** | Each provider card has exactly one `selectedModel`. No multi-model arrays. |
| **No raw discovery leakage** | The UI, role dropdowns, and runtime only see `selectedModel` — not all discovered models. |
| **Dedup by instance** | `providerInstanceId + selectedModelId` is the canonical dedup key. No duplicate entries. |
| **Role routing** | Role dropdowns only show `selectedModel` from active, enabled provider cards. |
| **Connection per card** | Each card has independent health status, latency, and last-checked timestamp. |

**Provider card layout:**
```
┌──────────────────────────────┐
│ NVIDIA NIM                  │
│ deepseek-v4-flash           │
│                              │
│ ● Connected                  │
│ latency: 420ms               │
│ roles: Coding, Research      │
│                              │
│ [Test] [Configure] [Remove]  │
└──────────────────────────────┘
```

**Configuration flow:** Add Provider → Select Type → Enter API Key → Discover Models → **Pick ONE Model** → Save → Isolated provider instance created.

---

## 🖥 Desktop App (Electron)

The optional Electron shell provides native capabilities:

| Capability | Native | Web Fallback |
|-----------|--------|-------------|
| **File system** | `fs/promises` via IPC | HTTP API routes |
| **Terminal** | `node-pty` via IPC | HTTP + SSE |
| **Credentials** | OS Keychain (keytar) | Encrypted DB via API |
| **Dialogs** | Native OS dialogs | HTML `<input>` elements |
| **Auto-updates** | electron-updater | Not available |
| **Deep linking** | `agentos://` protocol | Not available |

**Architecture:**

```
Renderer (Next.js)
     ↓ contextBridge (secure API)
Electron Main Process
     ├── IPC Handlers → fs, node-pty, keytar, dialogs
     ├── ProviderClient → External LLM APIs
     ├── ProviderHealthMonitor (5-min health checks)
     └── Tray, Auto-updater, Global Shortcuts
```

**Window controls** are native; the native menu bar is removed for a clean, frameless appearance.

---

## 💻 Development

```bash
# Start web dev server (hot reload)
pnpm --filter @agentos/web dev

# Typecheck
pnpm --filter @agentos/web typecheck

# Desktop dev mode (Electron + web dev server)
pnpm dev:desktop

# Lint
pnpm --filter @agentos/web lint

# Run tests
pnpm --filter @agentos/web test
```

### Desktop Dev Mode

```bash
pnpm --filter @agentos/desktop dev
```
This script builds the web app, starts a Next.js dev server, then launches Electron connected to it.

---

## 📦 Build & Package

```bash
# Build the web app only
pnpm --filter @agentos/web build

# Build desktop app (current platform)
pnpm build:desktop

# Platform-specific builds
pnpm build:desktop:win    # Windows NSIS installer + zip
pnpm build:desktop:mac    # macOS DMG + zip
pnpm build:desktop:linux  # Linux AppImage + deb

# Clean
pnpm clean
```

Output goes to `apps/desktop/out/`.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Full system architecture overview |
| [Desktop App Architecture](docs/architecture/desktop-app.md) | Electron IPC, PTY, credentials |
| [API Reference](docs/api-reference.md) | All API routes and responses |
| [Deployment Guide](docs/deployment.md) | Docker Compose, K8s, manual setup |
| [Contributing](docs/contributing.md) | Development setup, code style, PRs |

---

## 📄 License

**MIT** — see [LICENSE](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ by the AgentOS Studio Contributors</sub>
</div>
