import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { environment, githubAppEnvironment } from "@/lib/server/env";
import { createSession, saveGithubUserToken, upsertGithubUser } from "@/lib/server/db";
import { sessionCookie, validSignedState } from "@/lib/server/session";
import { encryptToken } from "@/lib/server/token-crypto";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = (await cookies()).get("draftwell_oauth_state")?.value;
  if (!code || !state || !validSignedState(savedState, state)) return NextResponse.json({ error: "Invalid or expired GitHub login state." }, { status: 400 });

  try {
    const config = githubAppEnvironment();
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: `${environment("APP_URL")}/api/auth/github/callback` }) });
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) throw new Error("GitHub did not return a user access token.");
    const userResponse = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token.access_token}`, "X-GitHub-Api-Version": "2022-11-28" } });
    const githubUser = (await userResponse.json()) as { id?: number; login?: string };
    if (!userResponse.ok || !githubUser.id || !githubUser.login) throw new Error("Could not load the GitHub user.");
    const user = await upsertGithubUser(githubUser.id, githubUser.login);
    await saveGithubUserToken(user.id, encryptToken(token.access_token));
    const session = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", environment("APP_URL")));
    response.cookies.set(sessionCookie(session));
    response.cookies.delete("draftwell_oauth_state");
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub login failed." }, { status: 502 });
  }
}
