BEGIN;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority varchar(10) NOT NULL DEFAULT 'NORMAL';
ALTER TABLE task_drafts ADD COLUMN IF NOT EXISTS priority varchar(10) NOT NULL DEFAULT 'NORMAL';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_check' AND conrelid = 'tasks'::regclass) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('HIGH', 'NORMAL', 'LOW'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_drafts_priority_check' AND conrelid = 'task_drafts'::regclass) THEN
    ALTER TABLE task_drafts ADD CONSTRAINT task_drafts_priority_check CHECK (priority IN ('HIGH', 'NORMAL', 'LOW'));
  END IF;
END $$;
COMMIT;
