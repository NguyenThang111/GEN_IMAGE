-- Nullable for historical registrations; no backfill or change to hours/payments.
ALTER TABLE production_work_sessions
  ADD COLUMN IF NOT EXISTS "plannedStartTime" varchar(5)
  CHECK ("plannedStartTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
