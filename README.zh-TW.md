# Draftwell

[English README](README.md)

Draftwell 是一個僅使用 Hugo 的瀏覽器寫作工作台。它會透過 GitHub App，將 Markdown 與媒體檔案發布到使用者選定的 repository；文章與媒體不會儲存在資料庫中。

## 目前範圍

- 支援 Hugo YAML front matter，以及相容於 `content/post` 和 `static/images/posts` 的路徑。
- 支援 PNG、JPEG、WebP、GIF 與 MP4，來源檔案上限為 100 MB。
- 支援 GitHub App 使用者登入、具 state 保護的安裝回呼、PostgreSQL session、repository 設定檔持久化，以及伺服器端 Hugo 文章發布。
- 支援伺服器端媒體簽章驗證，以及發布上限 10 MB 的媒體檔案。超過 10 MB 的檔案需要額外的壓縮／轉碼 worker，目前尚未實作。

## 本機設定

1. 建立 PostgreSQL 資料庫並執行所有 migration：

   ```bash
   npm run migrate
   ```

2. 將 `.env.example` 複製為 `.env.local`，並填入所有設定值。請使用密碼學安全的隨機值產生 `SESSION_SECRET`，長度至少 32 個字元。

3. 為此部署註冊 GitHub App，並設定：

   - User authorization callback URL：`<APP_URL>/api/auth/github/callback`
   - Setup URL：`<APP_URL>/api/github/installation/callback`
   - Repository permissions：`Contents: Read and write`、`Metadata: Read-only`
   - Installation target：使用者或組織可選定的 repositories

   `APP_URL` 必須是使用者在瀏覽器中開啟的公開基礎 URL。GitHub 要求 App 設定中的 callback URL 與 OAuth `redirect_uri` 完全一致，包括 scheme、主機名稱、埠號與路徑。

   僅供本機開發時：

   ```env
   APP_URL=http://localhost:3000
   ```

   GitHub App URL：

   ```txt
   User authorization callback URL:
   http://localhost:3000/api/auth/github/callback

   Setup URL:
   http://localhost:3000/api/github/installation/callback
   ```

   若使用 Cloudflare Tunnel 或其他 HTTPS reverse proxy 將流量轉送至本機 3000 埠，請讓 Next.js 持續監聽 `localhost:3000`，但將 `APP_URL` 設為公開的 HTTPS tunnel URL：

   ```env
   APP_URL=https://blog-writer.example.com
   ```

   GitHub App URL：

   ```txt
   User authorization callback URL:
   https://blog-writer.example.com/api/auth/github/callback

   Setup URL:
   https://blog-writer.example.com/api/github/installation/callback
   ```

   請勿混用 `localhost`、`127.0.0.1`、不同的埠號或舊的暫時 tunnel URL。若公開 URL 變更，請同步更新 `.env.local` 與 GitHub App 設定，然後重新啟動應用程式。

4. 啟動應用程式：

   ```bash
   npm install
   npm run dev
   ```

   使用 Cloudflare Tunnel 以開發模式測試時，修改 `next.config.ts`、`.env.local` 或驗證 UI 程式碼後，請重新啟動 `npm run dev`。Next.js 開發模式使用 `/_next/webpack-hmr` WebSocket 進行熱更新；若 tunnel 或瀏覽器阻擋該 WebSocket，頁面可能暫時混用新的伺服器 HTML 與舊的瀏覽器 bundle，並回報 hydration mismatch。重新整理頁面或重啟開發伺服器即可清除舊 bundle。正式環境不使用此 HMR endpoint：

   ```bash
   npm run build
   npm run start -- --port 3000
   ```

## 最精簡的正式環境啟動

此方式適用於 Cloudflare Tunnel 測試及低資源的公開服務。只需要 Node.js、PostgreSQL、Cloudflare Tunnel 與 GitHub App。

1. 安裝相依套件：

   ```bash
   npm install
   ```

2. 在 `.env.local` 或 process environment 中設定伺服器環境變數。目前 tunnel 部署使用：

   ```env
   APP_URL=https://blog-writer.pie-ye.org
   ```

