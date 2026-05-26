# Product Requirements Document (PRD) — Agentic-OS Studio

Based on the conversation provided in 

---

# 1. Product Overview

## Product Name

**Agentic-OS Studio**

## Vision

Agentic-OS Studio is a unified AI-powered development workspace designed for non-coders and vibe coders. It combines autonomous coding, premium UI generation, browser automation, testing, orchestration, and remote control into a single integrated ecosystem.

The platform acts as a centralized operating system for AI-assisted software creation.

Instead of using multiple fragmented AI tools, terminals, browser tabs, and automation systems, Agentic-OS Studio merges them into one orchestrated environment powered by specialized AI engines.

The long-term vision is:

* AI-assisted coding
* Automated UI/UX generation
* Autonomous testing loops
* Multi-model orchestration
* Remote mobile supervision
* Cloud execution on OCI
* Human approval workflows
* Full development lifecycle automation

---

# 2. Core Philosophy

## Principles

### 1. Minimal Human Coding

The system must reduce manual coding as much as possible.

### 2. Unified Workspace

All AI workflows operate from one interface.

### 3. Modular Architecture

Only required logic/components from open-source repositories are extracted.

### 4. Local-First Execution

Phase 1 focuses entirely on local execution.

### 5. Human-in-the-Loop

Agents can automate tasks, but critical approvals remain user-controlled.

### 6. Premium UX

The system should feel like a consumer-grade professional product, not an experimental developer tool.

---

# 3. Open Source Foundation

The project is an original implementation inspired by architectural patterns from the following open-source projects. It does NOT directly extract or copy code — it re-implements core concepts using a custom Tauri v2 + React + Zustand stack.

---

## A. [OpenClaude](https://github.com/Gitlawb/openclaude)

### Purpose

Core coding engine patterns.

### Inspired Concepts

* File read/write tools
* grep/glob search tools
* multi-file editing logic
* execution loops
* workspace management

### Re-implemented as

Custom Rust commands (`commands.rs`) with full unit tests, typed Tauri invoke bridge, and Zustand workspace store.

---

## B. [OpenDesign](https://github.com/nexu-io/open-design)

### Purpose

Premium UI/UX generation layer.

### Inspired Concepts

* design-systems/
* skills/
* DESIGN.md prompt structures
* visual prompt engineering

### Re-implemented as

Custom design store with artifact versioning, component comparison, TailwindCSS/shadcn/ui system with Radix primitives, and Design Agent system prompts.

---

## C. [Hermes Agent](https://github.com/nousresearch/hermes-agent)

### Purpose

Agent orchestration + autonomous testing + system control.

### Inspired Concepts

* browser automation
* screenshot pipelines
* messaging logic
* sub-agent orchestration
* execution loops

### Re-implemented as

Custom runtime engine with ExecutionStateMachine, 10-agent role registry, headless Chrome automation via `headless_chrome` crate, browser store, and approval gate.

---

# 4. Product Scope

The product will be developed in two major phases.

---

# PHASE 1 — Desktop Functional MVP (.EXE Only)

---

# Goal

Build a fully functional local desktop application capable of:

* AI coding
* UI generation
* browser testing
* project orchestration
* local workspace management

This phase intentionally excludes:

* mobile applications
* OCI deployment
* distributed cloud execution
* remote infrastructure

---

# 5. Phase 1 Technical Architecture

## Desktop Shell

* **Tauri v2** — lightweight native wrapper with Rust backend
* **Tauri plugins** — dialog, filesystem, shell, updater, notification, clipboard-manager

## Frontend

* **React 19** with TypeScript
* **Vite 6** — bundler + dev server
* **TailwindCSS v4** — utility-first CSS with custom design tokens
* **Framer Motion 12** — layout animations
* **Lucide React** — iconography
* **Inter + JetBrains Mono** — typography

## Backend (Rust)

