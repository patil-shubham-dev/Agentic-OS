# Multi-Agent Orchestration Architecture

## Overview

This document describes the multi-agent collaboration system that powers AgentOS Studio. Multiple specialized AI agents work together under a Manager to fulfill complex user requests.

## Agent Roles

| Role | Responsibility |
|---|---|
| **Manager** | Understands the request, creates a plan, delegates tasks, consolidates results |
| **Coding** | Reads/modifies files, writes code, runs tests |
| **Design** | Builds UI, styling, image references |
| **Research** | Web searches, documentation lookups, data aggregation |
| **Vision** | Analyzes screenshots and images |
| **Fast Inference** | Lightweight classification, quick responses |

## Collaboration Flow

```
User Prompt
   ↓
Manager Agent
   ↓
Task Plan
   ↓
Delegate to Specialized Agents
   ↓
Agents Execute Tools
   ↓
Results Sent Back to Manager
   ↓
Manager Consolidates Final Output
   ↓
Workspace Streams Response
```

### Example: Building a Login Page

1. **Manager** analyzes the request: "Use this screenshot to build a login page"
2. **Vision** extracts layout details from the screenshot
3. **Design** creates the UI structure
4. **Coding** implements the code and edits files
5. **Research** retrieves Next.js best practices if needed
6. **Coding** runs tests
7. **Manager** summarizes results to the user

## Inter-Agent Communication

Agents communicate via structured messages through the **Inter-Agent Bus** (`inter-agent-bus.ts`):

```json
{
  "from": "Manager",
  "to": "Coding",
  "task": "Create login page in app/login/page.tsx using the design spec.",
  "context": {
    "spec": "Two-column layout with gradient background...",
    "referenceUrl": "https://example.com/design.png"
  }
}
```

Response format:
```json
{
  "from": "Coding",
  "to": "Manager",
  "status": "completed",
  "findings": "Created login page with responsive layout.",
  "filesChanged": ["app/login/page.tsx", "components/LoginForm.tsx"],
  "result": "Page created successfully, tests passing."
}
```

## Role Router

The **Role Router** (`role-router.ts`) is the bridge between Settings and Workspace:

1. Reads role→model assignments from Settings (stored in `role_assignments` table)
2. Loads the appropriate provider configuration (base URL, API key, headers)
3. Applies the role-specific system prompt from `system_prompts` table
4. Creates an AI client instance for the correct model
5. Executes the request using `streamText` or `generateText`

## Tool Execution

All agents share a common **Tool Registry** (`tool-registry.ts`):

- `read_file(path)` — Read file contents
- `write_file(path, content)` — Write/overwrite a file
- `search_files(pattern)` — Search file contents with ripgrep
- `list_directory(path)` — List files in a directory
- `create_file(path)` — Create a new empty file
- `rename_path(oldPath, newPath)` — Move/rename a file or folder
- `delete_path(path)` — Delete a file or folder
- `execute_terminal(command)` — Run a terminal command
- `stop_terminal(id)` — Stop a running terminal session
- `analyze_image(url)` — Analyze an image using Vision model
- `fetch_web(url)` — Fetch and extract content from a URL

## Security Enforcement

Before any tool execution, the **Security Guard** (`security-guard.ts`) checks:

1. **Terminal Execution** — Allowed? (from `security_settings.terminal`)
2. **Filesystem Writes** — Allowed? (from `security_settings.filesystem`)
3. **Destructive Actions** — Requires approval? (from `security_settings.approval`)
4. **Browser Automation** — Allowed? (from `security_settings.browser`)

If a security check fails, the tool execution is blocked and the user is prompted for approval.

## System Prompts

Role-specific system prompts are stored in:
- **Database**: `system_prompts` table (for runtime flexibility)
- **Filesystem**: `system_prompts/` directory (for version control)

The **System Prompt Loader** (`system-prompt-loader.ts`) checks the database first, then falls back to the filesystem.

## Implementation Status

### Current (v1)
- ✅ Role assignments in Settings UI
- ✅ Security controls in Settings UI
- ✅ Provider configuration with test/discover
- ✅ Runtime module scaffolding (all 7 modules exist)
- ✅ Type-safe integration with AI SDK v6

### Roadmap (v2)
- 🔄 Manager-level orchestration with dynamic task planning
- 🔄 Real inter-agent messaging during runtime
- 🔄 Concurrent agent execution
- 🔄 Streaming collaborative output

## Getting Started

1. Configure providers in **Settings > Providers**
2. Assign models to roles in **Settings > Roles**
3. Set security policies in **Settings > Security**
4. Use the **Workspace** chat to execute tasks — the runtime will automatically orchestrate the configured models
