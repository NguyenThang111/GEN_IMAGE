BEGIN;

ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "valueLevel" varchar(16);
ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "valueRate" integer;
ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "standardHours" decimal(5,2);
ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "completionRate" decimal(3,2);
ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "reopenCount" integer;
ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "stabilityRate" decimal(3,2);

DO $$ BEGIN
  ALTER TABLE worklogs ADD CONSTRAINT worklogs_value_level CHECK ("valueLevel" IS NULL OR "valueLevel" IN ('BASIC', 'DEV', 'RND'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE worklogs ADD CONSTRAINT worklogs_value_rate CHECK ("valueRate" IS NULL OR "valueRate" IN (50, 100, 300));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE worklogs ADD CONSTRAINT worklogs_standard_hours CHECK ("standardHours" IS NULL OR ("standardHours" >= 0.25 AND "standardHours" <= 24));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE worklogs ADD CONSTRAINT worklogs_completion_rate CHECK ("completionRate" IS NULL OR "completionRate" IN (0, 0.6, 1));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE worklogs ADD CONSTRAINT worklogs_reopen_count CHECK ("reopenCount" IS NULL OR ("reopenCount" >= 0 AND "reopenCount" <= 100));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE worklogs ADD CONSTRAINT worklogs_stability_rate CHECK ("stabilityRate" IS NULL OR "stabilityRate" IN (0.5, 0.8, 1));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE worklogs DROP CONSTRAINT IF EXISTS worklogs_point_range;
ALTER TABLE worklogs ADD CONSTRAINT worklogs_point_range CHECK (point IS NULL OR (point >= 0 AND point <= 7200));

COMMIT;