* **40+ Tauri commands** across 8 modules
  * `commands.rs` — file I/O, grep, glob, edit, shell execution (with unit tests)
  * `browser.rs` — headless Chrome automation (launch, navigate, screenshot, click, fill, JS execution, console logs)
  * `git.rs` — full git operations (status, log, diff, commit, restore, init)
  * `history.rs` — file snapshot system (max 500 snapshots, rollback, diff computation)
  * `watcher.rs` — filesystem watching via `notify` crate, Tauri event emission
  * `desktop.rs` — install info, storage, cache clearing, settings reset, uninstall
  * `provider/` — runtime detection (12+ providers), model discovery, OpenAI-compatible gateway
  * `sandbox/` — command/FS/network sandbox rules with enable/disable toggle

## State Management

* **Zustand v5** — 12 stores (app, agent, workspace, ledger, design, theme, toast, browser, desktop, runtime-projections, workspace-runtime, approval)
* **Cross-store coordination** — runtime-coordinator, runtime-diagnostics (cross-store mutation detection), runtime-assertions (render-write enforcement)

## Runtime Architecture

* **RuntimeKernel** — dependency-injected kernel with service registration, topological init ordering, circular dependency detection, boot/shutdown lifecycle
* **EventBus** — singleton event bus for runtime events (15 event types)
* **ExecutionStateMachine** — Idle → Queued → Planning → Executing → Reviewing → Completed (with error/recovery paths)
* **TimelineEngine** — event sequencing and history tracking
* **RuntimeQueue** — prioritized execution queue
* **Agent System** — 10 agent roles with typed capabilities, system prompts, collaboration tags
* **Provider System** — 5 adapters (OpenAI, Anthropic, Ollama, OpenRouter, Nvidia), health monitoring, stream normalization, tool call normalization

## Performance

* **Leak detection** — React component leak tracker
* **Stream backpressure** — StreamBuffer, SharedBufferManager
* **Event projection** — RAF-batched runtime event processing
* **Timeline virtualization** — virtualized timeline for large event logs
* **Performance budgets** — defined thresholds for rendering, streaming, memory

## Build & Packaging

* **npm workspaces** — monorepo (`packages/*`, `apps/*`)
* **scripts/build-desktop.ps1** — Tauri build pipeline
* **scripts/release.ps1** — version bump, build all, package
* **Bundles** — MSI + NSIS (per-user install)

---

# 6. Phase 1 Core Features

---

## 6.1 Control Center

### Purpose

Central command dashboard for monitoring and orchestrating the entire workspace.

### Features

* **Agent Cards** — visual cards for all 10 agent roles (Manager, Coder, Vision, Research, Runtime, Design, Fast Inference, Browser, QA, Memory) with status indicators and quick actions
* **Provider Status** — live health monitoring for all configured AI providers with connection state
* **Orchestration Status** — active orchestration pipeline visualization
* **Runtime Health** — system health metrics, memory pressure, performance budgets
* **Task Queue** — prioritized task list with cancel/reorder controls
* **Summary Stats** — token usage, cost tracking, messages sent, roles configured
* **Search** — cmd+K global command palette
* **Diagnostics Overlay** — runtime diagnostics panel for debugging
* **Welcome Card** — first-launch onboarding guidance
* **Init Loader** — loading state while kernel bootstraps services

---

## 6.2 Code Canvas

### Purpose

Primary 4-panel workspace for all development activity.

### Layout

**Left Panel (180-350px)** — Project file tree with create/delete/rename

**Center-Flex Panel** — Assistant workspace with 4 dynamic modes:
* **Code Workspace** — Monaco editor with multi-file editing, syntax highlighting, IntelliSense
* **Browser Workspace** — embedded browser preview with screenshot capture
* **Design Workspace** — UI component preview and design token visualization
* **History Workspace** — file snapshots, diff viewer, rollback timeline

**Right Panel (300-700px)** — Runtime timeline, execution debug, terminal, validation center, context-aware auto-switching between agent state views

### Features

