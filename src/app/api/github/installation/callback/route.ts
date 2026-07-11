import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { saveInstallation } from "@/lib/server/db";
import { environment } from "@/lib/server/env";
import { verifyInstallation } from "@/lib/server/github";
import { requireUser, validSignedState } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const installationId = Number(request.nextUrl.searchParams.get("installation_id"));
  const savedState = (await cookies()).get("draftwell_install_state")?.value;
  if (!state || !Number.isSafeInteger(installationId) || installationId <= 0 || !validSignedState(savedState, state)) {
    return NextResponse.json({ error: "Invalid or expired GitHub App installation state." }, { status: 400 });
  }

  try {
    const user = await requireUser();
    await verifyInstallation(installationId);
    await saveInstallation(user.id, installationId);
    const response = NextResponse.redirect(new URL("/?installation=connected", environment("APP_URL")));
    response.cookies.delete("draftwell_install_state");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save GitHub App installation.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 502 });
  }
}
