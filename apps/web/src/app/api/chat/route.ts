import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_PROJECT_ID } from "@/lib/server/agentos-data";
import { resolveModelForRole } from "@/lib/runtime/role-router";
import { loadSecuritySettings, loadRoleMappings } from "@/lib/runtime/settings-loader";
import { loadSystemPromptForRole } from "@/lib/runtime/system-prompt-loader";
import { SecurityGuard } from "@/lib/runtime/security-guard";
import type { StreamingChunk } from "@/lib/runtime/types";
import { BaseUniversalProvider } from "@/lib/runtime/providers/base-provider";

export const dynamic = "force-dynamic";

/**
 * Detect the best role for a user message by analyzing content + attachments.
 * Priority: Vision > Design > Research > Fast > Coding > Manager
 */
function detectRole(messages: any[], hasAttachments: boolean): string {
  if (hasAttachments) return "Vision";

  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase?.() || "";

  if (/design|ui|ux|layout|css|styling|frontend|appearance|beautif|looks|theme|color|palette|typography|responsive/i.test(lastMsg)) {
    return "Design";
  }
  if (/research|search|find|look up|documentation|read the docs|what is|how does|investigate|explore|learn about|understand/i.test(lastMsg)) {
    return "Research";
  }
  if (/quick|fast|simple|classif|categoriz|label|tag|extract|summarize|short|brief|format|parse/i.test(lastMsg)) {
    return "Fast Inference";
  }
  if (/code|implement|refactor|write|create|modify|fix|bug|test|function|component|class|api|endpoint|route/i.test(lastMsg)) {
    return "Coding";
  }
  if (/plan|orchestrat|multi.?step|complex|architect|design\s*system|architecture|strategy/i.test(lastMsg)) {
    return "Manager";
  }

  return "Coding";
}

function detectRoleFromTask(task: string): string {
  const lower = task.toLowerCase();
  if (/vision|image|screenshot|picture|photo|analyze.*image/i.test(lower)) return "Vision";
  if (/design|ui|ux|layout|css|styling|frontend|appearance|beautif|looks|theme|color|palette|typography|responsive/i.test(lower)) return "Design";
  if (/research|search|find|look up|documentation|read the docs|what is|how does|investigate|explore|learn about|understand/i.test(lower)) return "Research";
  if (/quick|fast|simple|classif|categoriz|label|tag|extract|summarize|short|brief|format|parse/i.test(lower)) return "Fast Inference";
  if (/code|implement|refactor|write|create|modify|fix|bug|test|function|component|class|api|endpoint|route/i.test(lower)) return "Coding";
  if (/plan|orchestrat|multi.?step|complex|architect|design\s*system|architecture|strategy/i.test(lower)) return "Manager";
  return "Coding";
}

// Permission check — returns true when client-side approval needed
function needsApproval(
  securityGuard: SecurityGuard,
  toolName: string,
  args: any,
): boolean {
  const alwaysDestructive = [
    "write_file",
    "rename_path",
    "create_directory",
    "delete_path",
  ];
  if (alwaysDestructive.includes(toolName)) {
    return securityGuard.checkApprovalRequired(toolName, true);
  }
  const isDestructive =
    toolName === "execute_terminal" &&
    /rm\s+-rf|delete|format|shutdown|dd\s|mkfs/i.test(args.command || "");
  return securityGuard.checkApprovalRequired(toolName, isDestructive);
}

function toolResult(success: boolean, message: string) {
  return { success, message };
}

