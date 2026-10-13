DO $$ BEGIN CREATE TYPE production_payment_status AS ENUM ('REQUESTED','PAID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS production_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batchKey" text NOT NULL UNIQUE,
  "userId" uuid NOT NULL REFERENCES users(id),
  "sessionIds" uuid[] NOT NULL,
  "totalHours" numeric(6,2) NOT NULL,
  "workSummary" jsonb NOT NULL DEFAULT '[]'::jsonb,
  status production_payment_status NOT NULL DEFAULT 'REQUESTED',
  "paidById" uuid REFERENCES users(id),
  "paidAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE production_payment_requests ADD COLUMN IF NOT EXISTS "batchKey" text;
UPDATE production_payment_requests SET "batchKey" = id::text WHERE "batchKey" IS NULL;
ALTER TABLE production_payment_requests ALTER COLUMN "batchKey" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS production_payment_batch_key_idx ON production_payment_requests ("batchKey");

CREATE INDEX IF NOT EXISTS production_payment_user_status_idx ON production_payment_requests ("userId", status);
