BEGIN;

CREATE TABLE IF NOT EXISTS system_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipientId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "actorId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module varchar(32) NOT NULL,
  "eventType" varchar(64) NOT NULL,
  "entityType" varchar(40) NOT NULL,
  "entityId" uuid NOT NULL,
  "entityLabel" varchar(200) NOT NULL,
  message varchar(180) NOT NULL,
  "bodyPreview" text,
  "dedupeKey" varchar(220) NOT NULL,
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_notifications_recipient_dedupe_unique UNIQUE ("recipientId", "dedupeKey")
);

CREATE INDEX IF NOT EXISTS system_notifications_recipient_created_idx
  ON system_notifications ("recipientId", "createdAt" DESC);

COMMIT;
