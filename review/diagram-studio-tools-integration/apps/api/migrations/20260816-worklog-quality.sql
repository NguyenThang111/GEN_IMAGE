BEGIN;

ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "workType" varchar(16) NOT NULL DEFAULT 'NORMAL';
ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "reopenedWorklogId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'worklogs' AND column_name = 'reopenBaseCount') THEN
    ALTER TABLE worklogs ADD COLUMN "reopenBaseCount" integer NOT NULL DEFAULT 0;
    UPDATE worklogs SET "reopenBaseCount" = COALESCE("reopenCount", 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'worklogs' AND column_name = 'stabilityStatus') THEN
    ALTER TABLE worklogs ADD COLUMN "stabilityStatus" varchar(16) NOT NULL DEFAULT 'PENDING';
    UPDATE worklogs SET "stabilityStatus" = 'CONFIRMED' WHERE "scoredAt" IS NOT NULL AND point IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worklogs_reopened_worklog_fk') THEN
    ALTER TABLE worklogs
      ADD CONSTRAINT worklogs_reopened_worklog_fk
      FOREIGN KEY ("reopenedWorklogId") REFERENCES worklogs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worklogs_reopened_worklog_idx ON worklogs ("reopenedWorklogId") WHERE "reopenedWorklogId" IS NOT NULL;

COMMIT;
