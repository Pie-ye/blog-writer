"use client";

import { ChangeEvent, ClipboardEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  buildPostPath,
  DEFAULT_PROFILE,
  parseTaxonomyInput,
  parseHugoPost,
  renderHugoPost,
  type PostMetadata,
} from "@/lib/content";
import { assertMediaUpload, requiresProcessing } from "@/lib/media";

function taipeiDateTimeInput(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_PROFILE.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts();
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

const initialMetadata: PostMetadata = {
  title: "",
  date: "",
  draft: false,
  comments: true,
  categories: ["全部"],
  tags: [],
};

const initialBody = "今天想記下什麼？\n";

type Notice = { tone: "info" | "error"; message: string } | null;
type ProfileDraft = { installationId: string; owner: string; repository: string; branch: string; contentDirectory: string; imageDirectory: string; timezone: string };
type RepositoryOption = { fullName: string; defaultBranch: string };
type PostOption = { name: string; path: string };

function formatBytes(value: number): string {
  return `${(value / (1024 * 1024)).toFixed(value > 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

export function Writer() {
  const [metadata, setMetadata] = useState(initialMetadata);
  const [body, setBody] = useState(initialBody);
  const [categoriesInput, setCategoriesInput] = useState(initialMetadata.categories.join(", "));
  const [tagsInput, setTagsInput] = useState("");
  const [profile, setProfile] = useState<ProfileDraft>({ installationId: "", owner: "", repository: "", branch: DEFAULT_PROFILE.branch, contentDirectory: DEFAULT_PROFILE.contentDirectory, imageDirectory: DEFAULT_PROFILE.imageDirectory, timezone: DEFAULT_PROFILE.timezone });
  const [installations, setInstallations] = useState<number[]>([]);
  const [repositories, setRepositories] = useState<RepositoryOption[]>([]);
  const [installationReload, setInstallationReload] = useState(0);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostOption[]>([]);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [editorBaseline, setEditorBaseline] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({
    tone: "info",
    message: "GitHub App 尚未連線。你可以先編輯與預覽，發布會在完成設定後啟用。",
  });
  const [hydrated, setHydrated] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function editorStateKey(nextMetadata: PostMetadata, nextBody: string, nextEditingPath: string | null, nextCategoriesInput: string, nextTagsInput: string): string {
    return JSON.stringify({ nextMetadata, nextBody, nextEditingPath, nextCategoriesInput, nextTagsInput });
  }

  function currentEditorKey(): string {
    return editorStateKey(metadata, body, editingPath, categoriesInput, tagsInput);
  }

  function hasUnsavedChanges(): boolean {
    return editorBaseline !== null && editorBaseline !== currentEditorKey();
  }

  function confirmDiscardChanges(): boolean {
    return !hasUnsavedChanges() || window.confirm("目前有尚未儲存的變更，確定要捨棄嗎？");
  }

  function metadataWithTaxonomyInputs(): PostMetadata {
    return {
      ...metadata,
      categories: parseTaxonomyInput(categoriesInput),
      tags: parseTaxonomyInput(tagsInput),
    };
  }

  function commitTaxonomyInputs(): PostMetadata {
    const nextMetadata = metadataWithTaxonomyInputs();
    const nextCategoriesInput = nextMetadata.categories.join(", ");
    const nextTagsInput = nextMetadata.tags.join(", ");
    setCategoriesInput(nextCategoriesInput);
    setTagsInput(nextTagsInput);
    setMetadata(nextMetadata);
    return nextMetadata;
  }

  function resetToNewPost() {
    const nextMetadata = { ...initialMetadata, date: taipeiDateTimeInput() };
    const nextCategoriesInput = nextMetadata.categories.join(", ");
    const nextTagsInput = nextMetadata.tags.join(", ");
    setMetadata(nextMetadata);
    setBody(initialBody);
    setCategoriesInput(nextCategoriesInput);
    setTagsInput(nextTagsInput);
    setEditingPath(null);
    setEditorBaseline(editorStateKey(nextMetadata, initialBody, null, nextCategoriesInput, nextTagsInput));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextMetadata = { ...initialMetadata, date: taipeiDateTimeInput() };
      const nextCategoriesInput = nextMetadata.categories.join(", ");
      const nextTagsInput = nextMetadata.tags.join(", ");
      setMetadata(nextMetadata);
      setCategoriesInput(nextCategoriesInput);
      setTagsInput(nextTagsInput);
      setEditorBaseline(editorStateKey(nextMetadata, initialBody, null, nextCategoriesInput, nextTagsInput));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function syncInstallations() {
    const response = await fetch("/api/installations/sync", { method: "POST" });
    const result = await response.json() as { error?: string; installations?: number[] };
    if (!response.ok) { setNotice({ tone: "error", message: result.error ?? "Could not sync GitHub App installations." }); return; }
    if (!result.installations?.length) { window.location.assign("/api/github/install"); return; }
    setInstallationReload((value) => value + 1);
    setNotice({ tone: "info", message: "GitHub App installations are synced. Choose an installation and repository below." });
  }

  async function logoutGithub() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      setNotice({ tone: "error", message: "Could not sign out of GitHub." });
      return;
    }
    setGithubLogin(null);
    setInstallations([]);
    setRepositories([]);
    setPosts([]);
    setEditingPath(null);
    setActiveProfileId(null);
    setEditorBaseline(null);
    setProfile({ installationId: "", owner: "", repository: "", branch: DEFAULT_PROFILE.branch, contentDirectory: DEFAULT_PROFILE.contentDirectory, imageDirectory: DEFAULT_PROFILE.imageDirectory, timezone: DEFAULT_PROFILE.timezone });
    setNotice({ tone: "info", message: "已登出 GitHub。你可以重新登入測試流程。" });
  }

  useEffect(() => {
    void fetch("/api/session").then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { user?: { login?: string } };
      if (result.user?.login) {
        setGithubLogin(result.user.login);
        setNotice({ tone: "info", message: `已使用 GitHub 帳號 @${result.user.login} 登入。請在下方選擇授權的 repository。` });
        void syncInstallations();
      }
    });
  }, []);

  useEffect(() => {
    void fetch("/api/installations").then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { installations?: number[] };
      const ids = result.installations ?? [];
      setInstallations(ids);
      if (ids.length === 1) setProfile((current) => ({ ...current, installationId: String(ids[0]) }));
    });
  }, [installationReload]);

  useEffect(() => {
    if (!profile.installationId) return;
    void fetch(`/api/installations/${profile.installationId}/repositories`).then(async (response) => {
      const result = await response.json() as { repositories?: RepositoryOption[]; error?: string };
      if (!response.ok) { setNotice({ tone: "error", message: result.error ?? "Could not load repositories." }); return; }
      setRepositories(result.repositories ?? []);
    });
  }, [profile.installationId]);

  useEffect(() => {
    if (!activeProfileId) return;
    void fetch(`/api/posts?profileId=${encodeURIComponent(activeProfileId)}`).then(async (response) => {
      const result = await response.json() as { posts?: PostOption[]; error?: string };
      if (!response.ok) { setNotice({ tone: "error", message: result.error ?? "Could not load posts." }); return; }
      setPosts(result.posts ?? []);
    });
  }, [activeProfileId]);

  if (!hydrated) {
    return (
      <main className="writer-shell">
        <header className="masthead">
          <Link className="wordmark" href="/">Draftwell<span>.</span></Link>
          <button className="repo-status" type="button" disabled><span className="status-dot" /> Loading</button>
        </header>
      </main>
    );
  }

  const previewMetadata = metadataWithTaxonomyInputs();

  const source = (() => {
    try {
      return renderHugoPost(previewMetadata, body);
    } catch {
      return "請輸入標題與有效日期後預覽 Hugo 原始檔。";
    }
  })();

  const postPath = (() => {
    try {
      return buildPostPath(DEFAULT_PROFILE.contentDirectory, previewMetadata);
    } catch {
      return "content/post/YYYY-MM-DD 標題.md";
    }
  })();

  function insertMedia(file: File) {
    try {
      assertMediaUpload(file);
      if (!activeProfileId) throw new Error("Save a repository profile before uploading media.");
      if (requiresProcessing(file.size)) throw new Error(`${file.name} (${formatBytes(file.size)}) requires the media worker before it can be uploaded.`);
      const form = new FormData();
      form.set("profileId", activeProfileId);
      form.set("date", metadata.date);
      form.set("file", file);
      void fetch("/api/media", { method: "POST", body: form }).then(async (response) => {
        const result = await response.json() as { markup?: string; error?: string };
        if (!response.ok || !result.markup) throw new Error(result.error ?? "Could not upload media.");
        setBody((current) => `${current.trimEnd()}\n\n${result.markup}\n`);
        setNotice({ tone: "info", message: `${file.name} was committed to GitHub and inserted into the draft.` });
      }).catch((error: unknown) => setNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not upload media." }));
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "無法加入媒體檔案。" });
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const media = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!media) return;
    event.preventDefault();
    insertMedia(media);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    if (file) insertMedia(file);
    event.target.value = "";
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...profile, installationId: Number(profile.installationId) }) });
    const result = await response.json() as { error?: string; id?: string };
    if (response.ok) {
      setActiveProfileId(result.id ?? null);
      setNotice({ tone: "info", message: `Repository profile saved (${result.id}).` });
    } else {
      setNotice({ tone: "error", message: result.error ?? "Could not save repository profile." });
    }
  }

  async function publishPost() {
    if (!activeProfileId) { setNotice({ tone: "error", message: "Save a repository profile before publishing." }); return; }
    const nextMetadata = commitTaxonomyInputs();
    const response = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: activeProfileId, metadata: nextMetadata, body }) });
    const result = await response.json() as { error?: string; commit?: { url: string } };
    if (response.ok && result.commit) {
      setEditorBaseline(editorStateKey(nextMetadata, body, null, nextMetadata.categories.join(", "), nextMetadata.tags.join(", ")));
      setNotice({ tone: "info", message: `Published. Commit: ${result.commit.url}` });
    } else {
      setNotice({ tone: "error", message: result.error ?? "Could not publish post." });
    }
  }

  async function openPost(path: string) {
    if (!activeProfileId) return;
    if (path === editingPath || !confirmDiscardChanges()) return;
    const response = await fetch(`/api/post?profileId=${encodeURIComponent(activeProfileId)}&path=${encodeURIComponent(path)}`);
    const result = await response.json() as { content?: string; error?: string };
    if (!response.ok || !result.content) { setNotice({ tone: "error", message: result.error ?? "Could not open post." }); return; }
    try {
      const parsed = parseHugoPost(result.content);
      const nextCategoriesInput = parsed.metadata.categories.join(", ");
      const nextTagsInput = parsed.metadata.tags.join(", ");
      setMetadata(parsed.metadata);
      setCategoriesInput(nextCategoriesInput);
      setTagsInput(nextTagsInput);
      setBody(parsed.body);
      setEditingPath(path);
      setEditorBaseline(editorStateKey(parsed.metadata, parsed.body, path, nextCategoriesInput, nextTagsInput));
    } catch (error) { setNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not parse post." }); }
  }

  async function saveExistingPost() {
    if (!activeProfileId || !editingPath) return;
    const nextMetadata = commitTaxonomyInputs();
    const response = await fetch("/api/post", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: activeProfileId, path: editingPath, metadata: nextMetadata, body }) });
    const result = await response.json() as { error?: string };
    if (response.ok) {
      setEditorBaseline(editorStateKey(nextMetadata, body, editingPath, nextMetadata.categories.join(", "), nextMetadata.tags.join(", ")));
      setNotice({ tone: "info", message: "Post updated on GitHub." });
    } else {
      setNotice({ tone: "error", message: result.error ?? "Could not update post." });
    }
  }

  function startNewPost() {
    if (!confirmDiscardChanges()) return;
    resetToNewPost();
  }

  async function deleteExistingPost() {
    if (!activeProfileId || !editingPath || !window.confirm("Delete this post from GitHub?")) return;
    const response = await fetch("/api/post", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: activeProfileId, path: editingPath }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setNotice({ tone: "error", message: result.error ?? "Could not delete post." }); return; }
    setPosts((current) => current.filter((post) => post.path !== editingPath)); resetToNewPost(); setNotice({ tone: "info", message: "Post deleted from GitHub." });
  }

  return (
    <main className="writer-shell">
      <header className="masthead">
        <Link className="wordmark" href="/">Draftwell<span>.</span></Link>
        {githubLogin
          ? <button className="repo-status" type="button" onClick={() => void logoutGithub()}><span className="status-dot connected" /> GitHub: @{githubLogin} · 登出</button>
          : <button className="repo-status" type="button" onClick={() => window.location.assign("/api/auth/github/login")}><span className="status-dot" /> 使用 GitHub 登入</button>}
      </header>

      <section className="intro">
        <p className="eyebrow">HUGO WRITING DESK</p>
        <h1>把每天的片段，<br />寫回你的 repository。</h1>
        <p>文章與媒體只會發布到你選擇的 GitHub repository。這個工作台預設對應 Hugo 的 <code>content/post</code> 與 <code>static/images/posts</code>。</p>
      </section>

      {notice && <div className={`notice ${notice.tone}`}>{notice.message}</div>}

      <form className="profile-card" onSubmit={saveProfile}>
        <div className="profile-intro"><p className="eyebrow">REPOSITORY</p><strong>GitHub 登入後會自動取得授權給 Draftwell 的 repositories。</strong><span>選擇 repository 後儲存 profile，即可讀取、編輯與發布 Hugo posts。</span></div>
        <label>3. GitHub App installation<select required value={profile.installationId} onChange={(event) => setProfile({ ...profile, installationId: event.target.value, owner: "", repository: "" })}><option value="">Choose an installation</option>{installations.map((id) => <option key={id} value={id}>GitHub App installation #{id}</option>)}</select></label>
        <label>Repository<select required disabled={!profile.installationId} value={profile.owner && profile.repository ? `${profile.owner}/${profile.repository}` : ""} onChange={(event) => { const selected = repositories.find((repository) => repository.fullName === event.target.value); if (!selected) return; const [owner, repository] = selected.fullName.split("/"); setProfile({ ...profile, owner, repository, branch: selected.defaultBranch }); }}><option value="">{profile.installationId ? "Choose a repository" : "Install the App first"}</option>{repositories.map((repository) => <option key={repository.fullName} value={repository.fullName}>{repository.fullName}</option>)}</select></label>
        <label>Branch<input required value={profile.branch} onChange={(event) => setProfile({ ...profile, branch: event.target.value })} /></label>
        <label>Content directory<input required value={profile.contentDirectory} onChange={(event) => setProfile({ ...profile, contentDirectory: event.target.value })} /></label>
        <label>Media directory<input required value={profile.imageDirectory} onChange={(event) => setProfile({ ...profile, imageDirectory: event.target.value })} /></label>
        <label>Timezone<input required value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} /></label>
        <div className="profile-actions"><button className="quiet-button" type="submit">Save profile</button></div>
      </form>

      <section className="workspace">
        <div className="editor-pane">
          <div className="pane-heading"><span>EDITOR</span><span>{editingPath ?? postPath}</span></div>
          {posts.length > 0 && <nav className="post-list" aria-label="Past posts"><span>PAST POSTS</span><button type="button" className={!editingPath ? "selected" : ""} onClick={startNewPost}>新增文章</button>{posts.map((post) => <button type="button" key={post.path} className={post.path === editingPath ? "selected" : ""} onClick={() => void openPost(post.path)}>{post.name}</button>)}</nav>}
          <div className="metadata-grid">
            <label className="title-field">標題
              <input value={metadata.title} onChange={(event) => setMetadata({ ...metadata, title: event.target.value })} placeholder="今天的標題" />
            </label>
            <label>發布時間
              <input type="datetime-local" value={metadata.date} onChange={(event) => setMetadata({ ...metadata, date: event.target.value })} />
            </label>
            <label>分類（逗號分隔）
              <input value={categoriesInput} onChange={(event) => setCategoriesInput(event.target.value)} onBlur={() => { commitTaxonomyInputs(); }} />
            </label>
            <label>標籤（逗號分隔）
              <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} onBlur={() => { commitTaxonomyInputs(); }} placeholder="日常, 心情" />
            </label>
          </div>
          <div className="toggle-row">
            <label><input type="checkbox" checked={metadata.draft} onChange={(event) => setMetadata({ ...metadata, draft: event.target.checked })} /> 草稿</label>
            <label><input type="checkbox" checked={metadata.comments} onChange={(event) => setMetadata({ ...metadata, comments: event.target.checked })} /> 開放留言</label>
          </div>
          <textarea aria-label="Markdown 文章內容" value={body} onChange={(event) => setBody(event.target.value)} onPaste={onPaste} />
          <div className="editor-actions">
            <button type="button" className="quiet-button" onClick={() => fileInput.current?.click()}>加入媒體</button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4" onChange={onFileChange} hidden />
            <span>可貼上 PNG / JPEG / WebP / GIF，或選擇 MP4。</span>
          </div>
        </div>

        <aside className="preview-pane">
          <div className="pane-heading"><span>HUGO OUTPUT</span><span>preview</span></div>
          <pre>{source}</pre>
          {editingPath ? <><button type="button" className="publish-button" onClick={() => void saveExistingPost()}>儲存修改</button><button type="button" className="delete-button" onClick={() => void deleteExistingPost()}>刪除這篇文章</button></> : <button type="button" className="publish-button" onClick={publishPost}>發布到 GitHub</button>}
        </aside>
      </section>

      <footer>Hugo only · media is validated server-side · no content is stored by Draftwell</footer>
    </main>
  );
}
