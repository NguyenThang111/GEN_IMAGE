ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "reviewResult" varchar(16);