* **Live coding** — Monaco editor with file tree integration
* **Multi-file editing** — open multiple tabs, drag-and-drop reorder
* **Execution modes** — 7 modes (Autonomous, Fastest, Cheapest, Most Accurate, Research Heavy, Human Guided, Safe Mode)
* **Context-aware auto-switching** — panels auto-switch based on active agent (code/browser/design/history), with manual override timeout
* **Validation center** — pre-flight validation, lint results, type checking
* **Runtime status bar** — bottom bar with execution state, agent activity, orchestration mode
* **Execution debug drawer** — collapsible execution topology and event cards
* **Diff viewer** — visual code diffs with rollback support
* **Keyboard shortcuts** — Cmd+B (toggle sidebar), Cmd+J (toggle terminal), Cmd+N (new file), Cmd+P (quick open), Cmd+W (close tab), Cmd+S (save), F5 (run)
* **Resizable panels** — drag-to-resize handles between all panels

---

## 6.3 Settings System

### Purpose

Centralized configuration hub with 8 tabs and global command palette.

### Provider Tab

Add, configure, and manage AI providers.

* Add providers with API keys and custom endpoints
* Runtime provider detection (auto-detects 12+ provider types from URL)
* Model discovery and validation
* Local model support (Ollama, LM Studio, vLLM)

### Supported Providers

* OpenAI
* Anthropic
* Google Gemini
* Groq
* Ollama
* OpenRouter
* Nvidia NIM
* DeepSeek
* Together AI
* Azure OpenAI
* LiteLLM
* LM Studio / vLLM
* Any OpenAI-compatible endpoint (Custom)

### Models Tab

Configure model parameters per provider — temperature, max tokens, context window.

### Roles Tab

Map provider models to agent responsibilities.

### Roles (10 total)

* Manager — orchestration and task planning
* Coder — code writing and editing
* Vision — visual UI analysis
* Research — deep codebase exploration
* Runtime — command execution and process management
* Design — UI/UX creation
* Fast Inference — quick, low-cost responses
* Browser — web automation and scraping
* QA — testing and verification
* Memory — context and knowledge persistence

### Example

* Claude → Manager, Coder
* Gemini → Vision
* GPT-4o → Coder, Research
* Ollama/Mistral → Fast Inference, Runtime

### Memory Tab

Configure context memory — token budget limits, compression strategies, workspace indexing, semantic search.

### Tools & MCP Tab

Configure tool permissions and Model Context Protocol (MCP) servers.

### Runtime Tab

Execution mode defaults, sandbox rules, auto-fix toggles, loop detection sensitivity.

### Installation Tab

View install info, storage usage, cache management, app version, data locations.

### Updates Tab

Check for updates, view update status, perform updates via Tauri updater.

### Delete & Reset Tab

Danger zone — clear workspace memory, reset settings, uninstall app data.

### Navigation

* Collapsible sidebar with tab icons
* Keyboard shortcuts 1-8 / 0 for quick tab switching
* Cmd+K global search across all settings

---

## 6.4 Workspace System

### Features

* Local folder selection via native OS dialog (Tauri dialog plugin)
* File tree with create, delete, rename support
* File watching via `notify` crate — real-time change events streamed to frontend
* Change detection — file content diffing with visual indicators
* Workspace config persistence (`.agentic-os/` directory)
* Runtime configuration per workspace
* AI context file selection — mark files for agent awareness
* Multi-root workspace support via state management

---

## 6.5 State Manager

### Purpose

Prevent agent conflicts and orchestrate execution flow.

### Execution Modes (7)

* **Autonomous** — full autonomy, no human approval required
* **Fastest** — prioritize speed, use cheap/fast models, skip non-essential validation
* **Cheapest** — minimize token cost, use cheapest available models
* **Most Accurate** — prioritize quality, use strongest models, run full validation
* **Research Heavy** — deep analysis before execution, extensive context gathering
* **Human Guided** — approval gates at every step, user must confirm before actions
* **Safe Mode** — strict sandbox, no file writes, read-only exploration

### Runtime States

* Idle → Queued → Planning → Executing → Reviewing → Completed
* Error and recovery paths for each state transition

### Capabilities

