ALTER TABLE production_lots ADD COLUMN IF NOT EXISTS "actionType" text;

UPDATE production_lots
SET "actionType" = CASE
  WHEN "outputType" = 'SELLABLE_PRODUCT' THEN 'PACK'
  ELSE 'ASSEMBLE'
END
WHERE "actionType" IS NULL;

ALTER TABLE production_lots ALTER COLUMN "actionType" SET DEFAULT 'ASSEMBLE';
ALTER TABLE production_lots ALTER COLUMN "actionType" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE production_lots
    ADD CONSTRAINT production_lots_action_type_check
    CHECK ("actionType" IN ('ASSEMBLE','PACK','TEST'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
