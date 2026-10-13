BEGIN;

CREATE TABLE IF NOT EXISTS worklog_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "weekStart" date NOT NULL UNIQUE,
  "weekEnd" date NOT NULL,
  goal text,
  status varchar(16) NOT NULL DEFAULT 'OPEN',
  "summarySnapshot" jsonb,
  "closedById" uuid REFERENCES users(id) ON DELETE SET NULL,
  "closedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_worklog_weeks_status" CHECK (status IN ('OPEN', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS "IDX_worklog_weeks_status_start"
  ON worklog_weeks (status, "weekStart" DESC);

COMMIT;
