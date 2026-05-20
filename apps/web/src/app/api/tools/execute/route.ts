import { NextRequest, NextResponse } from "next/server";
import { toolRegistry } from "../../../../../../../tool_execution_loop";
import { selectRows } from "@/lib/server/supabase";
import { DEFAULT_PROJECT_ID } from "@/lib/server/agentos-data";

export const dynamic = "force-dynamic";

const DEFAULT_SECURITY = {
  terminal: true,
  filesystem: true,
  approval: true,
  browser: false,
};

export async function POST(request: NextRequest) {
  try {
    const { toolName, args, projectId = DEFAULT_PROJECT_ID } = await request.json();

    if (!toolName) {
      return NextResponse.json({ error: "toolName is required" }, { status: 400 });
    }

    // 1. Fetch Security settings from DB
    const securityRows = await selectRows<{ value: string }>("memories", {
      filters: { project_id: projectId, key: "system_security" },
      limit: 1,
    });
    const security = securityRows.length > 0 ? JSON.parse(securityRows[0].value) : DEFAULT_SECURITY;

    // 2. Enforce absolute security boundaries
    const isTerminal = toolName === "execute_terminal";
    const tool = toolRegistry[toolName];
    const isDestructive = tool ? tool.isDestructive(args) : false;

    if (isTerminal && !security.terminal) {
      return NextResponse.json({ success: false, error: "Terminal commands are disabled by security settings." });
    }

    if (isDestructive && !security.filesystem) {
      return NextResponse.json({ success: false, error: "Destructive filesystem operations are disabled by security settings." });
    }

    // 3. Lookup tool in registry
    if (!tool) {
      return NextResponse.json({ success: false, error: `Tool ${toolName} not found in registry.` });
    }

    // 4. Execute tool
    const config = {
      workspaceRoot: process.cwd(),
      osType: process.platform,
      homeDir: process.env.USERPROFILE || process.env.HOME || process.cwd(),
      securitySettings: {
        allowTerminal: security.terminal,
        allowFilesystem: security.filesystem,
        requireApprovalForDestructive: security.approval,
        browserAutomationEnabled: security.browser,
      },
    };

    const result = await tool.execute(args, config);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Tool execution failed" },
      { status: 500 }
    );
  }
}
