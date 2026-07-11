import "server-only";

type RequiredEnvironment = "APP_URL" | "DATABASE_URL" | "SESSION_SECRET" | "GITHUB_APP_ID" | "GITHUB_APP_SLUG" | "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET" | "GITHUB_APP_PRIVATE_KEY";

export function environment(name: RequiredEnvironment): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export function githubAppEnvironment() {
  return {
    appId: environment("GITHUB_APP_ID"),
    appSlug: environment("GITHUB_APP_SLUG"),
    clientId: environment("GITHUB_CLIENT_ID"),
    clientSecret: environment("GITHUB_CLIENT_SECRET"),
    privateKey: environment("GITHUB_APP_PRIVATE_KEY").replaceAll("\\n", "\n"),
  };
}
