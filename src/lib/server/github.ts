import "server-only";

import { createAppAuth } from "@octokit/auth-app";
import { githubAppEnvironment } from "@/lib/server/env";

export async function installationAccessToken(installationId: number): Promise<string> {
  const config = githubAppEnvironment();
  const auth = createAppAuth({ appId: config.appId, privateKey: config.privateKey });
  const result = await auth({ type: "installation", installationId });
  return result.token;
}

export async function verifyInstallation(installationId: number): Promise<void> {
  const config = githubAppEnvironment();
  const auth = createAppAuth({ appId: config.appId, privateKey: config.privateKey });
  const appToken = await auth({ type: "app" });
  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${appToken.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error("GitHub App installation was not found or is no longer accessible.");
}

async function installationRequest(installationId: number, path: string, init?: RequestInit): Promise<Response> {
  const token = await installationAccessToken(installationId);
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...init?.headers },
  });
}

export async function assertRepositoryAccess(installationId: number, owner: string, repository: string): Promise<void> {
  const response = await installationRequest(installationId, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`);
  if (!response.ok) throw new Error("The selected repository is not available to this GitHub App installation.");
}

export async function listInstallationRepositories(installationId: number): Promise<Array<{ fullName: string; defaultBranch: string }>> {
  const response = await installationRequest(installationId, "/installation/repositories?per_page=100");
  const result = await response.json() as { repositories?: Array<{ full_name?: string; default_branch?: string }> };
  if (!response.ok) throw new Error("GitHub could not list repositories for this installation.");
  return (result.repositories ?? [])
    .filter((repository): repository is { full_name: string; default_branch: string } => Boolean(repository.full_name && repository.default_branch))
    .map((repository) => ({ fullName: repository.full_name, defaultBranch: repository.default_branch }));
}

export async function createRepositoryFile(input: { installationId: number; owner: string; repository: string; branch: string; path: string; content: string; message: string; binary?: boolean }) {
  const path = input.path.split("/").map(encodeURIComponent).join("/");
  const current = await installationRequest(input.installationId, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/contents/${path}?ref=${encodeURIComponent(input.branch)}`);
  if (current.ok) throw new Error("A post already exists at this path. Rename it or add overwrite support before publishing.");
  if (current.status !== 404) throw new Error(`GitHub could not check the target path (${current.status}).`);
  const response = await installationRequest(input.installationId, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: input.message, content: Buffer.from(input.content, input.binary ? "binary" : "utf8").toString("base64"), branch: input.branch }),
  });
  const result = await response.json() as { commit?: { sha?: string; html_url?: string }; message?: string };
  if (!response.ok || !result.commit?.sha || !result.commit.html_url) throw new Error(result.message ?? "GitHub could not create the post commit.");
  return { sha: result.commit.sha, url: result.commit.html_url };
}

type RepositoryTarget = { installationId: number; owner: string; repository: string; branch: string };

export async function listMarkdownFiles(target: RepositoryTarget, directory: string) {
  const path = directory.split("/").map(encodeURIComponent).join("/");
  const response = await installationRequest(target.installationId, `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repository)}/contents/${path}?ref=${encodeURIComponent(target.branch)}`);
  const result = await response.json() as Array<{ name?: string; path?: string; type?: string }>;
  if (!response.ok || !Array.isArray(result)) throw new Error("GitHub could not list the post directory.");
  return result.filter((entry) => entry.type === "file" && entry.name?.endsWith(".md") && entry.path).map((entry) => ({ name: entry.name as string, path: entry.path as string }));
}

export async function readRepositoryFile(target: RepositoryTarget, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await installationRequest(target.installationId, `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repository)}/contents/${encodedPath}?ref=${encodeURIComponent(target.branch)}`);
  const result = await response.json() as { content?: string; encoding?: string; sha?: string; message?: string };
  if (!response.ok || !result.content || result.encoding !== "base64" || !result.sha) throw new Error(result.message ?? "GitHub could not read this post.");
  return { content: Buffer.from(result.content.replaceAll("\n", ""), "base64").toString("utf8"), sha: result.sha };
}

export async function updateRepositoryFile(target: RepositoryTarget, path: string, sha: string, content: string, message: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await installationRequest(target.installationId, `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repository)}/contents/${encodedPath}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, content: Buffer.from(content).toString("base64"), branch: target.branch, sha }) });
  const result = await response.json() as { commit?: { sha?: string; html_url?: string }; message?: string };
  if (!response.ok || !result.commit?.sha || !result.commit.html_url) throw new Error(result.message ?? "GitHub could not update this post.");
  return { sha: result.commit.sha, url: result.commit.html_url };
}

export async function deleteRepositoryFile(target: RepositoryTarget, path: string, sha: string, message: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await installationRequest(target.installationId, `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repository)}/contents/${encodedPath}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, branch: target.branch, sha }) });
  const result = await response.json() as { commit?: { html_url?: string }; message?: string };
  if (!response.ok || !result.commit?.html_url) throw new Error(result.message ?? "GitHub could not delete this post.");
  return { url: result.commit.html_url };
}
