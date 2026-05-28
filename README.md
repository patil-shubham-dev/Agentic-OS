# AgenticOS

> An open-source, AI-powered development operating system with a rich desktop interface, multi-agent orchestration, MCP integration, and an extensible tool ecosystem.

AgenticOS is a **Tauri-based desktop application** that turns AI models (Claude, GPT-4o, etc.) into a collaborative agent workforce for software development. It features an interactive file explorer, multi-panel code workspace, chat-based AI assistant, real-time agent orchestration, and granular permission controls.

![AgenticOS](https://img.shields.io/badge/version-2.1.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-purple)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6)

---

## Features

- **Workspace File Explorer** — Browse, open, create, rename, and delete files/folders with a VS Code-style tree view
- **Multi-Panel Code Workspace** — Split-view code editor with Monaco, diff viewer, and file tabs
- **AI Chat Assistant** — Conversational interface with streaming responses, markdown rendering, and syntax-highlighted code blocks
- **Multi-Agent Orchestration** — Autonomous, fastest, most-accurate, research-heavy, human-guided, and safe execution modes
- **Agent Workforce** — Coordinator, coder, researcher, reviewer agents that collaborate on tasks
- **Extensible Tool System** — Built-in tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, and more
- **MCP Support** — Connect to Model Context Protocol servers (stdio, SSE) for expanded tooling
- **Runtime Execution Engine** — Real-time agent execution with telemetry, token tracking, and streaming
- **Provider Gateway** — Connect OpenAI, Anthropic, Ollama, OpenRouter, and any OpenAI-compatible API
- **Role-Based Configuration** — Assign models and providers to specific agent roles (manager, coder, researcher, etc.)
- **Execution Dock** — Monitor agent activity, execution depth, tool usage, and performance metrics
- **Snapshot Browser** — View and restore file snapshots from agent sessions
- **Built-in Browser & Design Tools** — Preview web UIs and design artifacts within the workspace
- **Git Integration** — Basic git operations from within the workspace
- **Shell Integration** — Register/unregister "Open with AgenticOS" right-click context menu in Windows Explorer
- **Auto-Updater** — Built-in update mechanism with install dialogs

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm
- [Rust](https://www.rust-lang.org/) (for Tauri builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/patil-shubham-dev/Agentic-OS.git
cd AgenticOS

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

Starts the Vite dev server at `http://localhost:5173`.

### Desktop Development

```bash
npm run tauri:dev
```

Launches the Tauri desktop application in development mode with hot-reload.

### Build

```bash
# Web build
npm run build

# Desktop build (produces .exe + installer)
npm run tauri:build
```

Outputs:
- `src-tauri/target/release/agenticos.exe` — portable executable
- `src-tauri/target/release/bundle/nsis/AgenticOS_2.1.0_x64-setup.exe` — NSIS installer
- `src-tauri/target/release/bundle/msi/AgenticOS_2.1.0_x64_en-US.msi` — MSI installer

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run preview` | Serve production build locally |

---

## Architecture

```
AgenticOS/
├── src/                    # React/TypeScript frontend
│   ├── agents/             # Agent definitions & worktree manager
│   ├── components/         # UI components
│   │   ├── layout/         # Navigation rail, app shell
│   │   ├── runtime/        # Execution explorer, status bar, dock
│   │   ├── settings/       # Provider, role, and tool settings
│   │   ├── ui/             # Design system primitives
│   │   └── workspace/      # File tree, code workspace, chat, browser
│   ├── core/               # Kernel, routing, providers, error boundaries
│   ├── editor/             # Monaco editor runtime integration
│   ├── hooks/              # Shared React hooks
│   ├── lib/                # Core libraries (workspace, git, provider-gateway, etc.)
│   ├── pages/              # Route pages (code-canvas, settings, onboarding, etc.)
│   ├── performance/        # Performance monitoring, leak detection
│   ├── providers/          # AI provider adapters (OpenAI, Anthropic, Ollama, etc.)
│   ├── runtime/            # Execution engine, agent orchestration, sessions
│   ├── stores/             # Zustand state stores
│   └── types/              # TypeScript type definitions
├── src-tauri/              # Rust backend (Tauri)
│   └── src/
│       └── lib.rs          # Tauri commands, plugins, menu, tray
├── packages/               # Shared packages
│   ├── providers/          # AI provider gateway (shared)
│   ├── shared/             # Common types, constants, utilities
│   └── ui/                 # UI component library
└── scripts/                # Build and utility scripts
```

### Key Architecture Decisions

- **Desktop-first**: Built on Tauri v2 for native performance and small binary size
- **Plugin-based FS**: Uses `tauri-plugin-fs` for file operations with configurable scope
- **Multi-agent architecture**: Coordinator agent delegates to specialized sub-agents
- **Provider-agnostic**: Gateway pattern supports any OpenAI-compatible API
- **Real-time streaming**: EventBus-driven architecture for live execution telemetry
- **State management**: Zustand stores with selector-based subscriptions

---

## Configuration

### Providers

Connect AI providers in **Settings → Providers**:
- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)
- Ollama (local models)
- OpenRouter
- Any OpenAI-compatible API

### Roles

Assign models to agent roles in **Settings → Roles**:
- **Manager** — Orchestrates and delegates tasks
- **Coder** — Writes and edits code
- **Researcher** — Searches codebase and web
- **Vision** — Analyzes images/screenshots
- **Design** — Creates UI designs
- **QA** — Tests and verifies
- **Browser** — Web automation
- **Memory** — Context management

### Execution Modes

| Mode | Description |
|------|-------------|
| **Autonomous** | AI auto-selects agents and tools |
| **Fastest** | Optimize for speed — parallel execution |
| **Most Accurate** | Multi-agent verification & review |
| **Research** | Deep analysis, extensive searching |
| **Human Guided** | Approve every action before execution |
| **Safe Mode** | Read-only analysis, no mutations |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | Tauri 2.x (Rust backend) |
| **UI Framework** | React 19, TypeScript 5.6 |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS 4 |
| **Animation** | Framer Motion |
| **Code Editor** | Monaco Editor |
| **State Management** | Zustand 5 |
| **Validation** | Zod |
| **Panel Layout** | react-resizable-panels |
| **Routing** | react-router-dom 7 |
| **Virtualization** | @tanstack/react-virtual |
| **MCP** | @modelcontextprotocol/sdk |
| **Icons** | Lucide React |
| **Testing** | Vitest |

---

## Project Status

Active development. The codebase has been restructured from a monorepo architecture into a streamlined Tauri desktop application with a rich multi-agent orchestration system.

---

## License

MIT
