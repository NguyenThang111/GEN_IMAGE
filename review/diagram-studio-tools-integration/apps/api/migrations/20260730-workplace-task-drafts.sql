CREATE TABLE IF NOT EXISTS task_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic varchar(80) NOT NULL,
  description text,
  "assigneeIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "dueDate" date,
  "sourceStatus" varchar(40),
  "sourcePriority" varchar(20),
  "importKey" varchar(120) UNIQUE,
  "createdById" uuid NOT NULL REFERENCES users(id),
  "deletedById" uuid REFERENCES users(id),
  "deletedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_drafts_visible_created_idx
  ON task_drafts ("createdAt" DESC)
  WHERE "deletedAt" IS NULL;
