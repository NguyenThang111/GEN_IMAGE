ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "checkAssignedToId" uuid;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "checkRequestNote" text;
