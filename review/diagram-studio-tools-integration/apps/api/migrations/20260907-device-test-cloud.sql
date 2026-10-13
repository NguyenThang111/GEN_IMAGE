CREATE TABLE IF NOT EXISTS device_test_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "stationCode" text NOT NULL UNIQUE,
  "displayName" text NOT NULL,
  "apiKeyHash" text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "lastSeenAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_test_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "outputType" production_output_type NOT NULL,
  "outputId" uuid NOT NULL,
  "testProfileKey" text NOT NULL,
  "testProfileVersion" integer NOT NULL CHECK ("testProfileVersion" > 0),
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_test_profiles_output_unique UNIQUE ("outputType", "outputId")
);

ALTER TABLE production_lots
  ADD COLUMN IF NOT EXISTS "testProfileKey" text,
  ADD COLUMN IF NOT EXISTS "testProfileVersion" integer,
  ADD COLUMN IF NOT EXISTS "testStationId" uuid,
  ADD COLUMN IF NOT EXISTS "deviceTestStartedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "deviceTestTargetPassCount" integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_lots_test_station_fk') THEN
    ALTER TABLE production_lots ADD CONSTRAINT production_lots_test_station_fk
      FOREIGN KEY ("testStationId") REFERENCES device_test_stations(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS production_lots_one_active_per_station_idx
  ON production_lots ("testStationId")
  WHERE status = 'TESTING' AND "testStationId" IS NOT NULL AND "deletedAt" IS NULL;

CREATE TABLE IF NOT EXISTS production_lot_device_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lotId" uuid NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  "stationId" uuid NOT NULL REFERENCES device_test_stations(id) ON DELETE RESTRICT,
  "testRunId" text NOT NULL,
  "testProfileKey" text NOT NULL,
  "testProfileVersion" integer NOT NULL CHECK ("testProfileVersion" > 0),
  result text NOT NULL CHECK (result IN ('PASS', 'FAIL')),
  measurements jsonb,
  "testedAt" timestamptz NOT NULL,
  "receivedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_lot_device_tests_station_run_unique UNIQUE ("stationId", "testRunId")
);

CREATE INDEX IF NOT EXISTS production_lot_device_tests_lot_idx
  ON production_lot_device_tests ("lotId");

ALTER TABLE production_lot_device_tests ADD COLUMN IF NOT EXISTS "requestHash" text;

CREATE TABLE IF NOT EXISTS device_test_lot_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lotId" uuid NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  "stationId" uuid NOT NULL REFERENCES device_test_stations(id) ON DELETE RESTRICT,
  "releaseRequestId" text NOT NULL,
  "releasedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_test_lot_releases_station_request_unique UNIQUE ("stationId", "releaseRequestId")
);

CREATE INDEX IF NOT EXISTS device_test_lot_releases_lot_idx
  ON device_test_lot_releases ("lotId");
