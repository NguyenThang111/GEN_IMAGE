BEGIN;

ALTER TABLE worklogs
  ADD COLUMN IF NOT EXISTS "primaryTaskId" uuid,
  ADD COLUMN IF NOT EXISTS "outputCriteria" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "resultModelVersion" smallint NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_worklogs_primary_task'
  ) THEN
    ALTER TABLE worklogs
      ADD CONSTRAINT "FK_worklogs_primary_task"
      FOREIGN KEY ("primaryTaskId") REFERENCES tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_worklogs_primary_task_started_at"
  ON worklogs ("primaryTaskId", "startedAt");

UPDATE worklogs worklog
SET "primaryTaskId" = source."taskId"
FROM (
  SELECT "worklogId", MIN("taskId"::text)::uuid AS "taskId"
  FROM worklog_tasks
  GROUP BY "worklogId"
  HAVING COUNT(*) = 1
) source
WHERE source."worklogId" = worklog.id
  AND worklog."primaryTaskId" IS NULL;

COMMIT;
