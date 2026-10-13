BEGIN;

ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "deletedById" uuid;
ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz;

DO $$ BEGIN
  ALTER TABLE worklogs ADD CONSTRAINT worklogs_deleted_by_fk FOREIGN KEY ("deletedById") REFERENCES users(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS worklogs_active_started_idx ON worklogs ("startedAt" DESC) WHERE "deletedAt" IS NULL;

COMMIT;
