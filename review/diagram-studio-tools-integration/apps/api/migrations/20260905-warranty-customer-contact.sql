ALTER TABLE warranty_cases ADD COLUMN IF NOT EXISTS "customerName" varchar(160);
ALTER TABLE warranty_cases ADD COLUMN IF NOT EXISTS "customerAddress" varchar(320);
