BEGIN;

ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "orderUrl" text;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "orderCode" varchar(160);

COMMIT;
