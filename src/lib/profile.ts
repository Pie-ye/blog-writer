import { DEFAULT_PROFILE, normalizeRepositoryPath } from "@/lib/content";

export type RepositoryProfileInput = {
  installationId: number;
  owner: string;
  repository: string;
  branch?: string;
  contentDirectory?: string;
  imageDirectory?: string;
  timezone?: string;
};

export type RepositoryProfile = Required<Omit<RepositoryProfileInput, "installationId">> & {
  installationId: number;
};

const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/;

export function validateRepositoryProfile(input: RepositoryProfileInput): RepositoryProfile {
  if (!Number.isSafeInteger(input.installationId) || input.installationId <= 0) {
    throw new Error("A GitHub App installation is required.");
  }

  const owner = input.owner.trim();
  const repository = input.repository.trim();
  const branch = (input.branch ?? DEFAULT_PROFILE.branch).trim();
  const contentDirectory = normalizeRepositoryPath(input.contentDirectory ?? DEFAULT_PROFILE.contentDirectory);
  const imageDirectory = normalizeRepositoryPath(input.imageDirectory ?? DEFAULT_PROFILE.imageDirectory);
  const timezone = (input.timezone ?? DEFAULT_PROFILE.timezone).trim();

  if (!GITHUB_NAME.test(owner) || !GITHUB_NAME.test(repository) || !branch) {
    throw new Error("Repository owner, name, and branch contain unsupported characters.");
  }
  if (!contentDirectory.startsWith("content/") || !imageDirectory.startsWith("static/")) {
    throw new Error("Hugo content must be under content/ and media must be under static/.");
  }
  try {
    Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new Error("Timezone must be a valid IANA timezone.");
  }

  return { installationId: input.installationId, owner, repository, branch, contentDirectory, imageDirectory, timezone };
}