* File locking — prevent concurrent file modifications
* Execution locking — one active execution at a time per role
* Task queueing — prioritized FIFO with cancel/reorder
* Concurrency prevention — cross-role coordination via state machine
* Loop detection — automatic detection and prevention of infinite execution loops
* Preflight validation — validate environment before execution begins
* Approval gates — human-in-the-loop approval for high-risk operations

---

## 6.6 Context System

### Purpose

Unified memory and knowledge system for maintaining context across agent sessions.

### Components

* **Context Ledger** — persistent operation history with file modification tracking, agent summaries, transaction logs
* **Token Budget Manager** — per-agent token tracking and budget enforcement
* **Sliding Memory Compressor** — automatic compression of long conversation histories
* **AST Summarizer** — code structure summarization from abstract syntax trees
* **Workspace Indexer** — file content indexing for fast retrieval
* **Retrieval Engine** — relevance-based context retrieval for agent prompts
* **Context Assembler** — dynamic assembly of context blocks for LLM prompts
* **Dependency Graph** — project dependency analysis and mapping
* **Execution Memory Store** — session-persistent execution memory
* **Workspace Chunker** — intelligent file chunking for token-limited contexts
* **Semantic Search Index** — in-memory semantic search over workspace content

### Storage

* `.agentic-os/ledger.json` — transaction log
* `.agentic-os/config/` — workspace configuration
* In-memory session stores — execution memory, token budgets, search indices

---

## 6.7 Browser Automation

### Features

* Headless Chrome automation via `headless_chrome` Rust crate
* Launch, navigate, screenshot (base64 PNG), click, fill, wait
* JavaScript execution in browser context
* Console log extraction and analysis
* Page title and URL retrieval
* Multiple concurrent browser sessions with session management
* Browser store for session state (id, URL, title, screenshot, logs)

### Technologies

* `headless_chrome` crate (Rust) — native Chrome automation
* `base64` — screenshot encoding for frontend display

---

## 6.8 Design Intelligence

### Features

* Premium UI generation via Design Agent (specialized LLM prompts)
* Responsive layout generation with TailwindCSS
* Design token injection and management
* Component versioning and comparison
* Frontend polishing with Radix UI primitives
* Reusable component system extraction
* Design store with artifact tracking (versions, comparisons, apply-to-code)

### UI Systems

* TailwindCSS v4 with custom theme variables
* shadcn/ui component patterns
* Radix UI primitives (Dialog, DropdownMenu, Select, Switch, Tabs, Tooltip, etc.)
* Framer Motion animations
* Lucide React icons

---

## 6.9 Git & Rollback System

### Features

* Complete git operations via Rust backend: status, log, diff, commit, restore, init
* Visual diffs with side-by-side comparison
* File snapshot system — automatic snapshots before edits (max 500)
* Rollback to any snapshot with full file restoration
* Diff computation between snapshots
* Commit history with branch tracking (ahead/behind detection)
* Safe recovery — non-destructive rollback workflow

### Backend

* Rust `git.rs` — all git operations as Tauri commands
* Rust `history.rs` — file snapshot and rollback engine

---

## 6.10 Performance System

### Purpose

Maintain smooth UI performance during intensive agent operations.

### Components

* **Leak Detector** — React component tree leak tracking via `useLeakTracker`
* **Runtime Assertions** — subscription cleanup enforcement, render-write detection, timer leak detection
* **Performance Budgets** — defined thresholds for render time, streaming latency, memory usage
* **Stream Backpressure** — `StreamBuffer` + `SharedBufferManager` for controlled streaming
* **Event Projection Store** — RAF-batched runtime event processing (max 1000 events, batched projections)
* **Worker Telemetry Bridge** — web worker communication for offloading heavy computations
* **Timeline Virtualizer** — virtual scrolling for large event/timeline logs
* **Render Scheduler** — priority-based render scheduling for runtime components

---

## 6.11 Agent System

### Purpose

Modular agent framework for specialized task execution.

### Agent Types (10 roles)

