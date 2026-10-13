BEGIN;

DO $$ BEGIN
  CREATE TYPE worklogs_status_enum AS ENUM ('BACKLOG', 'OPEN', 'ENDED', 'DONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum value
    JOIN pg_type type ON type.oid = value.enumtypid
    WHERE type.typname = 'worklogs_status_enum' AND value.enumlabel = 'FAILED'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum value
    JOIN pg_type type ON type.oid = value.enumtypid
    WHERE type.typname = 'worklogs_status_enum' AND value.enumlabel = 'ENDED'
  ) THEN
    ALTER TYPE worklogs_status_enum RENAME VALUE 'FAILED' TO 'ENDED';
  END IF;
END $$;

ALTER TYPE worklogs_status_enum ADD VALUE IF NOT EXISTS 'BACKLOG' BEFORE 'OPEN';
ALTER TYPE worklogs_status_enum ADD VALUE IF NOT EXISTS 'ENDED' BEFORE 'DONE';

CREATE TABLE IF NOT EXISTS worklogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "createdById" uuid NOT NULL,
  input text NOT NULL,
  output text,
  status worklogs_status_enum NOT NULL DEFAULT 'OPEN',
  "startedAt" timestamptz NOT NULL,
  "endedAt" timestamptz,
  "hoursWorked" decimal(5,2),
  point integer,
  "scoredById" uuid REFERENCES users(id) ON DELETE SET NULL,
  "scoredAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worklogs_hours_range CHECK ("hoursWorked" IS NULL OR ("hoursWorked" > 0 AND "hoursWorked" <= 24)),
  CONSTRAINT worklogs_point_range CHECK (point IS NULL OR (point >= 0 AND point <= 1000))
);

ALTER TABLE worklogs ADD COLUMN IF NOT EXISTS "createdById" uuid;
UPDATE worklogs SET "createdById" = "userId" WHERE "createdById" IS NULL;
ALTER TABLE worklogs ALTER COLUMN "createdById" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE worklogs ADD CONSTRAINT worklogs_created_by_fk FOREIGN KEY ("createdById") REFERENCES users(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS worklogs_user_started_idx ON worklogs ("userId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS worklogs_status_started_idx ON worklogs (status, "startedAt" DESC);

COMMIT;
