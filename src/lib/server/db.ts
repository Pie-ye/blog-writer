import "server-only";

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { environment } from "@/lib/server/env";
import type { RepositoryProfile } from "@/lib/profile";

const globalForDatabase = globalThis as unknown as { pool?: Pool };

function database(): Pool {
  if (!globalForDatabase.pool) {
    globalForDatabase.pool = new Pool({ connectionString: environment("DATABASE_URL") });
  }
  return globalForDatabase.pool;
}

export type SessionUser = { id: string; githubLogin: string };

export async function upsertGithubUser(githubId: number, githubLogin: string): Promise<SessionUser> {
  const id = randomUUID();
  const result = await database().query<{ id: string; github_login: string }>(
    `INSERT INTO users (id, github_id, github_login)
     VALUES ($1, $2, $3)
     ON CONFLICT (github_id) DO UPDATE SET github_login = EXCLUDED.github_login
     RETURNING id, github_login`,
    [id, githubId, githubLogin],
  );
  return { id: result.rows[0].id, githubLogin: result.rows[0].github_login };
}

export async function createSession(userId: string): Promise<string> {
  const id = randomUUID();
  await database().query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '14 days')", [id, userId]);
  return id;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await database().query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function getSessionUser(sessionId: string): Promise<SessionUser | null> {
  const result = await database().query<{ id: string; github_login: string }>(
    `SELECT users.id, users.github_login FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = $1 AND sessions.expires_at > now()`,
    [sessionId],
  );
  const user = result.rows[0];
  return user ? { id: user.id, githubLogin: user.github_login } : null;
}

export async function saveInstallation(userId: string, installationId: number): Promise<void> {
  await database().query(
    `INSERT INTO github_installations (installation_id, user_id) VALUES ($1, $2)
     ON CONFLICT (installation_id) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [installationId, userId],
  );
}

export async function saveGithubUserToken(userId: string, encryptedToken: string): Promise<void> {
  await database().query(
    `INSERT INTO github_user_tokens (user_id, encrypted_token) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET encrypted_token = EXCLUDED.encrypted_token, updated_at = now()`,
    [userId, encryptedToken],
  );
}

export async function getGithubUserToken(userId: string): Promise<string | null> {
  const result = await database().query<{ encrypted_token: string }>("SELECT encrypted_token FROM github_user_tokens WHERE user_id = $1", [userId]);
  return result.rows[0]?.encrypted_token ?? null;
}

export async function userOwnsInstallation(userId: string, installationId: number): Promise<boolean> {
  const result = await database().query("SELECT 1 FROM github_installations WHERE installation_id = $1 AND user_id = $2", [installationId, userId]);
  return result.rowCount === 1;
}

export async function listInstallations(userId: string): Promise<number[]> {
  const result = await database().query<{ installation_id: number }>("SELECT installation_id FROM github_installations WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
  return result.rows.map((row) => row.installation_id);
}

export async function saveProfile(userId: string, profile: RepositoryProfile): Promise<string> {
  if (!(await userOwnsInstallation(userId, profile.installationId))) throw new Error("The selected GitHub App installation is not authorized for this user.");
  const id = randomUUID();
  const result = await database().query<{ id: string }>(
    `INSERT INTO repository_profiles (id, user_id, installation_id, owner, repository, branch, content_directory, image_directory, timezone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, owner, repository, branch)
     DO UPDATE SET installation_id = EXCLUDED.installation_id, content_directory = EXCLUDED.content_directory, image_directory = EXCLUDED.image_directory, timezone = EXCLUDED.timezone
     RETURNING id`,
    [id, userId, profile.installationId, profile.owner, profile.repository, profile.branch, profile.contentDirectory, profile.imageDirectory, profile.timezone],
  );
  return result.rows[0].id;
}

export async function listProfiles(userId: string) {
  const result = await database().query<{
    id: string; installation_id: number; owner: string; repository: string; branch: string;
    content_directory: string; image_directory: string; timezone: string;
  }>("SELECT id, installation_id, owner, repository, branch, content_directory, image_directory, timezone FROM repository_profiles WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
  return result.rows.map((row) => ({
    id: row.id, installationId: row.installation_id, owner: row.owner, repository: row.repository,
    branch: row.branch, contentDirectory: row.content_directory, imageDirectory: row.image_directory, timezone: row.timezone,
  }));
}

export async function getProfile(userId: string, profileId: string) {
  const profiles = await listProfiles(userId);
  return profiles.find((profile) => profile.id === profileId) ?? null;
}