* **Manager** — orchestration brain, task planning, delegation graph, result aggregation
* **Coder** — production code writing, editing, debugging, refactoring
* **Vision** — visual UI analysis, screenshot interpretation, layout validation
* **Research** — deep codebase exploration, dependency tracing, architecture analysis
* **Runtime** — command execution, process management, system monitoring
* **Design** — UI component creation, design tokens, frontend implementation
* **Fast Inference** — quick responses for simple queries, rapid prototyping
* **Browser** — web automation, data extraction, UI testing
* **QA** — test writing, test execution, code quality verification
* **Memory** — context continuity, knowledge persistence, session summarization

### Architecture

* **BaseAgent** — abstract base with common lifecycle (init, execute, cleanup)
* **AgentRouter** — routes tasks to appropriate agents based on capabilities
* **TaskLedger** — persistent task tracking with status and results
* **WorktreeManager** — isolated worktrees for parallel agent operations
* **ExecutionReflectionEngine** — self-analysis of execution performance and outcomes
* **Tool definitions** — typed tool schemas for each agent role
* **System prompts** — role-specific prompts with collaboration instructions

---

## 6.12 Auto-Fix & Loop Detection

### Purpose

Automatic recovery from errors and prevention of infinite execution loops.

### Auto-Fix Engine

* Detects common error patterns in command output, build failures, and runtime errors
* Applies automatic fixes (missing imports, type errors, configuration issues)
* Retries execution after fix with escalation on repeated failure
* Maintains fix history to avoid repeating failed strategies

### Loop Detection Engine

* Monitors agent execution for repetitive patterns
* Detects infinite loops via state repetition analysis
* Automatically terminates stuck executions with diagnostic report
* Suggests alternative approaches when loops are detected

---

## 6.13 MCP Support (Model Context Protocol)

### Purpose

Extend agent capabilities through external tool servers.

### Features

* Configure MCP server endpoints with authentication
* Tool discovery from MCP servers
* Tool permission management per agent role
* MCP tool invocation during agent execution
* Dedicated Tools & MCP tab in Settings

---

## 6.14 Onboarding System

### Purpose

Guide new users through first-time setup.

### 5-Step Wizard

1. **Welcome** — product introduction and value proposition
2. **Workspace Selection** — choose or create a project directory
3. **AI Provider** — configure first AI provider (API key, endpoint)
4. **System Check** — verify Tauri backend connectivity, Chrome availability, git installation
5. **Ready** — launch into Control Center with initialized defaults

### Behavior

* Fullscreen route (`/onboarding`) outside main app shell
* Auto-detection of first launch via session storage
* Cached provider defaults for quick setup
* Skip option for returning users

---

## 6.15 Provider System

### Purpose

Universal AI provider abstraction layer with runtime detection and health monitoring.

### Architecture

* **BaseProviderAdapter** — abstract base for all provider integrations
* **Provider Adapters** — OpenAI, Anthropic, Ollama, OpenRouter, Nvidia NIM
* **ProviderCapabilityRegistry** — maps providers to capabilities (chat, vision, tools, streaming)
* **ProviderHealthMonitor** — periodic health checks with connection state tracking
* **StreamNormalizer** — normalizes streaming responses from different providers into a common format
* **StreamingDeltaAssembler** — assembles streaming deltas into complete responses
* **ToolCallNormalizer** — normalizes tool calls from different provider formats
* **ToolSchemaValidator** — validates tool call schemas before execution

### Runtime Detection

Auto-detects provider type from URL patterns:
* OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, Nvidia, DeepSeek, Together AI, Azure, Ollama, LiteLLM, LM Studio, vLLM

### Discovery

* OpenAI-compatible model listing from `/v1/models` endpoints
* Ollama local model discovery via Ollama API
* Context window inference from model names

---

## 6.16 Editor Runtime

### Purpose

Intelligent code editing engine with AST-aware operations.

### Components

