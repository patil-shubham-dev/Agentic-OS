import { NextResponse } from "next/server";
import { getSetupStatus } from "@/lib/server/setup";
import { selectRows } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getSetupStatus();

  let projectName: string | null = null;
  if (status.env.ready && status.projectId) {
    try {
      const rows = await selectRows<{ id: string; name: string }>("projects", {
        filters: { id: status.projectId },
        limit: 1,
      });
      projectName = rows[0]?.name ?? null;
    } catch {
      projectName = null;
    }
  }

  return NextResponse.json({
    ready: status.env.ready && !status.needsSetup,
    needsSetup: status.needsSetup,
    env: status.env,
    supabaseReachable: status.supabaseReachable,
    hasProject: status.hasProject,
    hasConnectedProvider: status.hasConnectedProvider,
    projectName,
  });
}
