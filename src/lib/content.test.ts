import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPostPath,
  mediaMarkup,
  parseHugoPost,
  normalizeRepositoryPath,
  parseTaxonomyInput,
  renderHugoPost,
  toHugoStaticUrl,
} from "./content";

test("parses comma-delimited taxonomy input without empty values", () => {
  assert.deepEqual(
    parseTaxonomyInput("日常, 心情，, 旅行,"),
    ["日常", "心情", "旅行"],
  );
});

test("converts Hugo static paths into site-rooted URLs", () => {
  assert.equal(
    toHugoStaticUrl("static/images/posts/2026-07/photo.png"),
    "/images/posts/2026-07/photo.png",
  );
  assert.equal(
    mediaMarkup("static/images/posts/2026-07/movie.mp4", "movie", "video"),
    '<video controls src="/images/posts/2026-07/movie.mp4"></video>',
  );
});

test("parses existing Hugo posts that begin with a UTF-8 BOM", () => {
  const parsed = parseHugoPost("\uFEFF---\ntitle: \"舊文章\"\ndate: 2026-07-11T10:00:00+08:00\ndraft: false\ncomments: true\ncategories:\n  - \"全部\"\ntags:\n  - \"測試\"\n---\n\n內容");
  assert.equal(parsed.metadata.title, "舊文章");
  assert.equal(parsed.body, "內容");
});

test("rejects unsafe repository paths", () => {
  for (const path of ["/static/images", "static/../secrets", "", "../static/images"]) {
    assert.throws(() => normalizeRepositoryPath(path));
  }
});

test("renders Hugo-compatible front matter and post paths", () => {
  const metadata = {
    title: "今天 / 寫作",
    date: "2026-07-10T12:00",
    draft: false,
    comments: true,
    categories: ["全部", "日常"],
    tags: ["記錄"],
  };

  const post = renderHugoPost(metadata, "內容");
  assert.match(post, /^---\ntitle: "今天 - 寫作"/);
  assert.match(post, /date: 2026-07-10T12:00:00\+08:00/);
  assert.match(post, /comments: true/);
  assert.match(post, /categories:\n  - "全部"\n  - "日常"/);
  assert.equal(buildPostPath("content/post", metadata), "content/post/2026-07-10 今天 - 寫作.md");
});
