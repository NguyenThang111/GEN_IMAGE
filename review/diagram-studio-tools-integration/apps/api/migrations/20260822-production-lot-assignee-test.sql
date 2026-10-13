CREATE TABLE IF NOT EXISTS production_lot_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lotId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_lot_assignees_lot_user_unique UNIQUE ("lotId", "userId"),
  CONSTRAINT production_lot_assignees_lot_fk FOREIGN KEY ("lotId") REFERENCES production_lots(id) ON DELETE CASCADE,
  CONSTRAINT production_lot_assignees_user_fk FOREIGN KEY ("userId") REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS production_lot_assignees_lot_idx
  ON production_lot_assignees ("lotId");

CREATE INDEX IF NOT EXISTS production_lot_assignees_user_idx
  ON production_lot_assignees ("userId");

INSERT INTO production_lot_assignees ("lotId", "userId")
SELECT DISTINCT pel."lotId", pe."userId"
FROM production_entry_lots pel
JOIN production_entries pe ON pe.id = pel."entryId"
ON CONFLICT ("lotId", "userId") DO NOTHING;

ALTER TABLE production_lots
  ADD COLUMN IF NOT EXISTS "testedById" uuid,
  ADD COLUMN IF NOT EXISTS "testedAt" timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'CLAIMED'
      AND enumtypid = 'production_lot_event_type'::regtype
  ) THEN
    ALTER TYPE production_lot_event_type ADD VALUE 'CLAIMED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'TESTED'
      AND enumtypid = 'production_lot_event_type'::regtype
  ) THEN
    ALTER TYPE production_lot_event_type ADD VALUE 'TESTED';
  END IF;
END $$;
