BEGIN;

DO $$
DECLARE task_status_type text;
BEGIN
  SELECT udt_name INTO task_status_type
  FROM information_schema.columns
  WHERE table_name = 'tasks' AND column_name = 'status';
  IF task_status_type IS NULL THEN
    RAISE EXCEPTION 'tasks.status enum was not found';
  END IF;
  EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', task_status_type, 'BACKLOG');
END $$;

COMMIT;

BEGIN;

WITH reopen_counts AS (
  SELECT original.id,
    COALESCE(original."reopenBaseCount", 0) + COUNT(reopened.id)::integer AS reopen_count
  FROM worklogs original
  LEFT JOIN worklogs reopened
    ON reopened."reopenedWorklogId" = original.id
    AND reopened."workType" = 'REOPEN'
    AND reopened."deletedAt" IS NULL
  WHERE original."deletedAt" IS NULL
  GROUP BY original.id
)
UPDATE worklogs row
SET
  "valueRate" = CASE row."valueLevel" WHEN 'BASIC' THEN 50 WHEN 'DEV' THEN 100 WHEN 'RND' THEN 300 END,
  "standardHours" = row."hoursWorked",
  "completionRate" = 1,
  "reopenCount" = counts.reopen_count,
  "stabilityStatus" = CASE
    WHEN row."workType" <> 'REOPEN' AND counts.reopen_count = 0 AND row."stabilityStatus" = 'CONFIRMED' THEN 'CONFIRMED'
    ELSE 'PENDING'
  END,
  "stabilityRate" = CASE
    WHEN row."workType" <> 'REOPEN' AND counts.reopen_count = 0 AND row."stabilityStatus" = 'CONFIRMED' THEN 1
    ELSE 0.8
  END,
  point = CASE
    WHEN row."workType" = 'REOPEN' THEN 0
    ELSE ROUND(
      row."hoursWorked"::numeric
      * CASE row."valueLevel" WHEN 'BASIC' THEN 50 WHEN 'DEV' THEN 100 WHEN 'RND' THEN 300 END
      * CASE WHEN counts.reopen_count = 0 AND row."stabilityStatus" = 'CONFIRMED' THEN 1 ELSE 0.8 END
    )::integer
  END,
  "scoredAt" = COALESCE(row."scoredAt", NOW())
FROM reopen_counts counts
WHERE row.id = counts.id
  AND row.status = 'DONE'
  AND row."hoursWorked" IS NOT NULL
  AND row."valueLevel" IS NOT NULL;

COMMIT;
