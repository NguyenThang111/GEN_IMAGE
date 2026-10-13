BEGIN;

UPDATE inventory_items
SET unit = 'unit'
WHERE unit IS NULL;

ALTER TABLE inventory_items
  ALTER COLUMN unit SET DEFAULT 'unit',
  ALTER COLUMN unit SET NOT NULL;

COMMIT;
