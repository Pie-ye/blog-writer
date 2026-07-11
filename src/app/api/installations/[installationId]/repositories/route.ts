import { NextRequest, NextResponse } from "next/server";
import { userOwnsInstallation } from "@/lib/server/db";
import { listInstallationRepositories } from "@/lib/server/github";
import { requireUser } from "@/lib/server/session";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ installationId: string }> }) {
  try {
    const user = await requireUser();
    const installationId = Number((await params).installationId);
    if (!Number.isSafeInteger(installationId) || installationId <= 0 || !(await userOwnsInstallation(user.id, installationId))) {
      return NextResponse.json({ error: "GitHub App installation was not found." }, { status: 404 });
    }
    return NextResponse.json({ repositories: await listInstallationRepositories(installationId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load repositories.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 502 });
  }
}
