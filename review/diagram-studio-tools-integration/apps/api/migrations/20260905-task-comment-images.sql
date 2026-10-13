ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS "imageMimeType" varchar;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS "imageByteSize" integer;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS "imageData" bytea;
