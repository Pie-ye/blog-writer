import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { environment } from "@/lib/server/env";
import { getSessionUser, type SessionUser } from "@/lib/server/db";

const SESSION_COOKIE = "draftwell_session";

function sign(value: string): string {
  return createHmac("sha256", environment("SESSION_SECRET")).update(value).digest("base64url");
}

export function newState(): string { return randomBytes(32).toString("base64url"); }
export function signedState(state: string): string { return `${state}.${sign(state)}`; }
export function validSignedState(value: string | undefined, state: string): boolean {
  if (!value) return false;
  const [receivedState, signature] = value.split(".");
  if (!receivedState || !signature) return false;
  const expectedSignature = Buffer.from(sign(receivedState));
  const receivedSignature = Buffer.from(signature);
  const expectedState = Buffer.from(state);
  const actualState = Buffer.from(receivedState);
  return expectedSignature.length === receivedSignature.length
    && expectedState.length === actualState.length
    && timingSafeEqual(expectedSignature, receivedSignature)
    && timingSafeEqual(actualState, expectedState);
}

export async function currentUser(): Promise<SessionUser | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return id ? getSessionUser(id) : null;
}

export async function currentSessionId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("Sign in with GitHub before continuing.");
  return user;
}

export const sessionCookie = (value: string) => ({ name: SESSION_COOKIE, value, httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
export const expiredSessionCookie = () => ({ name: SESSION_COOKIE, value: "", httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
