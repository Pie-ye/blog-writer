import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { mediaMarkup, normalizeRepositoryPath } from "@/lib/content";
import { assertMediaPayload, assertMediaUpload, requiresProcessing } from "@/lib/media";
import { getProfile } from "@/lib/server/db";
import { assertRepositoryAccess, createRepositoryFile } from "@/lib/server/github";
import { requireUser } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const profileId = form.get("profileId");
    const date = form.get("date");
    const file = form.get("file");
    if (typeof profileId !== "string" || typeof date !== "string" || !(file instanceof File)) throw new Error("Profile, publication date, and media file are required.");
    assertMediaUpload(file);
    if (requiresProcessing(file.size)) return NextResponse.json({ error: "Files over 10 MB require the media worker, which is not configured on this deployment." }, { status: 503 });
    const profile = await getProfile(user.id, profileId);
    if (!profile) return NextResponse.json({ error: "Repository profile was not found." }, { status: 404 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const media = assertMediaPayload(bytes);
    await assertRepositoryAccess(profile.installationId, profile.owner, profile.repository);
    const month = date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Publication date is invalid.");
    const path = `${normalizeRepositoryPath(profile.imageDirectory)}/${month}/${randomUUID()}.${media.extension}`;
    const commit = await createRepositoryFile({ installationId: profile.installationId, owner: profile.owner, repository: profile.repository, branch: profile.branch, path, content: Buffer.from(bytes).toString("binary"), binary: true, message: `media: ${file.name}` });
    return NextResponse.json({ path, markup: mediaMarkup(path, file.name.replace(/\.[^.]+$/, ""), media.kind), commit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload media.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 400 });
  }
}
