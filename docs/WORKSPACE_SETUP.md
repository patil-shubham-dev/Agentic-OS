# Workspace Setup

## Opening a Workspace

1. Click **File → Open Workspace** or the folder icon in the sidebar
2. Select your project directory
3. The file explorer populates with your project structure
4. The code editor becomes available for file editing

## Workspace Features

### File Explorer
- Browse files and folders in a tree view
- Right-click for: create, rename, delete, copy path
- Click to open in editor
- Double-click tabs to maximize/minimize

### Code Editor
- Monaco-based editor (same engine as VS Code)
- Syntax highlighting for 50+ languages
- Multiple tabs for open files
- Diff viewer for file changes
- Search within files (Ctrl+F)

### Terminal
- Built-in terminal for running commands
- The AI agent can execute commands in your workspace
- Output streams in real-time to the terminal block

### Git Integration
- Basic git operations available
- View changed files
- Commit and push from the UI

## Project Memory

AgenticOS can read project-specific configuration:

### `.agentic-rules`
Place this file in your project root. It contains rules and context that the AI agent reads before starting work.

Example:
```yaml
project: my-app
language: TypeScript
framework: React
style: Use functional components with hooks
conventions:
  - Use named exports
  - Prefix interfaces with I
  - Use PascalCase for components
```

### Memory Files
AgenticOS reads memory files from your project for additional context. Files like `CONTEXT.md`, `ARCHITECTURE.md` in the project root are automatically included.

## Execution Modes

Configure execution behavior per session:

| Mode | Best For |
|------|----------|
| **Autonomous** | Full-featured agent with all capabilities |
| **Fastest** | Quick responses, minimal tool usage |
| **Most Accurate** | Quality-critical tasks, runs tests |
| **Research Heavy** | Information gathering, no file mutations |
| **Human Guided** | Approval required for every action |
| **Safe Mode** | Read-only exploration |

Change modes via the dropdown in the chat panel header.

## Multi-Agent Setup

For multi-agent workflows:
1. Configure at least 2 providers in **Settings → Providers**
2. Assign different roles (manager, coder, researcher) in **Settings → Roles**
3. The orchestrator automatically routes tasks to the right agent

## MCP Server Setup

1. Open **Settings → MCP Servers**
2. Click **Add Server**
3. Choose transport type: stdio, SSE, WebSocket, or HTTP
4. Configure the server command/URL
5. MCP tools are automatically registered and available to agents
