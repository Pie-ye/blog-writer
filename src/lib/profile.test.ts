import assert from "node:assert/strict";
import test from "node:test";
import { validateRepositoryProfile } from "./profile";

test("validates a Hugo repository profile", () => {
  const profile = validateRepositoryProfile({ installationId: 42, owner: "Pie-ye", repository: "my-blog" });
  assert.equal(profile.contentDirectory, "content/post");
  assert.equal(profile.imageDirectory, "static/images/posts");
});

test("rejects paths outside Hugo content/static directories", () => {
  assert.throws(() => validateRepositoryProfile({ installationId: 42, owner: "pie", repository: "blog", contentDirectory: "posts" }));
  assert.throws(() => validateRepositoryProfile({ installationId: 42, owner: "pie", repository: "blog", imageDirectory: "images" }));
});
