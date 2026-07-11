import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/server/db";
import { currentSessionId, expiredSessionCookie } from "@/lib/server/session";

export async function POST() {
  const sessionId = await currentSessionId();
  if (sessionId) await deleteSession(sessionId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(expiredSessionCookie());
  response.cookies.delete("draftwell_oauth_state");
  response.cookies.delete("draftwell_install_state");
  return response;
}
