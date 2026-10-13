CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "taskId" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "authorId" uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_comment_mentions (
  "commentId" uuid NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY ("commentId", "userId")
);

CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments ("taskId", "createdAt");
