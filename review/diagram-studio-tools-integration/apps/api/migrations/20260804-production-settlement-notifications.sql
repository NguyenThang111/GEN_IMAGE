CREATE TABLE IF NOT EXISTS production_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipientId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "paymentRequestId" uuid NOT NULL REFERENCES production_payment_requests(id) ON DELETE CASCADE,
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_notifications_recipient_payment_unique UNIQUE ("recipientId", "paymentRequestId")
);

CREATE INDEX IF NOT EXISTS production_notifications_recipient_created_idx
  ON production_notifications ("recipientId", "createdAt" DESC);
