// Tool type definitions for AgentOS autonomous runtime
export type ToolResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

export interface ToolDefinition {
  name: string;
  description: string;
  // args is a generic record; specific tools will define their own shape
  args: Record<string, unknown>;
  // The function that executes the tool; returns a promise of ToolResult
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}

// Registry map: tool name -> definition (populated at runtime)
export const toolRegistry: Record<string, ToolDefinition> = {};
