BEGIN;

CREATE TABLE IF NOT EXISTS diagram_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId" varchar(120) NOT NULL UNIQUE,
  "vehicleTitle" varchar(180) NOT NULL,
  manufacturer varchar(100),
  "modelYear" varchar(40),
  "ecmId" varchar(120),
  "scuId" varchar(120),
  status varchar(16) NOT NULL DEFAULT 'ACTIVE',
  "createdById" uuid NOT NULL,
  "updatedById" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagram_projects_status_check CHECK (status IN ('ACTIVE','ARCHIVED'))
);

CREATE TABLE IF NOT EXISTS diagram_circuits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES diagram_projects(id) ON DELETE CASCADE,
  "circuitKey" varchar(100) NOT NULL,
  "circuitTitle" varchar(180) NOT NULL,
  position integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT true,
  status varchar(24) NOT NULL DEFAULT 'REGISTERED',
  "sourceFileName" varchar(255),
  "sourceMimeType" varchar(40),
  "sourceByteSize" integer,
  "sourceImage" bytea,
  schema jsonb,
  "aiReview" jsonb,
  "validationErrors" jsonb,
  "generatedByModel" varchar(80),
  "updatedById" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagram_circuits_project_key_unique UNIQUE ("projectId", "circuitKey"),
  CONSTRAINT diagram_circuits_status_check CHECK (status IN ('REGISTERED','MISSING_OUTPUT','NEEDS_REVIEW','DRAFT_READY','LAYOUT_REVIEWED','ELECTRICALLY_REVIEWED'))
);

CREATE INDEX IF NOT EXISTS diagram_projects_status_updated_idx ON diagram_projects (status, "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS diagram_circuits_project_position_idx ON diagram_circuits ("projectId", position);

COMMIT;
