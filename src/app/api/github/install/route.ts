import { NextResponse } from "next/server";
import { githubAppEnvironment } from "@/lib/server/env";
import { newState, signedState, requireUser } from "@/lib/server/session";

export async function GET() {
  try {
    await requireUser();
    const state = newState();
    const { appSlug } = githubAppEnvironment();
    const url = new URL(`https://github.com/apps/${appSlug}/installations/new`);
    url.searchParams.set("state", state);
    const response = NextResponse.redirect(url);
    response.cookies.set("draftwell_install_state", signedState(state), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start GitHub App installation.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 503 });
  }
}