3. 按順序套用 database migration：

   ```bash
   npm run migrate
   ```

   migration runner 會逐一套用 `db/migrations/*.sql`，並在資料庫角色可以建立該資料表時，將已套用的檔名記錄在 `schema_migrations`。若應用程式角色具備讀寫權限但沒有 schema `CREATE` 權限，runner 會確認預期資料表已存在後成功結束；初始化全新的資料庫時，請使用資料庫 owner 角色。PostgreSQL 只儲存帳號、session、GitHub installation、加密的使用者 token、repository 設定檔與 migration metadata。文章與媒體仍儲存在 GitHub repositories 中。

4. 執行不洩漏秘密的啟動檢查：

   ```bash
   npm run startup:check
   ```

   此檢查會確認必要的環境變數、驗證資料庫連線，並只輸出公開的 GitHub callback URL。它不會輸出 secrets、資料庫憑證、私鑰、session secrets、OAuth state signatures 或 tokens。

5. 建置並啟動應用程式：

   ```bash
   npm run build
   npm run start -- --port 3000
   ```

6. 將 Cloudflare Tunnel 指向：

   ```txt
   http://localhost:3000
   ```

7. 驗證公開 OAuth redirect：

   ```bash
   curl -sS -I -L --max-redirs 0 https://blog-writer.pie-ye.org/api/auth/github/login
   ```

   `Location` header 應指向 GitHub，並包含：

   ```txt
   redirect_uri=https%3A%2F%2Fblog-writer.pie-ye.org%2Fapi%2Fauth%2Fgithub%2Fcallback
   ```

   此最精簡服務不需要 Redis、queues、object storage、Kubernetes、repository checkout 或 media worker。超過 10 MB 的檔案會刻意回傳 worker 尚未設定的錯誤，直到壓縮／轉碼 worker 完成實作。

## 背景服務

repository 包含 `deploy/systemd/blog-writer.service` systemd unit。在此主機上，它安裝為 `/etc/systemd/system/blog-writer.service`，以 `pieye` 使用者執行，於 3000 埠啟動正式環境的 Next.js server，並設定為開機啟動。

常用操作：

```bash
sudo systemctl status blog-writer.service --no-pager -l
sudo systemctl restart blog-writer.service
sudo systemctl stop blog-writer.service
sudo systemctl start blog-writer.service
sudo journalctl -u blog-writer.service -n 100 --no-pager
```

修改應用程式程式碼後，請在重新啟動前重新建置：

```bash
npm run build
sudo systemctl restart blog-writer.service
```

服務啟動前會執行以下檢查：

```bash
npm run migrate
npm run startup:check
```

## 環境變數

| 變數 | 用途 |
|---|---|
| `APP_URL` | GitHub OAuth redirect 使用的精確公開基礎 URL。GitHub App callback 必須是 `<APP_URL>/api/auth/github/callback`。 |
| `DATABASE_URL` | PostgreSQL 連線字串。 |
| `SESSION_SECRET` | 用於簽署 OAuth state cookies。請保持私密且穩定。 |
| `GITHUB_APP_ID` | GitHub App 數字 ID。 |
| `GITHUB_APP_SLUG` | GitHub App URL slug，用於開始 repository installation。 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub App 使用者授權憑證。 |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App 私鑰。請將換行符號轉義後，放在單一環境變數中。 |

請勿透過 `NEXT_PUBLIC_` 變數、瀏覽器程式碼、log 或 issue 報告暴露這些值。

## 使用者連線流程

1. 作者選擇 **Use GitHub to sign in**。GitHub OAuth 用於識別作者；Draftwell 不會要求個人 access token。
2. 作者選擇 **Choose repositories on GitHub**，GitHub 會顯示 App installation 頁面。作者可選擇 App 能寫入的 repositories。
3. GitHub 將使用者導回 Draftwell。repository selector 只會顯示該 installation 中的 repositories，作者再選擇發布目的地。

單獨使用 OAuth 登入，無法安全限制 repository 的寫入權限。GitHub App installation 步驟才會提供 repository 層級、可撤銷的權限控制。

## 檢查

```bash
npm test
npm run lint
npm run build
```
