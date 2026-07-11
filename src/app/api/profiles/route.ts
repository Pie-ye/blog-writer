import { NextRequest, NextResponse } from "next/server";
import { listProfiles, saveProfile } from "@/lib/server/db";
import { validateRepositoryProfile } from "@/lib/profile";
import { requireUser } from "@/lib/server/session";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ profiles: await listProfiles(user.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load repository profiles.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const profile = validateRepositoryProfile(await request.json());
    const id = await saveProfile(user.id, profile);
    return NextResponse.json({ id, profile }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save repository profile.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 400 });
  }
}
