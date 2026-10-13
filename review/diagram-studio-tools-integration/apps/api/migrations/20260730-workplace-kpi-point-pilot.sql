ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "outputScopeScore" smallint;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "complexityScore" smallint;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "uncertaintyScore" smallint;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "riskScore" smallint;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "verificationScore" smallint;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "dueRate" numeric(3,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "qualityRate" numeric(3,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "reliabilityRate" numeric(3,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "riskReportedById" uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "riskReportedAt" timestamptz;

ALTER TABLE task_assignees ADD COLUMN IF NOT EXISTS position smallint NOT NULL DEFAULT 0;
ALTER TABLE task_assignees ADD COLUMN IF NOT EXISTS "sharePercent" numeric(5,2) NOT NULL DEFAULT 100;

WITH ranked AS (
  SELECT "taskId", "userId",
    row_number() OVER (PARTITION BY "taskId" ORDER BY "assignedAt", "userId") - 1 AS position,
    count(*) OVER (PARTITION BY "taskId") AS assignee_count
  FROM task_assignees
)
UPDATE task_assignees assignment
SET position = ranked.position,
    "sharePercent" = CASE
      WHEN ranked.assignee_count = 1 THEN 100
      WHEN ranked.assignee_count = 2 AND ranked.position = 0 THEN 75
      WHEN ranked.assignee_count = 2 THEN 25
      WHEN ranked.assignee_count = 3 AND ranked.position = 0 THEN 50
      WHEN ranked.assignee_count = 3 AND ranked.position = 1 THEN 30
      WHEN ranked.assignee_count = 3 THEN 20
      ELSE round(100.0 / ranked.assignee_count, 2)
    END
FROM ranked
WHERE assignment."taskId" = ranked."taskId" AND assignment."userId" = ranked."userId";

CREATE TABLE IF NOT EXISTS task_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "taskId" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text text NOT NULL,
  position smallint NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  "firstReviewPassed" boolean
);

CREATE INDEX IF NOT EXISTS task_criteria_task_position_idx ON task_criteria ("taskId", position);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_event_type') THEN
    ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'RISK_REPORTED';
    ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'REVIEWED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_events_type_enum') THEN
    ALTER TYPE task_events_type_enum ADD VALUE IF NOT EXISTS 'RISK_REPORTED';
    ALTER TYPE task_events_type_enum ADD VALUE IF NOT EXISTS 'REVIEWED';
  END IF;
END $$;
