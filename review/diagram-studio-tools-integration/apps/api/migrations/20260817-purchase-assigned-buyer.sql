BEGIN;

ALTER TABLE purchase_requests
  ADD COLUMN IF NOT EXISTS "assignedBuyerId" uuid;

CREATE INDEX IF NOT EXISTS purchase_requests_assigned_buyer_idx
  ON purchase_requests ("assignedBuyerId");

COMMIT;
