BEGIN;

DO $$ BEGIN
  CREATE TYPE purchase_payment_status AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "paymentStatus" purchase_payment_status NOT NULL DEFAULT 'UNPAID';
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "orderedAt" timestamptz;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "receivedAt" timestamptz;

COMMIT;
