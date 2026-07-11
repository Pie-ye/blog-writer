import { NextResponse } from "next/server";
import { environment, githubAppEnvironment } from "@/lib/server/env";
import { newState, signedState } from "@/lib/server/session";

export async function GET() {
  try {
    const state = newState();
    const config = githubAppEnvironment();
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", `${environment("APP_URL")}/api/auth/github/callback`);
    url.searchParams.set("state", state);
    const response = NextResponse.redirect(url);
    response.cookies.set("draftwell_oauth_state", signedState(state), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub login is not configured." }, { status: 503 });
  }
}
