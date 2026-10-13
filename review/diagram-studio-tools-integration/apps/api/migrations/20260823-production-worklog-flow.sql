DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WAITING_TEST' AND enumtypid = 'production_lot_status'::regtype) THEN
    ALTER TYPE production_lot_status ADD VALUE 'WAITING_TEST';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TESTING' AND enumtypid = 'production_lot_status'::regtype) THEN
    ALTER TYPE production_lot_status ADD VALUE 'TESTING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STARTED' AND enumtypid = 'production_lot_event_type'::regtype) THEN
    ALTER TYPE production_lot_event_type ADD VALUE 'STARTED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAUSED' AND enumtypid = 'production_lot_event_type'::regtype) THEN
    ALTER TYPE production_lot_event_type ADD VALUE 'PAUSED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PRODUCTION_FINISHED' AND enumtypid = 'production_lot_event_type'::regtype) THEN
    ALTER TYPE production_lot_event_type ADD VALUE 'PRODUCTION_FINISHED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TEST_CLAIMED' AND enumtypid = 'production_lot_event_type'::regtype) THEN
    ALTER TYPE production_lot_event_type ADD VALUE 'TEST_CLAIMED';
  END IF;
END $$;

ALTER TABLE production_lots
  ADD COLUMN IF NOT EXISTS "producedQuantity" integer,
  ADD COLUMN IF NOT EXISTS "failedQuantity" integer,
  ADD COLUMN IF NOT EXISTS "accumulatedMinutes" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "activeById" uuid,
  ADD COLUMN IF NOT EXISTS "activeStartedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "workStartedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "workEndedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "testClaimedById" uuid,
  ADD COLUMN IF NOT EXISTS "testClaimedAt" timestamptz;