* **MonacoRuntimeHost** — Monaco editor integration with runtime bridge
* **MonacoPatchBridge** — applies AI-generated patches to editor content
* **ASTPatchEngine** — AST-aware code patching for structural edits
* **FileSnapshotManager** — automatic snapshots before each edit operation
* **IncrementalMutationCompiler** — incremental compilation after edits
* **SearchReplaceEngine** — pattern-based search and replace across files
* **PatchRollbackEngine** — rollback individual patches with state recovery
* **VerificationPipeline** — post-edit verification (lint, type check, build)

---

## 6.17 Sandbox System

### Purpose

Security sandbox for command execution, filesystem access, and network operations.

### Architecture (Rust + Frontend)

* **SandboxPolicy trait** — Rust trait for defining sandbox rules
* **Command Sandbox** — allow/block lists for shell commands, argument validation
* **Filesystem Sandbox** — allowed paths, read/write/delete restrictions
* **Network Sandbox** — allowed domains, URL pattern validation

### Features

* Toggle sandbox on/off per session
* Pre-execution validation for all commands, file paths, URLs
* Violation reporting with clear error messages
* Frontend validation mirroring Rust backend rules
* Human-in-the-loop approval for sandbox violations

---

## 6.18 Runtime Engine

### Purpose

Core orchestration engine that coordinates all agent activity.

### Components

* **RuntimeKernel** — dependency-injected service container with lifecycle management (initialize → start → stop → dispose), topological dependency resolution, circular dependency detection
* **EventBus** — singleton event bus for runtime events (15 types: state_transition, tool_requested, tool_stream, tool_completed, error, approval_required, etc.)
* **ExecutionStateMachine** — finite state machine with 6 primary states (Idle, Queued, Planning, Executing, Reviewing, Completed) plus error/recovery paths
* **TimelineEngine** — event sequencing with causal ordering
* **RuntimeQueue** — priority-based execution queue with concurrency limits
* **ToolExecutionManager** — tool execution lifecycle (validate, execute, monitor, complete)
* **RuntimeSupervisor** — orchestrates full execution lifecycle across all agents
* **RuntimeEventSerializer** — event serialization for persistence and debugging
* **RuntimeCheckpointManager** — checkpoint/restore for runtime state
* **StreamMultiplexer** — multiplex multiple LLM streams into a single output
* **SessionManager** — manages execution sessions with pause/resume/cancel
* **ExecutionSession** — single execution context with state, context, and result tracking
* **RuntimeProjectionBridge** — bridges runtime events to Zustand projection store
* **PersistentExecutionStore** — persists execution state between sessions

### Projections & UI

* **RuntimeProjectionStore** — RAF-batched React store with 15 event types projected to UI
* **CinematicTokenStream** — premium streaming text display with typewriter effect
* **RuntimeStatusBar** — bottom bar with execution state, agent activity, orchestration mode
* **ExecutionDock** — always-visible floating dock for active execution control
* **ValidationCenter** — collapsible panel for pre-flight and post-execution validation results
* **RuntimeInspector** — development tool for inspecting runtime state

---

# 7. Phase 1 Navigation Structure

The application uses a **NavigationRail** pattern with collapsible sidebar (52px collapsed / 220px expanded).

## Top Section

| Item            | Route             | Purpose                              |
| --------------- | ----------------- | ------------------------------------ |
| Control Center  | `/control-center` | Agent monitoring & orchestration     |
| Code Canvas     | `/code-canvas`    | Coding & testing workspace           |
| Agents          | `/agents`         | Agent role management & wiring       |
| Mobile Gateway  | `/mobile-gateway` | Reserved placeholder for Phase 2     |

## Bottom Section

| Item    | Route       | Purpose                        |
| ------- | ----------- | ------------------------------ |
| Logs    | `/logs`     | System logs & agent activity   |
| Git     | `/git`      | Git operations & history       |
| Settings| `/settings` | Providers, roles, config, MCP  |
| Updates | (in settings)| Update management              |

## Features

* Hover-to-expand with pin toggle
* Active route glow indicator
* Tooltips on collapsed state
* User avatar in bottom section
* 4 top items + 4 bottom items

