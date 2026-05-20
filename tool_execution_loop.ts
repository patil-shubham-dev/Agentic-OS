import { z } from "zod";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
import { exec, ChildProcess } from "child_process";
import { getUnifiedSystemPrompt } from "./system_prompts/unified_system_prompt";

// ==========================================
// Types & Interfaces
// ==========================================

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
}

export interface AgentExecutionState {
  taskId: string;
  taskPrompt: string;
  plan: PlanStep[];
  currentStepIndex: number;
  messageHistory: any[];
  toolLogs: any[];
  status: "idle" | "planning" | "running" | "awaiting_approval" | "completed" | "failed";
  pendingApproval?: {
    toolCallId: string;
    toolName: string;
    args: any;
  };
}

export interface SecuritySettings {
  allowTerminal: boolean;
  allowFilesystem: boolean;
  requireApprovalForDestructive: boolean;
  browserAutomationEnabled?: boolean;
}

export interface AgentRuntimeConfig {
  workspaceRoot: string;
  osType: string;
  homeDir: string;
  securitySettings: SecuritySettings;
  userProfile?: string;
  modelName?: string;
}

// Stream Event interface sent to frontend
export type RuntimeStreamEvent =
  | { type: "text"; text: string }
  | { type: "plan_update"; plan: PlanStep[]; currentStepIndex: number }
  | { type: "tool_call"; toolCallId: string; toolName: string; args: any }
  | { type: "tool_result"; toolCallId: string; toolName: string; result: any; success: boolean }
  | { type: "approval_required"; toolCallId: string; toolName: string; args: any }
  | { type: "status_update"; status: AgentExecutionState["status"] }
  | { type: "completed"; summary: string };

// ==========================================
// Tool Registry Implementation
// ==========================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  isDestructive: (args: any) => boolean;
  execute: (args: any, config: AgentRuntimeConfig) => Promise<{ success: boolean; data: any; error?: string }>;
}

export const toolRegistry: Record<string, ToolDefinition> = {};
const activeProcesses = new Map<string, ChildProcess>();

export function registerTool(tool: ToolDefinition) {
  toolRegistry[tool.name] = tool;
}

// ---------------------
// Filesystem Tools
// ---------------------

