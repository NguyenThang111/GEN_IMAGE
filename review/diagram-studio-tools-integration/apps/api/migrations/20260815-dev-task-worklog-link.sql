BEGIN;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS suggestion text;
ALTER TABLE tasks ALTER COLUMN "dueDate" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS worklog_tasks (
  "worklogId" uuid NOT NULL REFERENCES worklogs(id) ON DELETE CASCADE,
  "taskId" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY ("worklogId", "taskId")
);

CREATE INDEX IF NOT EXISTS worklog_tasks_task_idx ON worklog_tasks ("taskId");

COMMIT;