---

# 8. Features Explicitly Excluded From Phase 1

---

## Not Included

### Cloud Infrastructure

* OCI
* Kubernetes
* distributed runtimes
* WebSocket relay servers

### Mobile Systems

* Android app
* iOS app
* push notifications
* QR pairing (placeholder UI only)

### Messaging Integrations

* Telegram
* WhatsApp
* Discord

### Complex Memory UI

* vector database dashboards
* chunk management
* manual embedding systems

### Enterprise Infrastructure

* Docker clusters
* multi-user collaboration
* RBAC systems

### Backend Server

* Node.js backend (`apps/backend/` is a stub with no routes)
* REST API endpoints
* Authentication system
* User accounts

---

# 9. Technology Stack

---

## Desktop Runtime

### [Tauri v2](https://github.com/tauri-apps/tauri)

Desktop runtime with Rust backend for native operations.

---

## UI Framework

### [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)

Frontend framework with full type safety.

### [Vite 6](https://vite.dev/)

Build tool and dev server.

### [TailwindCSS v4](https://tailwindcss.com/)

Utility-first CSS framework with custom design tokens.

### [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)

Accessible component primitives and design system.

### [Framer Motion 12](https://www.framer.com/motion/)

Animation library for layout transitions and UI effects.

### [Lucide React](https://lucide.dev/)

Icon library.

---

## State Management

### [Zustand v5](https://github.com/pmndrs/zustand)

Lightweight state management for all application stores.

---

## Editor

### [Monaco Editor](https://microsoft.github.io/monaco-editor/) (via `@monaco-editor/react`)

Code editor with IntelliSense, syntax highlighting, and multi-file support.

---

## Browser Automation

### [`headless_chrome`](https://crates.io/crates/headless_chrome) (Rust crate)

Native headless Chrome automation for browser testing and screenshots.

---

## File Watching

### [`notify`](https://crates.io/crates/notify) (Rust crate)

Cross-platform filesystem event monitoring.

---

## AI Provider Routing

### Custom provider gateway (Rust) + Provider adapters (TypeScript)

Universal AI provider abstraction supporting OpenAI-compatible, Anthropic, and Ollama APIs.

---

# 10. Phase 1 Deliverables

---

## Desktop App

* Packaged executable (MSI + NSIS)
* Per-user Windows installation
* Tauri v2 shell with native menus and system tray

### Workspace & Coding

* Project file tree with CRUD operations
* Monaco code editor with multi-file tabs
* File watching and real-time change detection
* File snapshots with rollback and diff viewer

### AI Agent System

* 10 specialized agent roles with typed capabilities
* Multi-agent orchestration with Manager routing
* Agent conversation history per role
* Task queue with priorities and cancel support
* Human-in-the-loop approval gates
* 7 execution modes (autonomous, fastest, cheapest, most accurate, research heavy, human guided, safe mode)

### Provider System

* 12+ auto-detected provider types
* 5 adapter implementations (OpenAI, Anthropic, Ollama, OpenRouter, Nvidia)
* Provider health monitoring and connection state
* Model discovery and validation
* Streaming with backpressure and normalization

### Settings

* 8-tab configuration system with keyboard navigation
* Cmd+K global search across all settings
* Provider, model, role, memory, MCP, runtime, install, update, and reset tabs

### Automation

* Headless Chrome browser automation (launch, navigate, screenshot, click, fill, JS execution, console logs)
* Browser session management with store
* Git operations (status, log, diff, commit, restore, init)
* Auto-fix engine for common errors
* Loop detection to prevent infinite executions

### Runtime Systems

* State manager with 6-state execution machine
* Context system (ledger, token budget, memory compression, AST summarization, workspace indexing, retrieval, dependency graph, semantic search)
* Performance system (leak detection, stream backpressure, event projection, timeline virtualization)
* Sandbox system (command, FS, network rules)

### Onboarding

* 5-step first-launch wizard
* System health check before first use

### Navigation

* Collapsible NavigationRail with 8 items
* Active route indicators and tooltips

