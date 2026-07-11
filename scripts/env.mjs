import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const requiredEnvironment = [
  "APP_URL",
  "DATABASE_URL",
  "SESSION_SECRET",
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
];

export function loadLocalEnv() {
  const path = resolve(process.cwd(), ".env.local");
  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = unquote(rawValue.trim());
  }
}

export function missingEnvironment() {
  return requiredEnvironment.filter((name) => !process.env[name]?.trim());
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
