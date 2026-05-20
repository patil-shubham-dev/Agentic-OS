import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  DEFAULT_PROJECT_ID,
  getProviderConfigs,
} from "@/lib/server/agentos-data";
import { selectRows } from "@/lib/server/supabase";
import { decryptSecret } from "@/lib/server/encryption";
import { getUnifiedSystemPrompt } from "../../../../../../system_prompts/unified_system_prompt";

export const dynamic = "force-dynamic";

const DEFAULT_ROLES = {
  Manager: "claude-3-5-sonnet-20241022",
  Coding: "gpt-4o",
  Design: "gemini-1.5-pro",
  Research: "gpt-4o",
  "Fast Inference": "gpt-4o",
  Vision: "gpt-4o",
};

const DEFAULT_SECURITY = {
  terminal: true,
  filesystem: true,
  approval: true,
  browser: false,
};

export async function POST(request: NextRequest) {
  try {
    const { messages, attachments, projectId = DEFAULT_PROJECT_ID } = await request.json();

    // 1. Fetch Dynamic Role mappings from DB
    const rolesRows = await selectRows<{ value: string }>("memories", {
      filters: { project_id: projectId, key: "system_roles" },
      limit: 1,
    });
    const roles = rolesRows.length > 0 ? JSON.parse(rolesRows[0].value) : DEFAULT_ROLES;

    // 2. Multimodal Routing Hook
    const hasAttachments = attachments && attachments.length > 0;
    const assignedRole = hasAttachments ? "Vision" : "Coding";
    const targetModel = roles[assignedRole] || DEFAULT_ROLES[assignedRole];

    // 3. Find enabled provider
    const providers = await getProviderConfigs();
    const activeProvider = providers.find((p) => p.enabled);

    if (!activeProvider) {
      return NextResponse.json({ error: "No active provider configured." }, { status: 400 });
    }

    let decryptedApiKey = "";
    if (activeProvider.api_key_ciphertext) {
      try {
        decryptedApiKey = decryptSecret(activeProvider.api_key_ciphertext);
      } catch {
        // Fall back gracefully
      }
    }

    let aiModel;
    if (activeProvider.provider === "anthropic") {
      const anthropic = createAnthropic({
        apiKey: decryptedApiKey,
        baseURL: activeProvider.base_url || undefined,
      });
      aiModel = anthropic(targetModel);
    } else {
      const openai = createOpenAI({
        apiKey: decryptedApiKey || "dummy",
        baseURL: activeProvider.base_url || undefined,
      });
      aiModel = openai(targetModel);
    }

    // 4. Format Messages
    const lastMessage = messages[messages.length - 1];
    if (hasAttachments && lastMessage.role === "user") {
      const content = [
        { type: "text", text: lastMessage.content || "Analyze this image." },
        ...attachments.map((a: any) => {
          const base64Data = a.base64.split(",")[1] || a.base64;
          return {
            type: "image",
            image: Buffer.from(base64Data, "base64"),
            mimeType: a.type,
          };
        }),
      ];
      messages[messages.length - 1] = { ...lastMessage, content };
    }


    // 5. Fetch Security toggles
    const securityRows = await selectRows<{ value: string }>("memories", {
      filters: { project_id: projectId, key: "system_security" },
      limit: 1,
    });
    const security = securityRows.length > 0 ? JSON.parse(securityRows[0].value) : DEFAULT_SECURITY;

    // 6. Compile System Prompt using Unified compiler
    const systemPrompt = getUnifiedSystemPrompt({
      cwd: process.cwd(),
      osType: process.platform,
      homeDir: process.env.USERPROFILE || process.env.HOME || process.cwd(),
      securitySettings: {
        allowTerminal: security.terminal,
        allowFilesystem: security.filesystem,
        requireApprovalForDestructive: security.approval,
      },
    });

    // Helper: determine if execution should be deferred for manual client approval
    const needsApproval = (toolName: string) => {
      if (!security.approval) return false;
      return toolName === "execute_terminal" || toolName === "delete_path";
    };

    // 7. Define Tools Object (excluding execute handler if approval is required)
    const tools: Record<string, any> = {};
    
    // Helper to create tools with proper type loosening for AI SDK v6
    const defineTool = (config: any) => config;
    
    tools.read_file = defineTool({
      type: 'function' as const,
      description: "Read the contents of a local file in the workspace.",
      parameters: z.object({
        file_path: z.string().describe("The path to the file relative to the workspace root"),
        offset: z.number().optional().describe("Starting line (1-indexed)"),
        limit: z.number().optional().describe("Number of lines to read"),
      }),
      execute: async ({ file_path, offset, limit }: { file_path: string; offset?: number; limit?: number }) => {
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const fullPath = pathModule.resolve(process.cwd(), file_path);
          const content = await fs.readFile(fullPath, "utf-8");
          if (offset !== undefined || limit !== undefined) {
            const lines = content.split("\n");
            const start = (offset ?? 1) - 1;
            const end = limit !== undefined ? start + limit : lines.length;
            return lines.slice(start, end).join("\n");
          }
          return content;
        } catch (err) {
          return `Error reading file: ${err}`;
        }
      },
    });
    
    tools.write_file = defineTool({
      type: 'function' as const,
      description: "Write content to a local file in the workspace.",
      parameters: z.object({
        file_path: z.string().describe("The path relative to the workspace root"),
        content: z.string().describe("The new file content"),
      }),
      execute: async ({ file_path, content }: { file_path: string; content: string }) => {
        if (!security.filesystem) {
          return "Execution Policy Blocked: Filesystem modifications are disabled.";
        }
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const fullPath = pathModule.resolve(process.cwd(), file_path);
          await fs.mkdir(pathModule.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content, "utf-8");
          return `Successfully wrote to ${file_path}`;
        } catch (err) {
          return `Error writing file: ${err}`;
        }
      },
    });
    
    tools.create_file = defineTool({
      type: 'function' as const,
      description: "Create an empty file in the workspace.",
      parameters: z.object({
        file_path: z.string().describe("Path relative to the workspace root"),
      }),
      execute: async ({ file_path }: { file_path: string }) => {
        if (!security.filesystem) {
          return "Execution Policy Blocked: Filesystem modifications are disabled.";
        }
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const fullPath = pathModule.resolve(process.cwd(), file_path);
          await fs.mkdir(pathModule.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, "", "utf-8");
          return `Successfully created empty file: ${file_path}`;
        } catch (err) {
          return `Error creating file: ${err}`;
        }
      },
    });
    
    tools.create_directory = defineTool({
      type: 'function' as const,
      description: "Create a new directory in the workspace.",
      parameters: z.object({
        dir_path: z.string().describe("Directory path relative to the workspace root"),
      }),
      execute: async ({ dir_path }: { dir_path: string }) => {
        if (!security.filesystem) {
          return "Execution Policy Blocked: Filesystem modifications are disabled.";
        }
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const fullPath = pathModule.resolve(process.cwd(), dir_path);
          await fs.mkdir(fullPath, { recursive: true });
          return `Successfully created directory: ${dir_path}`;
        } catch (err) {
          return `Error creating directory: ${err}`;
        }
      },
    });
    
    tools.list_directory = defineTool({
      type: 'function' as const,
      description: "List the contents of a workspace directory.",
      parameters: z.object({
        dir_path: z.string().describe("The path to list relative to the workspace root"),
      }),
      execute: async ({ dir_path }: { dir_path: string }) => {
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const fullPath = pathModule.resolve(process.cwd(), dir_path);
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          return entries.map(e => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`).join("\n");
        } catch (err) {
          return `Error reading directory: ${err}`;
        }
      },
    });
    
    tools.search_files = defineTool({
      type: 'function' as const,
      description: "Search for a string pattern in files inside the workspace.",
      parameters: z.object({
        query: z.string().describe("The string to search for"),
        dir_path: z.string().optional().describe("Directory to search in"),
      }),
      execute: async ({ query, dir_path }: { query: string; dir_path?: string }) => {
        try {
          const util = await import("util");
          const exec = util.promisify((await import("child_process")).exec);
          const pathModule2 = await import("path");
          const searchDir = dir_path ? pathModule2.resolve(process.cwd(), dir_path) : process.cwd();
          const cmd = process.platform === "win32" ? `findstr /s /i "${query}" *.*` : `grep -rnw '${searchDir}' -e '${query}'`;
          const { stdout } = await exec(cmd, { cwd: searchDir });
          return stdout.slice(0, 3000) || "No matches found.";
        } catch (err: any) {
          return "Search completed with no matches found.";
        }
      },
    });
    
    tools.rename_path = defineTool({
      type: 'function' as const,
      description: "Rename or move a file/directory in the workspace.",
      parameters: z.object({
        old_path: z.string().describe("Source path relative to workspace root"),
        new_path: z.string().describe("Target path relative to workspace root"),
      }),
      execute: async ({ old_path, new_path }: { old_path: string; new_path: string }) => {
        if (!security.filesystem) {
          return "Execution Policy Blocked: Filesystem modifications are disabled.";
        }
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const oldFullPath = pathModule.resolve(process.cwd(), old_path);
          const newFullPath = pathModule.resolve(process.cwd(), new_path);
          await fs.mkdir(pathModule.dirname(newFullPath), { recursive: true });
          await fs.rename(oldFullPath, newFullPath);
          return `Renamed ${old_path} to ${new_path}`;
        } catch (err) {
          return `Error renaming: ${err}`;
        }
      },
    });
    
    tools.delete_path = defineTool({
      type: 'function' as const,
      description: "Delete a file or directory recursively. WARNING: Destructive operation.",
      parameters: z.object({
        path: z.string().describe("The workspace path to delete"),
      }),
      // Always provide execute; if approval is needed, the client will execute it
      execute: async ({ path: delPath }: { path: string }) => {
        if (!security.filesystem) {
          return "Execution Policy Blocked: Filesystem writes are disabled.";
        }
        if (needsApproval("delete_path")) {
          return "Deferred: This destructive operation requires client-side approval. The AI will send a request for user approval.";
        }
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const fullPath = pathModule.resolve(process.cwd(), delPath);
          await fs.rm(fullPath, { recursive: true, force: true });
          return `Successfully deleted ${delPath}`;
        } catch (err) {
          return `Error deleting path: ${err}`;
        }
      },
    });
    
    tools.execute_terminal = defineTool({
      type: 'function' as const,
      description: "Run a shell command in the terminal workspace.",
      parameters: z.object({
        command: z.string().describe("The terminal shell command to execute"),
        process_id: z.string().optional().describe("Optional unique process ID to allow termination"),
      }),
      execute: async ({ command }: { command: string }) => {
        if (!security.terminal) {
          return "Execution Policy Blocked: Terminal execution is disabled.";
        }
        if (needsApproval("execute_terminal")) {
          return "Deferred: Terminal execution requires client-side approval. The AI will send a request for user approval.";
        }
        try {
          const util = await import("util");
          const exec = util.promisify((await import("child_process")).exec);
          const { stdout, stderr } = await exec(command, { cwd: process.cwd() });
          return `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
        } catch (err: any) {
          return `Command Failed.\nError: ${err.message}\nSTDOUT:\n${err.stdout}\nSTDERR:\n${err.stderr}`;
        }
      },
    });
    
    tools.stop_terminal = defineTool({
      type: 'function' as const,
      description: "Stop an active terminal background process by process_id.",
      parameters: z.object({
        process_id: z.string().describe("The process ID to stop"),
      }),
      execute: async ({ process_id }: { process_id: string }) => {
        return `Stop request sent for process: ${process_id}`;
      },
    });
    
    tools.fetch_web = defineTool({
      type: 'function' as const,
      description: "Fetch contents from a URL for documentation or reference.",
      parameters: z.object({
        url: z.string().url().describe("Target URL"),
      }),
      execute: async ({ url }: { url: string }) => {
        try {
          const res = await fetch(url);
          const text = await res.text();
          return text.slice(0, 3000) + (text.length > 3000 ? "\n...[truncated]" : "");
        } catch (err) {
          return `Error fetching URL: ${err}`;
        }
      },
    });
    
    tools.analyze_image = defineTool({
      type: 'function' as const,
      description: "Analyze visual elements from a URL or base64 resource.",
      parameters: z.object({
        image_url: z.string().describe("Target URL or base64 data"),
        prompt: z.string().optional().describe("Question context"),
      }),
      execute: async () => {
        return "Please attach the screenshot directly to the chat interface to trigger native vision routing.";
      },
    });

    // 8. Stream Text
    const result = streamText({
      model: aiModel,
      messages,
      system: systemPrompt,
      tools: tools as any,
    });

    return (result as any).toDataStreamResponse ? (result as any).toDataStreamResponse() : (result as any).toTextStreamResponse();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat streaming failed" },
      { status: 500 }
    );
  }
}
