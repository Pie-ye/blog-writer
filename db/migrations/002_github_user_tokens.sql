CREATE TABLE github_user_tokens (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
