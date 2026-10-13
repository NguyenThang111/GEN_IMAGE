CREATE TABLE IF NOT EXISTS warranty_cases (
  id uuid PRIMARY KEY,
  code varchar(32) NOT NULL UNIQUE,
  "customerReference" varchar(160) NOT NULL,
  "productName" varchar(120) NOT NULL,
  "receivedItems" varchar(240) NOT NULL,
  issue text NOT NULL,
  "repairResult" text,
  status varchar(16) NOT NULL DEFAULT 'RECEIVED',
  "isChargeable" boolean NOT NULL DEFAULT false,
  "assigneeId" uuid REFERENCES users(id) ON DELETE SET NULL,
  "createdById" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "updatedById" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "repairedAt" timestamptz,
  "testedAt" timestamptz,
  "returnedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warranty_cases_status_check CHECK (status IN ('RECEIVED','REPAIRED','TESTED','RETURNED'))
);

CREATE INDEX IF NOT EXISTS warranty_cases_status_updated_idx ON warranty_cases(status, "updatedAt" DESC);
