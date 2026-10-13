ALTER TABLE production_entries
  ADD COLUMN IF NOT EXISTS "reportItems" jsonb NOT NULL DEFAULT '[]'::jsonb;
