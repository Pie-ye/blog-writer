CREATE TABLE users (
  id text PRIMARY KEY,
  github_id bigint NOT NULL UNIQUE,
  github_login text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE github_installations (
  installation_id bigint PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE repository_profiles (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id bigint NOT NULL REFERENCES github_installations(installation_id) ON DELETE CASCADE,
  owner text NOT NULL,
  repository text NOT NULL,
  branch text NOT NULL,
  content_directory text NOT NULL,
  image_directory text NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, owner, repository, branch)
);
