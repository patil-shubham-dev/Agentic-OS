import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function gone() {
  return NextResponse.json(
    {
      error: "AgentOS Studio runs as a single-user local app. NextAuth is not configured.",
      code: "AUTH_DISABLED",
    },
    { status: 410 }
  );
}

export const GET = gone;
export const POST = gone;
