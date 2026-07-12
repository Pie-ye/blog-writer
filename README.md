# Draftwell

繁體中文： [README.zh-TW.md](README.zh-TW.md)

Draftwell is a Hugo-only browser writing desk. It publishes Markdown and media to a repository selected through a GitHub App; it does not store posts or media in its database.

## Current scope

- Hugo YAML front matter and paths compatible with `content/post` and `static/images/posts`.
- PNG, JPEG, WebP, GIF, and MP4 validation with a 100 MB source-file limit.
- GitHub App user sign-in, state-protected installation callback, PostgreSQL sessions, repository-profile persistence, and server-side Hugo post publishing.
- Server-side media signature validation and GitHub publishing for media files up to 10 MB. Files over 10 MB require the separate compression/transcoding worker, which is not implemented yet.

## Local setup

1. Create a PostgreSQL database and run all migrations:

   ```bash
   npm run migrate
   ```

2. Copy `.env.example` to `.env.local` and set every value. Generate `SESSION_SECRET` with a cryptographically random value of at least 32 characters.

3. Register a GitHub App for this deployment. Set:

   - User authorization callback URL: `<APP_URL>/api/auth/github/callback`
   - Setup URL: `<APP_URL>/api/github/installation/callback`
   - Repository permissions: `Contents: Read and write`, `Metadata: Read-only`
   - Installation target: user or organization repositories selected by the installer

   `APP_URL` must be the exact public base URL that users open in the browser. GitHub requires the callback URL in the App settings to match the OAuth `redirect_uri` exactly, including scheme, hostname, port, and path.

   For local-only development:

   ```env
   APP_URL=http://localhost:3000
   ```

   GitHub App URLs:

   ```txt
   User authorization callback URL:
   http://localhost:3000/api/auth/github/callback

   Setup URL:
   http://localhost:3000/api/github/installation/callback
   ```

   For Cloudflare Tunnel or another HTTPS reverse proxy that forwards to local port 3000, keep Next.js listening on `localhost:3000` but set `APP_URL` to the public HTTPS tunnel URL:

   ```env
   APP_URL=https://blog-writer.example.com
   ```

   GitHub App URLs:

   ```txt
   User authorization callback URL:
   https://blog-writer.example.com/api/auth/github/callback

   Setup URL:
   https://blog-writer.example.com/api/github/installation/callback
   ```

   Do not mix `localhost`, `127.0.0.1`, a different port, or an old temporary tunnel URL. If the public URL changes, update both `.env.local` and the GitHub App settings, then restart the application.

4. Start the application:

   ```bash
   npm install
   npm run dev
   ```

   When testing through Cloudflare Tunnel in development mode, restart `npm run dev` after changing `next.config.ts`, `.env.local`, or authentication UI code. Next.js dev mode uses `/_next/webpack-hmr` WebSockets for hot reload; if that WebSocket is blocked by the tunnel or browser, the page can temporarily mix new server HTML with an old browser bundle and report a hydration mismatch. A hard refresh or dev-server restart clears the stale bundle. Production mode does not use this HMR endpoint:

   ```bash
   npm run build
   npm run start -- --port 3000
   ```

## Minimal production startup

Use this path for Cloudflare Tunnel testing and the lowest-resource public service. It requires only Node.js, PostgreSQL, Cloudflare Tunnel, and a GitHub App.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set server environment variables in `.env.local` or the process environment. For the current tunnel deployment:

   ```env
   APP_URL=https://blog-writer.pie-ye.org
   ```

3. Apply database migrations in order:

   ```bash
   npm run migrate
   ```

   The migration runner applies every `db/migrations/*.sql` file once and records applied filenames in `schema_migrations` when the database role can create that table. If the app role has read/write access but not schema `CREATE`, it verifies that the expected tables already exist and exits successfully; use a database owner role to initialize a fresh database. PostgreSQL stores only account, session, GitHub installation, encrypted user token, repository profile, and migration metadata. Posts and media remain in GitHub repositories.

4. Run a secret-safe startup check:

   ```bash
   npm run startup:check
   ```

   This checks required environment variables, verifies database connectivity, and prints only public GitHub callback URLs. It does not print secrets, database credentials, private keys, session secrets, OAuth state signatures, or tokens.

5. Build and start the app:

   ```bash
   npm run build
   npm run start -- --port 3000
   ```

6. Point Cloudflare Tunnel at:

   ```txt
   http://localhost:3000
   ```

7. Verify the public OAuth redirect:

   ```bash
   curl -sS -I -L --max-redirs 0 https://blog-writer.pie-ye.org/api/auth/github/login
   ```

   The `Location` header should point to GitHub and include:

   ```txt
   redirect_uri=https%3A%2F%2Fblog-writer.pie-ye.org%2Fapi%2Fauth%2Fgithub%2Fcallback
   ```

Redis, queues, object storage, Kubernetes, a repository checkout, and the media worker are not required for this minimal service. Files over 10 MB intentionally return a worker-not-configured error until the compression/transcoding worker is implemented.

## Background service

The repository includes a systemd unit at `deploy/systemd/blog-writer.service`. On this host it is installed as `/etc/systemd/system/blog-writer.service`, runs as user `pieye`, starts the production Next.js server on port 3000, and is enabled at boot.

Common operations:

```bash
sudo systemctl status blog-writer.service --no-pager -l
sudo systemctl restart blog-writer.service
sudo systemctl stop blog-writer.service
sudo systemctl start blog-writer.service
sudo journalctl -u blog-writer.service -n 100 --no-pager
```

After changing application code, rebuild before restarting:

```bash
npm run build
sudo systemctl restart blog-writer.service
```

The service runs these checks before starting:

```bash
npm run migrate
npm run startup:check
```

## Environment variables

| Variable | Purpose |
|---|---|
| `APP_URL` | Exact public base URL used in GitHub OAuth redirects. The GitHub App callback must be `<APP_URL>/api/auth/github/callback`. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `SESSION_SECRET` | Signs OAuth state cookies. Keep it private and stable. |
| `GITHUB_APP_ID` | GitHub App numeric ID. |
| `GITHUB_APP_SLUG` | GitHub App URL slug, used to start repository installation. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub App user authorization credentials. |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key. Use escaped newlines in one environment variable. |

Never expose these values through `NEXT_PUBLIC_` variables, browser code, logs, or issue reports.

## User connection flow

1. The author selects **Use GitHub to sign in**. GitHub OAuth identifies the author; Draftwell does not request a personal access token.
2. The author selects **Choose repositories on GitHub** and GitHub shows the App installation page. They choose the repositories the App may write to.
3. GitHub redirects back to Draftwell. The repository selector displays only repositories from that installation, and the author chooses where to publish.

OAuth login alone cannot safely restrict repository write access. The GitHub App installation step is what gives the author repository-level, revocable permission control.

## Checks

```bash
npm test
npm run lint
npm run build
```
