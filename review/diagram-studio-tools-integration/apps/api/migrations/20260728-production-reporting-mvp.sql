DO $$ BEGIN CREATE TYPE production_module AS ENUM ('CABLE','DEVICE','PACKING','TEST','SUPPORT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE production_output_type AS ENUM ('FINISHED_PRODUCT','SELLABLE_PRODUCT','LABEL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS production_work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id),
  "workDate" date NOT NULL,
  "isRegistered" boolean NOT NULL DEFAULT false,
  "hoursWorked" numeric(5,2),
  "sourceKey" text,
  "updatedById" uuid NOT NULL REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("userId", "workDate")
);

CREATE TABLE IF NOT EXISTS production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id),
  "workDate" date NOT NULL,
  module production_module NOT NULL,
  "workType" text NOT NULL,
  "outputType" production_output_type NOT NULL DEFAULT 'LABEL',
  "outputId" uuid,
  "outputLabel" text NOT NULL,
  quantity integer,
  "progressPercent" numeric(5,2),
  note text,
  "rawText" text,
  "needsReview" boolean NOT NULL DEFAULT false,
  "sourceKey" text UNIQUE,
  "createdById" uuid NOT NULL REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity IS NULL OR quantity >= 0),
  CHECK ("progressPercent" IS NULL OR ("progressPercent" >= 0 AND "progressPercent" <= 100))
);

CREATE INDEX IF NOT EXISTS production_sessions_date_idx ON production_work_sessions ("workDate");
CREATE INDEX IF NOT EXISTS production_entries_date_user_idx ON production_entries ("workDate", "userId");
