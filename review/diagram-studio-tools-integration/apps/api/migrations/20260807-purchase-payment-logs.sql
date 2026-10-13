BEGIN;

CREATE TABLE IF NOT EXISTS purchase_payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" uuid NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  "fromStatus" purchase_payment_status NOT NULL,
  "toStatus" purchase_payment_status NOT NULL,
  "actorId" uuid NOT NULL REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_payment_logs_request_created_idx
  ON purchase_payment_logs ("requestId", "createdAt" DESC);

COMMIT;