### Build & Release

* Automated build pipeline (PowerShell scripts)
* Version bump, build all packages, package installer
* Tauri updater integration for future updates

---

# 11. Phase 1 Implementation Status

Note: Phase 1 core implementation is substantially complete. The timeline below reflects the original plan; actual progress is ahead of schedule with most systems already built.

| Milestone                        | Status         |
| -------------------------------- | -------------- |
| Project Initialization           | Complete       |
| Tauri + React Shell              | Complete       |
| NavigationRail + Routing         | Complete       |
| Settings System (8 tabs)         | Complete       |
| Workspace Integration            | Complete       |
| Provider System (12+ types)      | Complete       |
| Agent System (10 roles)          | Complete       |
| Runtime Engine + State Machine   | Complete       |
| Browser Automation               | Complete       |
| Git & File History               | Complete       |
| State Manager + Context System   | Complete       |
| Performance System               | Complete       |
| Sandbox System                   | Complete       |
| Onboarding System                | Complete       |
| UI Polish & Animation            | Complete       |
| Build Pipeline & Packaging       | Complete       |

### Remaining Work

* Monaco Editor full integration (editor runtime modules exist, component wiring ongoing)
* Code Canvas redesign per `code-canvas-redesign-spec.md` (assistant workspace, timeline cards, context bar)
* Tauri native multi-webview for browser workspace
* Comprehensive test coverage expansion
* UI polish refinement rounds

---

# PHASE 2 — Mobile Application + OCI Infrastructure

---

# Goal

Extend Agentic-OS Studio into a cloud-connected autonomous ecosystem with mobile supervision and remote orchestration.

---

# 12. Phase 2 Objectives

---

## Mobile Application

Build a dedicated mobile control application.

### Capabilities

* realtime monitoring
* log streaming
* screenshot viewing
* command execution
* approvals/rejections
* remote prompts

---

## OCI Deployment

Deploy core execution systems to Oracle Cloud Infrastructure.

### OCI Responsibilities

* run agents 24/7
* execute browser testing
* maintain websocket servers
* process automation loops
* host remote APIs

---

# 13. Phase 2 Architecture

```
Mobile App
     ⇅
WebSocket Gateway
     ⇅
OCI Runtime Server
     ⇅
Agentic-OS Engines
(OpenClaude + Hermes + OpenDesign)
```

---

# 14. Phase 2 Mobile Features

---

## Realtime Dashboard

* current task
* active agent
* execution state

## Live Logs

* coding updates
* runtime feedback
* browser console logs

## Visual Stream

* screenshots
* live previews
* rendered pages

## Remote Commands

* approve changes
* reject changes
* rollback
* rerun task
* send prompts

---

# 15. Phase 2 OCI Infrastructure

---

## OCI Configuration

### Recommended

* VM.Standard.A1.Flex
* 4 OCPU
* 24GB RAM
* 200GB storage

### Runtime

* Ubuntu Minimal ARM

---

## Cloud Responsibilities

* websocket hosting
* Playwright execution
* background workers
* image streaming
* persistent agents

---

# 16. Phase 2 Security Requirements

---

## Authentication

* session tokens
* device pairing
* OTP/PIN verification

## Remote Execution Safety

* approval gates
* restricted commands
* isolated workspaces

---

# 17. Long-Term Vision

Future versions may include:

* autonomous deployment
* multi-agent collaboration
* cloud project syncing
* local model execution
* AI-generated workflows
* team collaboration
* enterprise orchestration
* voice interaction
* autonomous bug fixing

---

# 18. Final Product Summary

Agentic-OS Studio aims to become:

> A unified AI-native operating environment for software creation where coding, design, testing, orchestration, and remote supervision are merged into one intelligent workflow system.

The system is specifically optimized for:

* vibe coders
* solo builders
* AI-assisted developers
* no-code/low-code creators
* autonomous development workflows

Primary focus:

* minimal complexity
* modular architecture
* reusable open-source intelligence
* premium UX
* scalable future infrastructure

