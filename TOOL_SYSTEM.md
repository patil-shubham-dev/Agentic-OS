# Tool System

## Overview

Tools are the mechanism by which the AI agent interacts with the environment. The tool system provides registration, resolution, execution, permissions, and conversion.

---

## Architecture

```
ToolRegistry (multi-category)
  ├── Builtin tools (21 tools)
  ├── MCP tools (from MCP servers)
  ├── Plugin tools (from plugins)
  └── Task-scoped tools (per-invocation)

ToolExecutionPipeline
  ├── Validation (input schema)
  ├── Pre/post hooks
  ├── Permission evaluation
  └── Execution (ToolContext)

ToolConversion
  └── agentToolToToolDef → OpenAI ToolDef format
```

---

## Tool Registration

Tools are registered via `RuntimeOS`:

```typescript
// Builtin tools
registerBuiltinTools(runtimeOS) → ToolRegistry.register()

// MCP tools
MCPClient.listTools() → MCPToolAdapter.createMcpTool() → ToolRegistry.registerMcp()

// Plugin tools
ToolRegistry.registerPlugin()

// Task-scoped tools
ToolRegistry.registerTaskScoped()
```

**Resolution order**: `builtin` → `mcp` → `plugin` → `taskScoped`

---

## 21 Built-in Tools

| Tool | Description |
|------|-------------|
| `grep_files` | Search file contents via regex |
| `glob_files` | Find files by pattern |
| `read_file` | Read file contents |
| `write_file` | Write content to file |
| `edit_file` | Edit file (search-and-replace) |
| `run_command` | Execute shell command |
| `launch_browser` | Open browser |
| `browser_navigate` | Navigate to URL |
| `browser_screenshot` | Take screenshot |
| `browser_click` | Click element |
| `browser_fill` | Fill form field |
| `browser_execute_js` | Execute JavaScript |
| `browser_get_title` | Get page title |
| `browser_close` | Close browser |
| `browser_get_text` | Get page text |
| `browser_wait` | Wait for condition |
| `design_create_artifact` | Create design artifact |
| `design_add_version` | Add design version |
| `design_generate_preview` | Generate preview |
| `delegate_subtask` | Delegate to sub-agent |
| `run_skill` | Execute registered skill |

---

## AgentTool Interface

```typescript
interface AgentTool {
  name: string
  description: string
  inputSchema: JSONSchema  // Zod or custom schema
  execute: (ctx: ToolContext, input: Record<string, unknown>) => Promise<ToolResult>
  permissions?: (input: Record<string, unknown>) => PermissionResult
  capabilities?: ToolCapabilities
}
```

## ToolContext

```typescript
interface ToolContext {
  role: RuntimeRole
  executionMode?: string
  provider?: string
  model?: string
  signal?: AbortSignal
  env?: Record<string, string>
  cwd?: string
  traceId?: string
  messageHistory?: ChatMessage[]
  setProgress?: (msg: string) => void
  appendSystemMessage?: (msg: string) => void
}
```

## ToolResult

```typescript
interface ToolResult {
  data?: unknown        // Success result
  error?: string        // Error message
  isError: boolean      // Whether execution failed
}
```

---

## Execution Pipeline

```
ToolExecutionPipeline.execute(toolName, input, ctx, options)
  │
  ├─ emit('tool:start')
  ├─ ToolRegistry.resolve(toolName)
  ├─ Validator.validate(tool, input, ctx)
  │     └─ Schema validation via inputSchema
  ├─ Pre-execution hooks (registered + per-call)
  ├─ PermissionEngine.evaluate(tool, input, ctx)
  │     └─ Returns: "allow" | "deny" | "ask"
  │     └─ If "ask": ApprovalGate → user approves/denies
  ├─ tool.execute(ctx, input)
  │     └─ Actual tool implementation
  ├─ Post-execution hooks
  ├─ emit('tool:end')
  └─ return ToolResult
```

---

## Permissions

Each tool can define a `permissions()` function returning:

```typescript
type PermissionBehavior = "allow" | "deny" | "ask"
```

- **allow**: Execute without user confirmation
- **deny**: Block execution
- **ask**: Show ApprovalGate for user decision

Mode-based permission overrides are applied in `execution-mode.ts`:
- `autonomous`: Most tools auto-allowed
- `safe_mode`: Most tools require approval

---

## MCP Tool Integration

```
MCP Server
  → Stdio/SSE/WS/HTTP transport
  → JSON-RPC 2.0 protocol
  → MCPClient.initialize()
  → MCPClient.listTools()
  → MCPToolAdapter.createMcpTool(toolDef)
    → Returns AgentTool-compatible interface
  → ToolRegistry.registerMcp(tool)
```

Tools from MCP servers are indistinguishable from built-in tools to the agent.

---

## Tool Conversion

`agentToolToToolDef()` converts `AgentTool` → OpenAI-compatible `ToolDef`:

```typescript
{
  type: "function",
  function: {
    name: string,
    description: string,
    parameters: JSONSchema
  }
}
```

This format is sent to providers for function-calling support.
