import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({ user: { login: user.githubLogin } });
}
