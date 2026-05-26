# Agentic-OS Studio — Project Rules

## Architecture Overview

This is a **multi-agent runtime** built with a monorepo structure:

- **apps/web/** — React + TypeScript + Vite frontend (main UI)
- **apps/desktop/** — Tauri desktop shell (Rust backend)
- **apps/backend/** — Backend services
- **packages/** — Shared packages (ui, providers, shared types)
- **scripts/** — Build and release automation

## Coding Conventions

### TypeScript
- Use strict TypeScript with `strict: true` in tsconfig
- Prefer `type` imports over `interface` for props and API boundaries
- Use `import type { ... }` for type-only imports
- Avoid `any` — use `unknown` and narrow with type guards
- Use `as const` for literal types and tuple types
- Export types at the bottom or inline — never use `export default`

### React
- Functional components with hooks, no class components
- Zustand for global state management (stores in `apps/web/src/stores/`)
- Use `cn()` utility from `@/lib/utils` for conditional class merging
- Name files with kebab-case for utilities, PascalCase for components
- Each component in its own file, matching the export name

### TailwindCSS
- Use Tailwind utility classes exclusively (no CSS modules or styled-components)
- Dark theme by default — use `bg-[#0a0a0b]` and similar dark values
- Glass-morphism effects with `backdrop-blur-xl` and `bg-white/[0.03]`
- Animate with framer-motion, not CSS animations/tailwind-animate

## Runtime Architecture

### Agent Roles
The runtime has 10 agent roles (each with a designated system prompt):
- **manager** — orchestrates multi-agent execution
- **coder** — writes and edits code
- **design** — creates UI components
- **research** — deep codebase analysis
- **runtime** — shell command execution
- **qa** — testing and verification
- **browser** — web automation
- **vision** — visual analysis
- **fast-inference** — quick responses
- **memory** — cross-session persistence

### Execution Modes
6 modes controlling behavior: autonomous, fastest, most_accurate, research_heavy, human_guided, safe_mode

### Tools
File tools (read_file, write_file, edit_file), search tools (grep_files, glob_files), terminal (run_command), browser tools, design tools

## Important Rules

1. Never modify `package.json`, `tsconfig.json`, or build configs without explicit user request
2. Always read the file before editing it — never guess file contents
3. Prefer targeted edit_file over full-file write_file
4. Auto-verification (tsc + eslint) runs after every file edit — use the results to fix issues
5. System prompts live in `apps/web/src/runtime/context/SystemPromptFactory.ts`
6. Orchestrator logic lives in `apps/web/src/lib/agents/orchestrator.ts`

## File Organization

```
apps/web/src/
  components/ — React UI components
  runtime/ — Agent runtime engine, execution, tools
  lib/ — Shared utilities, AI service, tool executor
  stores/ — Zustand stores
  pages/ — Page-level components
  providers/ — AI provider adapters (OpenAI, Anthropic, Ollama, etc.)
```
