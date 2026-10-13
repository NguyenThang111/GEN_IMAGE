ALTER TABLE task_notifications
  ALTER COLUMN "commentId" DROP NOT NULL;

ALTER TABLE task_notifications
  ADD COLUMN IF NOT EXISTS type varchar(32) NOT NULL DEFAULT 'TASK_MENTION',
  ADD COLUMN IF NOT EXISTS "eventId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_notifications_event_fk'
  ) THEN
    ALTER TABLE task_notifications
      ADD CONSTRAINT task_notifications_event_fk
      FOREIGN KEY ("eventId") REFERENCES task_events(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS task_notifications_recipient_event_unique
  ON task_notifications ("recipientId", "eventId")
  WHERE "eventId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS task_notifications_task_created_idx
  ON task_notifications ("taskId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_notifications_source_check'
  ) THEN
    ALTER TABLE task_notifications
      ADD CONSTRAINT task_notifications_source_check
      CHECK (
        ("commentId" IS NOT NULL AND "eventId" IS NULL)
        OR ("commentId" IS NULL AND "eventId" IS NOT NULL)
      );
  END IF;
END $$;
