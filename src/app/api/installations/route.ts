import { NextResponse } from "next/server";
import { listInstallations } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ installations: await listInstallations(user.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load GitHub App installations.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
