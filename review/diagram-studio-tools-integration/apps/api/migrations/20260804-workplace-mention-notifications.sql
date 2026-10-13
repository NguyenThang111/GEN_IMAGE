CREATE TABLE IF NOT EXISTS task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipientId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "taskId" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "commentId" uuid NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_notifications_recipient_comment_unique UNIQUE ("recipientId", "commentId")
);

CREATE INDEX IF NOT EXISTS task_notifications_recipient_created_idx
  ON task_notifications ("recipientId", "createdAt" DESC);
