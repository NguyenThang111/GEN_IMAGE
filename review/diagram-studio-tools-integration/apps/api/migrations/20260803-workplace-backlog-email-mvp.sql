ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipientUserId" uuid NOT NULL REFERENCES users(id),
  "recipientEmail" varchar,
  "eventType" varchar(40) NOT NULL,
  "dedupeKey" varchar(180) NOT NULL UNIQUE,
  subject varchar(240) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  "attemptCount" smallint NOT NULL DEFAULT 0,
  "lastError" text,
  "availableAt" timestamptz,
  "sentAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_outbox_pending_idx
  ON email_outbox (status, "availableAt", "createdAt");
