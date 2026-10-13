BEGIN;
CREATE TABLE IF NOT EXISTS performance_periods (
  month varchar(7) PRIMARY KEY CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  "effectiveDate" date NOT NULL,
  "targetPoint" integer NOT NULL CHECK ("targetPoint" > 0),
  "memberIds" jsonb NOT NULL,
  "createdById" uuid NOT NULL REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS performance_plans (
  "taskId" uuid PRIMARY KEY REFERENCES tasks(id) ON DELETE RESTRICT,
  point integer NOT NULL CHECK (point > 0),
  "standardHours" numeric(8,2) NOT NULL CHECK ("standardHours" > 0),
  shares jsonb NOT NULL,
  "createdById" uuid NOT NULL REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS performance_attestations (
  month varchar(7) NOT NULL REFERENCES performance_periods(month),
  "userId" uuid NOT NULL REFERENCES users(id),
  fingerprint varchar(64) NOT NULL,
  "verifiedById" uuid NOT NULL REFERENCES users(id),
  "verifiedAt" timestamptz NOT NULL,
  PRIMARY KEY (month, "userId")
);
COMMIT;
