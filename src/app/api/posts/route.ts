import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/server/db";
import { assertRepositoryAccess, listMarkdownFiles } from "@/lib/server/github";
import { requireUser } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const profileId = request.nextUrl.searchParams.get("profileId");
    if (!profileId) throw new Error("Profile is required.");
    const profile = await getProfile(user.id, profileId);
    if (!profile) return NextResponse.json({ error: "Repository profile was not found." }, { status: 404 });
    await assertRepositoryAccess(profile.installationId, profile.owner, profile.repository);
    const posts = await listMarkdownFiles(profile, profile.contentDirectory);
    return NextResponse.json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list posts.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 400 });
  }
}
