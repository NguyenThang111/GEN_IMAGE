BEGIN;
ALTER TABLE production_lots DROP CONSTRAINT IF EXISTS production_lots_action_type_check;
ALTER TABLE production_lots ADD CONSTRAINT production_lots_action_type_check
  CHECK ("actionType" IN ('ASSEMBLE','PACK','TEST','SOLDER'));
COMMIT;
