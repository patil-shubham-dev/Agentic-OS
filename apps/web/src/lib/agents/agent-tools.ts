import type { ToolDef } from "@/lib/ai-service"

export function getTools(role: string): ToolDef[] {
  const baseTools: ToolDef[] = [
    {
      type: "function",
      function: {
        name: "grep_files",
        description: "Search file contents with a regex pattern in the workspace",
        parameters: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Regex pattern to search" },
            include: { type: "string", description: "Comma-separated file extensions (e.g. ts,tsx)" },
          },
          required: ["pattern"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "glob_files",
        description: "Find files matching a glob pattern in the workspace",
        parameters: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Glob pattern (e.g. src/**/*.ts)" },
          },
          required: ["pattern"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read the contents of a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path relative to workspace root" },
          },
          required: ["path"],
        },
      },
    },
  ]

  // Agents that can modify files
  if (role === "coding" || role === "coder" || role === "design" || role === "runtime") {
    baseTools.push(
      {
        type: "function",
        function: {
          name: "write_file",
          description: "Write content to a file (creates directories if needed)",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path relative to workspace root" },
              content: { type: "string", description: "File content to write" },
            },
            required: ["path", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "edit_file",
          description: "Apply targeted text replacements in an existing file using one or more exact old_content/new_content edits",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path relative to the workspace root" },
              edits: {
                type: "array",
                description: "Minimal exact replacements to apply in order",
                items: {
                  type: "object",
                  properties: {
                    old_content: { type: "string", description: "Exact text to find" },
                    new_content: { type: "string", description: "Replacement text" },
                  },
                  required: ["old_content", "new_content"],
                },
              },
              file: { type: "string", description: "Backward-compatible absolute file path" },
              old_string: { type: "string", description: "Backward-compatible text to find" },
              new_string: { type: "string", description: "Backward-compatible replacement text" },
            },
            required: [],
          },
        },
      },
    )
  }

  // All agents can run commands
  baseTools.push({
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command in the workspace directory",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command to run" },
          args: { type: "array", items: { type: "string" }, description: "Command arguments" },
        },
        required: ["command"],
      },
    },
  })

  // Agents that can create/edit design artifacts (OpenDesign integration)
  if (role === "design") {
    baseTools.push(
      {
        type: "function",
        function: {
          name: "design_create_artifact",
          description: "Create a new design artifact in the DesignWorkspace with component code",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Name for the design artifact (e.g. 'Button Component')" },
              description: { type: "string", description: "Description of the design" },
              code: { type: "string", description: "The full React + Tailwind component code" },
              label: { type: "string", description: "Version label (e.g. 'Initial design', 'Redesigned')" },
              tags: { type: "array", items: { type: "string" }, description: "Tags for categorization (e.g. ui, component, button)" },
            },
            required: ["name", "description", "code", "label"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "design_add_version",
          description: "Add a new version to an existing design artifact",
          parameters: {
            type: "object",
            properties: {
              artifact_id: { type: "string", description: "The ID of the design artifact to update" },
              code: { type: "string", description: "Updated component code" },
              label: { type: "string", description: "Version label describing the change" },
              changes: { type: "string", description: "Description of what changed in this version" },
            },
            required: ["artifact_id", "code", "label", "changes"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "design_generate_preview",
          description: "Generate an HTML preview string for a component design",
          parameters: {
            type: "object",
            properties: {
              code: { type: "string", description: "Component code to generate a preview for" },
            },
            required: ["code"],
          },
        },
      },
    )
  }

  // Hermes-style browser automation tools for browser and design roles
  if (role === "browser" || role === "qa" || role === "design") {
    baseTools.push(
      {
        type: "function",
        function: {
          name: "launch_browser",
          description: "Launch a headless browser session and navigate to a URL",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: "URL to navigate to" },
            },
            required: ["url"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "browser_navigate",
          description: "Navigate the browser to a new URL",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Browser session ID" },
              url: { type: "string", description: "Destination URL" },
            },
            required: ["session_id", "url"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "browser_screenshot",
          description: "Take a screenshot of the current browser page (returns base64 PNG data URI)",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Browser session ID" },
            },
            required: ["session_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "browser_click",
          description: "Click an element in the browser page matched by a CSS selector",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Browser session ID" },
              selector: { type: "string", description: "CSS selector for the element to click" },
            },
            required: ["session_id", "selector"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "browser_fill",
          description: "Fill a form field with a value",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Browser session ID" },
              selector: { type: "string", description: "CSS selector for the input field" },
              value: { type: "string", description: "Value to type into the field" },
            },
            required: ["session_id", "selector", "value"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "browser_execute_js",
          description: "Execute JavaScript in the browser page and return the result as a string",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Browser session ID" },
              js: { type: "string", description: "JavaScript code to execute" },
            },
            required: ["session_id", "js"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "browser_get_title",
          description: "Get the current page title from the browser",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Browser session ID" },
            },
            required: ["session_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "browser_get_text",
          description: "Get the text content of an element matched by CSS selector",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Browser session ID" },
              selector: { type: "string", description: "CSS selector for the element" },
            },
            required: ["session_id", "selector"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "browser_wait",
          description: "Wait for an element to appear in the DOM (useful for page transitions)",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Browser session ID" },
              selector: { type: "string", description: "CSS selector to wait for" },
              timeout: { type: "number", description: "Max wait time in milliseconds (default 5000)" },
            },
            required: ["session_id", "selector"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "browser_close",
          description: "Close a browser session and release resources",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Browser session ID to close" },
            },
            required: ["session_id"],
          },
        },
      },
    )
  }

  // ── Manager-Only: Sub-agent delegation ──
  if (role === "manager") {
    baseTools.push({
      type: "function",
      function: {
        name: "delegate_subtask",
        description: "Delegate a subtask to a specialized sub-agent with its own isolated context window. Use this for exploration, planning, verification, or general multi-step tasks that benefit from a fresh, focused context.",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Sub-agent type: 'explore' (read-only codebase search), 'plan' (read-only architecture planning), 'verify' (run tests/lint), 'general' (multi-step implementation)",
              enum: ["explore", "plan", "verify", "general"],
            },
            task: {
              type: "string",
              description: "The task prompt for the sub-agent. Be specific: include file paths, patterns to search, expected output format, and success criteria. The sub-agent receives ONLY this prompt — not the full conversation.",
            },
            model: {
              type: "string",
              description: "Optional: Override the model used for this sub-agent (e.g., 'claude-sonnet-4-20250514' for complex planning tasks). Defaults to the manager's model.",
            },
          },
          required: ["type", "task"],
        },
      },
    })
  }

  return baseTools
}
