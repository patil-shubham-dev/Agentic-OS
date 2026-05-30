# Tool Usage

## Overview

Tools are how the AI agent interacts with your workspace. AgenticOS provides 21 built-in tools for file operations, command execution, web browsing, and more.

## Built-in Tools

### File Tools

| Tool | Description | Example |
|------|-------------|---------|
| `read_file` | Read file contents | `read_file("src/index.ts")` |
| `write_file` | Create or overwrite a file | `write_file("hello.ts", "console.log('hi')")` |
| `edit_file` | Search-and-replace edits | `edit_file("file.ts", "old", "new")` |
| `grep_files` | Regex search in files | `grep_files("logger", "*.ts")` |
| `glob_files` | Find files by pattern | `glob_files("**/*.tsx")` |

### Command Tools

| Tool | Description |
|------|-------------|
| `run_command` | Execute shell commands in workspace |

### Browser Tools

| Tool | Description |
|------|-------------|
| `launch_browser` | Open a browser instance |
| `browser_navigate` | Navigate to URL |
| `browser_click` | Click page element |
| `browser_fill` | Fill form field |
| `browser_screenshot` | Take screenshot |
| `browser_get_text` | Extract page text |
| `browser_get_title` | Get page title |
| `browser_execute_js` | Run JavaScript in page |
| `browser_close` | Close browser |
| `browser_wait` | Wait for condition |

### Delegation Tools

| Tool | Description |
|------|-------------|
| `delegate_subtask` | Delegate work to sub-agent |
| `run_skill` | Execute registered skill |

### Design Tools

| Tool | Description |
|------|-------------|
| `design_create_artifact` | Create design artifact |
| `design_add_version` | Add version |
| `design_generate_preview` | Generate preview |

## Tool Permissions

Tools have permission levels:

- **Allow**: Execute automatically
- **Deny**: Block execution
- **Ask**: Prompt for user approval

Configure tool permissions per tool or per execution mode.

## MCP Tools

Tools from MCP servers appear automatically. They work identically to built-in tools. To add MCP tools:

1. Set up an MCP server in **Settings → MCP Servers**
2. The server's tools are auto-discovered and registered
3. Agents can use them without additional configuration

## Tool Execution Pipeline

When an agent calls a tool:

1. **Validation**: Input schema checked
2. **Permission**: Access evaluated
3. **Execution**: Tool runs with context
4. **Result**: Returned to agent

## Execution Modes and Tool Access

| Mode | File Mutations | Browser | Commands |
|------|---------------|---------|----------|
| autonomous | Yes | Yes | Yes |
| fastest | Yes | Yes | Yes |
| most_accurate | Yes | Yes | Yes (test only) |
| research_heavy | No | Yes | Yes |
| human_guided | Yes | Yes | Yes |
| safe_mode | No | No | No |

## Viewing Tool Results

Tool execution appears as cards in the conversation:

- **File edits**: Show diffs with additions/deletions
- **Commands**: Terminal output with exit codes
- **Browser**: Screenshots and page text
- **Tool progress**: Live status updates