// Multi-step tool execution loop over a provider
async function* executeWithToolLoop(
  provider: BaseUniversalProvider,
  modelId: string,
  messages: { role: string; content: unknown }[],
  system: string,
  tools: Record<string, any>,
  maxSteps = 10
): AsyncGenerator<StreamingChunk> {
  let currentMessages: { role: string; content: unknown; tool_call_id?: string }[] = [...messages];

  for (let step = 0; step < maxSteps; step++) {
    let textContent = "";
    const toolCalls: { name: string; args: unknown; id: string }[] = [];

    for await (const chunk of provider.execute(modelId, currentMessages, system, tools)) {
      if (chunk.type === "text") {
        textContent += chunk.content || "";
        yield chunk;
      } else if (chunk.type === "tool_call" && chunk.toolName) {
        toolCalls.push({
          name: chunk.toolName,
          args: chunk.args,
          id: chunk.toolCallId || `call_${step}_${chunk.toolName}`,
        });
      } else if (chunk.type === "done") {
        if (toolCalls.length === 0) {
          yield chunk;
          return;
        }
      } else if (chunk.type === "error") {
        yield chunk;
        return;
      }
    }

    if (toolCalls.length === 0) return;

    const assistantMsg: any = { role: "assistant" };
    if (textContent) assistantMsg.content = textContent;
    assistantMsg.tool_calls = toolCalls.map((tc) => ({
      id: tc.id,
      type: "function",
      function: { name: tc.name, arguments: JSON.stringify(tc.args) },
    }));
    currentMessages.push(assistantMsg);

    for (const tc of toolCalls) {
      const toolDef = tools[tc.name];
      let result: any;
      try {
        result = toolDef?.execute ? await toolDef.execute(tc.args) : { error: `Unknown tool: ${tc.name}` };
      } catch (err) {
        result = { error: String(err) };
      }
      currentMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }
}

// POST /api/chat — stream AI response with role routing & tools
export async function POST(request: NextRequest) {
  try {
    const { messages, attachments, projectId = DEFAULT_PROJECT_ID } =
      await request.json();

    const hasAttachments = attachments && attachments.length > 0;
    const assignedRole = detectRole(messages, hasAttachments);

    const roleMappings = await loadRoleMappings(projectId);
    const securitySettings = await loadSecuritySettings(projectId);
    const securityGuard = new SecurityGuard(securitySettings);

    const resolved = await resolveModelForRole(assignedRole);

    const systemPrompt = await loadSystemPromptForRole(
      assignedRole,
      securitySettings,
    );

    const lastMessage = messages[messages.length - 1];
    if (hasAttachments && lastMessage.role === "user") {
      const content: any[] = [
        { type: "text", text: lastMessage.content || "Analyze this image." },
      ];
      for (const a of attachments) {
        const base64Data = a.base64?.split(",")[1] || a.base64 || "";
        content.push({
          type: "image_url",
          image_url: { url: `data:${a.type || "image/png"};base64,${base64Data}` },
        });
      }
      messages[messages.length - 1] = { ...lastMessage, content };
    }

    // Build tools
    const tools: Record<string, any> = {};

    tools.read_file = {
      type: "function" as const,
      description:
        "Read the contents of a file in the workspace. Use this instead of cat or head/tail.",
      parameters: z.object({
        file_path: z.string().describe("The path to the file relative to the workspace root"),
        offset: z.number().optional().describe("Starting line number (1-indexed)"),
        limit: z.number().optional().describe("Number of lines to read from offset"),
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
            return toolResult(true, lines.slice(start, end).join("\n"));
          }
          return toolResult(true, content);
        } catch (err) {
          return toolResult(false, `Error reading file: ${err}`);
        }
      },
    };

    tools.write_file = {
      type: "function" as const,
      description:
        "Write or overwrite content to a file. Use for creating new files or replacing entire file content.",
      parameters: z.object({
        file_path: z.string().describe("The path relative to the workspace root"),
        content: z.string().describe("The new file content"),
      }),
      execute: async ({ file_path, content }: { file_path: string; content: string }) => {
        const fsCheck = securityGuard.checkFilesystemPermission(file_path, false);
        if (!fsCheck.allowed) return toolResult(false, fsCheck.reason ?? "Permission denied");
        if (needsApproval(securityGuard, "write_file", { file_path })) {
          return toolResult(false, "Deferred: Writing files requires client-side approval.");
        }
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const fullPath = pathModule.resolve(process.cwd(), file_path);
          await fs.mkdir(pathModule.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content, "utf-8");
          return toolResult(true, `Wrote ${file_path}`);
        } catch (err) {
          return toolResult(false, `Error writing file: ${err}`);
        }
      },
    };

    tools.create_directory = {
      type: "function" as const,
      description: "Create a new directory. Creates parent directories if needed.",
      parameters: z.object({
        dir_path: z.string().describe("Directory path relative to the workspace root"),
      }),
      execute: async ({ dir_path }: { dir_path: string }) => {
        const fsCheck = securityGuard.checkFilesystemPermission(dir_path, false);
        if (!fsCheck.allowed) return toolResult(false, fsCheck.reason ?? "Permission denied");
        if (needsApproval(securityGuard, "create_directory", { dir_path })) {
          return toolResult(false, "Deferred: Creating directories requires client-side approval.");
        }
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const fullPath = pathModule.resolve(process.cwd(), dir_path);
          await fs.mkdir(fullPath, { recursive: true });
          return toolResult(true, `Created directory: ${dir_path}`);
        } catch (err) {
          return toolResult(false, `Error creating directory: ${err}`);
        }
      },
    };

    tools.list_directory = {
      type: "function" as const,
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
          return toolResult(
            true,
            entries.map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`).join("\n"),
          );
        } catch (err) {
          return toolResult(false, `Error reading directory: ${err}`);
        }
      },
    };

    tools.search_files = {
      type: "function" as const,
      description:
        "Search the content of files for a string or regex pattern. Use instead of grep/rg.",
      parameters: z.object({
        pattern: z.string().describe("Search pattern (case-insensitive)"),
        include: z.string().optional().describe("File glob pattern (e.g. *.ts, *.js)"),
        dir_path: z.string().optional().describe("Directory to search within"),
      }),
      execute: async ({ pattern, include, dir_path }: { pattern: string; include?: string; dir_path?: string }) => {
        try {
          const pathModule = await import("path");
          const searchDir = dir_path ? pathModule.resolve(process.cwd(), dir_path) : process.cwd();
          const isWin = process.platform === "win32";
          const globFilter = include
            ? isWin ? `*.${include.replace("*.", "")}` : `--include="${include}"`
            : "";
          const cmd = isWin
            ? `findstr /s /i /n "${pattern}" ${searchDir}\\${globFilter || "*.*"}`
            : `grep -rn -i ${globFilter} "${pattern}" "${searchDir}" | head -200`;
          const util = await import("util");
          const exec = util.promisify((await import("child_process")).exec);
          const { stdout } = await exec(cmd, { cwd: searchDir, shell: isWin ? "cmd.exe" : "/bin/bash" });
          const results = stdout.slice(0, 5000) || "No matches found.";
          return toolResult(true, results);
        } catch {
          return toolResult(true, "No matches found.");
        }
      },
    };

    tools.rename_path = {
      type: "function" as const,
      description: "Rename or move a file/directory in the workspace.",
      parameters: z.object({
        old_path: z.string().describe("Source path relative to workspace root"),
        new_path: z.string().describe("Target path relative to workspace root"),
      }),
      execute: async ({ old_path, new_path }: { old_path: string; new_path: string }) => {
        const fsCheck = securityGuard.checkFilesystemPermission(new_path, false);
        if (!fsCheck.allowed) return toolResult(false, fsCheck.reason ?? "Permission denied");
        if (needsApproval(securityGuard, "rename_path", { old_path, new_path })) {
          return toolResult(false, "Deferred: Renaming files/directories requires client-side approval.");
        }
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const oldFullPath = pathModule.resolve(process.cwd(), old_path);
          const newFullPath = pathModule.resolve(process.cwd(), new_path);
          await fs.mkdir(pathModule.dirname(newFullPath), { recursive: true });
          await fs.rename(oldFullPath, newFullPath);
          return toolResult(true, `Renamed ${old_path} \u2192 ${new_path}`);
        } catch (err) {
          return toolResult(false, `Error renaming: ${err}`);
        }
      },
    };

    tools.delete_path = {
      type: "function" as const,
      description: "Delete a file or directory recursively. DESTRUCTIVE \u2014 requires approval.",
      parameters: z.object({
        path: z.string().describe("The workspace path to delete"),
      }),
      execute: async ({ path: delPath }: { path: string }) => {
        const fsCheck = securityGuard.checkFilesystemPermission(delPath, true);
        if (!fsCheck.allowed) return toolResult(false, fsCheck.reason ?? "Permission denied");
        if (needsApproval(securityGuard, "delete_path", { path: delPath })) {
          return toolResult(false, "Deferred: This destructive operation requires client-side approval.");
        }
        try {
          const fs = await import("fs/promises");
          const pathModule = await import("path");
          const fullPath = pathModule.resolve(process.cwd(), delPath);
          await fs.rm(fullPath, { recursive: true, force: true });
          return toolResult(true, `Deleted ${delPath}`);
        } catch (err) {
          return toolResult(false, `Error deleting: ${err}`);
        }
      },
    };

    tools.execute_terminal = {
      type: "function" as const,
      description:
        "Run a shell command in the terminal. Use for building, testing, running scripts, git, etc.",
      parameters: z.object({
        command: z.string().describe("The shell command to execute"),
        description: z.string().optional().describe("Brief description of what this command does"),
        process_id: z.string().optional().describe("Unique ID for long-running processes"),
      }),
      execute: async ({ command }: { command: string; description?: string; process_id?: string }) => {
        const termCheck = securityGuard.checkTerminalPermission(command);
        if (!termCheck.allowed) return toolResult(false, termCheck.reason ?? "Terminal execution denied");
        if (needsApproval(securityGuard, "execute_terminal", { command })) {
          return toolResult(false, "Deferred: Terminal execution requires client-side approval.");
        }
        try {
          const util = await import("util");
          const exec = util.promisify((await import("child_process")).exec);
          const { stdout, stderr } = await exec(command, { cwd: process.cwd(), timeout: 30_000 });
          return toolResult(true, `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
        } catch (err: any) {
          return toolResult(
            err.killed === false,
            `Exit code ${err.code}\nSTDOUT:\n${err.stdout || ""}\nSTDERR:\n${err.stderr || ""}\nError: ${err.message}`,
          );
        }
      },
    };

    tools.fetch_web = {
      type: "function" as const,
      description:
        "Fetch contents from a URL to read documentation, APIs, or reference material.",
      parameters: z.object({
        url: z.string().url().describe("Target URL"),
      }),
      execute: async ({ url }: { url: string }) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          const text = await res.text();
          const truncated = text.length > 5000 ? text.slice(0, 5000) + "\n...[truncated]" : text;
          return toolResult(true, truncated);
        } catch (err) {
          return toolResult(false, `Error fetching URL: ${err}`);
        }
      },
    };

    // Stream via provider with tool execution loop, emit AI SDK-compatible SSE
    const encoder = new TextEncoder();
    const sseStream = new TransformStream();
    const writer = sseStream.writable.getWriter();

    const chatId = `chat_${Date.now()}`;
    const textId = `${chatId}_0`;

    writer.write(encoder.encode(`data: ${JSON.stringify({ type: "start", id: chatId })}\n\n`));

    (async () => {
      try {
        const gen = executeWithToolLoop(
          resolved.provider,
          resolved.modelName,
          messages,
          systemPrompt,
          tools,
        );

        let textStarted = false;

        for await (const chunk of gen) {
          if (chunk.type === "text") {
            if (!textStarted) {
              writer.write(encoder.encode(
                `data: ${JSON.stringify({ type: "text-start", id: textId, providerMetadata: {} })}\n\n`
              ));
              textStarted = true;
            }
            writer.write(encoder.encode(
              `data: ${JSON.stringify({ type: "text-delta", id: textId, delta: chunk.content })}\n\n`
            ));
          } else if (chunk.type === "done") {
            if (textStarted) {
              writer.write(encoder.encode(
                `data: ${JSON.stringify({ type: "text-end", id: textId })}\n\n`
              ));
            }
            writer.write(encoder.encode(
              `data: ${JSON.stringify({
                type: "finish",
                finishReason: chunk.finishReason || "stop",
                usage: { promptTokens: 0, completionTokens: 0 },
              })}\n\n`
            ));
          } else if (chunk.type === "error") {
            writer.write(encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: { message: chunk.message } })}\n\n`
            ));
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        writer.write(encoder.encode(
          `data: ${JSON.stringify({ type: "error", error: { message } })}\n\n`
        ));
      } finally {
        writer.write(encoder.encode("data: [DONE]\n\n"));
        await writer.close();
      }
    })();

    return new Response(sseStream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Chat streaming failed",
      },
      { status: 500 },
    );
  }
}
