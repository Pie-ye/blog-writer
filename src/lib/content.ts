export const DEFAULT_PROFILE = {
  branch: "master",
  contentDirectory: "content/post",
  imageDirectory: "static/images/posts",
  timezone: "Asia/Taipei",
} as const;

export type PostMetadata = {
  title: string;
  date: string;
  draft: boolean;
  comments: boolean;
  categories: string[];
  tags: string[];
};

const UNSAFE_PATH = /(^\/|\\|\u0000|(^|\/)\.\.?(\/|$))/;
const TAIPEI_OFFSET = "+08:00";

export function normalizeRepositoryPath(path: string): string {
  const normalized = path.trim().replaceAll("\\", "/").replace(/\/{2,}/g, "/");

  if (!normalized || UNSAFE_PATH.test(normalized)) {
    throw new Error("Path must be a non-empty repository-relative path.");
  }

  return normalized.replace(/\/$/, "");
}

export function toHugoStaticUrl(repositoryPath: string): string {
  const normalized = normalizeRepositoryPath(repositoryPath);

  if (!normalized.startsWith("static/")) {
    throw new Error("Hugo media must be published inside the static directory.");
  }

  return `/${normalized.slice("static/".length)}`;
}

export function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-");

  if (!slug) {
    throw new Error("A title is required.");
  }

  return slug;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function yamlList(values: string[]): string[] {
  return values.map((value) => `  - ${yamlString(value.trim())}`);
}

function hugoTimestamp(value: string): string {
  const timestamp = value.length === 16 ? `${value}:00${TAIPEI_OFFSET}` : value;

  if (Number.isNaN(new Date(timestamp).valueOf())) {
    throw new Error("A valid publication date is required.");
  }

  return timestamp;
}

export function renderHugoPost(metadata: PostMetadata, body: string): string {
  const title = slugifyTitle(metadata.title);
  const date = hugoTimestamp(metadata.date);

  const lines = [
    "---",
    `title: ${yamlString(title)}`,
    `date: ${date}`,
    `lastmod: ${date}`,
    `draft: ${metadata.draft}`,
    `comments: ${metadata.comments}`,
    "categories:",
    ...yamlList(metadata.categories.filter(Boolean)),
    "tags:",
    ...yamlList(metadata.tags.filter(Boolean)),
    "---",
    "",
    body.trimEnd(),
    "",
  ];

  return lines.join("\n");
}

export function buildPostPath(contentDirectory: string, metadata: PostMetadata): string {
  const directory = normalizeRepositoryPath(contentDirectory);
  const datePrefix = hugoTimestamp(metadata.date).slice(0, 10);
  return `${directory}/${datePrefix} ${slugifyTitle(metadata.title)}.md`;
}

export function mediaMarkup(path: string, altText: string, mediaType: "image" | "video"): string {
  const url = toHugoStaticUrl(path);
  const safeAlt = altText.replaceAll("]", "").trim() || "media";

  return mediaType === "video"
    ? `<video controls src="${url}"></video>`
    : `![${safeAlt}](${url})`;
}

export function parseHugoPost(markdown: string): { metadata: PostMetadata; body: string } {
  const match = markdown.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("Post does not contain YAML front matter.");
  const frontMatter = match[1];
  const scalar = (name: string) => frontMatter.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.replace(/^"|"$/g, "") ?? "";
  const list = (name: string) => [...frontMatter.matchAll(new RegExp(`^${name}:\\s*\\r?\\n((?:\\s{2}- .*\\r?\\n?)*)`, "gm"))][0]?.[1].split(/\r?\n/).filter(Boolean).map((line) => line.replace(/^\s{2}-\s*/, "").replace(/^"|"$/g, "")) ?? [];
  return {
    metadata: { title: scalar("title"), date: scalar("date").slice(0, 16), draft: scalar("draft") === "true", comments: scalar("comments") !== "false", categories: list("categories"), tags: list("tags") },
    body: match[2].trim(),
  };
}
