CREATE TABLE IF NOT EXISTS pcb_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product varchar(16) NOT NULL UNIQUE,
  "fileName" varchar(180) NOT NULL,
  "mimeType" varchar(80) NOT NULL DEFAULT 'text/html',
  "byteSize" integer NOT NULL,
  html bytea NOT NULL,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  "progressVersion" integer NOT NULL DEFAULT 0,
  "createdById" uuid NOT NULL REFERENCES users(id),
  "updatedById" uuid NOT NULL REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
