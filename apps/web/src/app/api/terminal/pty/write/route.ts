import { NextRequest, NextResponse } from "next/server";
import { getPty } from "@/lib/server/ptyManager";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { id, data } = await request.json();
    
    if (!id || typeof data !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const pty = getPty(id);
    if (!pty) {
      return NextResponse.json({ error: "PTY session not found" }, { status: 404 });
    }

    pty.write(data);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
