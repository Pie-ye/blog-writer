import { NextResponse } from "next/server";
import { getGithubUserToken, saveInstallation } from "@/lib/server/db";
import { githubAppEnvironment } from "@/lib/server/env";
import { requireUser } from "@/lib/server/session";
import { decryptToken } from "@/lib/server/token-crypto";

export async function POST() {
  try {
    const user = await requireUser();
    const storedToken = await getGithubUserToken(user.id);
    if (!storedToken) return NextResponse.json({ error: "Sign in with GitHub again to sync App installations." }, { status: 401 });
    const accessToken = decryptToken(storedToken);
    const response = await fetch("https://api.github.com/user/installations", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${accessToken}`, "X-GitHub-Api-Version": "2022-11-28" } });
    const result = await response.json() as { installations?: Array<{ id?: number; app_id?: number }> };
    if (!response.ok) return NextResponse.json({ error: "GitHub authorization expired. Sign in again to continue." }, { status: 401 });
    const appId = Number(githubAppEnvironment().appId);
    const installationIds = (result.installations ?? []).filter((installation) => installation.app_id === appId && Number.isSafeInteger(installation.id)).map((installation) => installation.id as number);
    await Promise.all(installationIds.map((installationId) => saveInstallation(user.id, installationId)));
    return NextResponse.json({ installations: installationIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync GitHub App installations.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 502 });
  }
}
