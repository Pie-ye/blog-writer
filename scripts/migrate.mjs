import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";
import { loadLocalEnv } from "./env.mjs";

loadLocalEnv();

if (!process.env.DATABASE_URL?.trim()) {
  console.error("Missing required environment for migrations: DATABASE_URL");
  process.exit(1);
}

const migrationsDir = resolve(process.cwd(), "db/migrations");
const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
if (!files.length) {
  console.error("No migration files found in db/migrations.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  let canTrackMigrations = true;
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  } catch (error) {
    if (error?.code !== "42501") throw error;
    canTrackMigrations = false;
    console.log("schema_migrations cannot be created by this database user; verifying existing schema instead");
  }

  if (!canTrackMigrations) {
    for (const file of files) {
      if (!(await alreadyApplied(client, file))) {
        throw new Error(`Migration ${file} is not recorded and its expected tables are missing. Run migrations with a database owner role.`);
      }
      console.log(`verified ${file}`);
    }
  } else {
    const applied = await client.query("SELECT filename FROM schema_migrations");
    const appliedFiles = new Set(applied.rows.map((row) => row.filename));

    for (const file of files) {
      if (appliedFiles.has(file)) {
        console.log(`skip ${file}`);
        continue;
      }
      if (await alreadyApplied(client, file)) {
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
        console.log(`recorded ${file}`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
} finally {
  await client.end().catch(() => {});
}

async function alreadyApplied(client, file) {
  const expectedTables = {
    "001_initial.sql": ["users", "sessions", "github_installations", "repository_profiles"],
    "002_github_user_tokens.sql": ["github_user_tokens"],
  }[file];
  if (!expectedTables) return false;

  for (const table of expectedTables) {
    const result = await client.query("SELECT to_regclass($1) IS NOT NULL AS exists", [`public.${table}`]);
    if (!result.rows[0]?.exists) return false;
  }
  return true;
}
