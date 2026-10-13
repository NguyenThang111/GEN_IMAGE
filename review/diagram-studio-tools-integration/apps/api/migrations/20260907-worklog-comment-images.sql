ALTER TABLE "worklog_comments"
  ADD COLUMN IF NOT EXISTS "imageMimeType" varchar,
  ADD COLUMN IF NOT EXISTS "imageByteSize" integer,
  ADD COLUMN IF NOT EXISTS "imageData" bytea;
