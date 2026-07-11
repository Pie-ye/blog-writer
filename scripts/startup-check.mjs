import pg from "pg";
import { loadLocalEnv, missingEnvironment } from "./env.mjs";

loadLocalEnv();

const missing = missingEnvironment();
if (missing.length) {
  console.error(`Missing required server environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const appUrl = process.env.APP_URL.trim().replace(/\/+$/, "");
const oauthCallback = `${appUrl}/api/auth/github/callback`;
const setupCallback = `${appUrl}/api/github/installation/callback`;
const oauthUrl = new URL("https://github.com/login/oauth/authorize");
oauthUrl.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID.trim());
oauthUrl.searchParams.set("redirect_uri", oauthCallback);
oauthUrl.searchParams.set("state", "[redacted]");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("SELECT 1");
} finally {
  await client.end().catch(() => {});
}

console.log("environment: ok");
console.log("database: ok");
console.log(`app url: ${appUrl}`);
console.log(`oauth callback: ${oauthCallback}`);
console.log(`setup callback: ${setupCallback}`);
console.log(`oauth authorize url: ${oauthUrl.toString()}`);
