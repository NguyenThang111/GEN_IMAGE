BEGIN;

DO $$ BEGIN
  CREATE TYPE "stock_count_sheets_status_enum" AS ENUM ('DRAFT','SUBMITTED','FINALIZED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS stock_count_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  "periodStart" date NOT NULL,
  "dueDate" date NOT NULL,
  status "stock_count_sheets_status_enum" NOT NULL DEFAULT 'DRAFT',
  "assigneeId" uuid NOT NULL,
  "createdById" uuid NOT NULL,
  "submittedById" uuid,
  "submittedAt" timestamptz,
  "finalizedById" uuid,
  "finalizedAt" timestamptz,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_count_sheets_status_due_idx ON stock_count_sheets (status,"dueDate");
CREATE INDEX IF NOT EXISTS stock_count_sheets_assignee_idx ON stock_count_sheets ("assigneeId");

COMMIT;
