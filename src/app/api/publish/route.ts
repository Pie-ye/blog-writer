import { NextRequest, NextResponse } from "next/server";
import { buildPostPath, renderHugoPost, type PostMetadata } from "@/lib/content";
import { getProfile } from "@/lib/server/db";
import { assertRepositoryAccess, createRepositoryFile } from "@/lib/server/github";
import { requireUser } from "@/lib/server/session";

type PublishRequest = { profileId?: string; metadata?: PostMetadata; body?: string };

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = await request.json() as PublishRequest;
    if (!input.profileId || !input.metadata || typeof input.body !== "string") throw new Error("Profile, post metadata, and Markdown body are required.");
    const profile = await getProfile(user.id, input.profileId);
    if (!profile) return NextResponse.json({ error: "Repository profile was not found." }, { status: 404 });
    await assertRepositoryAccess(profile.installationId, profile.owner, profile.repository);
    const path = buildPostPath(profile.contentDirectory, input.metadata);
    const markdown = renderHugoPost(input.metadata, input.body);
    const commit = await createRepositoryFile({ installationId: profile.installationId, owner: profile.owner, repository: profile.repository, branch: profile.branch, path, content: markdown, message: `post: ${input.metadata.title.trim()}` });
    return NextResponse.json({ path, commit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish post.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 400 });
  }
}
