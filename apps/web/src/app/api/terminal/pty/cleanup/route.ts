import { NextRequest, NextResponse } from "next/server";
import { deletePty } from "@/lib/server/ptyManager";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    deletePty(id);
    return NextResponse.json({ success: true, message: `PTY session ${id} cleaned up` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
