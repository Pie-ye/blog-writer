import { NextRequest, NextResponse } from "next/server";
import { renderHugoPost, type PostMetadata } from "@/lib/content";
import { getProfile } from "@/lib/server/db";
import { assertRepositoryAccess, deleteRepositoryFile, readRepositoryFile, updateRepositoryFile } from "@/lib/server/github";
import { requireUser } from "@/lib/server/session";

type PostRequest = { profileId?: string; path?: string; metadata?: PostMetadata; body?: string };

async function profileForRequest(userId: string, profileId: string | undefined) {
  if (!profileId) throw new Error("Profile is required.");
  const profile = await getProfile(userId, profileId);
  if (!profile) throw new Error("Repository profile was not found.");
  await assertRepositoryAccess(profile.installationId, profile.owner, profile.repository);
  return profile;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const profile = await profileForRequest(user.id, request.nextUrl.searchParams.get("profileId") ?? undefined);
    const path = request.nextUrl.searchParams.get("path");
    if (!path?.startsWith(`${profile.contentDirectory}/`) || !path.endsWith(".md")) throw new Error("Post path is invalid.");
    return NextResponse.json(await readRepositoryFile(profile, path));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read post." }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser(); const input = await request.json() as PostRequest;
    const profile = await profileForRequest(user.id, input.profileId);
    if (!input.path?.startsWith(`${profile.contentDirectory}/`) || !input.metadata || typeof input.body !== "string") throw new Error("Post content is invalid.");
    const current = await readRepositoryFile(profile, input.path);
    const commit = await updateRepositoryFile(profile, input.path, current.sha, renderHugoPost(input.metadata, input.body), `update post: ${input.metadata.title.trim()}`);
    return NextResponse.json({ commit });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update post." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(); const input = await request.json() as PostRequest;
    const profile = await profileForRequest(user.id, input.profileId);
    if (!input.path?.startsWith(`${profile.contentDirectory}/`) || !input.path.endsWith(".md")) throw new Error("Post path is invalid.");
    const current = await readRepositoryFile(profile, input.path);
    return NextResponse.json({ commit: await deleteRepositoryFile(profile, input.path, current.sha, `delete post: ${input.path.split("/").at(-1)}`) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete post." }, { status: 400 });
  }
}
