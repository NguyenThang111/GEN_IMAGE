BEGIN;

UPDATE purchase_requests
SET
  "receivedQty" = COALESCE("receivedQty", "requestedQty"),
  "receivedAt" = COALESCE("receivedAt", "updatedAt")
WHERE status = 'RECEIVED'
  AND ("receivedQty" IS NULL OR "receivedAt" IS NULL);

COMMIT;
