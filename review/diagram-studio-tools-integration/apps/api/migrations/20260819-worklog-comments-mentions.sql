CREATE TABLE IF NOT EXISTS worklog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "worklogId" uuid NOT NULL REFERENCES worklogs(id) ON DELETE CASCADE,
  "authorId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worklog_comments_worklog_created_idx
  ON worklog_comments ("worklogId", "createdAt");

CREATE TABLE IF NOT EXISTS worklog_comment_mentions (
  "commentId" uuid NOT NULL REFERENCES worklog_comments(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY ("commentId", "userId")
);