registerTool({
  name: "read_file",
  description: "Read contents of a file in the workspace. Optional offset and limit for large files.",
  parameters: z.object({
    file_path: z.string().describe("Path to the file relative to the workspace root"),
    offset: z.number().optional().describe("Starting line number (1-indexed)"),
    limit: z.number().optional().describe("Number of lines to read"),
  }),
  isDestructive: () => false,
  execute: async (args, config) => {
    try {
      const fullPath = path.resolve(config.workspaceRoot, args.file_path);
      const content = await fs.readFile(fullPath, "utf-8");
      
      if (args.offset !== undefined || args.limit !== undefined) {
        const lines = content.split("\n");
        const start = (args.offset ?? 1) - 1;
        const end = args.limit !== undefined ? start + args.limit : lines.length;
        const chunk = lines.slice(start, end).join("\n");
        return {
          success: true,
          data: {
            content: chunk,
            totalLines: lines.length,
            startLine: args.offset ?? 1,
            endLine: Math.min(lines.length, end),
          },
        };
      }

      return { success: true, data: { content } };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: "write_file",
  description: "Write full contents to a file in the workspace.",
  parameters: z.object({
    file_path: z.string().describe("Path relative to workspace root"),
    content: z.string().describe("New contents to write"),
  }),
  isDestructive: () => false, // Standard write is considered non-destructive unless overwriting system folders
  execute: async (args, config) => {
    try {
      const fullPath = path.resolve(config.workspaceRoot, args.file_path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, args.content, "utf-8");
      return { success: true, data: `Successfully wrote file to ${args.file_path}` };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: "create_file",
  description: "Create a new empty file.",
  parameters: z.object({
    file_path: z.string().describe("Path relative to workspace root"),
  }),
  isDestructive: () => false,
  execute: async (args, config) => {
    try {
      const fullPath = path.resolve(config.workspaceRoot, args.file_path);
      if (existsSync(fullPath)) {
        return { success: false, data: null, error: "File already exists" };
      }
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, "", "utf-8");
      return { success: true, data: `Successfully created empty file ${args.file_path}` };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: "create_directory",
  description: "Create a new directory recursively.",
  parameters: z.object({
    dir_path: z.string().describe("Directory path relative to workspace root"),
  }),
  isDestructive: () => false,
  execute: async (args, config) => {
    try {
      const fullPath = path.resolve(config.workspaceRoot, args.dir_path);
      await fs.mkdir(fullPath, { recursive: true });
      return { success: true, data: `Successfully created directory ${args.dir_path}` };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: "list_directory",
  description: "List contents of a directory in the workspace.",
  parameters: z.object({
    dir_path: z.string().describe("Directory path relative to workspace root (use '.' for root)"),
  }),
  isDestructive: () => false,
  execute: async (args, config) => {
    try {
      const fullPath = path.resolve(config.workspaceRoot, args.dir_path);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const items = entries.map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        isFile: e.isFile(),
      }));
      return { success: true, data: items };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: "search_files",
  description: "Find matching string occurrences inside files in the workspace.",
  parameters: z.object({
    query: z.string().describe("Substring or search term"),
    dir_path: z.string().optional().describe("Subdirectory to restrict search"),
  }),
  isDestructive: () => false,
  execute: async (args, config) => {
    try {
      const searchDir = args.dir_path ? path.resolve(config.workspaceRoot, args.dir_path) : config.workspaceRoot;
      const cmd = process.platform === "win32" 
        ? `findstr /s /i /n /c:"${args.query}" *.*` 
        : `grep -rnw "${searchDir}" -e "${args.query}" --exclude-dir={node_modules,.next,dist}`;
      
      const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        exec(cmd, { cwd: searchDir, maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
          // findstr returns non-zero code on no-match, which is fine
          resolve({ stdout, stderr });
        });
      });
      return { success: true, data: result.stdout.slice(0, 10000) || "No matches found." };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: "rename_path",
  description: "Rename or move a file or directory.",
  parameters: z.object({
    old_path: z.string().describe("Source path relative to workspace root"),
    new_path: z.string().describe("Target path relative to workspace root"),
  }),
  isDestructive: () => false,
  execute: async (args, config) => {
    try {
      const oldFullPath = path.resolve(config.workspaceRoot, args.old_path);
      const newFullPath = path.resolve(config.workspaceRoot, args.new_path);
      await fs.mkdir(path.dirname(newFullPath), { recursive: true });
      await fs.rename(oldFullPath, newFullPath);
      return { success: true, data: `Successfully moved/renamed ${args.old_path} to ${args.new_path}` };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: "delete_path",
  description: "Delete a file or directory recursively. THIS IS A DESTRUCTIVE OPERATION.",
  parameters: z.object({
    path: z.string().describe("Path to delete relative to workspace root"),
  }),
  isDestructive: () => true, // Destructive filesystem write
  execute: async (args, config) => {
    try {
      const fullPath = path.resolve(config.workspaceRoot, args.path);
      await fs.rm(fullPath, { recursive: true, force: true });
      return { success: true, data: `Successfully deleted ${args.path}` };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

// ---------------------
// Terminal Tools
// ---------------------

registerTool({
  name: "execute_terminal",
  description: "Execute a shell command. Optional unique process_id to enable stopping/killing the process later.",
  parameters: z.object({
    command: z.string().describe("Command to run"),
    process_id: z.string().optional().describe("Unique identifier for long-running processes"),
  }),
  isDestructive: (args) => {
    // Check if command is dangerous or mutated
    const dangerousCommands = ["rm -rf", "delete", "format", "mkfs", "kill -9", "shutdown", "reboot"];
    const cmdLower = args.command.toLowerCase();
    return dangerousCommands.some((c) => cmdLower.includes(c));
  },
  execute: async (args, config) => {
    return new Promise((resolve) => {
      try {
        const cmdProcess = exec(args.command, { cwd: config.workspaceRoot, maxBuffer: 1024 * 1024 * 10 });
        
        if (args.process_id) {
          activeProcesses.set(args.process_id, cmdProcess);
        }

        let stdout = "";
        let stderr = "";

        cmdProcess.stdout?.on("data", (data) => {
          stdout += data;
        });

        cmdProcess.stderr?.on("data", (data) => {
          stderr += data;
        });

        cmdProcess.on("close", (code) => {
          if (args.process_id) {
            activeProcesses.delete(args.process_id);
          }
          resolve({
            success: code === 0,
            data: {
              stdout,
              stderr,
              exitCode: code,
            },
          });
        });
      } catch (err: any) {
        resolve({ success: false, data: null, error: err.message });
      }
    });
  },
});

registerTool({
  name: "stop_terminal",
  description: "Stop or kill a running terminal process by its process_id.",
  parameters: z.object({
    process_id: z.string().describe("Identifier of process to kill"),
  }),
  isDestructive: () => false,
  execute: async (args) => {
    try {
      const process = activeProcesses.get(args.process_id);
      if (process) {
        process.kill();
        activeProcesses.delete(args.process_id);
        return { success: true, data: `Process ${args.process_id} terminated.` };
      }
      return { success: false, data: null, error: `Process with ID ${args.process_id} not found.` };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

// ---------------------
// Research Tools
// ---------------------

registerTool({
  name: "fetch_web",
  description: "Fetch contents from a URL. Useful for looking up APIs, docs, or web search.",
  parameters: z.object({
    url: z.string().url().describe("Target URL"),
  }),
  isDestructive: () => false,
  execute: async (args) => {
    try {
      const response = await fetch(args.url);
      const text = await response.text();
      return { success: true, data: text.slice(0, 5000) };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

// ---------------------
// Vision Tools
// ---------------------

registerTool({
  name: "analyze_image",
  description: "Provide multimodal analysis on an attached image or screenshot.",
  parameters: z.object({
    image_url: z.string().describe("URL or base64 data string"),
    prompt: z.string().optional().describe("Question to ask about the image"),
  }),
  isDestructive: () => false,
  execute: async (args) => {
    // Since actual image analysis is routed via multimodal provider, we stub it for local tool calling
    return { success: true, data: "Image accepted. Forwarded to vision models." };
  },
});


// ==========================================
// Tool Execution Loop Coordinator
// ==========================================

export class ToolExecutionLoop {
  private state: AgentExecutionState;
  private config: AgentRuntimeConfig;
  private onEvent: (event: RuntimeStreamEvent) => void;

  constructor(
    taskId: string,
    taskPrompt: string,
    config: AgentRuntimeConfig,
    onEvent: (event: RuntimeStreamEvent) => void
  ) {
    this.config = config;
    this.onEvent = onEvent;
    
    this.state = {
      taskId,
      taskPrompt,
      plan: [],
      currentStepIndex: 0,
      messageHistory: [],
      toolLogs: [],
      status: "idle",
    };
  }

  public getState() {
    return this.state;
  }

  // Set the plan steps initially (can be generated by Hermes planning logic or default mapping)
  public setPlan(steps: string[]) {
    this.state.plan = steps.map((step, idx) => ({
      id: `step_${idx}`,
      description: step,
      status: "pending",
    }));
    this.state.status = "running";
    this.onEvent({ type: "plan_update", plan: this.state.plan, currentStepIndex: this.state.currentStepIndex });
  }

  /**
   * Safe approval check for destructive actions and general shell commands
   */
  private async checkSafety(toolName: string, args: any, toolCallId: string): Promise<boolean> {
    const { securitySettings } = this.config;
    const tool = toolRegistry[toolName];
    if (!tool) return true;

    const isDestructive = tool.isDestructive(args);
    const isTerminal = toolName === "execute_terminal";

    // Block completely if security setting disables the capability
    if (isTerminal && !securitySettings.allowTerminal) {
      throw new Error(`Execution policy blocked tool call '${toolName}': Terminal execution is disabled.`);
    }
    if (isDestructive && !securitySettings.allowFilesystem) {
      throw new Error(`Execution policy blocked tool call '${toolName}': Destructive operations are disabled.`);
    }

    // Require manual approval if configured
    const requireApproval = securitySettings.requireApprovalForDestructive && (isDestructive || isTerminal);
    if (requireApproval) {
      this.state.status = "awaiting_approval";
      this.state.pendingApproval = { toolCallId, toolName, args };
      this.onEvent({ type: "status_update", status: "awaiting_approval" });
      this.onEvent({ type: "approval_required", toolCallId, toolName, args });
      return false; // Tells loop to pause and wait for user confirmation
    }

    return true; // Auto-approved
  }

  /**
   * Core tool execution logic
   */
  public async executeToolCall(toolCallId: string, toolName: string, args: any): Promise<any> {
    this.onEvent({ type: "tool_call", toolCallId, toolName, args });
    
    // Check security / approvals
    const isApproved = await this.checkSafety(toolName, args, toolCallId);
    if (!isApproved) {
      // Pause and return a special token/marker indicating loop should await resolution
      return { pausedForApproval: true };
    }

    const tool = toolRegistry[toolName];
    if (!tool) {
      const errorResult = { success: false, data: null, error: `Tool '${toolName}' not found in registry.` };
      this.onEvent({ type: "tool_result", toolCallId, toolName, result: errorResult, success: false });
      return errorResult;
    }

    try {
      const response = await tool.execute(args, this.config);
      this.state.toolLogs.push({ toolCallId, toolName, args, result: response });
      
      this.onEvent({
        type: "tool_result",
        toolCallId,
        toolName,
        result: response.data,
        success: response.success,
      });

      // Update the plan status depending on step context
      this.advancePlanStep(toolName, response.success);

      return response;
    } catch (err: any) {
      const errorResult = { success: false, data: null, error: err.message };
      this.onEvent({ type: "tool_result", toolCallId, toolName, result: errorResult, success: false });
      return errorResult;
    }
  }

  /**
   * Handle user response to an approval request
   */
  public async resolveApproval(toolCallId: string, approved: boolean): Promise<any> {
    if (!this.state.pendingApproval || this.state.pendingApproval.toolCallId !== toolCallId) {
      throw new Error("No pending approval found for this tool call ID.");
    }

    const { toolName, args } = this.state.pendingApproval;
    this.state.pendingApproval = undefined;
    this.state.status = "running";
    this.onEvent({ type: "status_update", status: "running" });

    if (!approved) {
      const rejectedResult = { success: false, error: "Operation rejected by user safety control." };
      this.onEvent({ type: "tool_result", toolCallId, toolName, result: rejectedResult, success: false });
      return rejectedResult;
    }

    // Acknowledge safety check is satisfied and execute
    const tool = toolRegistry[toolName];
    const response = await tool.execute(args, this.config);
    this.state.toolLogs.push({ toolCallId, toolName, args, result: response });
    
    this.onEvent({
      type: "tool_result",
      toolCallId,
      toolName,
      result: response.data,
      success: response.success,
    });

    this.advancePlanStep(toolName, response.success);
    return response;
  }

  private advancePlanStep(toolName: string, success: boolean) {
    if (this.state.plan.length === 0) return;
    
    const currentStep = this.state.plan[this.state.currentStepIndex];
    if (currentStep) {
      currentStep.status = success ? "completed" : "failed";
      
      // Move to next step if current succeeded
      if (success && this.state.currentStepIndex < this.state.plan.length - 1) {
        this.state.currentStepIndex++;
        const nextStep = this.state.plan[this.state.currentStepIndex];
        if (nextStep) nextStep.status = "running";
      }
      
      this.onEvent({
        type: "plan_update",
        plan: this.state.plan,
        currentStepIndex: this.state.currentStepIndex,
      });
    }
  }

  public completeExecution(summary: string) {
    this.state.status = "completed";
    this.onEvent({ type: "status_update", status: "completed" });
    this.onEvent({ type: "completed", summary });
  }

  public failExecution(errorMsg: string) {
    this.state.status = "failed";
    const currentStep = this.state.plan[this.state.currentStepIndex];
    if (currentStep) {
      currentStep.status = "failed";
      currentStep.error = errorMsg;
    }
    this.onEvent({ type: "status_update", status: "failed" });
  }
}
