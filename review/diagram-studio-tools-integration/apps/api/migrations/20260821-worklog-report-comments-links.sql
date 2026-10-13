ALTER TABLE worklogs
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO worklog_comments ("worklogId", "authorId", body, "createdAt")
SELECT
  worklog.id,
  worklog."userId",
  'Báo cáo cũ' || E'\n' || btrim(worklog.output),
  COALESCE(worklog."updatedAt", worklog."endedAt", worklog."createdAt")
FROM worklogs worklog
WHERE worklog.output IS NOT NULL
  AND btrim(worklog.output) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM worklog_comments comment
    WHERE comment."worklogId" = worklog.id
      AND comment."authorId" = worklog."userId"
      AND comment.body = 'Báo cáo cũ' || E'\n' || btrim(worklog.output)
  );

UPDATE worklogs
SET output = NULL
WHERE output IS NOT NULL;
